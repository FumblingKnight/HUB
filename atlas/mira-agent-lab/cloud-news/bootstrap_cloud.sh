#!/usr/bin/env bash
# One-time owner-run bootstrap for the cloud Mira Newspaper.
# Secrets are sent directly to GitHub Actions or macOS Keychain and are never echoed.
set -euo pipefail

HUB_REPO="FumblingKnight/HUB"
PRIVATE_REPO="FumblingKnight/Sajo-Atlas"
WORKFLOW="mira-newspaper-cloud.yml"
KEYCHAIN_SERVICE="mira-hermes-cloud-auth-key"
BOOT_HOME="${HOME}/.hermes-mira-cloud-bootstrap"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/mira-cloud-bootstrap.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

need() { command -v "$1" >/dev/null || { echo "Missing required command: $1" >&2; exit 2; }; }
for x in gh hermes python3 git ssh-keygen security; do need "$x"; done
gh auth status >/dev/null

echo "[1/7] Keeping scheduled cloud runs disabled until acceptance tests pass."
gh variable set MIRA_NEWSPAPER_CLOUD_ENABLED -R "$HUB_REPO" --body false

echo "[2/7] Configuring write deploy key for private newspaper state."
if ! gh secret list -R "$HUB_REPO" | cut -f1 | grep -Fxq MIRA_SAJO_DEPLOY_KEY; then
  old_id="$(gh api "repos/$PRIVATE_REPO/keys" --jq '.[] | select(.title=="Mira Newspaper GitHub Actions") | .id' | head -n1 || true)"
  if [[ -n "$old_id" ]]; then gh api "repos/$PRIVATE_REPO/keys/$old_id" -X DELETE >/dev/null; fi
  ssh-keygen -q -t ed25519 -N '' -C 'mira-newspaper-github-actions' -f "$TMP/deploy"
  gh api "repos/$PRIVATE_REPO/keys" -X POST     -f title='Mira Newspaper GitHub Actions'     -f key="$(cat "$TMP/deploy.pub")" -F read_only=false >/dev/null
  gh secret set MIRA_SAJO_DEPLOY_KEY -R "$HUB_REPO" < "$TMP/deploy"
fi

echo "[3/7] Configuring encryption key for the dedicated cloud OAuth credential."
AUTH_KEY="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
if [[ -z "$AUTH_KEY" ]]; then
  # Do not replace a key if an encrypted credential already exists and the local recovery key is gone.
  if gh api "repos/$PRIVATE_REPO/contents/mira/newspaper/cloud/auth.enc" >/dev/null 2>&1; then
    echo "Encrypted cloud auth already exists but its local recovery key is missing." >&2
    echo "Stop here rather than overwriting it. Remove/re-bootstrap auth deliberately." >&2
    exit 3
  fi
  AUTH_KEY="$(python3 - <<'PY'
import base64,secrets
print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("="))
PY
)"
  security add-generic-password -U -a "$USER" -s "$KEYCHAIN_SERVICE" -w "$AUTH_KEY" >/dev/null
fi
printf '%s' "$AUTH_KEY" | gh secret set MIRA_HERMES_AUTH_KEY_B64 -R "$HUB_REPO"

echo "[4/7] Configuring Discord secrets when a bot token is available."
DISCORD_TOKEN="$(pbpaste 2>/dev/null | tr -d '\r\n' || true)"
if ! python3 - "$DISCORD_TOKEN" <<'PY'
import re,sys
raise SystemExit(0 if re.fullmatch(r"[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{15,}",sys.argv[1] if len(sys.argv)>1 else "") else 1)
PY
then
  read -r -s -p "Discord bot token (leave blank to skip Discord for now): " DISCORD_TOKEN
  echo
fi
if [[ -n "$DISCORD_TOKEN" ]]; then
  read -r DISCORD_USER_ID DISCORD_APP_ID < <(DISCORD_BOT_TOKEN="$DISCORD_TOKEN" python3 - <<'PY'
import json,os,urllib.request
t=os.environ["DISCORD_BOT_TOKEN"]
h={"Authorization":"Bot "+t,"User-Agent":"MiraCloudBootstrap/1.0"}
with urllib.request.urlopen(urllib.request.Request("https://discord.com/api/v10/oauth2/applications/@me",headers=h),timeout=15) as r:
    d=json.load(r)
u=str((d.get("owner") or {}).get("id") or "")
app=str(d.get("id") or "")
if not u.isdigit() or not app.isdigit(): raise SystemExit("Unable to identify Discord application owner")
print(u,app)
PY
)

  discord_dm_test() {
    DISCORD_BOT_TOKEN="$DISCORD_TOKEN" DISCORD_USER_ID="$DISCORD_USER_ID" python3 - <<'PY'
import json,os,urllib.request
from urllib.error import HTTPError
t=os.environ["DISCORD_BOT_TOKEN"];u=os.environ["DISCORD_USER_ID"]
h={"Authorization":"Bot "+t,"Content-Type":"application/json","User-Agent":"MiraCloudBootstrap/1.0"}
try:
    req=urllib.request.Request("https://discord.com/api/v10/users/@me/channels",method="POST",headers=h,data=json.dumps({"recipient_id":u}).encode())
    with urllib.request.urlopen(req,timeout=15) as r: channel=json.load(r)["id"]
    msg={"content":"Mira cloud Discord link verified. Urgent alerts and morning-edition notices will use this DM."}
    req=urllib.request.Request("https://discord.com/api/v10/channels/"+channel+"/messages",method="POST",headers=h,data=json.dumps(msg).encode())
    with urllib.request.urlopen(req,timeout=15) as r:
        raise SystemExit(0 if 200 <= r.status < 300 else 1)
except HTTPError:
    raise SystemExit(1)
PY
  }

  if ! discord_dm_test; then
    INVITE="https://discord.com/oauth2/authorize?client_id=$DISCORD_APP_ID&scope=bot%20applications.commands&permissions=2048"
    echo "Discord cannot DM you yet. The bot normally needs one mutual server first."
    echo "Opening its invite page; add it to a server you control, then return here."
    open "$INVITE" >/dev/null 2>&1 || echo "Open this URL manually: $INVITE"
    read -r -p "Press Enter after the bot has joined a server you share: "
    discord_dm_test || { echo "Discord DM test still failed; refusing silent alert setup." >&2; exit 4; }
  fi

  printf '%s' "$DISCORD_TOKEN" | gh secret set MIRA_DISCORD_BOT_TOKEN -R "$HUB_REPO"
  printf '%s' "$DISCORD_USER_ID" | gh secret set MIRA_DISCORD_USER_ID -R "$HUB_REPO"
  echo "Discord DM delivery verified."
  unset DISCORD_TOKEN
