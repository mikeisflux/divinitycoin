#!/bin/bash
# healthcheck.sh
# Application health check script

APP_URL="${APP_URL:-http://localhost:3000}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

check_health() {
    local response
    local http_code

    response=$(curl -s -w "\n%{http_code}" "${APP_URL}/health" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" -eq 200 ]; then
        return 0
    else
        return 1
    fi
}

send_alert() {
    local message="$1"

    if [ -n "${SLACK_WEBHOOK}" ]; then
        curl -s -X POST "${SLACK_WEBHOOK}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"${message}\"}" > /dev/null
    fi

    echo "[ALERT] ${message}"
}

# Run health check
if check_health; then
    echo "[OK] Application is healthy"
    exit 0
else
    send_alert "DivinityCoin health check failed! Application may be down."
    exit 1
fi
