#!/bin/bash
# cron-backup.sh
# Automated backup script for crontab
#
# Usage: Add to crontab with:
#   crontab -e
#   0 3 * * 0 /home/user/divinitycoin/scripts/cron-backup.sh
#   (runs every Sunday at 3 AM)
#
# Or for every 7 days from install:
#   0 3 */7 * * /home/user/divinitycoin/scripts/cron-backup.sh

set -e

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_FILE="/var/log/divinitycoin/backup.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting scheduled backup..."

# Build the URL
BACKUP_URL="${APP_URL}/api/cron/backup"

# Add secret if configured
if [ -n "$CRON_SECRET" ]; then
    BACKUP_URL="${BACKUP_URL}?secret=${CRON_SECRET}"
fi

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKUP_URL" 2>&1)
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