else
  echo "Discord skipped. Newspaper cloud setup can still complete."
fi

echo "[5/7] Creating a DEDICATED Codex OAuth identity for GitHub Actions."
echo "This intentionally does not reuse ~/.hermes/auth.json."
mkdir -p "$BOOT_HOME"; chmod 700 "$BOOT_HOME"
AUTH_STATUS="$(HERMES_HOME="$BOOT_HOME" hermes auth status openai-codex 2>&1 || true)"
if ! grep -Eqi 'openai-codex:.*logged in' <<<"$AUTH_STATUS"; then
  echo
  echo "Approve the OpenAI/Codex device login shown below. This is the one manual browser step."
  HERMES_HOME="$BOOT_HOME" hermes auth add openai-codex --type oauth --no-browser
fi
AUTH_STATUS="$(HERMES_HOME="$BOOT_HOME" hermes auth status openai-codex 2>&1 || true)"
grep -Eqi 'openai-codex:.*logged in' <<<"$AUTH_STATUS" || {
  echo "Dedicated Codex login did not become active." >&2
  exit 5
}
echo "Dedicated cloud Codex login verified."

echo "[6/7] Encrypting the dedicated OAuth state into the private repository."
gh repo clone "$PRIVATE_REPO" "$TMP/private" -- --depth 1 >/dev/null
MIRA_HERMES_AUTH_KEY_B64="$AUTH_KEY" python3 "$SCRIPT_DIR/auth_blob.py" seal   "$BOOT_HOME/auth.json" "$TMP/private/mira/newspaper/cloud/auth.enc"
(
  cd "$TMP/private"
  git add mira/newspaper/cloud/auth.enc
  if ! git diff --cached --quiet; then
    git config user.name "Mira Cloud Bootstrap"
    git config user.email "299255337+FumblingKnight@users.noreply.github.com"
    git commit -q -m "Mira newspaper: bootstrap dedicated cloud OAuth"
    git push -q origin HEAD:main
  fi
)

dispatch_and_wait() {
  local mode="$1"
  local before=""
  before="$(gh run list -R "$HUB_REPO" --workflow "$WORKFLOW" --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)"
  gh workflow run "$WORKFLOW" -R "$HUB_REPO" -f mode="$mode"
  local id=""
  for _ in {1..30}; do
    sleep 2
    id="$(gh run list -R "$HUB_REPO" --workflow "$WORKFLOW" --event workflow_dispatch --limit 1 --json databaseId,status --jq '.[0].databaseId // empty')"
    [[ -n "$id" && "$id" != "$before" ]] && break
    id=""
  done
  [[ -n "$id" ]] || { echo "Could not locate new $mode workflow run." >&2; return 1; }
  echo "Watching $mode run #$id"
  gh run watch "$id" -R "$HUB_REPO" --exit-status
}

echo "[7/8] Running cloud acceptance: auth, hourly, then premium morning."
dispatch_and_wait auth-check
dispatch_and_wait hourly
dispatch_and_wait morning

echo "All cloud acceptance runs passed."
echo "[8/8] Cutting over from Mac scheduling to GitHub Actions."
# Pause only after every cloud acceptance run succeeded. A pause failure stops here,
# leaving the GitHub schedule disabled so two writers never compete for current.json.
for job in eceb21ddbc4b ce1a79bbcff4 59135974381b; do
  if hermes cron list --all | grep -Fq "$job [active]"; then
    hermes cron pause "$job"
  fi
done
for job in eceb21ddbc4b ce1a79bbcff4 59135974381b; do
  if hermes cron list --all | grep -Fq "$job [active]"; then
    echo "Local Hermes job $job is still active; refusing to arm cloud schedules." >&2
    exit 8
  fi
done

gh variable set MIRA_NEWSPAPER_CLOUD_ENABLED -R "$HUB_REPO" --body true
echo "Scheduled cloud editor ENABLED; old Mac newspaper writers are paused."
echo "Cloud newspaper: https://sajo-atlas.thefumblingknight.workers.dev/newspaper.html"
echo
echo "Rollback if ever needed: set MIRA_NEWSPAPER_CLOUD_ENABLED=false, then resume the three Mac jobs."
echo "Return to ChatGPT and say: cloud bootstrap passed"
