# CreatorCredits - Gift Card Service Technical Specification

## Document Overview

This specification covers the complete build-out of the CreatorCredits gift card service, a standalone application that sells platform credits redeemable on IndieCrowdfund.

### What This Document Covers

| Section | Build Target |
|---------|--------------|
| CreatorCredits Service (Sections 1-8, 10-15) | **BUILD ON THIS SERVER** |
| IndieCrowdfund Integration (Section 9) | **REFERENCE ONLY - Separate server implementation** |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Gift Card System](#5-gift-card-system)
6. [API Specification](#6-api-specification)
7. [Stripe Integration](#7-stripe-integration)
8. [Server Configuration & Security](#8-server-configuration--security)
9. [IndieCrowdfund Integration Reference](#9-indiecrowdfund-integration-reference) *(External - Do Not Build)*
10. [Frontend Website](#10-frontend-website)
11. [Admin Panel](#11-admin-panel)
12. [Email System (SendGrid)](#12-email-system-sendgrid)
13. [Code Validation & Redemption Flow](#13-code-validation--redemption-flow)
14. [Legal Pages](#14-legal-pages)
15. [Deployment Checklist](#15-deployment-checklist)

---

## 1. Project Overview

### 1.1 Purpose

CreatorCredits is a standalone gift card/credits store that enables users to purchase platform credits which can be redeemed on IndieCrowdfund to back projects. This architecture allows IndieCrowdfund to support NSFW content without directly processing those transactions through Stripe.

### 1.2 Business Model

- Users purchase credits on CreatorCredits (processed via Stripe as digital goods)
- Users receive a 16-character hex code
- Users redeem codes on IndieCrowdfund to add credits to their balance
- Credits are used to back NSFW projects on IndieCrowdfund
- SFW projects on IndieCrowdfund continue to use direct Stripe payments

### 1.3 Key Features

- Gift card purchase with preset and custom amounts
- Secure 16-character hex code generation
- Code validation and redemption API (internal only)
- Credit balance management
- Hold/capture system for pledge lifecycle
- Full audit trail and transaction history

### 1.4 Domain & Branding

- **Domain**: Choose a neutral name (e.g., `creatorcredits.com`, `fundingcredits.com`)
- **Branding**: Clean, generic fintech aesthetic
- **No reference** to adult content, NSFW, or specific content types
- **Minimal reference** to IndieCrowdfund (just "Redeem on partner platforms")

---

## 2. Architecture

### 2.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Public Internet                            │
└──────────────────────┬──────────────────────┬───────────────────────┘
                       │                      │
                       ▼                      ▼
            ┌────────────────────┐  ┌────────────────────┐
            │  CreatorCredits    │  │  IndieCrowdfund    │
            │  Server A          │  │  Server B          │
            │                    │  │                    │
            │  ┌──────────────┐  │  │  ┌──────────────┐  │
            │  │ Next.js App  │  │  │  │ Next.js App  │  │
            │  └──────────────┘  │  │  └──────────────┘  │
            │  ┌──────────────┐  │  │  ┌──────────────┐  │
            │  │ PostgreSQL   │  │  │  │ PostgreSQL   │  │
            │  └──────────────┘  │  │  └──────────────┘  │
            │                    │  │                    │
            └─────────┬──────────┘  └──────────┬─────────┘
                      │                        │
                      │    WireGuard Tunnel    │
                      │      10.10.0.0/24      │
                      └────────────┬───────────┘
                                   │
                          Private API Communication
                          (Validation, Balance, Holds)
```

### 2.2 Communication Flow

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│    User     │          │ CreatorCredits│        │IndieCrowdfund│
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │  1. Purchase Credits   │                        │
       │───────────────────────►│                        │
       │                        │                        │
       │  2. Stripe Checkout    │                        │
       │◄──────────────────────►│                        │
       │                        │                        │
       │  3. Receive Hex Code   │                        │
       │◄───────────────────────│                        │
       │                        │                        │
       │  4. Redeem Code        │                        │
       │────────────────────────┼───────────────────────►│
       │                        │                        │
       │                        │  5. Validate (VPN)     │
       │                        │◄───────────────────────│
       │                        │                        │
       │                        │  6. Mark Redeemed      │
       │                        │───────────────────────►│
       │                        │                        │
       │  7. Balance Updated    │                        │
       │◄───────────────────────┼────────────────────────│
       │                        │                        │
```

### 2.3 Network Architecture

| Server | Public IP | VPN IP | Role |
|--------|-----------|--------|------|
| CreatorCredits (A) | `xxx.xxx.xxx.xxx` | `10.10.0.1` | Gift card service |
| IndieCrowdfund (B) | `yyy.yyy.yyy.yyy` | `10.10.0.2` | Crowdfunding platform |

**Private API Access**: CreatorCredits internal API (`/internal/*`) binds only to `10.10.0.1:3001`, accessible exclusively through the WireGuard tunnel.

---

## 3. Technology Stack

### 3.1 Core Technologies

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14.x (App Router) |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 16.x |
| ORM | Prisma | 5.x |
| Payments | Stripe | Latest SDK |
| Styling | Tailwind CSS | 3.x |
| Email | SendGrid | Latest SDK |

### 3.2 Infrastructure

| Component | Technology |
|-----------|------------|
| VPN | WireGuard |
| Reverse Proxy | Caddy or nginx |
| Process Manager | PM2 |
| SSL | Caddy (automatic) or Let's Encrypt |

### 3.3 Development Tools

| Tool | Purpose |
|------|---------|
| pnpm | Package manager |
| ESLint | Linting |
| Prettier | Formatting |
| Vitest | Testing |

---

## 4. Database Schema

### 4.1 Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  passwordHash  String?
  
  // Profile
  firstName     String?
  lastName      String?
  
  // Stripe
  stripeCustomerId String? @unique
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  purchasedCards GiftCard[]     @relation("PurchasedCards")
  redeemedCards  GiftCard[]     @relation("RedeemedCards")
  creditBalance  CreditBalance?
  transactions   Transaction[]
  sessions       Session[]
  
  @@index([email])
  @@index([stripeCustomerId])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token        String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  
  // Session metadata
  ipAddress    String?
  userAgent    String?
  
  @@index([token])
  @@index([userId])
}

// ============================================
// GIFT CARD SYSTEM
// ============================================

model GiftCard {
  id            String         @id @default(cuid())
  
  // Code (stored as SHA-256 hash)
  codeHash      String         @unique
  codeLast4     String         // Last 4 chars for display
  
  // Value
  amount        Decimal        @db.Decimal(10, 2)
  currency      String         @default("USD")
  
  // Status
  status        GiftCardStatus @default(ACTIVE)
  
  // Purchase info
  purchaserId   String?
  purchaser     User?          @relation("PurchasedCards", fields: [purchaserId], references: [id])
  purchaseEmail String?        // For guest purchases
  
  // Stripe
  stripePaymentIntentId String? @unique
  stripeCheckoutSessionId String? @unique
  
  // Redemption info
  redeemedById  String?
  redeemedBy    User?          @relation("RedeemedCards", fields: [redeemedById], references: [id])
  redeemedAt    DateTime?
  redeemedOnPlatform String?   // Which platform redeemed it
  
  // Validity
  expiresAt     DateTime?
  
  // Timestamps
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  @@index([codeHash])
  @@index([status])
  @@index([purchaserId])
  @@index([stripePaymentIntentId])
}

enum GiftCardStatus {
  PENDING    // Created but payment not confirmed
  ACTIVE     // Paid and ready to redeem
  REDEEMED   // Already used
  EXPIRED    // Past expiration date
  REVOKED    // Manually revoked (refund, fraud, etc.)
}

// ============================================
// CREDIT BALANCE SYSTEM
// ============================================

model CreditBalance {
  id              String   @id @default(cuid())
  
  // User (linked via platform user ID)
  platformUserId  String   @unique  // User ID from IndieCrowdfund
  
  // Or local user for account linking
  userId          String?  @unique
  user            User?    @relation(fields: [userId], references: [id])
  
  // Balance
  availableBalance Decimal @db.Decimal(10, 2) @default(0)
  heldBalance      Decimal @db.Decimal(10, 2) @default(0)
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  holds           CreditHold[]
  ledgerEntries   CreditLedger[]
  
  @@index([platformUserId])
}

model CreditHold {
  id              String          @id @default(cuid())
  
  // Balance reference
  creditBalanceId String
  creditBalance   CreditBalance   @relation(fields: [creditBalanceId], references: [id])
  
  // Hold details
  amount          Decimal         @db.Decimal(10, 2)
  pledgeId        String          @unique  // IndieCrowdfund pledge ID
  projectId       String          // IndieCrowdfund project ID
  
  // Status
  status          HoldStatus      @default(ACTIVE)
  
  // Timestamps
  createdAt       DateTime        @default(now())
  expiresAt       DateTime?       // Auto-release if project deadline passes
  capturedAt      DateTime?
  releasedAt      DateTime?
  
  @@index([pledgeId])
  @@index([creditBalanceId])
  @@index([status])
}

enum HoldStatus {
  ACTIVE     // Credits held for pending pledge
  CAPTURED   // Project funded, credits transferred
  RELEASED   // Project failed or pledge cancelled
  EXPIRED    // Hold expired without action
}

model CreditLedger {
  id              String           @id @default(cuid())
  
  // Balance reference
  creditBalanceId String
  creditBalance   CreditBalance    @relation(fields: [creditBalanceId], references: [id])
  
  // Transaction details
  type            LedgerEntryType
  amount          Decimal          @db.Decimal(10, 2) // Positive = credit, Negative = debit
  
  // Running balance after this entry
  balanceAfter    Decimal          @db.Decimal(10, 2)
  
  // References
  giftCardId      String?
  holdId          String?
  description     String
  
  // Metadata
  metadata        Json?
  
  // Timestamps
  createdAt       DateTime         @default(now())
  
  @@index([creditBalanceId])
  @@index([type])
  @@index([createdAt])
}

enum LedgerEntryType {
  REDEMPTION       // Gift card redeemed, credits added
  HOLD_PLACED      // Credits held for pledge
  HOLD_RELEASED    // Held credits returned (project failed)
  HOLD_CAPTURED    // Held credits transferred to creator
  ADJUSTMENT       // Manual adjustment
  REFUND           // Refund processed
}

// ============================================
// TRANSACTIONS & AUDIT
// ============================================

model Transaction {
  id              String            @id @default(cuid())
  
  // User (optional for guest purchases)
  userId          String?
  user            User?             @relation(fields: [userId], references: [id])
  guestEmail      String?
  
  // Transaction details
  type            TransactionType
  amount          Decimal           @db.Decimal(10, 2)
  currency        String            @default("USD")
  status          TransactionStatus @default(PENDING)
  
  // Stripe references
  stripePaymentIntentId    String?
  stripeCheckoutSessionId  String?
  stripeRefundId           String?
  
  // Related gift card
  giftCardId      String?
  
  // Metadata
  metadata        Json?
  failureReason   String?
  
  // Timestamps
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  completedAt     DateTime?
  
  @@index([userId])
  @@index([stripePaymentIntentId])
  @@index([status])
}

enum TransactionType {
  PURCHASE    // Gift card purchase
  REFUND      // Refund issued
}

enum TransactionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
}

// ============================================
// RATE LIMITING & SECURITY
// ============================================

model RedemptionAttempt {
  id          String   @id @default(cuid())
  
  // Attempt details
  codeHashAttempt String   // Hash of attempted code
  ipAddress       String
  userAgent       String?
  platformUserId  String?
  
  // Result
  success     Boolean
  failureReason String?
  
  // Timestamps
  createdAt   DateTime @default(now())
  
  @@index([ipAddress, createdAt])
  @@index([platformUserId, createdAt])
  @@index([codeHashAttempt])
}

// ============================================
// SYSTEM CONFIGURATION
// ============================================

model SystemConfig {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}
```

### 4.2 Key Schema Notes

**Gift Card Security**:
- Codes are never stored in plaintext
- Only SHA-256 hash is stored in `codeHash`
- `codeLast4` for display purposes ("••••••••••••A7F3")

**Credit Balance**:
- `platformUserId` links to IndieCrowdfund user ID
- Separate `availableBalance` and `heldBalance` for pledge lifecycle
- Full ledger audit trail

**Holds System**:
- When user pledges on IndieCrowdfund, credits move from available to held
- If project fails: held → available
- If project funds: held → captured (transferred to creator)

---

## 5. Gift Card System

### 5.1 Code Generation

```typescript
// lib/giftcard/generate.ts

import crypto from 'crypto';

/**
 * Generates a cryptographically secure 16-character hex code
 * 64 bits of entropy = 18.4 quintillion possibilities
 */
export function generateGiftCardCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Formats code for display: XXXX-XXXX-XXXX-XXXX
 */
export function formatCodeForDisplay(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

/**
 * Hash code for storage (never store plaintext)
 */
export function hashCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code.toUpperCase().replace(/-/g, ''))
    .digest('hex');
}

/**
 * Extract last 4 characters for display reference
 */
export function getCodeLast4(code: string): string {
  const clean = code.replace(/-/g, '');
  return clean.slice(-4).toUpperCase();
}

/**
 * Validate code format (16 hex characters)
 */
export function isValidCodeFormat(code: string): boolean {
  const clean = code.replace(/-/g, '').toUpperCase();
  return /^[0-9A-F]{16}$/.test(clean);
}
```

### 5.2 Code Validation & Redemption

```typescript
// lib/giftcard/redeem.ts

import { prisma } from '@/lib/prisma';
import { hashCode, isValidCodeFormat } from './generate';
import { RateLimiter } from '@/lib/rateLimit';

interface RedemptionResult {
  success: boolean;
  amount?: number;
  error?: string;
  balanceAfter?: number;
}

const redeemLimiter = new RateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxAttempts: 5,       // 5 attempts per minute
});

export async function validateAndRedeemCode(
  code: string,
  platformUserId: string,
  ipAddress: string,
  userAgent?: string
): Promise<RedemptionResult> {
  
  // Rate limiting
  const rateLimitKey = `redeem:${ipAddress}`;
  if (!redeemLimiter.check(rateLimitKey)) {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'RATE_LIMITED');
    return { success: false, error: 'Too many attempts. Please wait a minute.' };
  }

  // Validate format
  if (!isValidCodeFormat(code)) {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'INVALID_FORMAT');
    return { success: false, error: 'Invalid code format.' };
  }

  const codeHash = hashCode(code);

  // Find gift card
  const giftCard = await prisma.giftCard.findUnique({
    where: { codeHash }
  });

  if (!giftCard) {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'NOT_FOUND');
    return { success: false, error: 'Invalid code.' };
  }

  // Check status
  if (giftCard.status === 'REDEEMED') {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'ALREADY_REDEEMED');
    return { success: false, error: 'This code has already been redeemed.' };
  }

  if (giftCard.status === 'EXPIRED' || (giftCard.expiresAt && giftCard.expiresAt < new Date())) {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'EXPIRED');
    return { success: false, error: 'This code has expired.' };
  }

  if (giftCard.status === 'REVOKED') {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'REVOKED');
    return { success: false, error: 'This code is no longer valid.' };
  }

  if (giftCard.status !== 'ACTIVE') {
    await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, false, 'INVALID_STATUS');
    return { success: false, error: 'This code is not available for redemption.' };
  }

  // Perform redemption in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update gift card
    await tx.giftCard.update({
      where: { id: giftCard.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedOnPlatform: 'indiecrowdfund'
      }
    });

    // Upsert credit balance
    const balance = await tx.creditBalance.upsert({
      where: { platformUserId },
      create: {
        platformUserId,
        availableBalance: giftCard.amount
      },
      update: {
        availableBalance: { increment: giftCard.amount }
      }
    });

    // Create ledger entry
    await tx.creditLedger.create({
      data: {
        creditBalanceId: balance.id,
        type: 'REDEMPTION',
        amount: giftCard.amount,
        balanceAfter: balance.availableBalance,
        giftCardId: giftCard.id,
        description: `Gift card redeemed: ••••${giftCard.codeLast4}`
      }
    });

    return balance;
  });

  await logRedemptionAttempt(code, ipAddress, platformUserId, userAgent, true, null);

  return {
    success: true,
    amount: Number(giftCard.amount),
    balanceAfter: Number(result.availableBalance)
  };
}

