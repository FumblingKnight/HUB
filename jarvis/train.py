#!/usr/bin/env python3
"""Run on Kaggle GPU, not your Mac. Genuine LoRA training, not a memory lookup."""
import json
import os
import random
from pathlib import Path
from dataclasses import dataclass
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments
from peft import LoraConfig, get_peft_model, PeftModel

BASE_MODEL = "google/gemma-2b-it"
DATA = Path(os.getenv("TRAIN_JSONL", "./jarvis-training.jsonl"))
OUT = Path(os.getenv("OUTPUT_DIR", "/kaggle/working/jarvis-adapter" if Path("/kaggle/working").exists() else "./jarvis-adapter"))
PRIOR_ADAPTER = os.getenv("PRIOR_ADAPTER")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "384"))
if not torch.cuda.is_available():
    raise SystemExit("CUDA GPU required. Run in Kaggle, not on the M2 Mac.")
if not DATA.exists():
    raise SystemExit("Training data missing: " + str(DATA))
examples = []
for line_no, line in enumerate(DATA.read_text(encoding="utf8").splitlines(), 1):
    if not line.strip():
        continue
    row = json.loads(line)
    if row.get("verified") is not True or not isinstance(row.get("prompt"), str) or not isinstance(row.get("ideal"), str):
        raise SystemExit("Invalid or unverified example at line " + str(line_no))
    if row["prompt"].strip() and row["ideal"].strip():
        examples.append(row)
if len(examples) < 12:
    raise SystemExit("At least 12 verified examples required for this demonstration.")
random.Random(2026).shuffle(examples)
holdout_count = max(2, len(examples) // 5)
holdout, train_rows = examples[:holdout_count], examples[holdout_count:]
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "holdout.jsonl").write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in holdout), encoding="utf8")

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float16, device_map="auto")
model.config.use_cache = False
if PRIOR_ADAPTER:
    model = PeftModel.from_pretrained(model, PRIOR_ADAPTER, is_trainable=True)
else:
    model = get_peft_model(model, LoraConfig(
        r=8, lora_alpha=16, lora_dropout=0.05, bias="none",
        task_type="CAUSAL_LM", target_modules=["q_proj", "v_proj"]
    ))
model.print_trainable_parameters()

class Lessons(torch.utils.data.Dataset):
    def __len__(self):
        return len(train_rows)
    def __getitem__(self, index):
        row = train_rows[index]
        prefix = tokenizer.apply_chat_template(
            [{"role": "user", "content": row["prompt"]}],
            tokenize=False, add_generation_prompt=True
        )
        full = prefix + row["ideal"] + tokenizer.eos_token
        prefix_ids = tokenizer(prefix, add_special_tokens=False)["input_ids"]
        encoded = tokenizer(full, add_special_tokens=False, truncation=True, max_length=MAX_LENGTH)
        labels = list(encoded["input_ids"])
        if len(prefix_ids) >= len(labels):
            raise ValueError("Training example longer than MAX_LENGTH: shorten it.")
        labels[:len(prefix_ids)] = [-100] * len(prefix_ids)
        return {"input_ids": encoded["input_ids"], "attention_mask": encoded["attention_mask"], "labels": labels}

@dataclass
class PadBatch:
    pad_id: int
    def __call__(self, rows):
        length = max(len(x["input_ids"]) for x in rows)
        return {
            "input_ids": torch.tensor([x["input_ids"] + [self.pad_id] * (length - len(x["input_ids"])) for x in rows]),
            "attention_mask": torch.tensor([x["attention_mask"] + [0] * (length - len(x["attention_mask"])) for x in rows]),
            "labels": torch.tensor([x["labels"] + [-100] * (length - len(x["labels"])) for x in rows])
        }

args = TrainingArguments(
    output_dir=str(OUT / "checkpoints"), per_device_train_batch_size=1,
    gradient_accumulation_steps=4, num_train_epochs=2,
    learning_rate=1e-4, logging_steps=5, fp16=True, bf16=False,
    report_to="none", save_strategy="no", remove_unused_columns=False,
    optim="adamw_torch"
)
Trainer(model=model, args=args, train_dataset=Lessons(),
        data_collator=PadBatch(tokenizer.pad_token_id)).train()
model.save_pretrained(OUT, safe_serialization=True)
config_path = OUT / "adapter_config.json"
config = json.loads(config_path.read_text())
config["model_type"] = "gemma"
config_path.write_text(json.dumps(config, indent=2) + "\n")
assert (OUT / "adapter_model.safetensors").exists()
print("Ready:", OUT, "Holdout:", OUT / "holdout.jsonl")
print("Upload ONLY adapter_config.json and adapter_model.safetensors to Cloudflare.")
