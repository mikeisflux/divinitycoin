#!/bin/bash
# deploy.sh — pull, build and restart DivinityCoin.
#
# Usage:
#   ./scripts/deploy.sh                  # deploy the branch already checked out
#   ./scripts/deploy.sh <branch>         # deploy a specific branch
#   ./scripts/deploy.sh --no-pull        # rebuild and restart what is on disk
#
# The sequence here is section 3 of .claude/CLAUDE.md plus what the September
# 2026 outages taught. Read the comments before "simplifying" any of it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="divinitycoin"

cd "$APP_DIR"

# Never default to main. main holds two files; deploying it would wipe the
# site. The safe default is whatever is already checked out.
PULL=1
BRANCH=""
for arg in "$@"; do
    case "$arg" in
        --no-pull) PULL=0 ;;
        -*)        echo "Unknown option: $arg" >&2; exit 2 ;;
        *)         BRANCH="$arg" ;;
    esac
done
[ -n "$BRANCH" ] || BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$BRANCH" = "HEAD" ]; then
    echo "[ERROR] Detached HEAD. Check out a branch or pass one explicitly." >&2
    exit 1
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

log "Directory : $APP_DIR"
log "Branch    : $BRANCH"

# Belt and braces: a DATABASE_URL inherited from the shell can be snapshotted
# into pm2's env by --update-env and outlive this deploy. .env on disk is the
# only source we want. (CLAUDE.md section 1.)
unset DATABASE_URL

BEFORE="$(git rev-parse --short HEAD)"

if [ "$PULL" -eq 1 ]; then
    log "Fetching origin/$BRANCH..."
    for attempt in 1 2 3 4; do
        if git fetch origin "$BRANCH"; then break; fi
        warn "Fetch failed (attempt $attempt). Retrying..."
        sleep $((2 ** attempt))
    done
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    warn "--no-pull: rebuilding what is already on disk"
fi

AFTER="$(git rev-parse --short HEAD)"
if [ "$BEFORE" = "$AFTER" ]; then
    log "No new commits ($AFTER) — rebuilding anyway"
else
    log "Updated $BEFORE -> $AFTER"
    git --no-pager log --oneline "$BEFORE..$AFTER" | sed 's/^/         /'
fi

log "Installing dependencies..."
npm install --legacy-peer-deps

log "Generating Prisma client..."
npx prisma generate

# This project has no committed migrations; schema changes ship via db push.
# `prisma migrate deploy` would be a silent no-op here.
log "Syncing database schema..."
npx prisma db push --skip-generate

# Stop BEFORE building. `next build` deletes and rewrites .next in place, so a
# running process spends the whole build crashing into a half-written
# directory — that is the 502-plus-climbing-restart-count pattern from
# September. A short planned outage beats a long crash loop.
log "Stopping $APP_NAME for the build..."
pm2 stop "$APP_NAME" 2>/dev/null || warn "$APP_NAME was not running"

log "Building..."
BUILD_START=$(date +%s)
if ! npm run build; then
    err "Build failed. The app is stopped and .next is incomplete."
    err "Fix the build and re-run, or restore the previous release:"
    err "  git checkout $BEFORE && npm run build && pm2 start $APP_NAME"
    exit 1
fi
log "Built in $(( $(date +%s) - BUILD_START ))s"

# pm2 start, never reload or restart: a rolling restart can leave an old
# instance serving HTML that references chunk hashes the new .next no longer
# has, which renders as a styleless, broken-looking site. (CLAUDE.md section 3.)
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    log "Starting $APP_NAME..."
    pm2 start "$APP_NAME" --update-env
elif [ -f ecosystem.config.js ]; then
    warn "$APP_NAME not registered with pm2 — creating from ecosystem.config.js"
    pm2 start ecosystem.config.js --env production
else
    warn "$APP_NAME not registered with pm2 — creating"
    pm2 start npm --name "$APP_NAME" -- start
fi

# `pm2 update` and some upgrades drop the saved process list; without this the
# app does not come back after a reboot.
pm2 save >/dev/null 2>&1 || warn "pm2 save failed"

log "Waiting for the app to accept requests..."
STATUS="000"
for attempt in $(seq 1 10); do
    STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo 000)"
    # Deliberately an if, not `[ ... ] && break`: under `set -e` a failing test
    # as the last command in the loop body would exit the whole script.
    if [ "$STATUS" = "200" ]; then break; fi
    sleep 2
done

if [ "$STATUS" != "200" ]; then
    err "Local health check failed (last status: $STATUS)"
    err "  pm2 logs $APP_NAME --lines 40 --nostream"
    exit 1
fi
log "Local health check passed"

# Separates "the app is down" from "nginx is holding a dead upstream".
PUBLIC="$(curl -s -o /dev/null -w '%{http_code}' https://divinitycoin.com/ || echo 000)"
if [ "$PUBLIC" = "200" ]; then
    log "Public site returning 200"
else
    warn "Public site returned $PUBLIC while localhost is healthy."
    warn "Usually a stale nginx upstream: systemctl reload nginx"
fi

# The proxy carries security headers, bot blocking and the hosted-checkout
# frame policy. If it silently stops running, every page still returns 200,
# so it needs its own assertion.
PROXY="$(curl -s -o /dev/null -w '%{http_code}' -X POST https://divinitycoin.com/some-page || echo 000)"
if [ "$PROXY" = "400" ]; then
    log "Proxy active (origin-less POST rejected)"
else
    warn "Proxy check returned $PROXY, expected 400."
    warn "Security headers and bot blocking may not be running. Investigate before walking away."
fi

echo
pm2 status "$APP_NAME" || true
echo
log "Deployed $AFTER on $BRANCH"
log "Logs: pm2 logs $APP_NAME"