async function logRedemptionAttempt(
  code: string,
  ipAddress: string,
  platformUserId: string | undefined,
  userAgent: string | undefined,
  success: boolean,
  failureReason: string | null
) {
  await prisma.redemptionAttempt.create({
    data: {
      codeHashAttempt: hashCode(code),
      ipAddress,
      userAgent,
      platformUserId,
      success,
      failureReason
    }
  });
}
```

### 5.3 Credit Hold System

```typescript
// lib/credits/holds.ts

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface HoldResult {
  success: boolean;
  holdId?: string;
  error?: string;
}

interface CaptureResult {
  success: boolean;
  amount?: number;
  error?: string;
}

/**
 * Place a hold on credits for a pledge
 */
export async function placeHold(
  platformUserId: string,
  amount: number,
  pledgeId: string,
  projectId: string,
  expiresAt?: Date
): Promise<HoldResult> {
  
  const balance = await prisma.creditBalance.findUnique({
    where: { platformUserId }
  });

  if (!balance) {
    return { success: false, error: 'No credit balance found.' };
  }

  const availableBalance = Number(balance.availableBalance);
  
  if (availableBalance < amount) {
    return { 
      success: false, 
      error: `Insufficient credits. Available: ${availableBalance}, Required: ${amount}` 
    };
  }

  // Check for existing hold on this pledge
  const existingHold = await prisma.creditHold.findUnique({
    where: { pledgeId }
  });

  if (existingHold) {
    return { success: false, error: 'Hold already exists for this pledge.' };
  }

  const hold = await prisma.$transaction(async (tx) => {
    // Deduct from available, add to held
    await tx.creditBalance.update({
      where: { platformUserId },
      data: {
        availableBalance: { decrement: amount },
        heldBalance: { increment: amount }
      }
    });

    // Create hold record
    const hold = await tx.creditHold.create({
      data: {
        creditBalanceId: balance.id,
        amount: new Decimal(amount),
        pledgeId,
        projectId,
        expiresAt
      }
    });

    // Create ledger entry
    const updatedBalance = await tx.creditBalance.findUnique({
      where: { platformUserId }
    });

    await tx.creditLedger.create({
      data: {
        creditBalanceId: balance.id,
        type: 'HOLD_PLACED',
        amount: new Decimal(-amount),
        balanceAfter: updatedBalance!.availableBalance,
        holdId: hold.id,
        description: `Hold placed for pledge ${pledgeId}`
      }
    });

    return hold;
  });

  return { success: true, holdId: hold.id };
}

/**
 * Release a hold (project failed or pledge cancelled)
 */
export async function releaseHold(pledgeId: string): Promise<CaptureResult> {
  
  const hold = await prisma.creditHold.findUnique({
    where: { pledgeId },
    include: { creditBalance: true }
  });

  if (!hold) {
    return { success: false, error: 'Hold not found.' };
  }

  if (hold.status !== 'ACTIVE') {
    return { success: false, error: `Hold is not active. Current status: ${hold.status}` };
  }

  await prisma.$transaction(async (tx) => {
    const amount = Number(hold.amount);

    // Return credits to available balance
    await tx.creditBalance.update({
      where: { id: hold.creditBalanceId },
      data: {
        availableBalance: { increment: amount },
        heldBalance: { decrement: amount }
      }
    });

    // Update hold status
    await tx.creditHold.update({
      where: { id: hold.id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date()
      }
    });

    // Create ledger entry
    const updatedBalance = await tx.creditBalance.findUnique({
      where: { id: hold.creditBalanceId }
    });

    await tx.creditLedger.create({
      data: {
        creditBalanceId: hold.creditBalanceId,
        type: 'HOLD_RELEASED',
        amount: hold.amount,
        balanceAfter: updatedBalance!.availableBalance,
        holdId: hold.id,
        description: `Hold released for pledge ${pledgeId}`
      }
    });
  });

  return { success: true, amount: Number(hold.amount) };
}

/**
 * Capture a hold (project funded successfully)
 */
export async function captureHold(pledgeId: string): Promise<CaptureResult> {
  
  const hold = await prisma.creditHold.findUnique({
    where: { pledgeId },
    include: { creditBalance: true }
  });

  if (!hold) {
    return { success: false, error: 'Hold not found.' };
  }

  if (hold.status !== 'ACTIVE') {
    return { success: false, error: `Hold is not active. Current status: ${hold.status}` };
  }

  await prisma.$transaction(async (tx) => {
    const amount = Number(hold.amount);

    // Remove from held balance (credits go to creator via IndieCrowdfund)
    await tx.creditBalance.update({
      where: { id: hold.creditBalanceId },
      data: {
        heldBalance: { decrement: amount }
      }
    });

    // Update hold status
    await tx.creditHold.update({
      where: { id: hold.id },
      data: {
        status: 'CAPTURED',
        capturedAt: new Date()
      }
    });

    // Create ledger entry
    const updatedBalance = await tx.creditBalance.findUnique({
      where: { id: hold.creditBalanceId }
    });

    await tx.creditLedger.create({
      data: {
        creditBalanceId: hold.creditBalanceId,
        type: 'HOLD_CAPTURED',
        amount: new Decimal(-amount),
        balanceAfter: updatedBalance!.availableBalance,
        holdId: hold.id,
        description: `Credits captured for funded pledge ${pledgeId}`
      }
    });
  });

  return { success: true, amount: Number(hold.amount) };
}

/**
 * Get user's credit balance
 */
