#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
test -x "$HOME/.local/bin/hermes" || { echo 'Hermes binary missing'; exit 1; }
hermes --version
python3 -u atlas/mira-agent-lab/ci-mock-model.py &
mock_pid=$!
trap 'kill "$mock_pid" 2>/dev/null || true' EXIT
ready=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 1 http://127.0.0.1:8789/v1/models >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
test "$ready" -eq 1
hermes config set model.provider custom
hermes config set model.base_url http://127.0.0.1:8789/v1
hermes config set model.default mira-ci-mock-128k
export OPENAI_API_KEY='mira-ci-placeholder-no-secret'
set +e
timeout 80s hermes -z "Public CI integration check. Return the supplied model response." \
  --provider custom --model mira-ci-mock-128k --usage-file /tmp/mira-hermes-usage.json \
  > /tmp/mira-hermes-smoke.txt 2> /tmp/mira-hermes-stderr.txt
rc=$?
set -e
if [[ "$rc" -eq 0 ]] && grep -Fq 'HERMES_CI_OK' /tmp/mira-hermes-smoke.txt; then
  echo 'Hermes runtime received an isolated fixed-response mock model reply.'
  exit 0
fi
echo "Hermes -z did not produce the mock reply (exit=$rc)."
echo 'Captured stdout (public fixed prompt only):'
head -c 400 /tmp/mira-hermes-smoke.txt || true
echo
echo 'Captured stderr (public fixed prompt only):'
tail -c 1300 /tmp/mira-hermes-stderr.txt || true
echo
if test -f /tmp/mira-hermes-usage.json; then
  node -e 'const r=require("/tmp/mira-hermes-usage.json");console.log(JSON.stringify({completed:r.completed,failed:r.failed,api_calls:r.api_calls||0,provider:r.provider,model:r.model}));'
fi
echo 'Available local diagnostic log file names:'
find "$HOME/.hermes/logs" -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | head -n 10 || true
# Do not print log contents: future runs might contain credentials or private text.
exit 1
