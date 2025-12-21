# Deployment Instructions

## Production Server Setup

### 1. UFW Firewall Configuration

Run these commands on your production server:

```bash
# Reset and set defaults
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 51820/udp   # WireGuard VPN

# Allow internal API from VPN only (adjust IP as needed)
sudo ufw allow from 10.10.0.0/24 to any port 3001

# Enable firewall
sudo ufw enable
sudo ufw status verbose
```

### 2. Database Backup Crontab

Add daily backup at 3 AM:

```bash
# Edit crontab
crontab -e

# Add this line:
0 3 * * * /opt/divinitycoin/scripts/db-backup.sh >> /var/log/db-backup.log 2>&1
```

### 3. Environment Variables

Copy and configure environment:

```bash
cp .env.example .env
nano .env
```

Required variables to set:
- `DATABASE_URL` - Your PostgreSQL connection string
- `STRIPE_SECRET_KEY` - From Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` - From Stripe Webhooks
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - From Stripe Dashboard
- `SENDGRID_API_KEY` - From SendGrid

Pre-configured (change in production):
- `ADMIN_INITIAL_EMAIL` - divinitycomicsinc@gmail.com
- `ADMIN_INITIAL_PASSWORD` - DivAdmin2024Secure9X7Kz3
- `ADMIN_SESSION_SECRET` - Kx9mPvQ2nR7wT4jL8sY3bF6hN1cD5gA0
- `ENCRYPTION_SECRET` - Wm3Zp8Rv6Tn2Qx4Jk7Gy9Hc1Bf5Nd0La
- `INTERNAL_API_KEY` - Xt7Mj2Pw9Vb4Hs6Kf1Nc3Qr8Ye5Ud0Lg

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed admin user
npx ts-node scripts/seed-admin.ts

# Seed email templates
npx ts-node scripts/seed-email-templates.ts
```

### 5. Build and Start

```bash
# Install dependencies
pnpm install

# Build application
pnpm build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
```

### 6. Nginx Setup

```bash
# Copy nginx config
sudo cp nginx/nginx.conf /etc/nginx/sites-available/divinitycoin
sudo ln -s /etc/nginx/sites-available/divinitycoin /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 8. Uptime Monitoring

Set up monitoring at:
- [UptimeRobot](https://uptimerobot.com) - Free tier available
- [Better Uptime](https://betteruptime.com)

Monitor these endpoints:
- `https://yourdomain.com/api/health` - Main health check
- `https://yourdomain.com` - Frontend

### 9. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Test health endpoint
curl http://localhost:3000/api/health
```

## Admin Login

After deployment, access admin at:
- URL: `https://yourdomain.com/admin`
- Email: `divinitycomicsinc@gmail.com`
- Password: `DivAdmin2024Secure9X7Kz3`

**Change the password immediately after first login!**