export async function getBalance(platformUserId: string) {
  const balance = await prisma.creditBalance.findUnique({
    where: { platformUserId },
    include: {
      holds: {
        where: { status: 'ACTIVE' }
      }
    }
  });

  if (!balance) {
    return {
      available: 0,
      held: 0,
      total: 0,
      activeHolds: []
    };
  }

  return {
    available: Number(balance.availableBalance),
    held: Number(balance.heldBalance),
    total: Number(balance.availableBalance) + Number(balance.heldBalance),
    activeHolds: balance.holds.map(h => ({
      holdId: h.id,
      amount: Number(h.amount),
      pledgeId: h.pledgeId,
      projectId: h.projectId,
      createdAt: h.createdAt
    }))
  };
}
```

---

## 6. API Specification

### 6.1 API Overview

| Category | Base Path | Access |
|----------|-----------|--------|
| Public API | `/api/*` | Public (rate limited) |
| Internal API | `/internal/*` | VPN only (10.10.0.1) |
| Webhooks | `/webhook/*` | Stripe IPs only |

### 6.2 Public API Endpoints

#### POST `/api/checkout`

Create a Stripe checkout session for purchasing credits.

**Request:**
```json
{
  "amount": 25.00,
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
  "sessionId": "cs_live_..."
}
```

#### GET `/api/cards/:id/status`

Check status of a gift card (by transaction/order ID, not code).

**Response:**
```json
{
  "status": "ACTIVE",
  "amount": 25.00,
  "codeLast4": "A7F3",
  "createdAt": "2025-01-15T10:30:00Z",
  "expiresAt": null
}
```

#### GET `/api/balance`

Get credit balance (requires authentication or platform user ID).

**Response:**
```json
{
  "available": 75.00,
  "held": 25.00,
  "total": 100.00
}
```

### 6.3 Internal API Endpoints (VPN Only)

All internal endpoints require `X-Internal-Key` header.

#### POST `/internal/validate`

Validate and redeem a gift card code.

**Request:**
```json
{
  "code": "A7F3B2E19C4D8F01",
  "platformUserId": "user_abc123",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "amount": 25.00,
  "balanceAfter": 100.00
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Invalid code."
}
```

#### POST `/internal/balance`

Get user's credit balance.

**Request:**
```json
{
  "platformUserId": "user_abc123"
}
```

**Response:**
```json
{
  "available": 75.00,
  "held": 25.00,
  "total": 100.00,
  "activeHolds": [
    {
      "holdId": "hold_xyz",
      "amount": 25.00,
      "pledgeId": "pledge_123",
      "projectId": "project_456",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### POST `/internal/hold`

Place a hold on credits for a pledge.

**Request:**
```json
{
  "platformUserId": "user_abc123",
  "amount": 25.00,
  "pledgeId": "pledge_123",
  "projectId": "project_456",
  "expiresAt": "2025-02-15T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "holdId": "hold_xyz"
}
```

#### POST `/internal/release`

Release a hold (project failed or pledge cancelled).

**Request:**
```json
{
  "pledgeId": "pledge_123"
}
```

**Response:**
```json
{
  "success": true,
  "amount": 25.00
}
```

#### POST `/internal/capture`

Capture a hold (project funded).

**Request:**
```json
{
  "pledgeId": "pledge_123"
}
```

**Response:**
```json
{
  "success": true,
  "amount": 25.00
}
```

#### GET `/internal/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z",
  "database": "connected"
}
```

### 6.4 Internal API Implementation

```typescript
// app/internal/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { validateAndRedeemCode } from '@/lib/giftcard/redeem';
import { getBalance, placeHold, releaseHold, captureHold } from '@/lib/credits/holds';
import { prisma } from '@/lib/prisma';

// Middleware to check internal API key
function validateInternalRequest(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-Internal-Key');
  return apiKey === process.env.INTERNAL_API_KEY;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Validate internal access
  if (!validateInternalRequest(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const path = params.path.join('/');
  const body = await request.json();

  try {
    switch (path) {
      case 'validate': {
        const { code, platformUserId, ipAddress, userAgent } = body;
        const result = await validateAndRedeemCode(code, platformUserId, ipAddress, userAgent);
        return NextResponse.json(result);
      }

      case 'balance': {
        const { platformUserId } = body;
        const result = await getBalance(platformUserId);
        return NextResponse.json(result);
      }

      case 'hold': {
        const { platformUserId, amount, pledgeId, projectId, expiresAt } = body;
        const result = await placeHold(
          platformUserId, 
          amount, 
          pledgeId, 
          projectId, 
          expiresAt ? new Date(expiresAt) : undefined
        );
        return NextResponse.json(result);
      }

      case 'release': {
        const { pledgeId } = body;
        const result = await releaseHold(pledgeId);
        return NextResponse.json(result);
      }

      case 'capture': {
        const { pledgeId } = body;
        const result = await captureHold(pledgeId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Internal API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (!validateInternalRequest(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const path = params.path.join('/');

  if (path === 'health') {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch {
      return NextResponse.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected'
      }, { status: 503 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

### 6.5 Rate Limiting

```typescript
// lib/rateLimit.ts

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) this.cleanup();

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return true;
    }

    if (entry.count >= this.config.maxAttempts) {
      return false;
    }

    entry.count++;
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// For production, use Redis instead:
// import { Redis } from 'ioredis';
// Implement sliding window or token bucket algorithm
```

---

## 7. Stripe Integration

### 7.1 Checkout Flow

```typescript
// app/api/checkout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { generateGiftCardCode, hashCode, getCodeLast4 } from '@/lib/giftcard/generate';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, email } = body;

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < MIN_AMOUNT || numAmount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}` },
        { status: 400 }
      );
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400 }
      );
    }

    // Generate gift card code (but don't activate yet)
    const code = generateGiftCardCode();
    const codeHash = hashCode(code);
    const codeLast4 = getCodeLast4(code);

    // Create pending gift card record
    const giftCard = await prisma.giftCard.create({
      data: {
        codeHash,
        codeLast4,
        amount: numAmount,
        status: 'PENDING',
        purchaseEmail: email
      }
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Creator Credits',
              description: `$${numAmount.toFixed(2)} in platform credits`,
            },
            unit_amount: Math.round(numAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancelled`,
      customer_email: email,
      metadata: {
        giftCardId: giftCard.id,
        giftCardCode: code, // Stored encrypted in Stripe, delivered on success
      },
    });

    // Update gift card with session ID
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { stripeCheckoutSessionId: session.id }
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        guestEmail: email,
        type: 'PURCHASE',
        amount: numAmount,
        status: 'PENDING',
        stripeCheckoutSessionId: session.id,
        giftCardId: giftCard.id
      }
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

### 7.2 Webhook Handler

```typescript
// app/webhook/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendGiftCardEmail } from '@/lib/email/sendGiftCard';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulPayment(session);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleExpiredSession(session);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  const { giftCardId, giftCardCode } = session.metadata || {};

  if (!giftCardId || !giftCardCode) {
    console.error('Missing gift card metadata in session:', session.id);
    return;
  }

  // Update gift card to active
  const giftCard = await prisma.giftCard.update({
    where: { id: giftCardId },
    data: {
      status: 'ACTIVE',
      stripePaymentIntentId: session.payment_intent as string
    }
  });

  // Update transaction
  await prisma.transaction.updateMany({
    where: { stripeCheckoutSessionId: session.id },
    data: {
      status: 'COMPLETED',
      stripePaymentIntentId: session.payment_intent as string,
      completedAt: new Date()
    }
  });

  // Send email with code
  await sendGiftCardEmail({
    to: session.customer_email!,
    code: giftCardCode,
    amount: Number(giftCard.amount)
  });
}

async function handleExpiredSession(session: Stripe.Checkout.Session) {
  const { giftCardId } = session.metadata || {};

  if (giftCardId) {
    // Clean up pending gift card
    await prisma.giftCard.delete({
      where: { id: giftCardId }
    });

    await prisma.transaction.updateMany({
      where: { stripeCheckoutSessionId: session.id },
      data: { status: 'FAILED', failureReason: 'Session expired' }
    });
  }
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  // Find and revoke the gift card
  const giftCard = await prisma.giftCard.findFirst({
    where: { stripePaymentIntentId: paymentIntentId }
  });

  if (giftCard) {
    if (giftCard.status === 'REDEEMED') {
      // TODO: Handle refund for already-redeemed card
      // This requires deducting from user's balance
      console.error('Refund requested for redeemed card:', giftCard.id);
      return;
    }

    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'REVOKED' }
    });

    await prisma.transaction.create({
      data: {
        guestEmail: giftCard.purchaseEmail,
        type: 'REFUND',
        amount: giftCard.amount,
        status: 'COMPLETED',
        stripeRefundId: charge.refunds?.data[0]?.id,
        giftCardId: giftCard.id,
        completedAt: new Date()
      }
    });
  }
}
```

### 7.3 Email Delivery

```typescript
// lib/email/sendGiftCard.ts

import { Resend } from 'resend';
import { GiftCardEmail } from '@/emails/GiftCardEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendGiftCardParams {
  to: string;
  code: string;
  amount: number;
}

export async function sendGiftCardEmail({ to, code, amount }: SendGiftCardParams) {
  const formattedCode = code.match(/.{1,4}/g)?.join('-') ?? code;

  await resend.emails.send({
    from: 'CreatorCredits <noreply@creatorcredits.com>',
    to,
    subject: `Your $${amount.toFixed(2)} Creator Credits Code`,
    react: GiftCardEmail({
      code: formattedCode,
      amount,
      redemptionUrl: 'https://indiecrowdfund.com/redeem'
    })
  });
}
```

```tsx
// emails/GiftCardEmail.tsx

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Hr
} from '@react-email/components';

interface GiftCardEmailProps {
  code: string;
  amount: number;
  redemptionUrl: string;
}

export function GiftCardEmail({ code, amount, redemptionUrl }: GiftCardEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your ${amount.toFixed(2)} Creator Credits code is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Creator Credits</Heading>
          
          <Text style={text}>
            Thank you for your purchase! Here's your credit code:
          </Text>

          <Section style={codeSection}>
            <Text style={codeText}>{code}</Text>
          </Section>

          <Text style={text}>
            This code is worth <strong>${amount.toFixed(2)}</strong> in platform credits.
          </Text>

          <Button style={button} href={redemptionUrl}>
            Redeem Now
          </Button>

          <Hr style={hr} />

          <Text style={footer}>
            Keep this code safe. It can only be redeemed once.
            If you didn't make this purchase, please contact support.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'system-ui, sans-serif' };
const container = { margin: '0 auto', padding: '40px 20px', maxWidth: '560px' };
const h1 = { color: '#1a1a1a', fontSize: '24px', fontWeight: '600', margin: '0 0 20px' };
const text = { color: '#4a4a4a', fontSize: '16px', lineHeight: '24px', margin: '0 0 20px' };
const codeSection = { background: '#1a1a1a', borderRadius: '8px', padding: '24px', margin: '24px 0' };
const codeText = { color: '#ffffff', fontSize: '28px', fontFamily: 'monospace', textAlign: 'center' as const, margin: 0, letterSpacing: '2px' };
const button = { backgroundColor: '#5469d4', borderRadius: '4px', color: '#fff', fontSize: '16px', textDecoration: 'none', textAlign: 'center' as const, display: 'block', padding: '12px 24px' };
const hr = { borderColor: '#e6e6e6', margin: '32px 0' };
const footer = { color: '#8898aa', fontSize: '14px', lineHeight: '20px' };
```

---

## 8. Server Configuration & Security

### 8.1 WireGuard VPN Setup

#### Server A (CreatorCredits)

```bash
# Install WireGuard
sudo apt update && sudo apt install wireguard -y

# Generate keys
wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
chmod 600 /etc/wireguard/private.key
```

```ini
# /etc/wireguard/wg0.conf

[Interface]
PrivateKey = <CONTENTS_OF_PRIVATE_KEY>
Address = 10.10.0.1/24
ListenPort = 51820
PostUp = iptables -A INPUT -p udp --dport 51820 -j ACCEPT
PostDown = iptables -D INPUT -p udp --dport 51820 -j ACCEPT

[Peer]
# IndieCrowdfund Server
PublicKey = <INDIECROWDFUND_PUBLIC_KEY>
AllowedIPs = 10.10.0.2/32
```

#### Server B (IndieCrowdfund) - Reference Only

```ini
# /etc/wireguard/wg0.conf

[Interface]
PrivateKey = <CONTENTS_OF_PRIVATE_KEY>
Address = 10.10.0.2/24

[Peer]
# CreatorCredits Server
PublicKey = <CREATORCREDITS_PUBLIC_KEY>
AllowedIPs = 10.10.0.1/32
Endpoint = <CREATORCREDITS_PUBLIC_IP>:51820
PersistentKeepalive = 25
```

#### Enable WireGuard

```bash
# Both servers
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Verify connection
ping 10.10.0.2  # From Server A
ping 10.10.0.1  # From Server B
```

### 8.2 Firewall Configuration (UFW)

```bash
# Server A - CreatorCredits

# Reset and set defaults
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (consider limiting to specific IPs)
sudo ufw allow 22/tcp

# HTTP/HTTPS for public site
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# WireGuard
sudo ufw allow 51820/udp

# Internal API - VPN only
sudo ufw allow from 10.10.0.2 to any port 3001 proto tcp

# Enable firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

### 8.3 Caddy Configuration

```caddyfile
# /etc/caddy/Caddyfile

creatorcredits.com {
    # Reverse proxy to Next.js app
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    # Block access to internal routes from public
    @internal path /internal/*
    respond @internal 404

    # Logging
    log {
        output file /var/log/caddy/access.log
        format json
    }
}
```

### 8.4 Internal API Server

```typescript
// server.ts - Separate internal API server

import express from 'express';
import { internalRoutes } from './routes/internal';

const internalApp = express();

internalApp.use(express.json());

// Only accept requests with valid internal key
internalApp.use((req, res, next) => {
  const apiKey = req.headers['x-internal-key'];
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

internalApp.use('/internal', internalRoutes);

// Bind ONLY to VPN interface
internalApp.listen(3001, '10.10.0.1', () => {
  console.log('Internal API listening on 10.10.0.1:3001');
});
```

### 8.5 Environment Variables

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/creatorcredits"

# Next.js
NEXT_PUBLIC_BASE_URL="https://creatorcredits.com"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# Internal API
INTERNAL_API_KEY="your-256-bit-secret-here"

# SendGrid
SENDGRID_API_KEY="SG...."
SENDGRID_FROM_EMAIL="noreply@creatorcredits.com"
SENDGRID_FROM_NAME="CreatorCredits"
SENDGRID_WEBHOOK_SECRET="your-webhook-verification-key"

# Admin
ADMIN_SESSION_SECRET="your-session-secret"
ADMIN_INITIAL_EMAIL="admin@example.com"
ADMIN_INITIAL_PASSWORD="change-me-on-first-login"

# Security
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_ATTEMPTS=5
```

### 8.6 PM2 Process Management

```javascript
// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'creatorcredits-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/creatorcredits',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'creatorcredits-internal',
      script: 'dist/server.js',
      cwd: '/var/www/creatorcredits',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

```bash
# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8.7 Database Backup Script

```bash
#!/bin/bash
# /opt/scripts/backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgres"
FILENAME="creatorcredits_${TIMESTAMP}.sql.gz"

# Create backup
pg_dump -U postgres creatorcredits | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 30 days
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +30 -delete

# Optional: Upload to S3
# aws s3 cp "${BACKUP_DIR}/${FILENAME}" s3://your-bucket/backups/
```

```bash
# Add to crontab
0 3 * * * /opt/scripts/backup-db.sh
```

---

## 9. IndieCrowdfund Integration Reference

> ⚠️ **IMPORTANT: DO NOT BUILD ON THIS SERVER**
> 
> This section documents how IndieCrowdfund integrates with the CreatorCredits service.
> This code will be implemented on the **IndieCrowdfund server (Server B)**, not here.
> It is included for reference and to ensure both systems are designed compatibly.

### 9.1 Integration Overview

IndieCrowdfund's existing payment architecture uses Stripe for direct payments on SFW projects. The credit system integration adds an alternative payment path for NSFW projects:

```
┌─────────────────────────────────────────────────────────────────┐
│                     IndieCrowdfund Payment Flow                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User backs project                                            │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────┐                                               │
│   │ Is NSFW?    │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│    ┌─────┴─────┐                                                │
│    │           │                                                │
│    ▼           ▼                                                │
│   NO          YES                                               │
│    │           │                                                │
│    ▼           ▼                                                │
│ ┌──────┐   ┌──────────────┐                                     │
│ │Stripe│   │Check Credits │                                     │
│ │Direct│   │Balance (VPN) │                                     │
│ └──────┘   └──────┬───────┘                                     │
│                   │                                             │
│             ┌─────┴─────┐                                       │
│             │           │                                       │
│             ▼           ▼                                       │
│         Sufficient  Insufficient                                │
│             │           │                                       │
│             ▼           ▼                                       │
│        ┌────────┐  ┌─────────────┐                              │
│        │Place   │  │Redirect to  │                              │
│        │Hold    │  │CreatorCredits│                             │
│        └────────┘  └─────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Credit Service Client (IndieCrowdfund)

```typescript
// lib/services/creditService.ts
// TO BE IMPLEMENTED ON INDIECROWDFUND SERVER

const CREDIT_SERVICE_URL = process.env.CREDIT_SERVICE_INTERNAL_URL; // http://10.10.0.1:3001
const INTERNAL_API_KEY = process.env.CREDIT_SERVICE_API_KEY;

interface CreditBalance {
  available: number;
  held: number;
  total: number;
  activeHolds: Array<{
    holdId: string;
    amount: number;
    pledgeId: string;
    projectId: string;
    createdAt: string;
  }>;
}

interface HoldResult {
  success: boolean;
  holdId?: string;
  error?: string;
}

interface RedeemResult {
  success: boolean;
  amount?: number;
  balanceAfter?: number;
  error?: string;
}

class CreditService {
  private async request<T>(endpoint: string, body: object): Promise<T> {
    const response = await fetch(`${CREDIT_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Credit service error: ${response.status}`);
    }

    return response.json();
  }

  async getBalance(userId: string): Promise<CreditBalance> {
    return this.request('/internal/balance', { platformUserId: userId });
  }

  async redeemCode(
    code: string,
    userId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<RedeemResult> {
    return this.request('/internal/validate', {
      code,
      platformUserId: userId,
      ipAddress,
      userAgent
    });
  }

  async placeHold(
    userId: string,
    amount: number,
    pledgeId: string,
    projectId: string,
    expiresAt?: Date
  ): Promise<HoldResult> {
    return this.request('/internal/hold', {
      platformUserId: userId,
      amount,
      pledgeId,
      projectId,
      expiresAt: expiresAt?.toISOString()
    });
  }

  async releaseHold(pledgeId: string): Promise<{ success: boolean; amount?: number }> {
    return this.request('/internal/release', { pledgeId });
  }

  async captureHold(pledgeId: string): Promise<{ success: boolean; amount?: number }> {
    return this.request('/internal/capture', { pledgeId });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${CREDIT_SERVICE_URL}/internal/health`, {
        headers: { 'X-Internal-Key': INTERNAL_API_KEY! },
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const creditService = new CreditService();
```

### 9.3 Pledge Flow Modification (IndieCrowdfund)

```typescript
// Example of modified pledge creation logic
// TO BE IMPLEMENTED ON INDIECROWDFUND SERVER

import { creditService } from '@/lib/services/creditService';

async function createPledge(
  userId: string,
  projectId: string,
  rewardId: string,
  amount: number
): Promise<PledgeResult> {
  
  const project = await getProject(projectId);
  
  // SFW projects use existing Stripe flow
  if (!project.isNsfw) {
    return createStripePledge(userId, projectId, rewardId, amount);
  }

  // NSFW projects use credit system
  const balance = await creditService.getBalance(userId);
  
  if (balance.available < amount) {
    return {
      success: false,
      error: 'INSUFFICIENT_CREDITS',
      required: amount,
      available: balance.available,
      purchaseUrl: `https://creatorcredits.com?amount=${amount - balance.available}`
    };
  }

  // Create pledge record first
  const pledge = await prisma.pledge.create({
    data: {
      userId,
      projectId,
      rewardId,
      amount,
      paymentMethod: 'CREDITS',
      status: 'PENDING_HOLD'
    }
  });

  // Place hold on credits
  const holdResult = await creditService.placeHold(
    userId,
    amount,
    pledge.id,
    projectId,
    project.deadline
  );

  if (!holdResult.success) {
    await prisma.pledge.update({
      where: { id: pledge.id },
      data: { status: 'FAILED', failureReason: holdResult.error }
    });
    
    return {
      success: false,
      error: holdResult.error || 'Failed to place hold'
    };
  }

  // Update pledge with hold ID
  await prisma.pledge.update({
    where: { id: pledge.id },
    data: {
      status: 'ACTIVE',
      creditHoldId: holdResult.holdId
    }
  });

  return { success: true, pledgeId: pledge.id };
}
```

### 9.4 Project Funding Completion (IndieCrowdfund)

```typescript
// When a project reaches its funding goal
// TO BE IMPLEMENTED ON INDIECROWDFUND SERVER

async function processSuccessfulFunding(projectId: string) {
  const pledges = await prisma.pledge.findMany({
    where: {
      projectId,
      status: 'ACTIVE',
      paymentMethod: 'CREDITS'
    }
  });

  for (const pledge of pledges) {
    try {
      // Capture the held credits
      const result = await creditService.captureHold(pledge.id);
      
      if (result.success) {
        await prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: 'CAPTURED' }
        });
        
        // Add to creator's payout
        await addToCreatorPayout(pledge.projectId, result.amount!);
      }
    } catch (error) {
      console.error(`Failed to capture pledge ${pledge.id}:`, error);
      // Queue for retry
    }
  }
}
```

### 9.5 Project Failure / Cancellation (IndieCrowdfund)

```typescript
// When a project fails to reach its goal
// TO BE IMPLEMENTED ON INDIECROWDFUND SERVER

async function processFailedProject(projectId: string) {
  const pledges = await prisma.pledge.findMany({
    where: {
      projectId,
      status: 'ACTIVE',
      paymentMethod: 'CREDITS'
    }
  });

  for (const pledge of pledges) {
    try {
      // Release the held credits back to user
      const result = await creditService.releaseHold(pledge.id);
      
      if (result.success) {
        await prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: 'REFUNDED' }
        });
        
        // Notify user their credits were returned
        await sendCreditRefundNotification(pledge.userId, result.amount!);
      }
    } catch (error) {
      console.error(`Failed to release pledge ${pledge.id}:`, error);
      // Queue for retry
    }
  }
}
```

### 9.6 Code Redemption UI (IndieCrowdfund)

```tsx
// components/RedeemCreditsForm.tsx
// TO BE IMPLEMENTED ON INDIECROWDFUND SERVER

'use client';

import { useState } from 'react';
import { redeemCode } from '@/app/actions/credits';

export function RedeemCreditsForm() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const result = await redeemCode(code);

    if (result.success) {
      setStatus('success');
      setMessage(`$${result.amount?.toFixed(2)} added to your balance!`);
      setCode('');
    } else {
      setStatus('error');
      setMessage(result.error || 'Failed to redeem code');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="code">Enter your credit code</label>
      <input
        id="code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        maxLength={19}
      />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Redeeming...' : 'Redeem'}
      </button>
      {message && (
        <p className={status === 'success' ? 'text-green-600' : 'text-red-600'}>
          {message}
        </p>
      )}
    </form>
  );
}
```

### 9.7 Environment Variables (IndieCrowdfund)

```bash
# Add to IndieCrowdfund's .env
# TO BE CONFIGURED ON INDIECROWDFUND SERVER

# Credit Service (VPN)
CREDIT_SERVICE_INTERNAL_URL="http://10.10.0.1:3001"
CREDIT_SERVICE_API_KEY="same-256-bit-secret-as-creatorcredits"
```

### 9.8 Database Additions (IndieCrowdfund)

```prisma
// Additions to IndieCrowdfund's Prisma schema
// TO BE IMPLEMENTED ON INDIECROWDFUND SERVER

model Pledge {
  // ... existing fields ...
  
  // Add for credit payments
  paymentMethod   PaymentMethod @default(STRIPE)
  creditHoldId    String?       // Reference to hold on CreatorCredits
}

enum PaymentMethod {
  STRIPE
  CREDITS
}

model UserCreditBalance {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  
  // Cached balance (synced from CreatorCredits)
  cachedBalance    Decimal  @db.Decimal(10, 2) @default(0)
  lastSyncedAt     DateTime @default(now())
}
```

---

## 11. Admin Panel

### 11.1 Admin Overview

The admin panel provides complete control over all aspects of the CreatorCredits platform. Only authenticated administrators can access `/admin/*` routes.

#### Admin URL Structure

```
/admin                          # Dashboard
/admin/login                    # Admin authentication

# Configuration
/admin/settings                 # General settings
/admin/settings/api             # API configuration
/admin/settings/payments        # Payment processor settings
/admin/settings/email           # Email/SendGrid configuration
/admin/settings/security        # Security settings

# Partner Management
/admin/partners                 # Connected platforms list
/admin/partners/new             # Add new partner
/admin/partners/:id             # Partner details & config
/admin/partners/:id/api-keys    # Partner API key management

# Transactions & Finance
/admin/transactions             # All transactions
/admin/transactions/:id         # Transaction details
/admin/payments                 # Stripe payment history
/admin/payments/:id             # Payment details
/admin/payouts                  # Partner payout management
/admin/reports                  # Financial reports

# Gift Cards
/admin/gift-cards               # All gift cards
/admin/gift-cards/:id           # Gift card details
/admin/gift-cards/generate      # Manual generation (admin use)

# Users
/admin/users                    # User management
/admin/users/:id                # User details
/admin/admins                   # Admin user management

# Email System
/admin/emails                   # Email dashboard
/admin/emails/templates         # Email template management
/admin/emails/templates/:id     # Edit template
/admin/emails/logs              # Sent email logs
/admin/emails/accounts          # Email account configuration

# System
/admin/logs                     # System logs
/admin/logs/api                 # API request logs
/admin/logs/errors              # Error logs
/admin/logs/security            # Security audit logs
```

### 11.2 Admin Authentication

#### Admin User Model

```prisma
model AdminUser {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  
  // Profile
  firstName     String
  lastName      String
  
  // Role & Permissions
  role          AdminRole @default(ADMIN)
  permissions   Json?     // Granular permissions override
  
  // Security
  mfaEnabled    Boolean   @default(false)
  mfaSecret     String?
  lastLoginAt   DateTime?
  lastLoginIp   String?
  failedAttempts Int      @default(0)
  lockedUntil   DateTime?
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  sessions      AdminSession[]
  auditLogs     AdminAuditLog[]
  
  @@index([email])
}

enum AdminRole {
  SUPER_ADMIN   // Full access to everything
  ADMIN         // Full access except admin management
  FINANCE       // Transactions, payments, reports only
  SUPPORT       // Users, gift cards, transactions (read-only finance)
  VIEWER        // Read-only access to everything
}

model AdminSession {
  id          String    @id @default(cuid())
  adminUserId String
  admin       AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  
  token       String    @unique
  ipAddress   String
  userAgent   String?
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  
  @@index([token])
}

model AdminAuditLog {
  id          String    @id @default(cuid())
  adminUserId String
  admin       AdminUser @relation(fields: [adminUserId], references: [id])
  
  action      String    // e.g., "settings.update", "giftcard.revoke"
  resource    String    // e.g., "GiftCard", "Partner"
  resourceId  String?
  
  before      Json?     // State before change
  after       Json?     // State after change
  
  ipAddress   String
  userAgent   String?
  
  createdAt   DateTime  @default(now())
  
  @@index([adminUserId])
  @@index([action])
  @@index([createdAt])
}
```

#### Authentication Features

- Email/password login with bcrypt hashing
- Optional MFA via TOTP (Google Authenticator, Authy)
- Session-based authentication with secure HTTP-only cookies
- Auto-lockout after 5 failed attempts (30-minute lockout)
- Session expiry after 8 hours of inactivity
- IP-based session validation
- Full audit logging of all admin actions

### 11.3 Admin Dashboard

The dashboard provides at-a-glance metrics and quick actions.

#### Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Total Revenue | Lifetime credit purchases |
| Revenue (Today/Week/Month) | Time-filtered revenue |
| Active Gift Cards | Cards purchased but not redeemed |
| Redemption Rate | % of cards redeemed |
| Total Users | Registered users (purchasers) |
| Connected Partners | Active platform integrations |
| Pending Payouts | Amount owed to partners |
| Failed Transactions | Transactions needing attention |

#### Dashboard Widgets

- **Revenue Chart** - Line graph showing daily/weekly/monthly revenue
- **Recent Transactions** - Last 10 transactions with quick actions
- **Recent Redemptions** - Last 10 code redemptions across partners
- **System Health** - Database, VPN, email service status
- **Alerts** - Failed payments, security events, system warnings

#### Quick Actions

- Generate gift card (admin use)
- Look up transaction by ID
- Look up gift card by code (last 4 digits)
- View recent API errors
- Export reports

### 11.4 System Configuration

#### General Settings (`/admin/settings`)

| Setting | Description |
|---------|-------------|
| Site Name | Display name (CreatorCredits) |
| Site URL | Public URL |
| Support Email | Contact email for users |
| Timezone | System timezone for reports |
| Maintenance Mode | Enable/disable public access |
| Maintenance Message | Custom maintenance message |

#### API Configuration (`/admin/settings/api`)

| Setting | Description |
|---------|-------------|
| Internal API Key | Key for partner VPN communication |
| API Rate Limits | Requests per minute/hour |
| Allowed IP Ranges | IP whitelist for internal API |
| Webhook Retry Config | Retry attempts and backoff |
| API Version | Current API version |

#### Payment Settings (`/admin/settings/payments`)

| Setting | Description |
|---------|-------------|
| Stripe Secret Key | Stripe API secret key |
| Stripe Publishable Key | Stripe public key |
| Stripe Webhook Secret | Webhook signing secret |
| Minimum Purchase | Minimum credit purchase ($5) |
| Maximum Purchase | Maximum credit purchase ($500) |
| Preset Amounts | Quick-select amounts (10, 25, 50, 100, 250) |
| Currency | Default currency (USD) |

#### Email Settings (`/admin/settings/email`)

| Setting | Description |
|---------|-------------|
| SendGrid API Key | SendGrid API key |
| From Email | Sender email address |
| From Name | Sender display name |
| Reply-To Email | Reply-to address |
| BCC Admin | BCC address for transaction emails |
| Email Footer | Custom footer for all emails |

#### Security Settings (`/admin/settings/security`)

| Setting | Description |
|---------|-------------|
| Require MFA | Force MFA for all admins |
| Session Timeout | Admin session duration |
| Max Login Attempts | Before account lockout |
| Lockout Duration | Lockout period after failed attempts |
| Password Policy | Minimum requirements |
| Allowed Admin IPs | IP whitelist for admin access |

### 11.5 Partner Management

Partners are platforms (like IndieCrowdfund) that integrate with CreatorCredits.

#### Partner Model

```prisma
model Partner {
  id            String        @id @default(cuid())
  
  // Identity
  name          String        // "IndieCrowdfund"
  slug          String        @unique // "indiecrowdfund"
  
  // Contact
  contactName   String
  contactEmail  String
  website       String?
  
  // Configuration
  status        PartnerStatus @default(PENDING)
  vpnIp         String?       // Partner's VPN IP (e.g., 10.10.0.2)
  webhookUrl    String?       // Partner's webhook endpoint
  
  // Branding
  logoUrl       String?
  description   String?
  
  // Settings
  settings      Json?         // Partner-specific settings
  
  // Timestamps
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  activatedAt   DateTime?
  
  // Relations
  apiKeys       PartnerApiKey[]
  redemptions   GiftCard[]    @relation("RedeemedOnPartner")
  
  @@index([slug])
  @@index([status])
}

enum PartnerStatus {
  PENDING       // Awaiting setup
  ACTIVE        // Live and operational
  SUSPENDED     // Temporarily disabled
  DEACTIVATED   // Permanently disabled
}

model PartnerApiKey {
  id          String    @id @default(cuid())
  partnerId   String
  partner     Partner   @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  
  name        String    // "Production", "Staging"
  keyHash     String    @unique // SHA-256 hash of the key
  keyPrefix   String    // First 8 chars for identification
  
  // Permissions
  permissions Json      // Specific endpoint permissions
  
  // Usage
  lastUsedAt  DateTime?
  requestCount BigInt   @default(0)
  
  // Status
  isActive    Boolean   @default(true)
  expiresAt   DateTime?
  
  // Timestamps
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?
  
  @@index([keyHash])
  @@index([partnerId])
}
```

#### Partner Management Features

- **Add Partner** - Create new partner with contact info
- **Configure VPN** - Set partner's VPN IP for internal API access
- **Generate API Keys** - Create/rotate API keys for partner
- **View Statistics** - Redemptions, transaction volume per partner
- **Set Permissions** - Control which API endpoints partner can access
- **Suspend/Activate** - Enable/disable partner access
- **Webhook Testing** - Send test webhook to partner endpoint

### 11.6 Transaction Management

#### Transaction List View (`/admin/transactions`)

| Column | Description |
|--------|-------------|
| ID | Transaction ID |
| Type | Purchase, Refund |
| Amount | Transaction amount |
| Status | Pending, Completed, Failed, Refunded |
| User/Email | Associated user or guest email |
| Gift Card | Linked gift card (if applicable) |
| Stripe ID | Stripe payment intent ID |
| Created | Transaction timestamp |
| Actions | View, Refund |

#### Filters

- Date range
- Status
- Type
- Amount range
- User email
- Stripe payment ID

#### Transaction Detail View (`/admin/transactions/:id`)

- Full transaction data
- Associated gift card details
- Stripe payment details (fetched from Stripe)
- User information
- Timeline of events (created, paid, refunded, etc.)
- Related transactions (e.g., refund for purchase)
- Admin actions: Issue refund, Add note

### 11.7 Payment History

#### Payment List View (`/admin/payments`)

Synced from Stripe - shows all Stripe payment intents.

| Column | Description |
|--------|-------------|
| Stripe ID | Payment intent ID |
| Amount | Charged amount |
| Status | succeeded, pending, failed, refunded |
| Customer Email | Stripe customer email |
| Card | Last 4 digits, brand |
| Created | Payment timestamp |
| Actions | View in Stripe, View transaction |

#### Features

- Sync with Stripe (manual refresh)
- Auto-sync via webhooks
- Direct link to Stripe dashboard
- Refund initiation (syncs back)

### 11.8 Gift Card Management

#### Gift Card List View (`/admin/gift-cards`)

| Column | Description |
|--------|-------------|
| Code (Last 4) | ••••••••••••XXXX |
| Amount | Card value |
| Status | Pending, Active, Redeemed, Expired, Revoked |
| Purchased By | Email of purchaser |
| Redeemed By | Platform user ID (if redeemed) |
| Partner | Where redeemed |
| Created | Purchase date |
| Actions | View, Revoke, Resend code |

#### Filters

- Status
- Amount range
- Date range
- Partner (for redeemed)
- Purchaser email

#### Gift Card Detail View (`/admin/gift-cards/:id`)

- Full card details (not the actual code - only hash stored)
- Purchase transaction
- Redemption details (if redeemed)
- Associated user
- Audit trail (status changes)
- Admin actions: Revoke, Resend email, Add note

#### Manual Gift Card Generation (`/admin/gift-cards/generate`)

For admin use (promotions, customer service):

- Amount input
- Recipient email
- Optional: Expiration date
- Optional: Internal note
- Generates code and sends email (or displays for manual delivery)
- Logs as admin-generated (no payment transaction)

### 11.9 User Management

#### User List View (`/admin/users`)

| Column | Description |
|--------|-------------|
| ID | User ID |
| Email | User email |
| Name | First/Last name |
| Purchases | Number of purchases |
| Total Spent | Lifetime purchase value |
| Created | Registration date |
| Last Active | Last purchase/login |
| Actions | View, Disable |

#### User Detail View (`/admin/users/:id`)

- Profile information
- Purchase history
- Gift cards purchased
- Gift cards redeemed (via partners)
- Credit balance (synced from partners)
- Admin actions: Disable account, Reset password link, Add note

### 11.10 Reports

#### Available Reports

| Report | Description |
|--------|-------------|
| Revenue Report | Daily/weekly/monthly revenue breakdown |
| Sales Report | Purchases by amount, time period |
| Redemption Report | Redemptions by partner, time period |
| Partner Report | Volume and revenue per partner |
| Gift Card Aging | Unredeemed cards by age |
| Refund Report | Refunds by reason, time period |

#### Report Features

- Date range selection
- Export to CSV/Excel
- Scheduled email delivery (daily/weekly/monthly)
- Visual charts and graphs

### 11.11 Admin User Management

#### Admin List View (`/admin/admins`)

| Column | Description |
|--------|-------------|
| Name | Admin name |
| Email | Admin email |
| Role | Super Admin, Admin, Finance, Support, Viewer |
| MFA | Enabled/Disabled |
| Last Login | Last login timestamp |
| Status | Active, Locked, Disabled |
| Actions | Edit, Disable, Reset MFA |

#### Admin Permissions Matrix

| Permission | Super Admin | Admin | Finance | Support | Viewer |
|------------|:-----------:|:-----:|:-------:|:-------:|:------:|
| View Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| System Settings | ✓ | ✓ | - | - | - |
| API Settings | ✓ | ✓ | - | - | - |
| Payment Settings | ✓ | ✓ | - | - | - |
| Manage Partners | ✓ | ✓ | - | - | - |
| View Transactions | ✓ | ✓ | ✓ | ✓ | ✓ |
| Issue Refunds | ✓ | ✓ | ✓ | - | - |
| View Gift Cards | ✓ | ✓ | ✓ | ✓ | ✓ |
| Revoke Gift Cards | ✓ | ✓ | - | ✓ | - |
| Generate Gift Cards | ✓ | ✓ | - | - | - |
| View Users | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage Users | ✓ | ✓ | - | ✓ | - |
| View Reports | ✓ | ✓ | ✓ | - | ✓ |
| Export Data | ✓ | ✓ | ✓ | - | - |
| Manage Admins | ✓ | - | - | - | - |
| View Audit Logs | ✓ | ✓ | - | - | - |
| Email Management | ✓ | ✓ | - | - | - |

---

## 12. Email System (SendGrid)

### 12.1 SendGrid Integration Overview

All transactional emails are sent via SendGrid API. The admin panel provides full control over email configuration, templates, and delivery logs.

### 12.2 Email Configuration

#### SendGrid Settings

| Setting | Description |
|---------|-------------|
| API Key | SendGrid API key |
| From Email | Verified sender email |
| From Name | Sender display name |
| Reply-To | Reply-to address |
| IP Pool | Dedicated IP pool (if applicable) |
| Tracking | Enable/disable open/click tracking |

#### Email Accounts (`/admin/emails/accounts`)

Manage multiple sender identities:

| Field | Description |
|-------|-------------|
| Name | Account name (e.g., "Transactional", "Support") |
| From Email | Sender email address |
| From Name | Sender display name |
| Reply-To | Reply-to address |
| Use For | Which email types use this account |

### 12.3 Email Templates

#### Template Management (`/admin/emails/templates`)

| Template | Trigger | Description |
|----------|---------|-------------|
| `purchase_confirmation` | Successful payment | Receipt with gift card code |
| `gift_card_delivery` | Code delivery | Standalone code delivery |
| `gift_card_reminder` | Scheduled | Reminder for unredeemed codes |
| `refund_confirmation` | Refund processed | Refund receipt |
| `welcome` | Account creation | Welcome email (if accounts enabled) |
| `password_reset` | Password reset request | Reset link email |
| `admin_alert` | System events | Admin notification |

#### Template Editor Features

- Visual editor with preview
- HTML source editing
- Variable insertion (merge tags)
- Test send to email address
- Version history
- Mobile preview

#### Available Template Variables

| Variable | Description |
|----------|-------------|
| `{{user.email}}` | User's email address |
| `{{user.firstName}}` | User's first name |
| `{{giftCard.code}}` | Full gift card code (formatted) |
| `{{giftCard.codeLast4}}` | Last 4 characters |
| `{{giftCard.amount}}` | Card value (formatted) |
| `{{transaction.id}}` | Transaction ID |
| `{{transaction.amount}}` | Transaction amount |
| `{{transaction.date}}` | Transaction date |
| `{{redemptionUrl}}` | Partner redemption URL |
| `{{supportEmail}}` | Support email address |
| `{{currentYear}}` | Current year (for copyright) |

### 12.4 Email Types & Triggers

#### Purchase Confirmation Email

**Trigger**: Stripe webhook `checkout.session.completed`

**Content**:
- Thank you message
- Transaction details (amount, date, ID)
- **Gift card code prominently displayed**
- Redemption instructions
- Link to partner platform(s)
- Support contact info

#### Gift Card Delivery Email

**Trigger**: Manual resend from admin, or code regeneration

**Content**:
- Gift card code
- Amount
- Redemption instructions
- Expiration (if applicable)

#### Refund Confirmation Email

**Trigger**: Stripe webhook `charge.refunded`

**Content**:
- Refund confirmation
- Original transaction details
- Refund amount
- Reason (if provided)
- Timeline for funds to appear

#### Unredeemed Card Reminder

**Trigger**: Scheduled job (configurable: 7, 14, 30 days)

**Content**:
- Reminder of purchased credits
- Gift card code
- How to redeem
- Support contact

### 12.5 Email Delivery Logs

#### Log View (`/admin/emails/logs`)

| Column | Description |
|--------|-------------|
| ID | Email log ID |
| Template | Template used |
| To | Recipient email |
| Subject | Email subject |
| Status | Queued, Sent, Delivered, Opened, Clicked, Bounced, Failed |
| Sent At | Timestamp |
| Events | Open/click tracking events |

#### Log Detail View

- Full email content (rendered)
- SendGrid message ID
- Delivery events timeline
- Bounce/error details
- Associated transaction/gift card

#### Email Statistics Dashboard

- Delivery rate
- Open rate
- Click rate
- Bounce rate
- Spam complaints
- Trends over time

### 12.6 Email Database Schema

```prisma
model EmailLog {
  id            String      @id @default(cuid())
  
  // Recipient
  toEmail       String
  toName        String?
  
  // Sender
  fromEmail     String
  fromName      String
  
  // Content
  templateId    String?
  template      EmailTemplate? @relation(fields: [templateId], references: [id])
  subject       String
  htmlContent   String?     @db.Text
  textContent   String?     @db.Text
  
  // SendGrid
  sendgridMessageId String? @unique
  
  // Status
  status        EmailStatus @default(QUEUED)
  statusMessage String?
  
  // Tracking
  openedAt      DateTime?
  clickedAt     DateTime?
  bouncedAt     DateTime?
  
  // Relations
  userId        String?
  transactionId String?
  giftCardId    String?
  
  // Timestamps
  createdAt     DateTime    @default(now())
  sentAt        DateTime?
  
  // Events from SendGrid webhooks
  events        EmailEvent[]
  
  @@index([toEmail])
  @@index([status])
  @@index([templateId])
  @@index([sendgridMessageId])
}

enum EmailStatus {
  QUEUED
  SENDING
  SENT
  DELIVERED
  OPENED
  CLICKED
  BOUNCED
  FAILED
  SPAM
}

model EmailEvent {
  id          String    @id @default(cuid())
  emailLogId  String
  emailLog    EmailLog  @relation(fields: [emailLogId], references: [id], onDelete: Cascade)
  
  event       String    // delivered, open, click, bounce, etc.
  timestamp   DateTime
  data        Json?     // Raw event data from SendGrid
  
  @@index([emailLogId])
}

model EmailTemplate {
  id          String    @id @default(cuid())
  
  // Identity
  name        String    // Internal name
  slug        String    @unique // purchase_confirmation, etc.
  description String?
  
  // Content
  subject     String
  htmlContent String    @db.Text
  textContent String?   @db.Text
  
  // Settings
  isActive    Boolean   @default(true)
  accountId   String?   // Which email account to use
  
  // Versioning
  version     Int       @default(1)
  
  // Timestamps
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Relations
  emailLogs   EmailLog[]
  versions    EmailTemplateVersion[]
}

model EmailTemplateVersion {
  id          String        @id @default(cuid())
  templateId  String
  template    EmailTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  version     Int
  subject     String
  htmlContent String        @db.Text
  textContent String?       @db.Text
  
  // Who made the change
  changedBy   String?
  changeNote  String?
  
  createdAt   DateTime      @default(now())
  
  @@unique([templateId, version])
}
```

### 12.7 SendGrid Webhook Handler

Process SendGrid event webhooks for delivery tracking:

**Webhook Events to Handle**:
- `processed` - Email accepted by SendGrid
- `delivered` - Email delivered to recipient server
- `open` - Recipient opened email
- `click` - Recipient clicked link
- `bounce` - Email bounced
- `dropped` - SendGrid dropped the email
- `spamreport` - Recipient marked as spam
- `unsubscribe` - Recipient unsubscribed

---

## 13. Code Validation & Redemption Flow

### 13.1 Validation Process

When a partner platform validates a code, the following process occurs:

```
Partner Platform                    CreatorCredits (Internal API)
       │                                      │
       │  POST /internal/validate             │
       │  {code, platformUserId, ip}          │
       │─────────────────────────────────────►│
       │                                      │
       │                            ┌─────────┴─────────┐
       │                            │ 1. Validate format │
       │                            │ 2. Hash code       │
       │                            │ 3. Look up by hash │
       │                            │ 4. Check status    │
       │                            │ 5. Check expiry    │
       │                            └─────────┬─────────┘
       │                                      │
       │  If valid:                           │
       │  - Mark as REDEEMED                  │
       │  - Record redemption details         │
       │  - Create ledger entry               │
       │  - Log the attempt                   │
       │                                      │
       │  {success: true, amount, balance}    │
       │◄─────────────────────────────────────│
       │                                      │
```

### 13.2 Code Status Lifecycle

```
┌─────────┐     Payment      ┌─────────┐     Redemption    ┌──────────┐
│ PENDING │────Confirmed────►│ ACTIVE  │───────Called─────►│ REDEEMED │
└─────────┘                  └─────────┘                   └──────────┘
     │                            │
     │ Payment                    │ Time passes
     │ Failed/Expired             │ (if expiry set)
     ▼                            ▼
┌─────────┐                  ┌─────────┐
│ DELETED │                  │ EXPIRED │
└─────────┘                  └─────────┘
                                  │
              Admin action        │
              (refund, fraud)     │
                    ▼             │
              ┌─────────┐        │
              │ REVOKED │◄───────┘
              └─────────┘
```

### 13.3 Preventing Reuse

Once a code is marked as `REDEEMED`:

1. **Database constraint**: Status is set to `REDEEMED` in transaction
2. **Validation check**: Any subsequent validation attempts immediately return error
3. **Audit log**: All redemption attempts (successful or not) are logged
4. **Rate limiting**: Prevents brute-force attempts to find valid codes

#### Redemption Locking

```prisma
// Pseudo-code for atomic redemption
BEGIN TRANSACTION;

-- Lock the row for update
SELECT * FROM GiftCard 
WHERE codeHash = $hash 
FOR UPDATE;

-- Verify still ACTIVE
IF status != 'ACTIVE' THEN
  ROLLBACK;
  RETURN error;
END IF;

-- Mark as redeemed
UPDATE GiftCard SET
  status = 'REDEEMED',
  redeemedById = $userId,
  redeemedAt = NOW(),
  redeemedOnPlatform = $partnerId
WHERE id = $id;

-- Update credit balance
-- Create ledger entry

COMMIT;
```

### 13.4 Redemption Data Captured

| Field | Description |
|-------|-------------|
| `redeemedById` | Platform user ID who redeemed |
| `redeemedAt` | Timestamp of redemption |
| `redeemedOnPlatform` | Partner slug (e.g., "indiecrowdfund") |
| `redemptionIp` | IP address of redemption request |
| `redemptionUserAgent` | User agent string |

---

## 14. Legal Pages

### 14.1 Required Legal Pages

| Page | URL | Description |
|------|-----|-------------|
| Terms of Service | `/terms` | Usage terms and conditions |
| Privacy Policy | `/privacy` | Data collection and usage |
| Refund Policy | `/refunds` | Refund terms and process |

### 14.2 Terms of Service (`/terms`)

#### Sections to Include

1. **Acceptance of Terms**
   - By using the service, users agree to terms
   - Age requirement (18+ or parental consent)
   - Jurisdiction

2. **Service Description**
   - What CreatorCredits provides
   - Gift card/credit purchase and redemption
   - Relationship with partner platforms

3. **Account Terms** (if applicable)
   - Account creation requirements
   - Account security responsibilities
   - Account termination

4. **Purchases and Payments**
   - Payment processing via Stripe
   - Pricing and currency
   - No pay-over-time or financing
   - Successful purchase confirmation

5. **Gift Card Terms**
   - Gift cards are non-transferable after redemption
   - One-time use only
   - No cash value
   - Expiration policy (if any)
   - Lost/stolen code policy

6. **Redemption**
   - How to redeem codes
   - Partner platform terms apply
   - CreatorCredits not responsible for partner services

7. **Refund Policy**
   - Reference to full refund policy
   - Summary of refund terms

8. **Prohibited Uses**
   - Fraudulent activity
   - Unauthorized resale
   - Attempting to exploit the system
   - Violating partner platform terms

9. **Intellectual Property**
   - Ownership of content
   - Trademark usage

10. **Limitation of Liability**
    - Service provided "as is"
    - Limitation on damages
    - Force majeure

11. **Indemnification**
    - User indemnifies CreatorCredits

12. **Dispute Resolution**
    - Governing law
    - Arbitration clause (if applicable)
    - Class action waiver (if applicable)

13. **Changes to Terms**
    - Right to modify terms
    - Notification of changes

14. **Contact Information**
    - Support email
    - Legal contact

### 14.3 Privacy Policy (`/privacy`)

#### Sections to Include

1. **Introduction**
   - Commitment to privacy
   - Scope of policy

2. **Information We Collect**
   - Information you provide (email, payment info)
   - Information collected automatically (IP, device, usage)
   - Information from third parties (Stripe)

3. **How We Use Information**
   - Process transactions
   - Send transactional emails
   - Prevent fraud
   - Improve service
   - Legal compliance

4. **Information Sharing**
   - Payment processor (Stripe)
   - Partner platforms (limited data for redemption)
   - Legal requirements
   - Business transfers

5. **Data Retention**
   - Transaction records retention period
   - When data is deleted

6. **Security**
   - Encryption
   - Access controls
   - Security measures

7. **Your Rights**
   - Access your data
   - Correct your data
   - Delete your data
   - Data portability
   - Opt-out of marketing

8. **Cookies and Tracking**
   - Essential cookies
   - Analytics (if used)
   - How to control cookies

9. **International Transfers**
   - Where data is processed
   - Safeguards for transfers

10. **Children's Privacy**
    - Not intended for children under 13
    - COPPA compliance

11. **California Privacy Rights** (if applicable)
    - CCPA disclosures
    - Do Not Sell statement

12. **Changes to Policy**
    - Notification of changes

13. **Contact**
    - Privacy inquiries contact

### 14.4 Refund Policy (`/refunds`)

#### Sections to Include

1. **Overview**
   - Commitment to customer satisfaction
   - Summary of refund eligibility

2. **Eligibility for Refunds**
   
   | Scenario | Refund Eligible | Notes |
   |----------|:---------------:|-------|
   | Unredeemed code, within 30 days | ✓ | Full refund |
   | Unredeemed code, after 30 days | Case-by-case | Contact support |
   | Redeemed code | ✗ | Non-refundable |
   | Technical error (duplicate charge) | ✓ | Full refund |
   | Fraudulent purchase | ✓ | Full refund, code revoked |
   | Dissatisfaction with partner | ✗ | Contact partner |

3. **How to Request a Refund**
   - Email support with transaction ID
   - Required information
   - Response timeline (24-48 hours)

4. **Refund Processing**
   - Refunds processed to original payment method
   - Processing time (5-10 business days)
   - Stripe refund fees (if passed to user - typically not)

5. **Code Revocation**
   - Refunded codes are immediately revoked
   - Cannot be redeemed after refund

6. **Partial Refunds**
   - When partial refunds apply
   - How they're calculated

7. **Disputes**
   - Contact support first
   - Chargeback policy

8. **Contact**
   - Support email
   - Response time expectations

### 14.5 Legal Page Implementation Notes

- All legal pages should be static content (not dynamically generated)
- Include "Last Updated" date at the top of each page
- Use clear, readable formatting (headers, bullet points)
- Avoid overly complex legal jargon where possible
- Include a "back to top" navigation for long pages
- Make legal pages accessible from footer on all pages
- Consider having legal pages reviewed by an attorney
- Store version history of legal documents

### 14.6 Footer Legal Links

All pages should include footer with:

```
Terms of Service | Privacy Policy | Refund Policy
```

Checkout pages should include:

```
By completing this purchase, you agree to our Terms of Service and Privacy Policy.
```

---

## 15. Deployment Checklist

### 15.1 Pre-Deployment

- [ ] Domain purchased and DNS configured
- [ ] SSL certificates (automatic via Caddy)
- [ ] Stripe account approved and API keys obtained
- [ ] SendGrid account configured and sender verified
- [ ] PostgreSQL installed and configured
- [ ] WireGuard keys generated for both servers
- [ ] Brand assets finalized (logo, colors, copy)
- [ ] Legal pages reviewed and approved
- [ ] Admin user credentials prepared

### 15.2 Server Setup

- [ ] Ubuntu 24.04 LTS installed
- [ ] UFW configured per Section 8.2
- [ ] WireGuard configured and tested
- [ ] Caddy installed and configured
- [ ] Node.js 20.x installed
- [ ] PM2 installed globally
- [ ] PostgreSQL database created

### 15.3 Application Deployment

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

### 15.4 Admin Panel Verification

- [ ] Admin login works
- [ ] Dashboard displays correctly
- [ ] All settings pages save correctly
- [ ] Partner management functional
- [ ] Transaction list loads
- [ ] Gift card management works
- [ ] Email templates editable
- [ ] Reports generate correctly
- [ ] Audit logs recording

### 15.5 Frontend Verification

- [ ] Homepage loads correctly
- [ ] All navigation links work
- [ ] Amount selector functions properly
- [ ] Stripe checkout redirects correctly
- [ ] Success page displays after payment
- [ ] Email delivery with codes works
- [ ] Mobile responsive on all pages
- [ ] Forms validate properly
- [ ] Legal pages accessible

### 15.6 Integration Verification

- [ ] Internal API accessible via VPN only
- [ ] Redemption flow working (test with IndieCrowdfund)
- [ ] Hold/release/capture flows working
- [ ] Code marked as REDEEMED after use
- [ ] Reused code properly rejected
- [ ] Balance updates correctly

### 15.7 Post-Deployment

- [ ] Database backups scheduled
- [ ] PM2 monitoring configured
- [ ] Error logging to file/service
- [ ] Uptime monitoring (e.g., UptimeRobot)
- [ ] VPN health check automated
- [ ] SendGrid webhook receiving events

---

## 10. Frontend Website

### 10.1 Brand Identity

#### Brand Positioning
CreatorCredits positions itself as a modern fintech solution for the creator economy, enabling seamless payments across partner platforms. The messaging emphasizes flexibility, security, and creator empowerment without referencing specific content types.

#### Brand Voice
- **Professional** but approachable
- **Confident** without being corporate-stiff
- **Creator-focused** language
- **Trust-building** through transparency

#### Tagline Options
- "Fuel Your Favorite Creators"
- "The Universal Creator Currency"
- "Support Creators. Seamlessly."

### 10.2 Design System

#### Color Palette

```css
:root {
  /* Primary */
  --color-primary-50: #f0f7ff;
  --color-primary-100: #e0effe;
  --color-primary-200: #bae0fd;
  --color-primary-300: #7cc8fb;
  --color-primary-400: #36aaf5;
  --color-primary-500: #0c8ee7;
  --color-primary-600: #0070cc;
  --color-primary-700: #0159a6;
  --color-primary-800: #064b88;
  --color-primary-900: #0a3f70;

  /* Neutral */
  --color-neutral-50: #f9fafb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-200: #e5e7eb;
  --color-neutral-300: #d1d5db;
  --color-neutral-400: #9ca3af;
  --color-neutral-500: #6b7280;
  --color-neutral-600: #4b5563;
  --color-neutral-700: #374151;
  --color-neutral-800: #1f2937;
  --color-neutral-900: #111827;

  /* Accent (Success/Trust) */
  --color-accent-500: #10b981;
  --color-accent-600: #059669;

  /* Warning */
  --color-warning-500: #f59e0b;

  /* Error */
  --color-error-500: #ef4444;
}
```

#### Typography

```css
:root {
  /* Font Families */
  --font-heading: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font Sizes */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */
  --text-5xl: 3rem;       /* 48px */
  --text-6xl: 3.75rem;    /* 60px */
}
```

#### Spacing & Layout

```css
:root {
  --container-max: 1280px;
  --container-padding: 1.5rem;
  
  --section-spacing: 6rem;
  --section-spacing-lg: 8rem;
  
  --border-radius-sm: 0.375rem;
  --border-radius-md: 0.5rem;
  --border-radius-lg: 0.75rem;
  --border-radius-xl: 1rem;
  --border-radius-full: 9999px;
}
```

### 10.3 Site Structure

```
/                       # Homepage
/buy                    # Purchase credits (amount selection + checkout)
/redeem                 # Redeem code (redirects to partner)
/balance                # Check balance (requires code or account)
/how-it-works           # Detailed explanation
/for-creators           # Creator/platform partnership info
/faq                    # Frequently asked questions
/support                # Help & contact
/terms                  # Terms of service
/privacy                # Privacy policy

