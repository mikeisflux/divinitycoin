#!/bin/bash
# deploy.sh
# Zero-downtime deployment script for DivinityCoin
# Usage: ./scripts/deploy.sh [branch]

set -e

echo "Starting deployment..."

# Variables - detect current directory or use default
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="divinitycoin"
BRANCH="${1:-main}"

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

# Change to app directory
cd "$APP_DIR"
log_info "Working directory: $APP_DIR"
log_info "Target branch: $BRANCH"

# Step 1: Pull latest changes
log_info "Fetching latest changes..."
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warn "Already up to date with origin/$BRANCH"
    read -p "Rebuild anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled."
        exit 0
    fi
else
    log_info "Pulling changes..."
    git pull origin "$BRANCH"
fi

# Step 2: Install dependencies
log_info "Installing dependencies..."
npm ci --prefer-offline 2>/dev/null || npm install

# Step 3: Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate

# Step 4: Run database migrations
log_info "Running database migrations..."
npx prisma migrate deploy || log_warn "No pending migrations"

# Step 5: Build application (while current version stays live)
log_info "Building Next.js application..."
BUILD_START=$(date +%s)
npm run build
BUILD_END=$(date +%s)
log_info "Build completed in $((BUILD_END - BUILD_START)) seconds"

# Step 6: Hot reload with PM2 (zero-downtime)
log_info "Performing zero-downtime reload..."

if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
    # Use reload for graceful zero-downtime restart
    # PM2 will start new instances before killing old ones
    pm2 reload "$APP_NAME" --update-env
    log_info "Application reloaded (zero downtime)"
else
    log_warn "Application not found in PM2. Starting fresh..."
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start npm --name "$APP_NAME" -- start
    fi
fi

# Step 7: Reload nginx (if accessible)
if command -v nginx &> /dev/null; then
    log_info "Testing nginx configuration..."
    if sudo nginx -t 2>/dev/null; then
        sudo nginx -s reload
        log_info "Nginx reloaded"
    elif nginx -t 2>/dev/null; then
        nginx -s reload
        log_info "Nginx reloaded"
    else
        log_warn "Nginx config test failed, skipping reload"
    fi
fi

# Step 8: Save PM2 state
pm2 save 2>/dev/null || true

# Step 9: Health check
log_info "Running health check..."
sleep 3

MAX_RETRIES=5
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        log_info "Health check passed!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_warn "Health check attempt $RETRY_COUNT/$MAX_RETRIES (status: $HTTP_STATUS)"
    sleep 2
done

if [ "$HTTP_STATUS" != "200" ]; then
    log_error "Health check failed after $MAX_RETRIES attempts"
    log_warn "Check logs with: pm2 logs $APP_NAME"
    exit 1
fi

# Step 10: Show status
echo ""
pm2 status "$APP_NAME"
echo ""
log_info "Deployment completed successfully!"
log_info "Monitor logs: pm2 logs $APP_NAME"
