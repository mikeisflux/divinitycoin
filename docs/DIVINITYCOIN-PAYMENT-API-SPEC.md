# DivinityCoin Seamless Payment Integration Spec

## The Big Picture

Transform DivinityCoin from a manual prepaid credit system into a **seamless, invisible payment processor**. The backer enters their credit card on IndieK, clicks "Pledge $50", and they're done. They never see DivinityCoin, never see a wallet, never see a gift card code.

Behind the scenes, the gift card system still exists as the **compliance layer** that separates Stripe from adult/NSFW content. Stripe sees "DivinityCoin digital product purchase" on DivinityCoin's Stripe account - a perfectly legitimate transaction.

### Current Flow (friction, site-hopping):
```
Backer → goes to divinitycoin.com → buys $50 gift card via Stripe →
gets voucher code → comes back to IndieK → redeems code in wallet →
goes to pledge page → pays $50 from balance
```

### New Flow (seamless, zero friction):
```
Backer → enters card on IndieK → clicks "Pledge $50" → done
```

### What happens behind the scenes (all invisible to backer):
```
1. IndieK calls DC API: POST /internal?action=create-payment-intent
2. DC creates Stripe PaymentIntent on DC's Stripe account, returns client_secret
3. IndieK renders Stripe Elements using DC's Stripe publishable key
4. Backer enters card → Stripe charges it → money lands in DC's Stripe account
5. Stripe webhook hits DC → DC auto-creates $50 gift card → auto-redeems → auto-holds for pledge
6. DC sends webhook to IndieK: "payment succeeded, credits held for pledge XYZ"
7. IndieK marks pledge as COMPLETED, sends confirmation email

Campaign succeeds → IndieK calls /internal?action=capture → credits go to settlement
Campaign fails → IndieK calls /internal?action=release → DC auto-refunds via Stripe

What Stripe sees: "Customer purchased $50 DivinityCoin digital product"
What backer sees: "I entered my card and pledged $50"
What the audit trail shows: Gift card created → redeemed → held → captured/released
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      BACKER'S BROWSER                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  IndieK Pledge Page                                        │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  Stripe Elements (loaded with DivinityCoin's         │  │  │
│  │  │  Stripe publishable key - NOT IndieK's)              │  │  │
│  │  │  ┌─────────────────┐ ┌────────┐ ┌────────────────┐  │  │  │
│  │  │  │  Card Number    │ │ MM/YY  │ │     CVC        │  │  │  │
│  │  │  └─────────────────┘ └────────┘ └────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  [ Pledge $50.00 ]                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────┬────────────────────────────────────────┬──────────────┘
           │                                        │
           │ Card data goes directly to Stripe      │ IndieK only sends
           │ (DC's Stripe account, not IndieK's)    │ amount + pledge info
           ▼                                        ▼
┌─────────────────────────┐              ┌──────────────────────────┐
│  Stripe                 │              │  IndieK Backend          │
│  (DivinityCoin's        │              │                          │
│   Stripe account)       │              │  Calls DC Partner API:   │
│                         │              │  /internal?action=       │
│  Sees: "DivinityCoin    │              │    create-payment-intent │
│  digital product"       │              │    hold / capture /      │
│                         │              │    release               │
└────────┬────────────────┘              └──────────┬───────────────┘
         │                                          │
         │ payment_intent.succeeded                 │
         ▼                                          │
┌──────────────────────────────┐                    │
│  DivinityCoin Backend        │                    │
│  (EXISTING infrastructure)   │                    │
│                              │   webhook:         │
│  1. Stripe webhook received  │   "payment         │
│  2. Auto-create gift card    │   succeeded"       │
│  3. Auto-redeem to balance   │────────────────────►
│  4. Auto-hold for pledge     │                    │
│  5. Audit trail created      │                    │
│  6. Send webhook to IndieK   │                    │
│                              │                    │
│  EXISTING: hold/capture/     │                    │
│  release, settlements,       │                    │
│  webhooks, gift cards        │                    │
└──────────────────────────────┘                    │
```