/success                # Post-purchase success page
/cancelled              # Checkout cancelled
```

### 10.4 Component Library

#### Button Component

```tsx
// components/ui/Button.tsx

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-500',
        outline: 'border-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus:ring-neutral-500',
        ghost: 'text-neutral-600 hover:bg-neutral-100 focus:ring-neutral-500',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
        xl: 'h-16 px-10 text-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        disabled={isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4\" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
```

#### Card Component

```tsx
// components/ui/Card.tsx

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-neutral-200 p-6
        ${hover ? 'transition-shadow hover:shadow-lg hover:border-neutral-300' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-xl font-semibold text-neutral-900 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-neutral-600 mt-1 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
```

#### Amount Selector Component

```tsx
// components/AmountSelector.tsx

'use client';

import { useState } from 'react';

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

interface AmountSelectorProps {
  value: number | null;
  onChange: (amount: number) => void;
  min?: number;
  max?: number;
}

export function AmountSelector({ value, onChange, min = 5, max = 500 }: AmountSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handlePresetClick = (amount: number) => {
    setIsCustom(false);
    onChange(amount);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setCustomValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => handlePresetClick(amount)}
            className={`
              py-4 px-2 rounded-lg font-semibold text-lg transition-all
              ${value === amount && !isCustom
                ? 'bg-primary-600 text-white ring-2 ring-primary-600 ring-offset-2'
                : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
              }
            `}
          >
            ${amount}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-neutral-500 text-lg">$</span>
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Custom amount"
          value={isCustom ? customValue : ''}
          onFocus={() => setIsCustom(true)}
          onChange={handleCustomChange}
          className={`
            w-full pl-8 pr-4 py-4 rounded-lg text-lg font-medium
            border-2 transition-colors
            ${isCustom
              ? 'border-primary-500 ring-2 ring-primary-100'
              : 'border-neutral-200 hover:border-neutral-300'
            }
            focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100
          `}
        />
      </div>

      <p className="text-sm text-neutral-500 text-center">
        Minimum ${min} · Maximum ${max}
      </p>
    </div>
  );
}
```

### 10.5 Page Layouts

#### Global Layout

```tsx
// app/layout.tsx

