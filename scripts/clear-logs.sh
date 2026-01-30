#!/bin/bash
# Clear all PM2 and application logs

echo "Clearing PM2 logs..."
pm2 flush

echo "Clearing application log files..."
# Clear PM2 log files directly
> ~/.pm2/pm2.log 2>/dev/null || true
> ~/.pm2/logs/divinitycoin-out.log 2>/dev/null || true
> ~/.pm2/logs/divinitycoin-error.log 2>/dev/null || true

# Clear application log directory if it exists
if [ -d "/var/log/divinitycoin" ]; then
    > /var/log/divinitycoin/out.log 2>/dev/null || true
    > /var/log/divinitycoin/error.log 2>/dev/null || true
    echo "Cleared /var/log/divinitycoin logs"
fi

# Restart the application to apply any code changes
echo "Restarting application..."
pm2 restart divinitycoin

echo "Done! Logs cleared and application restarted."
echo ""
echo "To monitor fresh logs, run:"
echo "  pm2 logs divinitycoin"