---

## What DivinityCoin Already Has (from DIVINITYCOIN.md)

DivinityCoin already has almost everything needed:

### Existing Partner API (`POST /internal?action=`)
| Action | Purpose | Status |
|--------|---------|--------|
| `validate` | Redeem gift card code → credits | EXISTS |
| `balance` | Get user's available/held/total balance | EXISTS |
| `hold` | Reserve credits for a pledge (amount, pledgeId, projectId) | EXISTS |
| `release` | Return held credits when project fails | EXISTS |
| `capture` | Transfer held credits when project succeeds → settlement | EXISTS |
| `health` | Service health check | EXISTS |
| **`create-payment-intent`** | **Create Stripe PaymentIntent, return client_secret** | **NEW** |
| **`refund`** | **Refund a payment + void gift card** | **NEW** |

### Existing Infrastructure
- Stripe payment processing with PaymentIntents
- Auto gift card creation on `payment_intent.succeeded`
- Credit balance system (available / held / total)
- Credit holds with lifecycle (ACTIVE → CAPTURED / RELEASED / EXPIRED)
- Partner authentication (Bearer token API keys)
- Webhook delivery with HMAC-SHA256 signing
- Weekly settlement system (configurable fees, min thresholds)
- Gift card generation (16-char hex, SHA-256 hashed)
- Audit logging (CreditLedger, AdminAuditLog)

---

## Part 1: What DivinityCoin Needs to Add

Only **2 new actions** + **1 enhancement** to the existing partner API.

### 1.1 NEW: `create-payment-intent` Action

This is the main new feature. Creates a Stripe PaymentIntent on DC's Stripe account and returns the `client_secret` so IndieK can render Stripe Elements.

#### `POST /internal?action=create-payment-intent`

**Request:**
```json
{
  "amount": 5000,
  "currency": "usd",
  "platformUserId": "user_456",
  "email": "backer@example.com",
  "pledgeId": "pledge_abc123",
  "projectId": "project_xyz",
  "statement_descriptor": "INDIECROWDFUND"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | integer | Yes | Amount in cents (5000 = $50.00) |
| `currency` | string | Yes | Currency code ("usd") |
| `platformUserId` | string | Yes | IndieK's user ID for this backer |
| `email` | string | Yes | Backer's email (for Stripe customer creation) |
| `pledgeId` | string | Yes | IndieK's pledge ID (for hold/capture tracking) |
| `projectId` | string | Yes | IndieK's project ID (for hold/capture tracking) |
| `statement_descriptor` | string | No | What appears on the card statement |

**What DC does internally:**
```
1. Find or create DC user record for this platformUserId
2. Find or create Stripe customer on DC's Stripe account
3. Create Stripe PaymentIntent:
   - amount, currency
   - customer = DC's Stripe customer
   - metadata.type = "gift_card_purchase"
   - metadata.partner = partner_id (from API key)
   - metadata.platformUserId, pledgeId, projectId
   - statement_descriptor
4. Store pending transaction mapping
5. Return client_secret to IndieK
```

**Response:**
```json
{
  "success": true,
  "clientSecret": "pi_3ABC123_secret_XYZ789",
  "paymentIntentId": "pi_3ABC123",
  "amount": 5000
}
```

The `clientSecret` is the raw Stripe PaymentIntent client_secret. IndieK passes this directly to Stripe Elements.

---

### 1.2 ENHANCED: Auto Gift Card + Hold on Payment Success

When DC receives Stripe's `payment_intent.succeeded` webhook for a partner-initiated payment, the flow becomes:

```
Stripe payment_intent.succeeded
  ↓
1. Auto-create gift card (EXISTING - DC already does this)
  ↓
2. Auto-redeem to user's balance (EXISTING - DC already does this)
  ↓
3. Auto-place HOLD for the pledgeId/projectId (NEW - use existing hold logic)
  ↓