import { Inter, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'CreatorCredits - Support Creators Seamlessly',
  description: 'Purchase credits to support your favorite creators across partner platforms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen flex flex-col bg-white text-neutral-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

#### Header Component

```tsx
// components/layout/Header.tsx

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-semibold text-xl text-neutral-900">
              Creator<span className="text-primary-600">Credits</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/how-it-works" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              How It Works
            </Link>
            <Link href="/for-creators" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              For Creators
            </Link>
            <Link href="/faq" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              FAQ
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/balance">
              <Button variant="ghost" size="sm">Check Balance</Button>
            </Link>
            <Link href="/buy">
              <Button size="sm">Buy Credits</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <nav className="flex flex-col gap-4">
              <Link href="/how-it-works" className="text-neutral-600 hover:text-neutral-900">
                How It Works
              </Link>
              <Link href="/for-creators" className="text-neutral-600 hover:text-neutral-900">
                For Creators
              </Link>
              <Link href="/faq" className="text-neutral-600 hover:text-neutral-900">
                FAQ
              </Link>
              <hr className="border-neutral-200" />
              <Link href="/balance">
                <Button variant="outline" className="w-full">Check Balance</Button>
              </Link>
              <Link href="/buy">
                <Button className="w-full">Buy Credits</Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
```

#### Footer Component

```tsx
// components/layout/Footer.tsx

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="font-semibold text-lg text-white">
                CreatorCredits
              </span>
            </div>
            <p className="text-sm">
              The universal currency for supporting creators across the web.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/buy" className="hover:text-white transition-colors">Buy Credits</Link></li>
              <li><Link href="/redeem" className="hover:text-white transition-colors">Redeem Code</Link></li>
              <li><Link href="/balance" className="hover:text-white transition-colors">Check Balance</Link></li>
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/for-creators" className="hover:text-white transition-colors">For Creators</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm">
            © {new Date().getFullYear()} CreatorCredits. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <svg className="w-8 h-5" viewBox="0 0 32 20" fill="currentColor">
              {/* Visa-style icon */}
              <rect width="32" height="20" rx="2" fill="#1A1F71"/>
              <text x="16" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">VISA</text>
            </svg>
            <svg className="w-8 h-5" viewBox="0 0 32 20" fill="currentColor">
              {/* Mastercard-style icon */}
              <rect width="32" height="20" rx="2" fill="#000"/>
              <circle cx="12" cy="10" r="6" fill="#EB001B"/>
              <circle cx="20" cy="10" r="6" fill="#F79E1B"/>
            </svg>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

### 10.6 Page: Homepage

```tsx
// app/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-neutral-900 leading-tight">
                Support Creators.
                <span className="text-primary-600"> Seamlessly.</span>
              </h1>
              <p className="mt-6 text-xl text-neutral-600 leading-relaxed">
                Purchase credits once, use them across our partner platforms. 
                A flexible, secure way to back the creators you love.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link href="/buy">
                  <Button size="xl" className="w-full sm:w-auto">
                    Buy Credits
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="xl" variant="outline" className="w-full sm:w-auto">
                    How It Works
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero Illustration */}
            <div className="relative">
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 transform lg:rotate-2">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-medium text-neutral-500">Your Credits</span>
                  <span className="text-sm text-primary-600 font-medium">Active</span>
                </div>
                <div className="text-5xl font-bold text-neutral-900 mb-2">$250.00</div>
                <div className="text-neutral-500">Ready to use</div>
                <div className="mt-8 pt-6 border-t border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">Instant Delivery</div>
                      <div className="text-sm text-neutral-500">Codes sent immediately</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Background decoration */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-200 to-primary-100 rounded-2xl transform -rotate-2 -z-10" />
            </div>
          </div>
        </div>

        {/* Background gradient orbs */}
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-primary-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-96 h-96 bg-primary-100 rounded-full opacity-40 blur-3xl" />
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">
              Three Simple Steps
            </h2>
            <p className="mt-4 text-xl text-neutral-600 max-w-2xl mx-auto">
              Get started in minutes. No account required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                1
              </div>
              <Card className="pt-8">
                <CardContent>
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Choose Amount
                  </h3>
                  <p className="text-neutral-600">
                    Select from preset amounts or enter a custom value. From $5 to $500.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                2
              </div>
              <Card className="pt-8">
                <CardContent>
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Get Your Code
                  </h3>
                  <p className="text-neutral-600">
                    Complete checkout securely with Stripe. Your code arrives instantly via email.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                3
              </div>
              <Card className="pt-8">
                <CardContent>
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                    Support Creators
                  </h3>
                  <p className="text-neutral-600">
                    Redeem your code on any partner platform and back the projects you love.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">
                Built for the Creator Economy
              </h2>
              <p className="mt-4 text-xl text-neutral-600">
                We understand creators need flexible funding options. That's why we built 
                a universal credit system that works across platforms.
              </p>

              <div className="mt-10 space-y-6">
                {[
                  {
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    ),
                    title: 'Secure Payments',
                    description: 'All transactions processed through Stripe with bank-level encryption.',
                  },
                  {
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    ),
                    title: 'Instant Delivery',
                    description: 'Receive your credit code immediately after purchase. No waiting.',
                  },
                  {
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ),
                    title: 'Flexible Amounts',
                    description: 'Buy exactly what you need, from $5 to $500. Top up anytime.',
                  },
                  {
                    icon: (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    ),
                    title: 'No Account Required',
                    description: 'Purchase as a guest. Your code is delivered straight to your email.',
                  },
                ].map((feature, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {feature.icon}
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">{feature.title}</h3>
                      <p className="text-neutral-600 mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">$2M+</div>
                  <div className="text-neutral-600 mt-2">Credits Purchased</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">50K+</div>
                  <div className="text-neutral-600 mt-2">Happy Supporters</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">99.9%</div>
                  <div className="text-neutral-600 mt-2">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">&lt;1min</div>
                  <div className="text-neutral-600 mt-2">Avg. Delivery</div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-neutral-100">
                <div className="flex items-center justify-center gap-4 text-neutral-400">
                  <span className="text-sm">Secured by</span>
                  <svg className="h-8" viewBox="0 0 60 25" fill="currentColor">
                    <path d="M5 0h50a5 5 0 015 5v15a5 5 0 01-5 5H5a5 5 0 01-5-5V5a5 5 0 015-5z" fill="#635BFF"/>
                    <text x="30" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">stripe</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Support Your Favorite Creators?
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            Get your credits in under a minute. No account required.
          </p>
          <div className="mt-10">
            <Link href="/buy">
              <Button size="xl" className="bg-white text-primary-600 hover:bg-primary-50">
                Buy Credits Now
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
```

### 10.7 Page: Buy Credits

```tsx
// app/buy/page.tsx

'use client';

import { useState } from 'react';
import { AmountSelector } from '@/components/AmountSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function BuyPage() {
  const [amount, setAmount] = useState<number | null>(25);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!amount || !email) {
      setError('Please select an amount and enter your email.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Redirect to Stripe
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-neutral-900">Buy Credits</h1>
          <p className="mt-2 text-neutral-600">
            Choose your amount and receive your code instantly.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Amount Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Select Amount
              </label>
              <AmountSelector value={amount} onChange={setAmount} />
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border-2 border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              />
              <p className="mt-2 text-sm text-neutral-500">
                We'll send your credit code to this email.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Credits</span>
                <span className="font-semibold text-neutral-900">
                  ${amount?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-neutral-200">
                <span className="font-medium text-neutral-900">Total</span>
                <span className="font-bold text-xl text-neutral-900">
                  ${amount?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleCheckout}
              isLoading={isLoading}
              disabled={!amount || !email}
            >
              {isLoading ? 'Redirecting...' : 'Continue to Payment'}
            </Button>

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Checkout
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Powered by Stripe
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### 10.8 Page: Success

```tsx
// app/success/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Payment Successful!
        </h1>
        <p className="text-neutral-600 mb-8">
          Your credit code has been sent to your email. Check your inbox (and spam folder, just in case).
        </p>

        {/* Next Steps */}
        <div className="bg-white rounded-xl p-6 shadow-md text-left mb-8">
          <h2 className="font-semibold text-neutral-900 mb-4">What's Next?</h2>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <span className="text-neutral-600">Check your email for the credit code</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <span className="text-neutral-600">Go to your favorite creator platform</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <span className="text-neutral-600">Redeem your code and start supporting!</span>
            </li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/buy">
            <Button variant="outline">Buy More Credits</Button>
          </Link>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### 10.9 Page: How It Works

```tsx
// app/how-it-works/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 to-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900">
            How CreatorCredits Works
          </h1>
          <p className="mt-4 text-xl text-neutral-600">
            A simple, flexible way to support creators across the web.
          </p>
        </div>
      </section>

      {/* Detailed Steps */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="space-y-16">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                1
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Purchase Credits
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Choose any amount between $5 and $500. We accept all major credit and debit 
                  cards through our secure Stripe checkout. No account needed—just enter your 
                  email and complete the purchase.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                2
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Receive Your Code
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Immediately after purchase, you'll receive an email containing your unique 
                  16-character credit code. This code represents your purchased credits and 
                  can only be used once. Keep it safe!
                </p>
                <div className="mt-4 bg-neutral-100 rounded-lg p-4 font-mono text-center text-xl tracking-wider">
                  XXXX-XXXX-XXXX-XXXX
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                3
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Redeem on Partner Platforms
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Visit any of our partner platforms and navigate to their "Redeem Credits" 
                  page. Enter your code, and the credits will be added to your account 
                  instantly. Use them to back projects, support creators, or unlock content.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0 w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
                4
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-3">
                  Support Creators
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed">
                  Your credits are now ready to use! Back crowdfunding campaigns, subscribe 
                  to creators, or make purchases. Your support goes directly to the creators 
                  you care about.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12">
            Common Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Do credits expire?',
                a: 'Credits do not expire. Once purchased, they remain valid until redeemed.',
              },
              {
                q: 'Can I get a refund?',
                a: 'Unused credits can be refunded within 30 days of purchase. Contact our support team.',
              },
              {
                q: 'What platforms accept CreatorCredits?',
                a: 'We partner with select creator platforms. After purchase, you\'ll see redemption instructions in your confirmation email.',
              },
              {
                q: 'Is my payment secure?',
                a: 'Absolutely. All payments are processed through Stripe, a PCI-compliant payment processor used by millions of businesses.',
              },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-neutral-900 mb-2">{item.q}</h3>
                <p className="text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/faq">
              <Button variant="outline">View All FAQs</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Purchase your credits now and start supporting creators today.
          </p>
          <Link href="/buy">
            <Button size="lg" className="bg-white text-primary-600 hover:bg-primary-50">
              Buy Credits
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
```

### 10.10 Page: For Creators (Partnership)

```tsx
// app/for-creators/page.tsx

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function ForCreatorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-block px-4 py-1 bg-primary-500/20 text-primary-300 rounded-full text-sm font-medium mb-6">
            For Platforms & Creators
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Accept Payments Without the Hassle
          </h1>
          <p className="mt-6 text-xl text-neutral-300 max-w-2xl mx-auto">
            Partner with CreatorCredits to offer your users a flexible payment option. 
            No integration headaches. No payment processor restrictions.
          </p>
          <div className="mt-10">
            <a href="mailto:partners@creatorcredits.com">
              <Button size="xl" className="bg-white text-neutral-900 hover:bg-neutral-100">
                Become a Partner
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900">
              Why Partner With Us?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card hover>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Expand Payment Options
                </h3>
                <p className="text-neutral-600">
                  Accept credits as payment alongside traditional methods. Give your users 
                  more ways to support creators on your platform.
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Simple API Integration
                </h3>
                <p className="text-neutral-600">
                  Our REST API makes integration straightforward. Validate codes, check 
                  balances, and process transactions with just a few endpoints.
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardContent className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Reliable Payouts
                </h3>
                <p className="text-neutral-600">
                  Funds are held securely and transferred to creators on your schedule. 
                  You maintain full control over your payout process.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works for Partners */}
      <section className="py-24 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900">
              How the Integration Works
            </h2>
          </div>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Secure API Connection
                </h3>
                <p className="text-neutral-600">
                  We establish a secure connection between your platform and our credit 
                  system. All communication is encrypted and authenticated.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  User Redeems Code
                </h3>
                <p className="text-neutral-600">
                  Users enter their CreatorCredits code on your platform. Your backend 
                  validates it with our API and adds credits to their account.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Credits Used on Platform
                </h3>
                <p className="text-neutral-600">
                  Users spend credits on your platform just like any other payment method. 
                  Our API handles balance checks and transaction processing.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Settlement & Payouts
                </h3>
                <p className="text-neutral-600">
                  We settle captured credits with your platform on a regular schedule. 
                  You handle creator payouts through your existing systems.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Interested in Partnering?
          </h2>
          <p className="text-xl text-neutral-600 mb-8 max-w-2xl mx-auto">
            We're selectively onboarding new partner platforms. Reach out to discuss 
            how CreatorCredits can work for your platform.
          </p>
          <a href="mailto:partners@creatorcredits.com">
            <Button size="lg">
              Contact Partnership Team
            </Button>
          </a>
        </div>
      </section>
    </>
  );
}
```

### 10.11 Page: FAQ

```tsx
// app/faq/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

const faqs = [
  {
    category: 'Purchasing',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) through our secure Stripe checkout.',
      },
      {
        q: 'Is there a minimum or maximum purchase amount?',
        a: 'You can purchase anywhere from $5 to $500 in credits per transaction. There\'s no limit on how many transactions you can make.',
      },
      {
        q: 'Do I need an account to buy credits?',
        a: 'No account is required. Simply enter your email address, and we\'ll send your credit code directly to your inbox.',
      },
      {
        q: 'How quickly will I receive my code?',
        a: 'Credit codes are delivered instantly via email after successful payment. If you don\'t see it within a few minutes, check your spam folder.',
      },
    ],
  },
  {
    category: 'Using Credits',
    questions: [
      {
        q: 'Where can I use my credits?',
        a: 'Credits can be redeemed on our partner platforms. You\'ll find redemption instructions in your confirmation email.',
      },
      {
        q: 'Do credits expire?',
        a: 'No, credits do not expire. Once purchased, they remain valid until you redeem them.',
      },
      {
        q: 'Can I use credits across multiple platforms?',
        a: 'Each credit code can only be redeemed once on one platform. However, you can purchase multiple codes for different platforms.',
      },
      {
        q: 'What happens to my credits if a project I backed fails?',
        a: 'If you back a crowdfunding project that doesn\'t reach its goal, your credits are returned to your balance on that platform.',
      },
    ],
  },
  {
    category: 'Refunds & Support',
    questions: [
      {
        q: 'Can I get a refund?',
        a: 'Unredeemed credits can be refunded within 30 days of purchase. Contact our support team with your order details.',
      },
      {
        q: 'What if I never received my code?',
        a: 'First, check your spam folder. If you still can\'t find it, contact support with your payment confirmation, and we\'ll resend it.',
      },
      {
        q: 'My code isn\'t working. What should I do?',
        a: 'Make sure you\'re entering the code exactly as shown (codes are case-insensitive). If it still doesn\'t work, contact our support team.',
      },
      {
        q: 'How do I contact support?',
        a: 'Email us at support@creatorcredits.com. We typically respond within 24 hours.',
      },
    ],
  },
  {
    category: 'Security',
    questions: [
      {
        q: 'Is my payment information secure?',
        a: 'Absolutely. All payments are processed through Stripe, a PCI-DSS Level 1 certified payment processor. We never see or store your card details.',
      },
      {
        q: 'Should I share my credit code?',
        a: 'Treat your credit code like cash. Anyone with the code can redeem it. Only share it if you intend to gift it to someone.',
      },
      {
        q: 'What if someone steals my code?',
        a: 'If your code is stolen before redemption, contact us immediately. Once redeemed, credits cannot be recovered.',
      },
    ],
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <>
      {/* Hero */}
      <section className="bg-neutral-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl font-bold text-neutral-900">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-xl text-neutral-600">
            Everything you need to know about CreatorCredits.
          </p>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {faqs.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-6">
                {section.category}
              </h2>
              <div className="space-y-4">
                {section.questions.map((item, questionIndex) => {
                  const id = `${sectionIndex}-${questionIndex}`;
                  const isOpen = openIndex === id;

                  return (
                    <div
                      key={id}
                      className="border border-neutral-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleQuestion(id)}
                        className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-neutral-50 transition-colors"
                      >
                        <span className="font-medium text-neutral-900">
                          {item.q}
                        </span>
                        <svg
                          className={`w-5 h-5 text-neutral-500 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-neutral-600">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">
            Still Have Questions?
          </h2>
          <p className="text-neutral-600 mb-8">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <Link href="/support">
            <Button>Contact Support</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
```

### 10.12 Global Styles

```css
/* app/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary-50: 240 247 255;
    --color-primary-100: 224 239 254;
    --color-primary-200: 186 224 253;
    --color-primary-300: 124 200 251;
    --color-primary-400: 54 170 245;
    --color-primary-500: 12 142 231;
    --color-primary-600: 0 112 204;
    --color-primary-700: 1 89 166;
    --color-primary-800: 6 75 136;
    --color-primary-900: 10 63 112;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply text-neutral-900 antialiased;
  }
}

@layer components {
  .container {
    @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
  }
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

### 10.13 Tailwind Configuration

```typescript
// tailwind.config.ts

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#36aaf5',
          500: '#0c8ee7',
          600: '#0070cc',
          700: '#0159a6',
          800: '#064b88',
          900: '#0a3f70',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## Appendix A: API Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CODE_FORMAT` | Code is not 16 hex characters |
| `CODE_NOT_FOUND` | No gift card matches this code |
| `ALREADY_REDEEMED` | Code has already been used |
| `CODE_EXPIRED` | Code is past expiration date |
| `CODE_REVOKED` | Code was manually revoked |
| `RATE_LIMITED` | Too many redemption attempts |
| `INSUFFICIENT_BALANCE` | Not enough credits for operation |
| `HOLD_NOT_FOUND` | No hold exists for this pledge |
| `HOLD_NOT_ACTIVE` | Hold is not in active state |
| `INVALID_AMOUNT` | Amount outside allowed range |

## Appendix B: Database Indexes for Performance

```sql
-- Additional indexes for high-traffic tables
CREATE INDEX idx_giftcard_status_created ON "GiftCard" (status, "createdAt") WHERE status = 'ACTIVE';
CREATE INDEX idx_credithold_expires ON "CreditHold" ("expiresAt") WHERE status = 'ACTIVE';
CREATE INDEX idx_redemption_ip_time ON "RedemptionAttempt" ("ipAddress", "createdAt" DESC);
CREATE INDEX idx_ledger_balance_time ON "CreditLedger" ("creditBalanceId", "createdAt" DESC);
```

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Credit** | Virtual currency purchased on CreatorCredits, redeemable on IndieCrowdfund |
| **Hold** | Credits reserved for an active pledge, not available for other use |
| **Capture** | Converting held credits to a completed payment when project funds |
| **Release** | Returning held credits to available balance when project fails |
| **Platform User ID** | User's unique ID on IndieCrowdfund, used to link credit balances |

---

*Document Version: 1.0*
*Last Updated: 2025*
