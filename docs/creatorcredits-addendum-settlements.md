# CreatorCredits Addendum: Partner Settlements & Creator Payouts

> **Addendum to**: CreatorCredits - Gift Card Service Technical Specification  
> **Version**: 1.0  
> **Purpose**: Defines how money flows from credit purchases to creator bank accounts

---

## Table of Contents

1. [Money Flow Overview](#1-money-flow-overview)
2. [Fee Structure](#2-fee-structure)
3. [Settlement System](#3-settlement-system)
4. [Settlement Process](#4-settlement-process)
5. [Admin Settlement Interface](#5-admin-settlement-interface)
6. [Partner Settlement API](#6-partner-settlement-api)
7. [Creator Payout (IndieCrowdfund Side)](#7-creator-payout-indiecrowdfund-side)
8. [Settlement Reports](#8-settlement-reports)
9. [Settlement Notifications](#9-settlement-notifications)

---

## 1. Money Flow Overview

This document explains how money flows from credit purchases to creator bank accounts.

### Complete Money Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE MONEY FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

  USER                CREATORCREDITS           INDIECROWDFUND          CREATOR
   │                        │                        │                    │
   │  1. Buys $100 credits  │                        │                    │
   │───────────────────────►│                        │                    │
   │                        │                        │                    │
   │   (Stripe processes)   │                        │                    │
   │                        │  Funds held            │                    │
   │                        │                        │                    │
   │  2. Redeems code       │                        │                    │
   │────────────────────────┼───────────────────────►│                    │
   │                        │   (validates via VPN)  │                    │
   │                        │◄──────────────────────►│                    │
   │                        │                        │                    │
   │  3. Backs project with $100 credits             │                    │
   │────────────────────────┼───────────────────────►│                    │
   │                        │   (hold placed)        │                    │
   │                        │◄──────────────────────►│                    │
   │                        │                        │                    │
   │                        │                        │  4. Project funds  │
   │                        │   (capture hold)       │                    │
   │                        │◄──────────────────────►│                    │
   │                        │                        │                    │
   │                        │                        │  Creator earned    │
   │                        │                        │  $100 in credits   │
   │                        │                        │──────────────────►│
   │                        │                        │                    │
   │                        │  5. Settlement         │                    │
   │                        │  (weekly/monthly)      │                    │
   │                        │───────────────────────►│                    │
   │                        │  Wire $940 to partner  │                    │
   │                        │  (after 6% total fee)  │                    │
   │                        │                        │                    │
   │                        │                        │  6. Creator payout │
   │                        │                        │  (via Stripe Connect)
   │                        │                        │───────────────────►│
   │                        │                        │  $893.00           │
   │                        │                        │  (after 5% IC fee) │
   │                        │                        │                    │
```

### Key Concepts

| Term | Definition |
|------|------------|
| **Credit Purchase** | User buys credits on CreatorCredits via Stripe |
| **Redemption** | User redeems code on IndieCrowdfund, credits added to balance |
| **Hold** | Credits reserved when user backs a project |
| **Capture** | Credits converted to earnings when project funds successfully |
| **Settlement** | CreatorCredits pays IndieCrowdfund for captured credits |
| **Creator Payout** | IndieCrowdfund pays creator via Stripe Connect |

---

## 2. Fee Structure

### Total Partner Fee: 6%

CreatorCredits charges partners a **6% total fee** on all settled credits. This fee covers:
- Stripe payment processing (~2.9% + $0.30)
- CreatorCredits platform fee (remainder)

### Fee Breakdown by Stage

| Stage | Fee | Who Pays | Example ($100) |
|-------|-----|----------|----------------|
| **Total Partner Fee** | **6%** | **Partner** | **$6.00** |
| ↳ Stripe Processing | ~2.9% + $0.30 | (included above) | ~$3.20 |
| ↳ CreatorCredits Platform | ~2.8% | (included above) | ~$2.80 |
| IndieCrowdfund Platform | 5% of earnings | Creator | $94.00 × 95% = $89.30 |
| Stripe Connect Payout | ~0.25% + fees | Creator | ~$89.00 final |

**Note**: The 6% fee is calculated on the gross credit amount and deducted at settlement time.

### Fee Flow Visualization

```
User pays:        $100.00
                     │
                     ▼
Credit Value:     $100.00  (what user can spend)
                     │
                     ▼
At Settlement:
                     │
Total Partner Fee: -$6.00  (6% of $100)
                     │
                     ▼
IndieCrowdfund 
receives:          $94.00
                     │
                     ▼
IC Platform fee:   -$4.70  (5% of $94.00)
                     │
                     ▼
Creator earns:     $89.30
                     │
                     ▼
Stripe Connect:    -$0.25  (payout fee)
                     │
                     ▼
Creator receives:  $89.05
```

### Behind the Scenes (CreatorCredits)

```
User pays $100:
  Stripe takes:      -$3.20  (2.9% + $0.30)
  CC receives:       $96.80

At Settlement ($100 gross):
  Partner receives:  $94.00  (100 - 6%)
  CC keeps:          $2.80   (96.80 - 94.00)

Total CC revenue:    $2.80 per $100 in credits
                     (after Stripe fees absorbed)
```

### Configurable Fee Settings

| Setting | Location | Default |
|---------|----------|---------|
| Total Partner Fee | `/admin/settings/payments` | 6% |
| Per-Partner Fee Override | `/admin/partners/:id` | (uses default) |

---

## 3. Settlement System

### 3.1 Database Schema

#### PartnerSettlement Model

```prisma
model PartnerSettlement {
  id            String            @id @default(cuid())
  
  // Partner
  partnerId     String
  partner       Partner           @relation(fields: [partnerId], references: [id])
  
  // Period
  periodStart   DateTime
  periodEnd     DateTime
  
  // Amounts
  grossAmount   Decimal           @db.Decimal(12, 2)  // Total captured credits
  partnerFee    Decimal           @db.Decimal(12, 2)  // 6% total fee
  netAmount     Decimal           @db.Decimal(12, 2)  // Amount to pay partner
  
  // Currency
  currency      String            @default("USD")
  
  // Status
  status        SettlementStatus  @default(PENDING)
  
  // Payment details
  paymentMethod String?           // "wire", "ach", "paypal", "stripe"
  paymentRef    String?           // External reference (wire ref, PayPal ID)
  paidAt        DateTime?
  
  // Notes
  adminNotes    String?           @db.Text
  
  // Timestamps
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  
  // Relations
  captures      CreditCapture[]
  
  @@index([partnerId])
  @@index([status])
  @@index([periodEnd])
}

enum SettlementStatus {
  PENDING       // Settlement calculated, awaiting approval
  APPROVED      // Approved, ready for payment
  PROCESSING    // Payment initiated
  PAID          // Payment confirmed
  FAILED        // Payment failed
  DISPUTED      // Under dispute
}
```

#### CreditCapture Model

```prisma
model CreditCapture {
  id              String            @id @default(cuid())
  
  // Hold reference
  holdId          String            @unique
  hold            CreditHold        @relation(fields: [holdId], references: [id])
  
  // Partner
  partnerId       String
  partner         Partner           @relation(fields: [partnerId], references: [id])
  
  // Creator info (from partner platform)
  creatorId       String            // Creator's ID on IndieCrowdfund
  creatorEmail    String?           // For reference
  projectId       String            // Project ID on IndieCrowdfund
  projectName     String?           // For reference
  
  // Amount
  amount          Decimal           @db.Decimal(10, 2)
  
  // Settlement
  settlementId    String?
  settlement      PartnerSettlement? @relation(fields: [settlementId], references: [id])
  settledAt       DateTime?
  
  // Timestamps
  capturedAt      DateTime          @default(now())
  
  @@index([partnerId])
  @@index([settlementId])
  @@index([capturedAt])
  @@index([creatorId])
}
```

#### Partner Model Additions

```prisma
model Partner {
  // ... existing fields from main spec ...
  
  // Settlement configuration
  settlementFrequency   SettlementFrequency @default(WEEKLY)
  settlementDay         Int                 @default(1)  // Day of week (1=Mon) or month
  minimumSettlement     Decimal             @db.Decimal(10, 2) @default(100)
  partnerFeeOverride    Decimal?            @db.Decimal(5, 4)  // Override default 6% fee
  
  // Payment details
  paymentMethod         String?             // "wire", "ach", "paypal", "stripe"
  bankName              String?
  bankAccountNumber     String?             // Encrypted
  bankRoutingNumber     String?             // Encrypted
  bankSwiftCode         String?
  bankAddress           String?
  paypalEmail           String?
  stripeAccountId       String?             // For Stripe Connect payouts
  
  // Relations
  settlements           PartnerSettlement[]
  captures              CreditCapture[]
}

enum SettlementFrequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
}
```

### 3.2 Settlement Configuration (Admin)

Located at `/admin/settings/settlements`

| Setting | Description | Default |
|---------|-------------|---------|
| Default Settlement Frequency | How often to generate settlements | Weekly |
| Default Settlement Day | Day of week (1-7) or month (1-28) | 1 (Monday) |
| Default Minimum Settlement | Minimum amount to trigger settlement | $100.00 |
| Default Partner Fee | Total fee percentage (includes processing) | 6.00% |
| Auto-Approve Threshold | Auto-approve settlements under this amount | $1,000.00 |
| Auto-Approve Enabled | Enable automatic approval | No |
| Settlement Notification Email | Email for settlement alerts | (admin email) |

### 3.3 Per-Partner Configuration

Located at `/admin/partners/:id/settlements`

| Setting | Description |
|---------|-------------|
| Settlement Frequency | Override default frequency |
| Settlement Day | Override default day |
| Minimum Settlement | Override minimum amount |
| Partner Fee Override | Custom fee for this partner (default 6%) |
| Payment Method | Wire, ACH, PayPal, Stripe Connect |
| Bank/Payment Details | Payment destination info |

---

## 4. Settlement Process

### 4.1 Automatic Settlement Generation

```
┌─────────────────────────────────────────────────────────────────┐
│              SETTLEMENT GENERATION JOB (Scheduled)              │
│                                                                 │
│  Runs based on each partner's settlement frequency:             │
│  - DAILY: Every day at 00:00 UTC                               │
│  - WEEKLY: Every Monday at 00:00 UTC                           │
│  - BIWEEKLY: Every other Monday at 00:00 UTC                   │
│  - MONTHLY: 1st of month at 00:00 UTC                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  For each active partner:     │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  1. Check if settlement due   │
              │     based on frequency        │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  2. Get unsettled captures    │
              │     WHERE settlementId IS NULL│
              │     AND partnerId = X         │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  3. Sum gross amount          │
              │     Check >= minimum          │
              └───────────────────────────────┘
                              │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              >= Minimum         < Minimum
                    │                 │
                    ▼                 │
              ┌─────────────┐         │
              │ 4. Calculate│         │
              │    fees     │         │
              └─────────────┘         │
                    │                 │
                    ▼                 │
              ┌─────────────┐         │
              │ 5. Create   │         │
              │ settlement  │         │
              │ record      │         │
              └─────────────┘         │
                    │                 │
                    ▼                 │
              ┌─────────────┐         │
              │ 6. Link     │         │
              │ captures    │         │
              └─────────────┘         │
                    │                 │
                    ▼                 │
              ┌─────────────┐         │
              │ 7. Check    │         │
              │ auto-approve│         │
              └─────────────┘         │
                    │                 │
                    ▼                 ▼
              ┌─────────────────────────────┐
              │  8. Notify admin            │
              └─────────────────────────────┘
```

### 4.2 Settlement Calculation

```typescript
interface SettlementCalculation {
  grossAmount: number;      // Sum of all captured credits
  partnerFee: number;       // grossAmount * feePercentage (6% default)
  netAmount: number;        // grossAmount - partnerFee
  captureCount: number;     // Number of captures included
  periodStart: Date;        // Start of settlement period
  periodEnd: Date;          // End of settlement period
}

function calculateSettlement(
  partnerId: string,
  feePercentage: number = 0.06  // 6% default
): SettlementCalculation {
  // Get unsettled captures for this partner
  const captures = await prisma.creditCapture.findMany({
    where: {
      partnerId,
      settlementId: null
    }
  });
  
  const grossAmount = captures.reduce(
    (sum, c) => sum + Number(c.amount), 
    0
  );
  
  const partnerFee = grossAmount * feePercentage;
  const netAmount = grossAmount - partnerFee;
  
  // Determine period based on capture dates
  const dates = captures.map(c => c.capturedAt);
  const periodStart = new Date(Math.min(...dates.map(d => d.getTime())));
  const periodEnd = new Date(Math.max(...dates.map(d => d.getTime())));
  
  return {
    grossAmount,
    partnerFee,
    netAmount,
    captureCount: captures.length,
    periodStart,
    periodEnd
  };
}
```

### 4.3 Admin Settlement Workflow

#### Step 1: View Pending Settlements

Admin navigates to `/admin/settlements` and sees list of pending settlements.

#### Step 2: Review Settlement Details

Admin clicks on a settlement to view:
- Gross amount, fee, net amount
- All captures included (by creator, by project)
- Partner payment details
- Any notes or flags

#### Step 3: Approve Settlement

Admin clicks "Approve" button:
- Status changes from PENDING → APPROVED
- Settlement locked (no more captures added)
- Ready for payment processing

**Auto-Approval**: If enabled and settlement is under threshold, automatically approved.

#### Step 4: Process Payment

Admin initiates payment:
- Views partner's bank/payment details
- Initiates wire transfer, ACH, PayPal, or Stripe payout
- Enters payment reference number
- Status changes from APPROVED → PROCESSING

#### Step 5: Confirm Payment

Once payment confirmed (received by partner):
- Admin clicks "Mark as Paid"
- Enters confirmation details
- Status changes from PROCESSING → PAID
- Settlement complete

### 4.4 Settlement Status Flow

```
┌─────────┐     Generate     ┌──────────┐     Approve     ┌──────────┐
│         │────────────────►│          │───────────────►│          │
│ (none)  │                 │ PENDING  │                │ APPROVED │
│         │                 │          │                │          │
└─────────┘                 └──────────┘                └────┬─────┘
                                  │                         │
                                  │ Dispute                 │ Initiate
                                  ▼                         │ Payment
                            ┌──────────┐                    │
                            │ DISPUTED │                    ▼
                            └──────────┘              ┌──────────┐
                                                      │PROCESSING│
                                                      └────┬─────┘
                                                           │
                                            ┌──────────────┼──────────────┐
                                            │              │              │
                                            ▼              ▼              ▼
                                      ┌──────────┐  ┌──────────┐  ┌──────────┐
                                      │   PAID   │  │  FAILED  │  │ DISPUTED │
                                      └──────────┘  └──────────┘  └──────────┘
```

---

## 5. Admin Settlement Interface

### 5.1 Settlement List (`/admin/settlements`)

#### List View Columns

| Column | Description |
|--------|-------------|
| ID | Settlement ID (click to view) |
| Partner | Partner name |
| Period | Date range (e.g., "Jan 1-7, 2025") |
| Captures | Number of captures |
| Gross | Total captured amount |
| Fee (6%) | Partner fee |
| Net | Amount to pay partner |
| Status | Pending, Approved, Processing, Paid, Failed |
| Created | When settlement was generated |
| Actions | Quick action buttons |

#### Filters

- **Partner**: Filter by specific partner
- **Status**: Pending, Approved, Processing, Paid, Failed, Disputed
- **Date Range**: Settlement period dates
- **Amount Range**: Min/max net amount

#### Bulk Actions

- Approve selected (for multiple pending settlements)
- Export selected to CSV

#### Quick Stats

- Total pending: $XX,XXX.XX (X settlements)
- Paid this month: $XX,XXX.XX
- Paid this year: $XXX,XXX.XX

### 5.2 Settlement Detail (`/admin/settlements/:id`)

#### Summary Section

```
┌─────────────────────────────────────────────────────────────────┐
│  Settlement #settle_abc123                        Status: PENDING│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Partner:        IndieCrowdfund                                 │
│  Contact:        finance@indiecrowdfund.com                     │
│                                                                 │
│  Period:         January 1 - January 7, 2025                    │
│  Captures:       47                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Gross Amount:         $10,000.00                       │   │
│  │  Partner Fee (6%):     -   $600.00                      │   │
│  │  ─────────────────────────────────────                  │   │
│  │  Net Amount:            $9,400.00                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Approve]  [Dispute]  [Add Note]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Captures Breakdown

**By Creator**:

| Creator ID | Creator Email | Projects | Amount |
|------------|---------------|----------|--------|
| creator_123 | alice@email.com | 3 | $2,500.00 |
| creator_456 | bob@email.com | 1 | $1,200.00 |
| creator_789 | carol@email.com | 2 | $6,750.00 |

**Detailed Capture List**:

| Capture ID | Creator | Project | Amount | Captured At |
|------------|---------|---------|--------|-------------|
| cap_001 | creator_123 | Project Alpha | $500.00 | Jan 2, 10:30 AM |
| cap_002 | creator_123 | Project Alpha | $1,000.00 | Jan 2, 2:15 PM |
| cap_003 | creator_456 | Project Beta | $1,200.00 | Jan 3, 9:00 AM |
| ... | ... | ... | ... | ... |

#### Payment Section

**For APPROVED status**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Payment Details                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Method:         Wire Transfer                                  │
│  Bank:           First National Bank                            │
│  Account:        ****4567                                       │
│  Routing:        ****8901                                       │
│  SWIFT:          FNBKUS33                                       │
│                                                                 │
│  Amount to Send: $9,400.00 USD                                  │
│                                                                 │
│  Payment Reference: [________________________]                   │
│                                                                 │
│  [Process Payment]                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**For PROCESSING status**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Payment Status: PROCESSING                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Payment Reference:  WIRE-20250108-001                          │
│  Initiated:          January 8, 2025 at 2:30 PM                 │
│  Amount Sent:        $9,400.00 USD                              │
│                                                                 │
│  [Mark as Paid]  [Mark as Failed]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### History/Timeline

```
January 8, 2025 2:30 PM - admin@company.com
  Payment initiated (WIRE-20250108-001)

January 8, 2025 10:15 AM - admin@company.com
  Settlement approved

January 8, 2025 12:00 AM - System
  Settlement generated automatically
  47 captures totaling $10,000.00 (net: $9,400.00 after 6% fee)
```

#### Notes Section

- Add internal notes
- Flag for review
- Attach documents (if needed)

### 5.3 Partner Payment Configuration (`/admin/partners/:id/payments`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Payment Configuration: IndieCrowdfund                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Payment Method: [Wire Transfer ▼]                              │
│                                                                 │
│  ── Wire Transfer Details ──────────────────────────────────    │
│                                                                 │
│  Bank Name:        [First National Bank        ]                │
│  Account Number:   [****4567                   ] 🔒             │
│  Routing Number:   [****8901                   ] 🔒             │
│  SWIFT/BIC:        [FNBKUS33                   ]                │
│  Bank Address:     [123 Main St, New York, NY  ]                │
│                                                                 │
│  Account Holder:   [IndieCrowdfund LLC         ]                │
│  Account Type:     [Checking ▼]                                 │
│                                                                 │
│  ── Settlement Settings ────────────────────────────────────    │
│                                                                 │
│  Frequency:        [Weekly ▼]                                   │
│  Settlement Day:   [Monday ▼]                                   │
│  Minimum Amount:   [$100.00      ]                              │
│  Partner Fee:      [6.00%        ] (default)                    │
│                    [ ] Override default fee                     │
│                                                                 │
│  [Save Changes]                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Partner Settlement API

Partners can query their settlement status via the internal API.

### 6.1 GET `/internal/settlements`

Get list of settlements for the requesting partner.

**Request**:
```http
GET /internal/settlements?status=PAID&limit=10
X-Internal-Key: <partner-api-key>
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (optional) |
| limit | number | Max results (default 20, max 100) |
| offset | number | Pagination offset |
| from | ISO date | Period start after date |
| to | ISO date | Period end before date |

**Response**:
```json
{
  "settlements": [
    {
      "id": "settle_abc123",
      "periodStart": "2025-01-01T00:00:00Z",
      "periodEnd": "2025-01-07T23:59:59Z",
      "grossAmount": 10000.00,
      "partnerFee": 600.00,
      "netAmount": 9400.00,
      "currency": "USD",
      "captureCount": 47,
      "status": "PAID",
      "paidAt": "2025-01-10T14:30:00Z",
      "paymentRef": "WIRE-20250108-001",
      "createdAt": "2025-01-08T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 52,
    "limit": 10,
    "offset": 0
  }
}
```

### 6.2 GET `/internal/settlements/:id`

Get detailed settlement with capture breakdown.

**Request**:
```http
GET /internal/settlements/settle_abc123
X-Internal-Key: <partner-api-key>
```

**Response**:
```json
{
  "settlement": {
    "id": "settle_abc123",
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-01-07T23:59:59Z",
    "grossAmount": 10000.00,
    "partnerFee": 600.00,
    "netAmount": 9400.00,
    "currency": "USD",
    "status": "PAID",
    "paidAt": "2025-01-10T14:30:00Z",
    "paymentRef": "WIRE-20250108-001"
  },
  "captures": [
    {
      "id": "cap_001",
      "creatorId": "creator_123",
      "projectId": "project_456",
      "amount": 500.00,
      "capturedAt": "2025-01-02T10:30:00Z"
    },
    {
      "id": "cap_002",
      "creatorId": "creator_123",
      "projectId": "project_456",
      "amount": 1000.00,
      "capturedAt": "2025-01-02T14:15:00Z"
    }
    // ... more captures
  ],
  "summary": {
    "byCreator": [
      { "creatorId": "creator_123", "amount": 2500.00, "count": 5 },
      { "creatorId": "creator_456", "amount": 1200.00, "count": 1 }
    ],
    "byProject": [
      { "projectId": "project_456", "amount": 1500.00, "count": 3 },
      { "projectId": "project_789", "amount": 1000.00, "count": 2 }
    ]
  }
}
```

### 6.3 GET `/internal/captures`

Get unsettled captures for partner's own tracking.

**Request**:
```http
GET /internal/captures?settled=false
X-Internal-Key: <partner-api-key>
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| settled | boolean | Filter by settlement status |
| creatorId | string | Filter by creator |
| projectId | string | Filter by project |
| from | ISO date | Captured after date |
| to | ISO date | Captured before date |
| limit | number | Max results |
| offset | number | Pagination offset |

**Response**:
```json
{
  "captures": [
    {
      "id": "cap_xyz",
      "holdId": "hold_123",
      "creatorId": "creator_123",
      "projectId": "project_456",
      "amount": 500.00,
      "capturedAt": "2025-01-08T10:00:00Z",
      "settlementId": null
    }
  ],
  "summary": {
    "totalUnsettled": 2500.00,
    "captureCount": 12
  },
  "pagination": {
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

### 6.4 POST `/internal/captures` (Called by Partner)

When a project funds on IndieCrowdfund and holds are captured, the partner calls this endpoint to record capture details.

**Request**:
```http
POST /internal/captures
X-Internal-Key: <partner-api-key>
Content-Type: application/json

{
  "holdId": "hold_123",
  "creatorId": "creator_456",
  "creatorEmail": "creator@example.com",
  "projectId": "project_789",
  "projectName": "Amazing Project"
}
```

**Response**:
```json
{
  "success": true,
  "capture": {
    "id": "cap_xyz",
    "holdId": "hold_123",
    "amount": 500.00,
    "capturedAt": "2025-01-08T10:00:00Z"
  }
}
```

**Note**: The hold must already be captured via `/internal/capture` (from main spec). This endpoint records additional metadata for settlement purposes.

---

## 7. Creator Payout (IndieCrowdfund Side)

> ⚠️ **REFERENCE ONLY - Implemented on IndieCrowdfund Server**  
> This section documents how IndieCrowdfund should handle creator payouts.

### 7.1 Overview

Once IndieCrowdfund receives settlement funds from CreatorCredits, they pay creators through their existing payout system. The recommended approach is **Stripe Connect**.

### 7.2 Stripe Connect Integration

#### Onboarding Flow

1. Creator signs up on IndieCrowdfund
2. Creator initiates payout setup
3. Redirect to Stripe Connect onboarding (Express or Custom)
4. Creator completes identity verification, bank details
5. Stripe Connect account linked to IndieCrowdfund

#### Account Types

| Type | Best For | IndieCrowdfund Responsibility |
|------|----------|-------------------------------|
| Express | Most creators | Minimal - Stripe handles dashboard |
| Custom | White-label experience | Full - must build payout dashboard |

**Recommendation**: Start with Express, migrate to Custom later if needed.

### 7.3 Creator Balance Tracking

```prisma
// On IndieCrowdfund server

model CreatorBalance {
  id               String    @id @default(cuid())
  creatorId        String    @unique
  creator          Creator   @relation(fields: [creatorId], references: [id])
  
  // Available for payout
  availableBalance Decimal   @db.Decimal(10, 2) @default(0)
  
  // Pending (project funded but settlement not received)
  pendingBalance   Decimal   @db.Decimal(10, 2) @default(0)
  
  // Lifetime totals
  lifetimeEarnings Decimal   @db.Decimal(12, 2) @default(0)
  lifetimePaid     Decimal   @db.Decimal(12, 2) @default(0)
  
  // Breakdown by source
  stripeEarnings   Decimal   @db.Decimal(10, 2) @default(0)
  creditEarnings   Decimal   @db.Decimal(10, 2) @default(0)
  
  updatedAt        DateTime  @updatedAt
}

model CreatorEarning {
  id            String        @id @default(cuid())
  creatorId     String
  creator       Creator       @relation(fields: [creatorId], references: [id])
  
  // Source
  source        EarningSource // STRIPE_DIRECT or CREDITS
  projectId     String
  pledgeId      String?
  
  // Amounts
  grossAmount   Decimal       @db.Decimal(10, 2)
  platformFee   Decimal       @db.Decimal(10, 2)
  netAmount     Decimal       @db.Decimal(10, 2)
  
  // Status
  status        EarningStatus
  availableAt   DateTime?     // When funds become available
  
  // References
  stripePaymentId  String?    // For direct Stripe payments
  creditCaptureId  String?    // Reference to CreatorCredits capture
  
  createdAt     DateTime      @default(now())
}

enum EarningSource {
  STRIPE_DIRECT   // Backer paid with Stripe
  CREDITS         // Backer paid with CreatorCredits
}

enum EarningStatus {
  PENDING         // Awaiting settlement/processing
  AVAILABLE       // Ready for payout
  PAID            // Included in a payout
}

model CreatorPayout {
  id              String        @id @default(cuid())
  creatorId       String
  creator         Creator       @relation(fields: [creatorId], references: [id])
  
  // Amount
  amount          Decimal       @db.Decimal(10, 2)
  fee             Decimal       @db.Decimal(10, 2)  // Stripe Connect fee
  netAmount       Decimal       @db.Decimal(10, 2)
  currency        String        @default("USD")
  
  // Status
  status          PayoutStatus
  
  // Stripe
  stripePayoutId  String?
  stripeAccountId String
  
  // Timestamps
  createdAt       DateTime      @default(now())
  processedAt     DateTime?
  paidAt          DateTime?
  failedAt        DateTime?
  failureReason   String?
  
  // Linked earnings
  earnings        CreatorEarning[]
}

enum PayoutStatus {
  PENDING     // Created, awaiting processing
  PROCESSING  // Sent to Stripe
  PAID        // Successfully paid
  FAILED      // Payment failed
  CANCELLED   // Cancelled before processing
}
```

### 7.4 Balance Update Flow

#### When Project Funds with Credits

```typescript
// On IndieCrowdfund server
async function handleProjectFunded(project: Project) {
  const pledges = await getPledgesForProject(project.id);
  
  for (const pledge of pledges) {
    if (pledge.paymentMethod === 'CREDITS') {
      // Capture the hold on CreatorCredits
      const captureResult = await creditService.captureHold(pledge.id);
      
      if (captureResult.success) {
        // Record earning (but mark as PENDING until settlement received)
        await prisma.creatorEarning.create({
          data: {
            creatorId: project.creatorId,
            source: 'CREDITS',
            projectId: project.id,
            pledgeId: pledge.id,
            grossAmount: captureResult.amount,
            platformFee: captureResult.amount * 0.05, // 5% IC fee
            netAmount: captureResult.amount * 0.95,
            status: 'PENDING',
            creditCaptureId: captureResult.captureId
          }
        });
        
        // Update pending balance
        await prisma.creatorBalance.update({
          where: { creatorId: project.creatorId },
          data: {
            pendingBalance: { increment: captureResult.amount * 0.95 }
          }
        });
      }
    }
  }
}
```

#### When Settlement Received from CreatorCredits

```typescript
// On IndieCrowdfund server
async function handleSettlementReceived(settlement: Settlement) {
  // Get all earnings linked to this settlement's captures
  const earnings = await prisma.creatorEarning.findMany({
    where: {
      creditCaptureId: { in: settlement.captureIds },
      status: 'PENDING'
    }
  });
  
  for (const earning of earnings) {
    // Move from pending to available
    await prisma.$transaction([
      prisma.creatorEarning.update({
        where: { id: earning.id },
        data: { 
          status: 'AVAILABLE',
          availableAt: new Date()
        }
      }),
      prisma.creatorBalance.update({
        where: { creatorId: earning.creatorId },
        data: {
          pendingBalance: { decrement: earning.netAmount },
          availableBalance: { increment: earning.netAmount },
          creditEarnings: { increment: earning.netAmount }
        }
      })
    ]);
  }
}
```

### 7.5 Payout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CREATOR PAYOUT FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Creator                    IndieCrowdfund                    Stripe
   │                             │                              │
   │  1. Request payout          │                              │
   │  (or automatic threshold)   │                              │
   │────────────────────────────►│                              │
   │                             │                              │
   │                             │  2. Verify available balance │
   │                             │  3. Calculate fees           │
   │                             │  4. Create payout record     │
   │                             │                              │
   │                             │  5. Initiate transfer        │
   │                             │─────────────────────────────►│
   │                             │                              │
   │                             │  6. Transfer to connected    │
   │                             │     account                  │
   │                             │◄─────────────────────────────│
   │                             │                              │
   │  7. Payout confirmation     │                              │
   │◄────────────────────────────│                              │
   │                             │                              │
   │  8. Funds in bank           │                              │
   │  (1-2 business days)        │                              │
```

### 7.6 Payout Configuration

| Setting | Description | Suggested Default |
|---------|-------------|-------------------|
| Minimum Payout | Minimum amount to request payout | $25.00 |
| Auto-Payout Threshold | Automatically payout when balance exceeds | $500.00 |
| Auto-Payout Enabled | Enable automatic payouts | Optional |
| Payout Schedule | When auto-payouts process | Daily, Weekly, Monthly |

---

## 8. Settlement Reports

### 8.1 Available Reports

Located at `/admin/reports/settlements`

| Report | Description |
|--------|-------------|
| Settlement Summary | Total settled by period, by partner |
| Unsettled Captures | All captures awaiting next settlement |
| Platform Fee Revenue | Fees earned by CreatorCredits |
| Partner Performance | Volume trends by partner |
| Settlement Aging | Time from capture to settlement to payment |
| Creator Distribution | Earnings distribution across creators |

### 8.2 Settlement Summary Report

**Filters**: Date range, Partner, Status

**Output**:

| Partner | Settlements | Gross | Fees | Net | Avg Settlement |
|---------|-------------|-------|------|-----|----------------|
| IndieCrowdfund | 4 | $45,000 | $1,350 | $43,650 | $10,912 |
| (Total) | 4 | $45,000 | $1,350 | $43,650 | $10,912 |

**Charts**:
- Settlements over time (line chart)
- Settlement amounts (bar chart)
- Fee revenue trend

### 8.3 Unsettled Captures Report

**Filters**: Partner, Date range, Creator, Project

**Output**:

| Partner | Captures | Total Amount | Oldest | Next Settlement |
|---------|----------|--------------|--------|-----------------|
| IndieCrowdfund | 23 | $5,250 | Jan 8 | Jan 15 |

**Detailed View**:
- List of all unsettled captures
- Grouped by creator or project

### 8.4 Export Options

- **CSV**: Raw data for spreadsheets
- **Excel**: Formatted with multiple sheets
- **PDF**: Settlement statements for partners

### 8.5 Scheduled Reports

| Report | Frequency | Recipients |
|--------|-----------|------------|
| Weekly Settlement Summary | Weekly (Monday) | Finance team |
| Monthly Partner Statements | Monthly (1st) | Partners + Finance |
| Quarterly Revenue Report | Quarterly | Executive team |

---

## 9. Settlement Notifications

### 9.1 Admin Notifications

| Event | Channel | Recipients |
|-------|---------|------------|
| Settlement created | Email + Dashboard | Finance admin |
| Settlement over $10K | Email + Dashboard | Finance admin |
| Settlement requires approval | Dashboard | All admins |
| Payment initiated | Email | Finance admin |
| Payment confirmed | Email | Finance admin + Partner |
| Payment failed | Email + SMS | Finance admin |

### 9.2 Partner Webhook Notifications

Partners can configure a webhook URL to receive settlement events.

**Webhook Configuration** (in Partner settings):
- Webhook URL
- Webhook Secret (for signature verification)
- Events to subscribe to

**Webhook Payload Format**:

```json
{
  "event": "settlement.created",
  "timestamp": "2025-01-08T00:00:00Z",
  "data": {
    "settlementId": "settle_abc123",
    "partnerId": "partner_xyz",
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-01-07T23:59:59Z",
    "grossAmount": 10000.00,
    "partnerFee": 600.00,
    "netAmount": 9400.00,
    "captureCount": 47,
    "currency": "USD",
    "status": "PENDING"
  }
}

// Signature header
X-Webhook-Signature: sha256=<hmac-sha256-of-body-with-secret>
```

**Available Events**:

| Event | Description |
|-------|-------------|
| `settlement.created` | New settlement generated |
| `settlement.approved` | Settlement approved for payment |
| `settlement.processing` | Payment initiated |
| `settlement.paid` | Payment confirmed |
| `settlement.failed` | Payment failed |
| `settlement.disputed` | Settlement disputed |

### 9.3 Email Templates

#### Settlement Created (to Admin)

```
Subject: New Settlement Ready: IndieCrowdfund - $9,400.00

A new settlement has been generated and requires review.

Partner: IndieCrowdfund
Period: January 1-7, 2025
Captures: 47

Gross Amount: $10,000.00
Partner Fee (6%): $600.00
Net Amount: $9,400.00

[Review Settlement]
```

#### Settlement Paid (to Partner)

```
Subject: Settlement Paid: $9,400.00 - January 1-7, 2025

Your settlement has been paid.

Settlement ID: settle_abc123
Period: January 1-7, 2025

Gross Amount: $10,000.00
Partner Fee (6%): $600.00
Net Amount: $9,400.00

Payment Method: Wire Transfer
Payment Reference: WIRE-20250110-001
Paid On: January 10, 2025

The funds should arrive in your account within 1-3 business days.

[View Settlement Details]
```

---

## Implementation Notes

### Adding to Main Spec

When integrating this addendum:

1. Add settlement models to main Prisma schema (Section 4)
2. Add settlement admin routes to admin panel (Section 11)
3. Add settlement endpoints to internal API (Section 6)
4. Add settlement configuration to admin settings (Section 11.4)
5. Update deployment checklist with settlement verification

### Dependencies

- Main CreatorCredits spec (gift card system, partners, internal API)
- Scheduled job system (cron or similar for settlement generation)
- Partner webhook delivery system

### Testing Checklist

- [ ] Settlement generation calculates correctly
- [ ] Platform fees applied correctly
- [ ] Captures linked to settlements properly
- [ ] Settlement approval workflow functions
- [ ] Payment marking workflow functions
- [ ] Partner API returns correct data
- [ ] Webhooks delivered successfully
- [ ] Reports generate accurately
- [ ] Email notifications sent

---

*Addendum Version: 1.0*  
*Parent Document: CreatorCredits - Gift Card Service Technical Specification*