4. Send webhook to partner (IndieK) with hold confirmation (ENHANCED)
```

Step 3 is new but uses the **existing hold system**. DC just needs to automatically call the hold logic after auto-redeem, using the `pledgeId` and `projectId` from the PaymentIntent metadata.

**Enhanced webhook payload to IndieK:**
```json
{
  "event": "payment.succeeded",
  "data": {
    "paymentIntentId": "pi_3ABC123",
    "amount": 5000,
    "platformUserId": "user_456",
    "pledgeId": "pledge_abc123",
    "projectId": "project_xyz",
    "giftCard": {
      "last4": "C3D4",
      "amount": 5000,
      "autoRedeemed": true
    },
    "hold": {
      "holdId": "hold_abc123",
      "amount": 5000,
      "status": "ACTIVE"
    },
    "paymentMethod": {
      "type": "card",
      "brand": "visa",
      "last4": "4242"
    }
  }
}
```

The key addition to the webhook is the `hold` object - confirming that credits were auto-held for this pledge.

---

### 1.3 NEW: `refund` Action

For when a campaign fails and IndieK needs to refund the backer's card (not just release credits).

#### `POST /internal?action=refund`

**Request:**
```json
{
  "paymentIntentId": "pi_3ABC123",
  "amount": 5000,
  "reason": "campaign_failed",
  "pledgeId": "pledge_abc123"
}
```

**What DC does internally:**
```
1. Find the original Stripe PaymentIntent
2. Process Stripe refund (full or partial)
3. Void/revoke the associated gift card
4. Release the hold (if still active)
5. Deduct from user's balance
6. Create audit trail
7. Send webhook to partner: "refund.completed"
```

**Response:**
```json
{
  "success": true,
  "refundId": "re_abc123",
  "amount": 5000,
  "status": "succeeded"
}
```

---

### 1.4 Expose Stripe Publishable Key

IndieK needs DC's Stripe publishable key to render Stripe Elements in the browser. Two options:

**Option A: Return it in the `create-payment-intent` response:**
```json
{
  "success": true,
  "clientSecret": "pi_3ABC123_secret_XYZ789",
  "publishableKey": "pk_live_dc_abc123",
  "paymentIntentId": "pi_3ABC123"
}
```

**Option B: Separate endpoint or partner config field:**
```
GET /internal?action=config
→ { "stripePublishableKey": "pk_live_dc_abc123" }
```

Option A is simpler (one fewer API call). IndieK caches the publishable key after the first response.

---

### 1.5 Summary: Changes Needed on DivinityCoin

| Change | Effort | Description |
|--------|--------|-------------|
| `create-payment-intent` action | Medium | Create Stripe PaymentIntent, return client_secret + publishable key |
| Auto-hold after payment success | Small | After auto gift card + auto redeem, also auto-hold using existing hold logic |
| Enhanced webhook payload | Small | Include hold info + payment method in webhook to partner |
| `refund` action | Medium | Stripe refund + void gift card + release hold + deduct balance |
| Expose publishable key | Tiny | Include in create-payment-intent response |

Everything else (gift cards, holds, captures, releases, settlements, webhooks) **already exists and works**.

---

## Part 2: What IndieK Needs to Change

### 2.1 Frontend: Replace Balance UI with Card Form

Since DC uses Stripe under the hood, IndieK uses the same `@stripe/react-stripe-js` library - just initialized with DC's Stripe publishable key instead of IndieK's. The existing `StripePaymentForm` component works as-is.

**Changes to `PaymentStep.tsx` - DivinityCoin section becomes:**
```tsx
project?.paymentProcessor === "DIVINITYCOIN" ? (
  clientSecret && divinityCoinStripePromise ? (
    <Elements
      stripe={divinityCoinStripePromise}  // loadStripe(DC's pk_live_...)
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#028858" } },
      }}
    >
      <StripePaymentForm  // Reuse same component - different Stripe account
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        agreedToTerms={agreedToTerms}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        total={total}
        intentType="payment_intent"  // Always payment_intent (DC charges immediately + holds)
        pledgeId={currentPledgeId}
        projectPath={projectPath}
      />
    </Elements>
  ) : (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">Loading payment form...</p>
    </div>
  )
) : // ... Chain2Pay / Stripe branches
```

**Key difference from current Stripe flow:** `intentType` is always `"payment_intent"` (never `"setup_intent"`) because DC charges immediately and uses credit holds instead of saved cards.

**Changes to `pledge/page.tsx`:**
```tsx
// Load DC's Stripe publishable key (cached after first load)
const [dcStripePromise, setDcStripePromise] = useState<Promise<Stripe | null> | null>(null);

