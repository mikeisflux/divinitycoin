# DivinityCoin API — changes for partners (September 2026)

Everything below is additive. **No existing request or response shape changed**,
so nothing breaks if you deploy none of it. Two items warrant a look regardless,
because they change *when* you receive an event you already handle.

---

## 1. `dispute.created` — new webhook (action needed)

Fired when a cardholder disputes a charge. Until now nothing told you, so a
disputed order kept its reward slot, kept counting toward the campaign total,
and stayed in fulfillment queues — goods could ship for money already being
clawed back.

```json
{
  "event": "dispute.created",
  "data": {
    "disputeId": "du_1AbC...",
    "stripePaymentIntentId": "pi_3Abc...",
    "chargeId": "ch_3Abc...",
    "pledgeId": "pledge_xyz",
    "projectId": "proj_xyz",
    "platformUserId": "user_xyz",
    "paymentId": "cm...",
    "amount": 2800,
    "currency": "usd",
    "reason": "fraudulent",
    "status": "warning_needs_response",
    "evidenceDueBy": "2026-09-17T23:59:00Z"
  }
}
```

**What you need to do**

- **If you have set an explicit event allowlist** in your partner settings, add
  `dispute.created` to it. An empty allowlist keeps receiving everything and
  needs no change.
- Handle the event. `stripePaymentIntentId` is the authoritative key — a dispute
  is raised against a charge, not an order. `pledgeId` is included whenever we
  hold one, which is every partner charge.
- **Make the handler idempotent.** Delivery is retried up to three times with
  backoff on any non-2xx or network failure. A redelivery must not decrement a
  campaign total or release a reward slot twice.
- Return `2xx` once you have accepted the event, *including* when no order
  matches. A non-2xx means we try again.

Same envelope, `X-Webhook-Signature` header and HMAC scheme as every other
webhook. Only disputes on your own charges are sent.

Not yet sent: `dispute.updated` and `dispute.closed`. Without them, a dispute we
win stays marked as a chargeback on your side until someone corrects it. Tell us
if your handler accepts them and we will start sending.

---

## 2. `payment.failed` now fires on real card declines (check your handler)

You already receive `payment.failed`. Previously it only fired when a charge
succeeded and *our* post-processing broke. It now also fires when the card
itself fails — declined, expired, insufficient funds, a failed 3DS challenge.

**You will receive this event in cases where you previously received nothing.**
No shape changed; three fields were added.

```json
{
  "event": "payment.failed",
  "data": {
    "paymentIntentId": "pi_3Abc...",
    "amount": 2500,
    "platformUserId": "user_xyz",
    "pledgeId": "pledge_xyz",
    "projectId": "proj_xyz",
    "type": "initial",
    "error": "Your card was declined.",
    "code": "card_declined",
    "declineCode": "insufficient_funds",
    "status": "requires_payment_method"
  }
}
```

Telling the two apart: a real decline carries `code`, usually `declineCode`, and
a non-terminal `status`. A post-processing failure carries neither code.

**What you need to do:** confirm your handler tolerates the extra deliveries and
is idempotent. If you use `charge-saved-payment-method`, you already get the
decline synchronously as a `402` — this is a deliberate second signal for the
case where your request times out or your process dies mid-call.

---

## 3. Retrying a declined charge (important, and probably affecting you today)

Idempotency on `charge-saved-payment-method` is enforced by the processor, which
caches the first result for a given key for **24 hours** — and that cache
includes declines. Repeating the identical call inside that window replays the
cached `402` **without contacting the bank**.

If you run a retry schedule for declined charges, retries inside 24 hours are
currently reaching nothing at all.

**The fix — one optional field.** `charge-saved-payment-method` now accepts
`idempotencyKey` (1–64 chars of `[A-Za-z0-9._:-]`):

```json
{
  "platformUserId": "...",
  "paymentMethodId": "...",
  "amount": 2500,
  "pledgeId": "pledge_abc",
  "projectId": "proj_xyz",
  "idempotencyKey": "attempt-2"
}
```

Pass a distinct value per attempt (`attempt-1`, `attempt-2`, …) and each retry
becomes a genuine new authorization. Omit it and behaviour is byte-identical to
today.

**Do not mutate `pledgeId` to force a new key.** We persist it on the payment
record and echo it in webhooks; changing it breaks your reconciliation.

---

## 4. `create-payment-intent` also takes `idempotencyKey` (optional)

This endpoint deliberately does **not** deduplicate on its own. A single pledge
legitimately carries more than one charge — a base pledge and an add-on upcharge
minutes apart, often at the same amount — and collapsing those automatically
would hand the backer the add-on for free.

So a blind retry after a timeout *will* charge again. To retry safely, pass an
`idempotencyKey` — any stable string you generate per intended charge, reused
across retries of that charge:

```json
{ "pledgeId": "pledge_abc", "amount": 1000, "idempotencyKey": "pledge_abc-base" }
```

Repeat the key and you get the original PaymentIntent back for 24 hours. Use a
*different* key for a genuinely different charge on the same pledge. Reusing a
key with different parameters is rejected rather than charged, so a mistake
surfaces as an error.

---

## 5. `lookup-payment` — new action (optional, recommended)

For the case where a request timed out and you do not know whether the card was
captured. Check rather than retry blind.

```
POST /internal?action=lookup-payment
{ "pledgeId": "pledge_abc" }
```

Returns every charge attempt recorded against that pledge, each reconciled
against live processor status so a missed webhook cannot make a settled charge
look unpaid.

- `hasSuccessfulCharge` is the field to branch on.
- If `reconciled` is `false`, we could not reach the processor for at least one
  attempt — treat `hasSuccessfulCharge: false` as **unknown**, not "safe to
  charge".

Past 24 hours an idempotency key expires and a retry will charge again, so use
this first.

---

## 6. Partner-initiated refunds now work

The refund callback path had a defect that made it fail on every call. It is
fixed. If you built a workaround, you can retire it.

One thing to know if you read card status back: a refunded card reports
`REVOKED`. There is no `REFUNDED` card status.

---

## 7. Withdrawn before you could have used it

A short-lived `deduplicated: true` field appeared on `create-payment-intent`
responses for part of August. It is gone, replaced by the explicit
`idempotencyKey` above. If you coded against it, remove that branch.

---

## Summary

| Change | Action required |
|---|---|
| `dispute.created` | **Yes** — add to allowlist if you use one; handle it; be idempotent |
| `payment.failed` on declines | **Check** — you will receive more of these |
| `idempotencyKey` on `charge-saved-payment-method` | Recommended — your retries are otherwise no-ops |
| `idempotencyKey` on `create-payment-intent` | Optional |
| `lookup-payment` | Optional |
| Refund callback fixed | None |
| `deduplicated` field removed | Only if you used it |

Full reference: https://divinitycoin.com/developers

Questions, or if you want `dispute.updated` / `dispute.closed` — tell us and we
will send them.
