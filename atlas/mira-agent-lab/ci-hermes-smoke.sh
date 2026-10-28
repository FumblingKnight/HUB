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
# Explicitly no API secrets, no GitHub credentials, no personal data.
# Use a single request, 1 tool-turn maximum, and a fake model; a mock response is NOT live AI inference.
timeout 90s hermes chat --oneshot --quiet --provider custom \
  --base-url http://127.0.0.1:8789/v1 \
  --api-key 'mira-ci-placeholder-no-secret' \
  --model mira-ci-mock-128k \
  --max-turns 1 --safe-mode --ignore-user-config --ignore-rules \
  -q "This is a public CI integration check. Respond with the supplied model response." \
  > /tmp/mira-hermes-smoke.txt
grep -Fq 'HERMES_CI_OK' /tmp/mira-hermes-smoke.txt
echo 'Hermes actual runtime invoked an isolated OpenAI-compatible endpoint successfully.'