useEffect(() => {
  if (project?.paymentProcessor === "DIVINITYCOIN") {
    fetch("/api/divinitycoin/config")
      .then(res => res.json())
      .then(data => {
        if (data.stripePublishableKey) {
          setDcStripePromise(loadStripe(data.stripePublishableKey));
        }
      });
  }
}, [project?.paymentProcessor]);
```

### 2.2 Backend: Pledge Creation for DivinityCoin

When creating a pledge for a DC project, IndieK calls DC's API instead of creating a Stripe PaymentIntent on IndieK's Stripe.

**In `/api/pledges/route.ts` - add DC branch:**
```typescript
if (project.paymentProcessor === "DIVINITYCOIN") {
  const config = await getDivinityCoinConfig();

  // Create pledge locally first
  const pledge = await db.pledge.create({
    data: {
      userId: session.user.id,
      projectId,
      rewardId,
      amount: totalAmount,
      status: "PENDING",
      paymentProcessor: "DIVINITYCOIN",
    },
  });

  // Call DC's partner API to create payment intent
  const dcResponse = await fetch(`${config.baseUrl}?action=create-payment-intent`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(totalAmount * 100),  // cents
      currency: "usd",
      platformUserId: session.user.id,
      email: session.user.email,
      pledgeId: pledge.id,
      projectId,
    }),
  });

  const dcResult = await dcResponse.json();
  if (!dcResult.success) {
    throw new Error(dcResult.error || "Failed to create payment intent");
  }

  // Cache DC's publishable key if returned
  if (dcResult.publishableKey) {
    // Store for frontend to use
  }

  // Store DC's payment intent ID on pledge
  await db.pledge.update({
    where: { id: pledge.id },
    data: { divinityCoinPaymentId: dcResult.paymentIntentId },
  });

  return NextResponse.json({
    type: "payment_intent",  // Always payment_intent for DC
    clientSecret: dcResult.clientSecret,
    pledgeId: pledge.id,
    chargedImmediately: true,  // DC always charges immediately (uses holds for unfunded)
    paymentMethod: "DIVINITYCOIN",
  });
}
```

### 2.3 Backend: New Config Endpoint

**`/api/divinitycoin/config/route.ts`**

Serves DC's Stripe publishable key to the frontend:

```typescript
export async function GET() {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { divinityCoinStripePublishableKey: true },
  });
  return NextResponse.json({
    stripePublishableKey: settings?.divinityCoinStripePublishableKey || "",
  });
}
```

### 2.4 Backend: Updated Webhook Handler

The existing `/api/webhooks/divinitycoin/route.ts` gets new event types:

```typescript
case "payment.succeeded":
  // DC already created gift card, redeemed, and held credits
  // IndieK just needs to:
  // 1. Find pledge by data.pledgeId
  // 2. Mark pledge as COMPLETED
  // 3. Store holdId in pledge metadata (for later capture/release)
  // 4. Update project currentAmount + backerCount
  // 5. Claim reward slot
  // 6. Send backer confirmation email
  // 7. Notify creator
  // 8. Add to creator email list
  // 9. Check if project just reached goal
  break;

case "payment.failed":
  // Payment declined - mark pledge as FAILED, notify backer
  break;

