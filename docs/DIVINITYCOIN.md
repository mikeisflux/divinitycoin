# DivinityCoin - Technical Documentation

> **Version:** 1.0.0
> **Last Updated:** February 2026
> **Status:** Production

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Authentication](#authentication)
8. [Payment System](#payment-system)
9. [Gift Card System](#gift-card-system)
10. [Credit & Balance System](#credit--balance-system)
11. [Partner Integration](#partner-integration)
12. [Email System](#email-system)
13. [Admin Dashboard](#admin-dashboard)
14. [Security](#security)
15. [Deployment](#deployment)
16. [Maintenance](#maintenance)

---

## Overview

DivinityCoin is a gift card and creator credits platform that enables:

- **Users** to purchase gift cards with real money via Stripe
- **Partners** (like IndieCrowdfund) to integrate via API for credit redemption and holds
- **Creators** to receive payments through the settlement system
- **Admins** to manage all aspects of the platform

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. User purchases gift card ($5-$500)                         │
│              │                                                  │
│              ▼                                                  │
│   2. Payment processed via Stripe                               │
│              │                                                  │
│              ▼                                                  │
│   3. Gift card code emailed to user                             │
│              │                                                  │
│              ▼                                                  │
│   4. User redeems code on partner platform (IndieCrowdfund)     │
│              │                                                  │
│              ▼                                                  │
│   5. Credits added to user's balance                            │
│              │                                                  │
│              ▼                                                  │
│   6. Credits used to back projects/pledges                      │
│              │                                                  │
│              ▼                                                  │
│   7. When project funds, credits captured → creator paid        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14.0.0 (App Router) |
| **Language** | TypeScript 5.0.0 |
| **Database** | PostgreSQL with Prisma ORM 5.0.0 |
| **Payments** | Stripe SDK 14.0.0 |
| **Email** | SendGrid + Nodemailer (fallback) |
| **Styling** | Tailwind CSS |
| **Validation** | Zod |
| **Process Manager** | PM2 |
| **Reverse Proxy** | Nginx |

---

## Architecture

```
/src
├── /app
│   ├── /api              # REST API endpoints
│   ├── /admin            # Admin dashboard (server components)
│   ├── /partners         # Partner portal
│   ├── /account          # User account pages
│   ├── /buy              # Gift card purchase
│   └── /[pages]          # Public pages
├── /components
│   ├── /admin            # Admin UI components
│   ├── /ui               # Shared UI components
│   └── /email            # Email templates
├── /lib
│   ├── /admin            # Admin auth & middleware
│   ├── /auth             # User authentication
│   ├── /partner          # Partner auth & webhooks
│   ├── /credits          # Credit hold system
│   ├── /email            # Email sending & queue
│   ├── /giftcard         # Gift card generation & redemption
│   ├── /settlements      # Settlement processing
│   ├── db.ts             # Prisma singleton
│   ├── stripe.ts         # Stripe client
│   ├── encryption.ts     # AES-256-GCM encryption
│   ├── logger.ts         # Sanitized logging
│   └── rateLimit.ts      # Rate limiting
├── /prisma
│   └── schema.prisma     # Database schema
└── /emails               # React Email templates
```

---

## Core Features

### For Users
- Purchase gift cards ($5-$500) via Stripe
- Receive gift card codes via email
- Redeem codes on partner platforms
- View credit balance and transaction history
- Account management (email updates, password reset)

### For Partners
- API integration for code redemption
- Credit hold/capture system for pledges
- Webhook notifications
- Settlement reports and payouts
- API key management

### For Admins
- Complete dashboard with metrics
- Gift card management (create, revoke, resend)
- Partner management and onboarding
- Settlement processing and approval
- User management
- Email system management
- Audit logging and security monitoring
- Server backup and restore

---

## Database Schema

### Core Models

| Model | Purpose |
|-------|---------|
| `User` | Registered users with auth |
| `Session` | User session tokens |
| `GiftCard` | Gift cards with hashed codes |
| `CreditBalance` | User credit balances |
| `CreditHold` | Holds on credits for pledges |
| `CreditLedger` | Audit trail of all credit transactions |
| `Transaction` | Payment transactions |
| `Partner` | Partner configurations |
| `PartnerApiKey` | Partner API keys |
| `PartnerSettlement` | Settlement records |
| `CreditCapture` | Captured credits for payouts |
| `AdminUser` | Admin accounts with roles |
| `AdminAuditLog` | Admin action audit trail |

### Gift Card Statuses
- `PENDING` - Created, awaiting payment
- `ACTIVE` - Payment confirmed, ready to redeem
- `REDEEMED` - Code has been used
- `EXPIRED` - Past expiration date
- `REVOKED` - Manually deactivated

### Credit Hold Statuses
- `ACTIVE` - Hold in place for pledge
- `CAPTURED` - Project funded, credits transferred
- `RELEASED` - Project failed, credits returned
- `EXPIRED` - Hold expired without action

---

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/update-email` | Update email address |
| POST | `/api/payment-intent` | Create Stripe payment |
| POST | `/api/checkout` | Create Stripe checkout |
| POST | `/api/cards/check` | Check gift card status |
| POST | `/api/balance` | Get credit balance |

### Partner API (`/internal`)

| Action | Description |
|--------|-------------|
| `validate` | Redeem a gift card code |
| `balance` | Get user's credit balance |
| `hold` | Place hold on credits |
| `release` | Release a hold |
| `capture` | Capture a hold |
| `health` | Health check |

**Authentication:** `Authorization: Bearer <API_KEY>`

### Admin Endpoints

| Category | Endpoints |
|----------|-----------|
| Gift Cards | CRUD, generate, revoke, resend |
| Partners | CRUD, approve, API keys, webhooks |
| Settlements | List, approve, process, mark paid |
| Users | List, view, ban/unban |
| Settings | Payments, email, security, backup |

---

## Authentication

### User Authentication
- Session-based with 30-day expiry
- Password hashing: bcryptjs (12 rounds)
- Secure httpOnly cookies
- Password reset via email token

### Admin Authentication
- 8-hour session expiry
- Lockout after 5 failed attempts (30 minutes)
- Role-based access control (RBAC)
- Full audit logging

### Admin Roles

| Role | Permissions |
|------|-------------|
| `SUPER_ADMIN` | Full access including admin management |
| `ADMIN` | All except admin management |
| `FINANCE` | Transactions and settlements |
| `SUPPORT` | Users and gift cards |
| `VIEWER` | Read-only access |

### Partner Authentication
- API key-based for API access
- Password-based for portal access
- 24-hour portal sessions

---

## Payment System

### Purchase Flow

1. User selects amount ($5-$500) on `/buy`
2. Frontend creates PaymentIntent via `/api/payment-intent`
3. Stripe Elements processes card payment
4. Webhook receives `payment_intent.succeeded`
5. System generates gift card code
6. Gift card emailed to customer

### Stripe Integration

```typescript
// Payment Intent creation
POST /api/payment-intent
{
  "amount": 25.00,
  "email": "user@example.com"
}

// Response
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### Refund Flow
1. User requests refund via `/api/refund-request`
2. If code redeemed on partner → webhook to partner for approval
3. Partner approves/rejects via callback
4. If approved → Stripe refund processed
5. Gift card status updated to REVOKED

---

## Gift Card System

### Code Generation
- 16-character hexadecimal code (8 random bytes)
- Display format: `XXXX-XXXX-XXXX-XXXX`
- Stored as SHA-256 hash (never plain text)
- Last 4 characters stored for display

### Redemption Flow

```typescript
POST /internal?action=validate
{
  "code": "ABCD-1234-EFGH-5678",
  "platformUserId": "user_123"
}

// Success Response
{
  "success": true,
  "amount": 25.00,
  "balanceAfter": 50.00
}
```

### Security
- SERIALIZABLE transaction isolation
- Row-level locking prevents double-redemption
- Rate limiting: 5 attempts/minute
- Lockout after 10 failures (15 minutes)

---

## Credit & Balance System

### Balance Structure
```typescript
{
  "available": 50.00,  // Can be used
  "held": 25.00,       // Reserved for pledges
  "total": 75.00,      // available + held
  "activeHolds": [
    {
      "holdId": "hold_123",
      "amount": 25.00,
      "pledgeId": "pledge_456",
      "projectId": "project_789"
    }
  ]
}
```

### Hold Lifecycle

```
┌────────────┐     ┌──────────┐     ┌──────────┐
│   ACTIVE   │────▶│ CAPTURED │     │ RELEASED │
│ (pledge)   │     │ (funded) │     │ (failed) │
└────────────┘     └──────────┘     └──────────┘
      │                                   ▲
      │                                   │
      └───────────────────────────────────┘
            Project fails/cancelled
```

### API Operations

| Operation | Description |
|-----------|-------------|
| `hold` | Reserve credits for pledge |
| `release` | Return credits (project failed) |
| `capture` | Transfer credits (project funded) |

---

## Partner Integration

### Onboarding Flow

1. Partner applies at `/become-a-partner`
2. Admin creates partner record
3. Setup email sent with secure token
4. Partner sets password and configures settings
5. Admin approves → status becomes ACTIVE
6. Partner generates API keys

### API Configuration

```bash
# Partner Environment
DIVINITYCOIN_API_URL=https://divinitycoin.com/internal
DIVINITYCOIN_API_KEY=dc_live_xxxxxxxxxxxxx
```

### Webhook Events

Partners receive webhooks for:
- Code redemption
- Refund requests
- Settlement notifications

**Signature Verification:**
```
Header: X-Webhook-Signature: t=1234567890,v1=abc123...
```

### Settlement Process

1. Credits captured throughout period
2. Weekly settlement generated automatically
3. Admin reviews and approves
4. Payment processed (wire, ACH, PayPal)
5. Settlement marked as PAID

**Fee Structure:**
- Default: 6% platform fee
- Configurable per partner
- Minimum settlement threshold (default $100)

---

## Email System

### Providers

| Provider | Use Case |
|----------|----------|
| SendGrid | Primary (recommended) |
| Nodemailer/SMTP | Fallback |

### Email Types

- Gift card delivery
- Purchase receipts
- Password reset
- Partner onboarding
- Settlement notifications
- Admin alerts

### Queue System

- Rate-limited: 1 email/second
- Priority-based ordering
- Retry with exponential backoff
- Max 3 attempts before failure
- Bulk send support

### Tracking

- Delivery status via SendGrid webhooks
- Open/click tracking
- Bounce handling
- Full email logs in admin

---

## Admin Dashboard

### Main Sections

| Section | Features |
|---------|----------|
| Dashboard | Overview, metrics, recent activity |
| Gift Cards | List, create, revoke, resend |
| Partners | Onboard, configure, API keys |
| Settlements | Review, approve, process payments |
| Users | View, ban/unban, link purchases |
| Emails | Templates, queue, inbox |
| Settings | Payments, email, security, backup |
| Logs | Audit, API requests, security |

### Backup & Restore

**Create Backup:**
- PostgreSQL database dump
- Configuration files (.env, schema)
- Downloadable .zip archive

**Restore:**
- Upload backup file
- Choose: database only, configs only, or both
- Confirmation required (destructive action)

**Automated Backups:**
- Cron job: weekly at 3 AM Sunday
- Stores in `/var/backups/divinitycoin/`
- Keeps last 4 backups (~1 month)

---

## Security

### Encryption
- **Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2 (100k iterations)
- **Encrypted Data:** API keys, bank details, sensitive configs

### Authentication Security
- bcryptjs password hashing (12 rounds)
- Secure session cookies (httpOnly, secure, sameSite)
- CSRF protection with signed tokens
- Rate limiting with lockout

### Data Protection
- Gift card codes stored as SHA-256 hashes
- Sensitive data redacted from logs
- PII protection in error messages
- Audit trail for all admin actions

### Transaction Safety
- SERIALIZABLE isolation level
- Row-level locking (SELECT FOR UPDATE)
- Prevents double-spend and race conditions

### API Security
- API key hashing with SHA-256
- HMAC-SHA256 webhook signatures
- IP/user-agent logging
- Request rate limiting

---

## Deployment

### Requirements

- Node.js 18+
- PostgreSQL 14+
- PM2 (process manager)
- Nginx (reverse proxy)

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Email
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=no-reply@divinitycoin.com

# Security
ENCRYPTION_SECRET=256-bit-key
CSRF_SECRET=256-bit-key
CRON_SECRET=secret-for-cron-endpoints

# App
NEXT_PUBLIC_BASE_URL=https://divinitycoin.com
NODE_ENV=production
```

### Deployment Commands

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build
npm run build

# Restart with zero downtime
pm2 reload divinitycoin
```

### Using Deploy Script

```bash
./scripts/deploy.sh main
```

---

## Maintenance

### Cron Jobs

| Schedule | Task |
|----------|------|
| Weekly (Sunday 3 AM) | Automated backup |
| Every minute | Email queue processing |

**Setup:**
```bash
crontab -e

# Add these lines:
0 3 * * 0 /home/user/divinitycoin/scripts/cron-backup.sh
* * * * * curl -s http://localhost:3000/api/cron/process-email-queue
```

### Log Locations

| Log | Location |
|-----|----------|
| PM2 logs | `~/.pm2/logs/divinitycoin-*.log` |
| Application | `/var/log/divinitycoin/*.log` |
| Backup logs | `/var/log/divinitycoin/backup.log` |

### Clear Logs

```bash
./scripts/clear-logs.sh
```

### Health Check

```bash
curl https://divinitycoin.com/api/health
```

### Database Backup (Manual)

Admin Panel: `/admin/settings` → Download Backup

Or via API:
```bash
curl -X POST https://divinitycoin.com/api/admin/settings/backup \
  -H "Cookie: admin_session=xxx" \
  -o backup.zip
```

---

## Current State Summary

### What's Working
- User registration and authentication
- Gift card purchase via Stripe
- Gift card redemption and credit system
- Partner API integration
- Credit holds and captures
- Settlement generation
- Admin dashboard with full management
- Email system with queue
- Server backup and restore
- Automated weekly backups

### Recent Fixes
- Middleware now allows partner API requests (was blocking `/internal`)
- PostgreSQL connection reset errors suppressed
- Email editing feature added for users
- Zod validation library installed

### Active Branch
`claude/fix-pm2-logs-Mn1xQ` - Contains all recent fixes

---

## Support

- **Admin Panel:** https://divinitycoin.com/admin
- **Partner Portal:** https://divinitycoin.com/partners
- **API Endpoint:** https://divinitycoin.com/internal

---

*This documentation reflects the current production state of DivinityCoin as of February 2026.*
