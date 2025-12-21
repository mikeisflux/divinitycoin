# CreatorCredits - Complete Build Checklist

> **Generated from**: `giftcard-service-spec (1).md`
> **Build Target**: CreatorCredits Server (Sections 1-8, 10-15)
> **Reference Only**: IndieCrowdfund Integration (Section 9) - Do NOT build

---

## 1. Project Setup & Configuration

### 1.1 Initial Setup
- [ ] Create Next.js 14.x project with App Router
- [ ] Configure TypeScript 5.x
- [ ] Set up pnpm as package manager
- [ ] Configure ESLint
- [ ] Configure Prettier
- [ ] Set up Vitest for testing

### 1.2 Brand Identity
- [ ] Choose neutral domain name (e.g., creatorcredits.com, fundingcredits.com)
- [ ] Clean, generic fintech aesthetic
- [ ] No reference to adult content, NSFW, or specific content types
- [ ] Minimal reference to IndieCrowdfund (just "Redeem on partner platforms")
- [ ] Tagline options: "Fuel Your Favorite Creators" / "The Universal Creator Currency" / "Support Creators. Seamlessly."
- [ ] Professional but approachable brand voice
- [ ] Creator-focused language
- [ ] Trust-building through transparency

### 1.3 Dependencies to Install
- [ ] Install Prisma 5.x ORM
- [ ] Install Stripe SDK (latest)
- [ ] Install Tailwind CSS 3.x
- [ ] Install SendGrid SDK
- [ ] Install class-variance-authority (for UI components)
- [ ] Install @react-email/components (for email templates)
- [ ] Install bcrypt (for password hashing)
- [ ] Install crypto (built-in, for code generation)

### 1.4 Environment Variables
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `NEXT_PUBLIC_BASE_URL` - Public site URL
- [ ] `STRIPE_SECRET_KEY` - Stripe API secret key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- [ ] `INTERNAL_API_KEY` - 256-bit secret for internal API
- [ ] `SENDGRID_API_KEY` - SendGrid API key
- [ ] `SENDGRID_FROM_EMAIL` - Verified sender email
- [ ] `SENDGRID_FROM_NAME` - Sender display name
- [ ] `SENDGRID_WEBHOOK_SECRET` - Webhook verification key
- [ ] `ADMIN_SESSION_SECRET` - Admin session secret
- [ ] `ADMIN_INITIAL_EMAIL` - Initial admin email
- [ ] `ADMIN_INITIAL_PASSWORD` - Initial admin password
- [ ] `RATE_LIMIT_WINDOW_MS` - Rate limit window (60000)
- [ ] `RATE_LIMIT_MAX_ATTEMPTS` - Max attempts (5)

---

## 2. Database Schema (Prisma)

### 2.1 User Management Models
- [ ] `User` model with email, password, profile, Stripe customer ID
- [ ] `Session` model with token, expiry, IP, user agent

### 2.2 Gift Card System Models
- [ ] `GiftCard` model with codeHash, codeLast4, amount, status, purchase/redemption info
- [ ] `GiftCardStatus` enum (PENDING, ACTIVE, REDEEMED, EXPIRED, REVOKED)

### 2.3 Credit Balance System Models
- [ ] `CreditBalance` model with platformUserId, availableBalance, heldBalance
- [ ] `CreditHold` model with amount, pledgeId, projectId, status
- [ ] `HoldStatus` enum (ACTIVE, CAPTURED, RELEASED, EXPIRED)
- [ ] `CreditLedger` model for audit trail
- [ ] `LedgerEntryType` enum (REDEMPTION, HOLD_PLACED, HOLD_RELEASED, HOLD_CAPTURED, ADJUSTMENT, REFUND)

### 2.4 Transaction & Audit Models
- [ ] `Transaction` model with type, amount, status, Stripe references
- [ ] `TransactionType` enum (PURCHASE, REFUND)
- [ ] `TransactionStatus` enum (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED)
- [ ] `RedemptionAttempt` model for rate limiting & security

