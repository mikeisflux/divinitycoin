#!/bin/bash
# cron-backup.sh
# Triggers the application's own backup endpoint on a schedule.
#
# Usage from crontab (path is resolved from this script, so put it wherever
# the repo actually lives):
#   0 3 */7 * * /root/divinitycoin/scripts/cron-backup.sh
#
# CRON_SECRET is read from the repo's .env. It used to be taken from the
# environment, which cron does not populate, so the secret was always empty,
# the request went out unauthenticated, and the endpoint answered 401 — every
# run, silently, into a log nobody read.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP_URL="${APP_URL:-http://localhost:3000}"
LOG_FILE="${LOG_FILE:-/var/log/divinitycoin/backup.log}"

mkdir -p "$(dirname "$LOG_FILE")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

if [ ! -f "${REPO_DIR}/.env" ]; then
    log "ERROR: no .env at ${REPO_DIR}/.env — cannot resolve CRON_SECRET"
    exit 1
fi

CRON_SECRET="$(grep '^CRON_SECRET=' "${REPO_DIR}/.env" | sed 's/^CRON_SECRET=//' | tr -d '"')"
if [ -z "${CRON_SECRET}" ]; then
    log "ERROR: CRON_SECRET is empty or absent in ${REPO_DIR}/.env"
    exit 1
fi

log "Starting scheduled backup..."

# --secret goes in a header rather than the query string so it stays out of
# access logs. The endpoint accepts either.
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "${APP_URL}/api/cron/backup" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    log "Backup completed successfully"
    log "Response: $BODY"
else
    log "ERROR: Backup failed with HTTP $HTTP_CODE"
    log "Response: $BODY"
    exit 1
fi

log "Backup script finished"
