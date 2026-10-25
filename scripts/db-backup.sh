#!/bin/bash
# db-backup.sh
# Database backup script
#
# Credentials come from DATABASE_URL in the repo's .env — the same string the
# app uses. It previously built a connection from DB_USER/DB_PASSWORD env vars
# that nothing ever set, so it authenticated as "postgres" with an empty
# password and sat on an interactive prompt. Under cron, with no stdin, that
# meant it had never produced a backup.

set -euo pipefail

# Resolve the repo from this script's own location rather than a hardcoded
# path. The crontab entry pointed at a directory that does not exist on this
# host for exactly that reason.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/divinitycoin/db}"
S3_BUCKET="${S3_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
# A dump defining fewer tables than this is treated as a failure, not a
# backup. The schema has ~39; a connection to the wrong database, or a dump
# that died part-way, produces far fewer. This is a content check rather than
# a byte count because 39 empty tables gzip to under 10 KB, so any size floor
# large enough to be meaningful also rejects a valid dump.
MIN_TABLES="${MIN_TABLES:-10}"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2; }

if [ ! -f "${REPO_DIR}/.env" ]; then
    log_error "No .env at ${REPO_DIR}/.env — cannot resolve DATABASE_URL."
    exit 1
fi

DB_URL="$(grep '^DATABASE_URL=' "${REPO_DIR}/.env" | sed 's/^DATABASE_URL=//' | tr -d '"')"
if [ -z "${DB_URL}" ]; then
    log_error "DATABASE_URL is empty or absent in ${REPO_DIR}/.env"
    exit 1
fi
case "${DB_URL}" in
    postgresql://*|postgres://*) ;;
    *) log_error "DATABASE_URL does not look like a postgres URL; refusing to run."; exit 1 ;;
esac

DB_NAME="$(basename "${DB_URL%%\?*}")"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

log_info "Starting database backup of '${DB_NAME}'..."

# pipefail above is what makes this safe. Without it, a pg_dump that failed
# still left gzip exiting 0, so the script wrote a small valid .gz and
# reported success — a backup that restores nothing, which is worse than no
# backup at all because you stop worrying about it.
if ! pg_dump "${DB_URL}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        | gzip > "${BACKUP_FILE}"; then
    log_error "pg_dump failed; removing partial file ${BACKUP_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Prove it is a readable archive before calling it a backup.
if ! gzip -t "${BACKUP_FILE}"; then
    log_error "Backup failed gzip integrity check; removing ${BACKUP_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# And that it is a dump of this schema, not of an empty or wrong database.
TABLE_COUNT=$(gzip -dc "${BACKUP_FILE}" | grep -c '^CREATE TABLE' || true)
if [ "${TABLE_COUNT}" -lt "${MIN_TABLES}" ]; then
    log_error "Backup defines only ${TABLE_COUNT} tables (minimum ${MIN_TABLES}); treating as failed."
    rm -f "${BACKUP_FILE}"
    exit 1
fi

log_info "Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1), ${TABLE_COUNT} tables)"

if [ -n "${S3_BUCKET}" ]; then
    log_info "Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/db-backups/" --storage-class STANDARD_IA
    log_info "Uploaded to S3"
fi

log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

log_info "Database backup completed successfully."
