#!/bin/bash
# db-backup.sh
# Database backup script

set -e

# Variables
DB_NAME="${DB_NAME:-divinitycoin}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
BACKUP_DIR="/opt/divinitycoin/backups/db"
S3_BUCKET="${S3_BUCKET:-}"
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

log_info "Starting database backup..."

# Create backup
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    | gzip > "${BACKUP_FILE}"

log_info "Backup created: ${BACKUP_FILE}"

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log_info "Backup size: ${BACKUP_SIZE}"

# Upload to S3 if bucket is configured
if [ -n "${S3_BUCKET}" ]; then
    log_info "Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/db-backups/" \
        --storage-class STANDARD_IA
    log_info "Uploaded to S3"
fi

# Cleanup old local backups
log_info "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

log_info "Database backup completed successfully!"