### 2.5 Admin System Models
- [ ] `AdminUser` model with email, passwordHash, role, MFA settings
- [ ] `AdminRole` enum (SUPER_ADMIN, ADMIN, FINANCE, SUPPORT, VIEWER)
- [ ] `AdminSession` model
- [ ] `AdminAuditLog` model

### 2.6 Partner System Models
- [ ] `Partner` model with name, slug, VPN IP, webhook URL
- [ ] `PartnerStatus` enum (PENDING, ACTIVE, SUSPENDED, DEACTIVATED)
- [ ] `PartnerApiKey` model

### 2.7 Email System Models
- [ ] `EmailLog` model
- [ ] `EmailStatus` enum (QUEUED, SENDING, SENT, DELIVERED, OPENED, CLICKED, BOUNCED, FAILED, SPAM)
- [ ] `EmailEvent` model
- [ ] `EmailTemplate` model
- [ ] `EmailTemplateVersion` model

### 2.8 System Configuration Models
- [ ] `SystemConfig` model for key-value settings

### 2.9 Database Setup
- [ ] Create database indexes as specified
- [ ] Run initial migration
- [ ] Seed default admin user
- [ ] Seed default email templates

---

## 3. Gift Card System Library

### 3.1 Code Generation (`lib/giftcard/generate.ts`)
- [ ] `generateGiftCardCode()` - Generate 16-char hex code
- [ ] `formatCodeForDisplay()` - Format as XXXX-XXXX-XXXX-XXXX
- [ ] `hashCode()` - SHA-256 hash for storage
- [ ] `getCodeLast4()` - Extract last 4 characters
- [ ] `isValidCodeFormat()` - Validate 16 hex chars

### 3.2 Code Validation & Redemption (`lib/giftcard/redeem.ts`)
- [ ] Rate limiting implementation
- [ ] `validateAndRedeemCode()` function
- [ ] Format validation
- [ ] Status checks (REDEEMED, EXPIRED, REVOKED, ACTIVE)
- [ ] Atomic redemption transaction
- [ ] Credit balance upsert
- [ ] Ledger entry creation
- [ ] `logRedemptionAttempt()` function

---

## 4. Credit Hold System Library

### 4.1 Credit Holds (`lib/credits/holds.ts`)
- [ ] `placeHold()` - Place hold on credits for pledge
- [ ] `releaseHold()` - Release hold (project failed/cancelled)
- [ ] `captureHold()` - Capture hold (project funded)
- [ ] `getBalance()` - Get user's credit balance with active holds

---

## 5. Rate Limiting Library

### 5.1 Rate Limiter (`lib/rateLimit.ts`)
- [ ] `RateLimiter` class with configurable window and max attempts
- [ ] `check()` method
- [ ] `cleanup()` method for expired entries
- [ ] (Optional) Redis-based implementation for production

---

## 6. API Endpoints

### 6.1 Public API Endpoints
- [ ] `POST /api/checkout` - Create Stripe checkout session
  - [ ] Amount validation ($5-$500)
  - [ ] Email validation
  - [ ] Gift card record creation (PENDING)
  - [ ] Stripe session creation
  - [ ] Transaction record creation
- [ ] `GET /api/cards/:id/status` - Check gift card status
- [ ] `GET /api/balance` - Get credit balance (authenticated)

### 6.2 Internal API Endpoints (VPN Only)
- [ ] Create `app/internal/[...path]/route.ts`
- [ ] `validateInternalRequest()` middleware
- [ ] `POST /internal/validate` - Validate and redeem code
- [ ] `POST /internal/balance` - Get user's credit balance
- [ ] `POST /internal/hold` - Place hold on credits
- [ ] `POST /internal/release` - Release a hold
- [ ] `POST /internal/capture` - Capture a hold
- [ ] `GET /internal/health` - Health check