case "refund.completed":
  // Refund processed - update pledge status
  break;
```

### 2.5 Campaign Funded: Capture Holds

When a DC-processed campaign reaches its funding goal, capture all the holds:

```typescript
// In processPendingPledgesForProject() or campaign-funded handler:

for (const pledge of dcPledges) {
  const holdId = pledge.metadata?.divinityCoinHoldId;
  if (!holdId) continue;

  const res = await fetch(`${config.baseUrl}?action=capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ holdId }),
  });

  // On success: credits move from "held" → "captured" → settlement queue
  // DC handles settlement to creator via existing weekly settlement cycle
}
```

### 2.6 Campaign Failed: Release Holds + Refund

When a DC campaign fails, release holds and refund cards:

```typescript
// In campaign-failed handler:

for (const pledge of dcPledges) {
  const holdId = pledge.metadata?.divinityCoinHoldId;
  const paymentIntentId = pledge.divinityCoinPaymentId;

  // 1. Release the hold (credits return to available balance)
  if (holdId) {
    await fetch(`${config.baseUrl}?action=release`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ holdId }),
    });
  }

  // 2. Refund the original card charge
  if (paymentIntentId) {
    await fetch(`${config.baseUrl}?action=refund`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        amount: Math.round(Number(pledge.amount) * 100),
        reason: "campaign_failed",
        pledgeId: pledge.id,
      }),
    });
  }
}
```

### 2.7 Database Changes

```prisma
model PlatformSettings {
  // Add:
  divinityCoinStripePublishableKey  String?  // DC's Stripe publishable key (safe for browser)
}
```

Note: `divinityCoinCustomerId` on User is NOT needed because DC manages its own user records via `platformUserId`. DC maps IndieK user IDs to DC users internally.

### 2.8 Admin Settings

Add one new field to Admin > Payment Settings > DivinityCoin:

| Setting | Type | Description |
|---------|------|-------------|
| Stripe Publishable Key | SecureKeyInput | DC's Stripe publishable key for card form rendering |

Existing settings remain: API Key, Partner ID, Webhook Secret, Settlement Frequency.

---

## Part 3: Payment Lifecycle Comparison

### How Each Processor Handles the Crowdfunding Lifecycle

| Stage | Stripe (direct) | DivinityCoin (new) | Chain2Pay |
|-------|-----------------|-------------------|-----------|
| **Unfunded pledge** | Save card (SetupIntent) | Charge immediately + hold credits | Charge immediately |
| **Card data** | Stripe Elements (IndieK's key) | Stripe Elements (DC's key) | Redirect to hosted checkout |
| **Campaign succeeds** | Charge saved card | Capture hold → settlement | Already charged |
| **Campaign fails** | Release card (no charge) | Release hold + Stripe refund | Refund needed |
| **Backer experience** | Card saved, charged later | Card charged, refunded if fails | Card charged immediately |
| **Statement shows** | "INDIECROWDFUND" | "DIVINITYCOIN" (or custom) | Chain2Pay branding |
| **Settlement** | Stripe Connect → creator | DC settlement → creator bank | USDC on Polygon |

### Why "Charge Immediately + Hold" Works for DivinityCoin

The DivinityCoin model charges upfront and uses credit holds, which differs from Stripe's save-card-charge-later approach. This works because:

1. **The gift card IS the product** - Stripe sees a completed digital product purchase
2. **Holds prevent double-spending** - credits can't be used elsewhere while held
3. **Refunds are clean** - if campaign fails, Stripe refund + void gift card, backer's card gets money back
4. **No expired cards** - unlike Stripe where a saved card might expire/decline months later
5. **Compliance preserved** - gift card audit trail exists regardless of outcome

---

## Part 4: Implementation Plan

### Phase 1: DivinityCoin Changes (~3-5 days)

Since most infrastructure exists, DC only needs:

1. **New `create-payment-intent` action** (~1 day)
   - Create Stripe PaymentIntent
   - Map to partner/user/pledge metadata
   - Return client_secret + publishable key

2. **Auto-hold on payment success** (~0.5 day)
   - After existing auto gift card + auto redeem
   - Use existing hold logic with pledgeId/projectId from metadata
   - Include holdId in webhook to IndieK

3. **Enhanced webhook payload** (~0.5 day)
   - Add holdId, payment method info to payment.succeeded event
   - Add payment.failed event type

4. **New `refund` action** (~1 day)
   - Stripe refund + void gift card + release hold + deduct balance
   - Send refund.completed webhook

5. **Expose publishable key** (~0.5 day)
   - Return in create-payment-intent response
   - Or new `config` action

### Phase 2: IndieK Changes (~3-5 days)

1. Add `divinityCoinStripePublishableKey` to PlatformSettings schema
2. Create `/api/divinitycoin/config` endpoint
3. Update pledge creation API - DC branch calls `create-payment-intent`
4. Update `PaymentStep.tsx` - card form replaces balance UI
5. Update `pledge/page.tsx` - load DC's Stripe publishable key
6. Update webhook handler - new payment events
7. Add capture/release logic for campaign funded/failed
8. Update admin settings UI
9. End-to-end testing

### Phase 3: Polish (~2-3 days)
1. Apple Pay / Google Pay (free with Stripe Elements)
2. Error handling and retry logic
3. Remove old balance-based payment UI (or keep as fallback)
4. Settlement automation

---

## Part 5: The Compliance Story

The compliance structure is identical to the current manual flow - just automated:

| Step | Manual Flow (current) | Automated Flow (new) |
|------|----------------------|---------------------|
| 1 | Backer goes to divinitycoin.com | IndieK calls DC API |
| 2 | Backer buys $50 gift card via Stripe | DC creates Stripe PaymentIntent |
| 3 | Stripe charges backer's card | Stripe charges backer's card |
| 4 | DC creates gift card, sends code | DC auto-creates gift card |
| 5 | Backer redeems code on IndieK | DC auto-redeems to balance |
| 6 | IndieK deducts from balance | DC auto-holds for pledge |
| 7 | - | DC sends webhook to IndieK |

Same gift cards. Same Stripe account. Same audit trail. Same legal structure.
The automation just removes the manual steps that create friction.

Stripe's relationship is with DivinityCoin (digital goods seller).
IndieK's relationship is with DivinityCoin (partner platform using credits).
The backer's card statement shows DivinityCoin (or a custom descriptor).

---

## Summary: Minimal Changes Required

### DivinityCoin (you build):
| What | Effort | Uses Existing? |
|------|--------|---------------|
| `create-payment-intent` action | ~1 day | Existing Stripe + partner API |
| Auto-hold after payment | ~0.5 day | Existing hold system |
| Enhanced webhook payload | ~0.5 day | Existing webhook delivery |
| `refund` action | ~1 day | Existing Stripe + gift card + hold |
| Expose publishable key | ~0.5 day | New but trivial |

### IndieK (I build):
| What | Effort | Uses Existing? |
|------|--------|---------------|
| Card form in PaymentStep | ~0.5 day | Reuses StripePaymentForm |
| DC config endpoint | ~0.5 day | New but trivial |
| Pledge creation DC branch | ~1 day | Follows existing Stripe pattern |
| Webhook handler updates | ~1 day | Extends existing handler |
| Capture/release on campaign lifecycle | ~1 day | New but straightforward |
| Admin settings + schema | ~0.5 day | Extends existing |

### What IndieK Needs From You:
| Credential | Example | Purpose |
|------------|---------|---------|
| Partner API Key | (existing) | Server-to-server auth |
| Stripe Publishable Key | `pk_live_dc_...` | Render card form in browser |
| Webhook Secret | (existing) | Verify webhooks |
| Partner ID | (existing) | Identify IndieK |
| API Base URL | `https://divinitycoin.com/internal` | Where to send requests |
