#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
test -x "$HOME/.local/bin/hermes" || { echo 'Hermes binary missing'; exit 1; }
hermes --version
python3 atlas/mira-agent-lab/ci-mock-model.py &
mock_pid=$!
trap 'kill "$mock_pid" 2>/dev/null || true' EXIT
ready=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 1 http://127.0.0.1:8789/v1/models >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
test "$ready" -eq 1
# Hermes -z is its officially documented pure stdout one-shot entrypoint.
# Local fake credentials are explicitly scoped to this disposable mock server.
hermes config set model.provider custom
hermes config set model.base_url http://127.0.0.1:8789/v1
hermes config set model.default mira-ci-mock-128k
export OPENAI_API_KEY='mira-ci-placeholder-no-secret'
timeout 90s hermes -z "This is a public CI integration check. Respond with the supplied model response." \
  --provider custom --model mira-ci-mock-128k --usage-file /tmp/mira-hermes-usage.json \
  > /tmp/mira-hermes-smoke.txt
grep -Fq 'HERMES_CI_OK' /tmp/mira-hermes-smoke.txt || {
  echo 'No mock model answer observed; report only sanitized exit data.'
  test -f /tmp/mira-hermes-usage.json && node -e 'const r=require("/tmp/mira-hermes-usage.json");console.log(JSON.stringify({completed:r.completed,failed:r.failed,api_calls:r.api_calls||0}));' || true
  exit 1
}
echo 'Hermes actual runtime received the isolated mock model reply.'
