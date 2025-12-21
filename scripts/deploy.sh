#!/bin/bash
# deploy.sh
# Production deployment script

set -e

echo "Starting deployment..."

# Variables
APP_NAME="divinitycoin"
DEPLOY_DIR="/opt/${APP_NAME}"
BACKUP_DIR="/opt/${APP_NAME}/backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root"
    exit 1
fi

# Create backup
log_info "Creating backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}"
if [ -d "${DEPLOY_DIR}/current" ]; then
    tar -czf "${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz" -C "${DEPLOY_DIR}" current
    log_info "Backup created: backup_${TIMESTAMP}.tar.gz"
fi

# Pull latest changes
log_info "Pulling latest changes..."
cd "${DEPLOY_DIR}/repo"
git fetch origin
git checkout main
git pull origin main

# Install dependencies
log_info "Installing dependencies..."
npm ci --production=false

# Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate

# Run database migrations
log_info "Running database migrations..."
npx prisma migrate deploy

# Build application
log_info "Building application..."
npm run build

# Create new release directory
RELEASE_DIR="${DEPLOY_DIR}/releases/${TIMESTAMP}"
mkdir -p "${RELEASE_DIR}"

# Copy built files
log_info "Copying built files..."
cp -r .next "${RELEASE_DIR}/"
cp -r public "${RELEASE_DIR}/"
cp -r node_modules "${RELEASE_DIR}/"
cp -r prisma "${RELEASE_DIR}/"
cp package.json "${RELEASE_DIR}/"
cp next.config.js "${RELEASE_DIR}/" 2>/dev/null || true

# Update symlink
log_info "Updating symlink..."
rm -f "${DEPLOY_DIR}/current"
ln -sf "${RELEASE_DIR}" "${DEPLOY_DIR}/current"

# Restart application
log_info "Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 reload ecosystem.config.js --env production
else
    systemctl restart ${APP_NAME}
fi

# Cleanup old releases (keep last 5)
log_info "Cleaning up old releases..."
cd "${DEPLOY_DIR}/releases"
ls -t | tail -n +6 | xargs -r rm -rf

# Health check
log_info "Running health check..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ "$HTTP_STATUS" -eq 200 ]; then
    log_info "Deployment successful! Application is healthy."
else
    log_error "Health check failed! HTTP status: ${HTTP_STATUS}"
    log_warn "Rolling back to previous version..."
    # Rollback logic here
    exit 1
fi

echo ""
log_info "Deployment completed successfully!"