### 6.3 Webhook Endpoints
- [ ] `POST /webhook/stripe` - Stripe webhook handler
  - [ ] Signature verification
  - [ ] `checkout.session.completed` handler
  - [ ] `checkout.session.expired` handler
  - [ ] `charge.refunded` handler
- [ ] `POST /webhook/sendgrid` - SendGrid event webhook
  - [ ] Signature verification
  - [ ] Process delivery events

---

## 7. Stripe Integration

### 7.1 Checkout Flow (`app/api/checkout/route.ts`)
- [ ] Define preset amounts constant: [10, 25, 50, 100, 250]
- [ ] Define MIN_AMOUNT: $5
- [ ] Define MAX_AMOUNT: $500
- [ ] Validate amount within range
- [ ] Validate email format (regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
- [ ] Generate gift card code (not activated)
- [ ] Create pending gift card record
- [ ] Create Stripe checkout session
  - [ ] payment_method_types: ['card']
  - [ ] mode: 'payment'
  - [ ] success_url with session_id
  - [ ] cancel_url
  - [ ] customer_email
  - [ ] metadata with giftCardId and giftCardCode
- [ ] Store code in Stripe metadata
- [ ] Update gift card with session ID
- [ ] Create transaction record

### 7.2 Webhook Handler (`app/webhook/stripe/route.ts`)
- [ ] `handleSuccessfulPayment()` - Activate card, update transaction, send email
- [ ] `handleExpiredSession()` - Delete pending card, update transaction
- [ ] `handleRefund()` - Revoke card, create refund transaction

---

## 8. Email System (SendGrid)

### 8.1 Email Service (`lib/email/sendGiftCard.ts`)
- [ ] `sendGiftCardEmail()` function
- [ ] Code formatting
- [ ] SendGrid API integration

### 8.2 Email Templates (`emails/`)
- [ ] `GiftCardEmail.tsx` - Purchase confirmation with code
- [ ] Refund confirmation template
- [ ] Welcome email template (if accounts enabled)
- [ ] Password reset template
- [ ] Admin alert template
- [ ] Unredeemed card reminder template

### 8.3 SendGrid Webhook Handler
- [ ] Process `processed` event
- [ ] Process `delivered` event
- [ ] Process `open` event
- [ ] Process `click` event
- [ ] Process `bounce` event
- [ ] Process `dropped` event
- [ ] Process `spamreport` event
- [ ] Process `unsubscribe` event

---

## 9. Server Configuration & Security

### 9.1 WireGuard VPN Setup
- [ ] Install WireGuard
- [ ] Generate keys
- [ ] Configure `/etc/wireguard/wg0.conf`
- [ ] Enable and start WireGuard service
- [ ] Test VPN connectivity

### 9.2 Firewall Configuration (UFW)
- [ ] Reset and set default deny incoming
- [ ] Allow SSH (port 22)
- [ ] Allow HTTP (port 80)
- [ ] Allow HTTPS (port 443)
- [ ] Allow WireGuard (port 51820/udp)
- [ ] Allow internal API from VPN only (10.10.0.2 to port 3001)
- [ ] Enable firewall

### 9.3 Caddy Configuration
- [ ] Create `/etc/caddy/Caddyfile`
- [ ] Configure reverse proxy to localhost:3000
- [ ] Add security headers:
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection: "1; mode=block"
  - [ ] Referrer-Policy: strict-origin-when-cross-origin
  - [ ] Strict-Transport-Security: "max-age=31536000; includeSubDomains"
- [ ] Block `/internal/*` from public access (respond 404)
- [ ] Configure JSON logging to `/var/log/caddy/access.log`

### 9.4 Internal API Server (`server.ts`)
- [ ] Create Express server for internal API
- [ ] Bind ONLY to VPN interface (10.10.0.1:3001)
- [ ] Add internal API key validation middleware

### 9.5 PM2 Configuration
- [ ] Create `ecosystem.config.js`
- [ ] Configure `creatorcredits-web` (Next.js)
- [ ] Configure `creatorcredits-internal` (Express)
- [ ] Set up cluster mode for web
- [ ] Configure PM2 startup on boot

### 9.6 Database Backup
- [ ] Create `/opt/scripts/backup-db.sh`
- [ ] Configure pg_dump with gzip
- [ ] Set up 30-day retention
- [ ] (Optional) S3 upload
- [ ] Add to crontab (daily at 3 AM)

---

## 10. Frontend Website

### 10.1 Design System Setup
- [ ] Configure color palette CSS variables (primary, neutral, accent, warning, error)
- [ ] Configure typography (Inter font, JetBrains Mono)
- [ ] Configure spacing & layout variables
- [ ] Set up Tailwind configuration

### 10.2 UI Component Library (`components/ui/`)
- [ ] `Button` component with variants (primary, secondary, outline, ghost)
- [ ] `Card` component with CardHeader, CardTitle, CardDescription, CardContent
- [ ] `AmountSelector` component with preset amounts and custom input
- [ ] Input components with proper styling
- [ ] Loading spinner component

### 10.3 Layout Components (`components/layout/`)
- [ ] `Header` component with navigation and mobile menu
- [ ] `Footer` component with links and copyright
- [ ] Root layout (`app/layout.tsx`) with fonts and metadata

### 10.4 Public Pages
- [ ] Homepage (`app/page.tsx`)
  - [ ] Hero section with CTA
  - [ ] "Three Simple Steps" section
  - [ ] Features section with stats
  - [ ] Final CTA section
- [ ] Buy Credits page (`app/buy/page.tsx`)
  - [ ] Amount selector
  - [ ] Email input
  - [ ] Order summary
  - [ ] Checkout button
  - [ ] Trust badges
- [ ] Success page (`app/success/page.tsx`)
  - [ ] Success icon and message
  - [ ] "What's Next?" steps
  - [ ] Navigation buttons
- [ ] Cancelled page (`app/cancelled/page.tsx`)
- [ ] How It Works page (`app/how-it-works/page.tsx`)
  - [ ] Detailed step-by-step guide
  - [ ] FAQ preview
  - [ ] CTA section
- [ ] For Creators page (`app/for-creators/page.tsx`)
  - [ ] Partnership benefits
  - [ ] Integration overview
  - [ ] Contact CTA
- [ ] FAQ page (`app/faq/page.tsx`)
  - [ ] Accordion-style FAQs
  - [ ] Categories: Purchasing, Using Credits, Refunds & Support, Security
- [ ] Support page (`app/support/page.tsx`)
- [ ] Redeem page (`app/redeem/page.tsx`) - Redirect to partner
- [ ] Balance page (`app/balance/page.tsx`)

### 10.5 Mobile Responsiveness
- [ ] Test all pages on mobile viewport
- [ ] Verify touch-friendly inputs
- [ ] Test mobile navigation menu

### 10.6 Global Styles (`app/globals.css`)
- [ ] Tailwind base/components/utilities imports
- [ ] CSS custom properties for primary colors (50-900 scale)
- [ ] Smooth scroll behavior
- [ ] Base body styling with antialiased text
- [ ] Container component class
- [ ] Text-balance utility

### 10.7 Tailwind Configuration (`tailwind.config.ts`)
- [ ] Content paths configuration (pages, components, app)
- [ ] Extended color palette (primary 50-900)
- [ ] Custom font families (sans: Inter, mono: JetBrains Mono)
- [ ] Plugins setup

### 10.8 FAQ Content Data
- [ ] Purchasing category questions (4 items)
  - [ ] Payment methods accepted
  - [ ] Minimum/maximum purchase amounts
  - [ ] Account requirement
  - [ ] Code delivery time
- [ ] Using Credits category questions (4 items)
  - [ ] Where to use credits
  - [ ] Credits expiration
  - [ ] Cross-platform usage
  - [ ] Failed project credit return
- [ ] Refunds & Support category questions (4 items)
  - [ ] Refund eligibility
  - [ ] Missing code resolution
  - [ ] Non-working code troubleshooting
  - [ ] Support contact methods
- [ ] Security category questions (3 items)
  - [ ] Payment security (Stripe PCI compliance)
  - [ ] Code sharing guidelines
  - [ ] Stolen code policy

---

## 11. Admin Panel

### 11.1 Admin Authentication
- [ ] Admin login page (`/admin/login`)
- [ ] Email/password authentication with bcrypt
- [ ] Session-based auth with HTTP-only cookies
- [ ] Auto-lockout after 5 failed attempts (30-min lockout)
- [ ] Session expiry after 8 hours
- [ ] (Optional) MFA via TOTP

### 11.2 Admin Dashboard (`/admin`)
- [ ] Total revenue metric
- [ ] Revenue by period (today/week/month)
- [ ] Active gift cards count
- [ ] Redemption rate
- [ ] Total users
- [ ] Connected partners
- [ ] Pending payouts
- [ ] Failed transactions alert
- [ ] Revenue chart widget
- [ ] Recent transactions widget
- [ ] Recent redemptions widget
- [ ] System health widget
- [ ] Quick actions panel

### 11.3 System Configuration Pages
- [ ] General settings (`/admin/settings`)
- [ ] API configuration (`/admin/settings/api`)
- [ ] Payment settings (`/admin/settings/payments`)
- [ ] Email settings (`/admin/settings/email`)
- [ ] Security settings (`/admin/settings/security`)

### 11.4 Partner Management
- [ ] Partner list (`/admin/partners`)
- [ ] Add new partner (`/admin/partners/new`)
- [ ] Partner details (`/admin/partners/:id`)
- [ ] Partner API key management (`/admin/partners/:id/api-keys`)
- [ ] VPN configuration per partner
- [ ] Webhook testing

### 11.5 Transaction Management
- [ ] Transaction list (`/admin/transactions`)
  - [ ] Filters: date range, status, type, amount, email
  - [ ] Actions: View, Refund
- [ ] Transaction detail (`/admin/transactions/:id`)
  - [ ] Full data display
  - [ ] Related gift card
  - [ ] Stripe details
  - [ ] Timeline of events

### 11.6 Payment History
- [ ] Payment list (`/admin/payments`)
- [ ] Stripe sync
- [ ] Direct Stripe dashboard link
- [ ] Refund initiation

### 11.7 Gift Card Management
- [ ] Gift card list (`/admin/gift-cards`)
  - [ ] Filters: status, amount, date, partner, email
  - [ ] Actions: View, Revoke, Resend code
- [ ] Gift card detail (`/admin/gift-cards/:id`)
- [ ] Manual generation (`/admin/gift-cards/generate`)

### 11.8 User Management
- [ ] User list (`/admin/users`)
- [ ] User detail (`/admin/users/:id`)
  - [ ] Purchase history
  - [ ] Admin actions

### 11.9 Admin User Management
- [ ] Admin list (`/admin/admins`)
- [ ] Role-based permissions matrix
- [ ] MFA management
- [ ] Audit log viewer

### 11.10 Email Management
- [ ] Email dashboard (`/admin/emails`)
- [ ] Template management (`/admin/emails/templates`)
- [ ] Template editor with preview
- [ ] Email logs (`/admin/emails/logs`)
- [ ] Email accounts (`/admin/emails/accounts`)
- [ ] Email statistics dashboard

### 11.11 Reports
- [ ] Revenue report
- [ ] Sales report
- [ ] Redemption report
- [ ] Partner report
- [ ] Gift card aging report
- [ ] Refund report
- [ ] CSV/Excel export
- [ ] (Optional) Scheduled email delivery

### 11.12 Logs
- [ ] System logs (`/admin/logs`)
- [ ] API request logs (`/admin/logs/api`)
- [ ] Error logs (`/admin/logs/errors`)
- [ ] Security audit logs (`/admin/logs/security`)

---

## 12. Legal Pages

### 12.1 Terms of Service (`/terms`)
- [ ] Acceptance of terms
- [ ] Service description
- [ ] Account terms (if applicable)
- [ ] Purchases and payments
- [ ] Gift card terms
- [ ] Redemption terms
- [ ] Refund policy reference
- [ ] Prohibited uses
- [ ] Intellectual property
- [ ] Limitation of liability
- [ ] Indemnification
- [ ] Dispute resolution
- [ ] Changes to terms
- [ ] Contact information

### 12.2 Privacy Policy (`/privacy`)
- [ ] Introduction
- [ ] Information collected
- [ ] How information is used
- [ ] Information sharing
- [ ] Data retention
- [ ] Security measures
- [ ] User rights
- [ ] Cookies and tracking
- [ ] International transfers
- [ ] Children's privacy
- [ ] California privacy rights (if applicable)
- [ ] Changes to policy
- [ ] Contact information

### 12.3 Refund Policy (`/refunds`)
- [ ] Overview
- [ ] Eligibility table
- [ ] How to request refund
- [ ] Refund processing timeline
- [ ] Code revocation notice
- [ ] Partial refunds
- [ ] Disputes
- [ ] Contact information

### 12.4 Legal Page Implementation
- [ ] "Last Updated" date on each page
- [ ] Footer links on all pages
- [ ] Checkout consent text
- [ ] Version history storage

---

## 13. Code Validation & Redemption Flow

### 13.1 Validation Process
- [ ] Format validation
- [ ] Hash code lookup
- [ ] Status verification
- [ ] Expiry check
- [ ] Atomic redemption with row locking
- [ ] Audit logging

### 13.2 Preventing Reuse
- [ ] Database constraint on status
- [ ] Validation check rejection
- [ ] All attempts logged
- [ ] Rate limiting active

---

## 14. Deployment

### 14.1 Pre-Deployment Checklist
- [ ] Domain purchased and DNS configured
- [ ] SSL certificates (automatic via Caddy)
- [ ] Stripe account approved and API keys obtained
- [ ] SendGrid account configured and sender verified
- [ ] PostgreSQL installed and configured
- [ ] WireGuard keys generated for both servers
- [ ] Brand assets finalized (logo, colors, copy)
- [ ] Legal pages reviewed and approved
- [ ] Admin user credentials prepared

### 14.2 Server Setup Checklist
- [ ] Ubuntu 24.04 LTS installed
- [ ] UFW configured per specification
- [ ] WireGuard configured and tested
- [ ] Caddy installed and configured
- [ ] Node.js 20.x installed
- [ ] PM2 installed globally
- [ ] PostgreSQL database created

### 14.3 Application Deployment Checklist
- [ ] Repository cloned to `/var/www/creatorcredits`
- [ ] Dependencies installed (`pnpm install`)
- [ ] Environment variables configured
- [ ] Database migrations run (`pnpm prisma migrate deploy`)
- [ ] Email templates seeded
- [ ] Default admin user created
- [ ] Application built (`pnpm build`)
- [ ] PM2 processes started
- [ ] Stripe webhook endpoint configured
- [ ] SendGrid webhook endpoint configured

### 14.4 Admin Panel Verification
- [ ] Admin login works
- [ ] Dashboard displays correctly
- [ ] All settings pages save correctly
- [ ] Partner management functional
- [ ] Transaction list loads
- [ ] Gift card management works
- [ ] Email templates editable
- [ ] Reports generate correctly
- [ ] Audit logs recording

### 14.5 Frontend Verification
- [ ] Homepage loads correctly
- [ ] All navigation links work
- [ ] Amount selector functions properly
- [ ] Stripe checkout redirects correctly
- [ ] Success page displays after payment
- [ ] Email delivery with codes works
- [ ] Mobile responsive on all pages
- [ ] Forms validate properly
- [ ] Legal pages accessible

### 14.6 Integration Verification
- [ ] Internal API accessible via VPN only
- [ ] Redemption flow working (test with IndieCrowdfund)
- [ ] Hold/release/capture flows working
- [ ] Code marked as REDEEMED after use
- [ ] Reused code properly rejected
- [ ] Balance updates correctly

### 14.7 Post-Deployment Checklist
- [ ] Database backups scheduled
- [ ] PM2 monitoring configured
- [ ] Error logging to file/service
- [ ] Uptime monitoring (e.g., UptimeRobot)
- [ ] VPN health check automated
- [ ] SendGrid webhook receiving events

---

## 15. Appendix A: API Error Codes

### 15.1 Error Code Implementation
- [ ] `INVALID_CODE_FORMAT` - Code is not 16 hex characters
- [ ] `CODE_NOT_FOUND` - No gift card matches this code
- [ ] `ALREADY_REDEEMED` - Code has already been used
- [ ] `CODE_EXPIRED` - Code is past expiration date
- [ ] `CODE_REVOKED` - Code was manually revoked
- [ ] `RATE_LIMITED` - Too many redemption attempts
- [ ] `INSUFFICIENT_BALANCE` - Not enough credits for operation
- [ ] `HOLD_NOT_FOUND` - No hold exists for this pledge
- [ ] `HOLD_NOT_ACTIVE` - Hold is not in active state
- [ ] `INVALID_AMOUNT` - Amount outside allowed range

---

## 16. Appendix B: Database Indexes for Performance

### 16.1 Additional Performance Indexes (SQL)
- [ ] `idx_giftcard_status_created` - GiftCard(status, createdAt) WHERE status = 'ACTIVE'
- [ ] `idx_credithold_expires` - CreditHold(expiresAt) WHERE status = 'ACTIVE'
- [ ] `idx_redemption_ip_time` - RedemptionAttempt(ipAddress, createdAt DESC)
- [ ] `idx_ledger_balance_time` - CreditLedger(creditBalanceId, createdAt DESC)

---

## 17. Appendix C: Glossary Implementation

### 17.1 Terms to Define in Documentation
- [ ] **Credit** - Virtual currency purchased on CreatorCredits, redeemable on IndieCrowdfund
- [ ] **Hold** - Credits reserved for an active pledge, not available for other use
- [ ] **Capture** - Converting held credits to a completed payment when project funds
- [ ] **Release** - Returning held credits to available balance when project fails
- [ ] **Platform User ID** - User's unique ID on IndieCrowdfund, used to link credit balances

---

## Summary Statistics

| Category | Items |
|----------|-------|
| Project Setup & Brand Identity | 27 |
| Database Schema | 27 |
| Gift Card Library | 7 |
| Credit Hold Library | 4 |
| Rate Limiting | 4 |
| API Endpoints | 16 |
| Stripe Integration | 17 |
| Email System | 17 |
| Server Configuration | 30 |
| Frontend Website | 58 |
| Admin Panel | 55 |
| Legal Pages | 43 |
| Validation Flow | 7 |
| Deployment | 44 |
| Appendix A (Error Codes) | 10 |
| Appendix B (Indexes) | 4 |
| Appendix C (Glossary) | 5 |
| **TOTAL** | **~371 items** |

---

## Notes

1. **Section 9 (IndieCrowdfund Integration)** is REFERENCE ONLY - do not build on this server
2. All gift card codes are stored as SHA-256 hashes, never plaintext
3. Internal API binds ONLY to VPN interface (10.10.0.1:3001)
4. Consider having legal pages reviewed by an attorney before launch
5. Test thoroughly with Stripe test mode before going live
6. Document version: 1.0 (as per spec)
