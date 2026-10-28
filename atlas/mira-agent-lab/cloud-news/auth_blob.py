#!/usr/bin/env python3
"""Encrypt/decrypt Hermes OAuth state for an ephemeral GitHub runner."""
from __future__ import annotations
from pathlib import Path
import argparse, base64, json, os, secrets
AAD=b"mira-hermes-cloud-auth-v1"

def key_from_env() -> bytes:
    raw=os.environ.get("MIRA_HERMES_AUTH_KEY_B64","").strip()
    try:key=base64.urlsafe_b64decode(raw+"="*((4-len(raw)%4)%4))
    except Exception as exc:raise SystemExit("Invalid MIRA_HERMES_AUTH_KEY_B64") from exc
    if len(key)!=32:raise SystemExit("MIRA_HERMES_AUTH_KEY_B64 must decode to 32 bytes")
    return key

def aesgcm():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        return AESGCM
    except ImportError as exc:raise SystemExit("cryptography package required") from exc

def seal(src:Path,dst:Path):
    raw=src.read_bytes()
    try:data=json.loads(raw)
    except Exception as exc:raise SystemExit("Auth source is not valid JSON") from exc
    if not isinstance(data,dict) or "providers" not in data:raise SystemExit("Auth source does not look like Hermes auth.json")
    nonce=secrets.token_bytes(12);enc=aesgcm()(key_from_env()).encrypt(nonce,raw,AAD)
    blob={"version":1,"alg":"AES-256-GCM","nonce":base64.b64encode(nonce).decode(),
          "ciphertext":base64.b64encode(enc).decode()}
    dst.parent.mkdir(parents=True,exist_ok=True)
    tmp=dst.with_suffix(dst.suffix+".tmp");tmp.write_text(json.dumps(blob,separators=(",",":"))+"\n")
    os.chmod(tmp,0o600);tmp.replace(dst)

def open_blob(src:Path,dst:Path):
    try:blob=json.loads(src.read_text())
    except Exception as exc:raise SystemExit("Encrypted auth blob invalid") from exc
    if blob.get("version")!=1 or blob.get("alg")!="AES-256-GCM":raise SystemExit("Unsupported auth blob")
    try:
        nonce=base64.b64decode(blob["nonce"]);enc=base64.b64decode(blob["ciphertext"])
        raw=aesgcm()(key_from_env()).decrypt(nonce,enc,AAD);data=json.loads(raw)
    except Exception as exc:raise SystemExit("Unable to decrypt Hermes auth blob") from exc
    if not isinstance(data,dict) or "providers" not in data:raise SystemExit("Decrypted auth is not Hermes auth.json")
    dst.parent.mkdir(parents=True,exist_ok=True)
    tmp=dst.with_suffix(dst.suffix+".tmp");tmp.write_bytes(raw);os.chmod(tmp,0o600);tmp.replace(dst)

def main():
    ap=argparse.ArgumentParser();sub=ap.add_subparsers(dest="cmd",required=True)
    for cmd in ("seal","open"):
        p=sub.add_parser(cmd);p.add_argument("src",type=Path);p.add_argument("dst",type=Path)
    sub.add_parser("generate-key");args=ap.parse_args()
    if args.cmd=="generate-key":
        print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("="));return
    (seal if args.cmd=="seal" else open_blob)(args.src,args.dst)

if __name__=="__main__":main()
