# Hosted checkout: one session per pledge

**For partners using `create-checkout-session`. One field to add.**

## What to change

Pass `idempotencyKey` on every `create-checkout-session` call. Use your own
pledge or order id.

```diff
  POST /internal?action=create-checkout-session
  {
    "mode": "payment",
    "platformUserId": "user_xyz",
    "email": "backer@example.com",
    "amount": 5500,
    "pledgeId": "cmvfq1vqp06hbj96v3dy78tnd",
    "projectId": "proj_xyz",
    "returnUrl": "https://example.com/pledge/complete",
+   "idempotencyKey": "cmvfq1vqp06hbj96v3dy78tnd",
    "disableAutoRedirect": true
  }
```

The field is optional and max 255 characters. Keys are scoped to your partner
account and cannot collide with another partner's.

## What it fixes

Without a key, **every call creates a new session and a new PaymentIntent.**
A checkout that re-mounts — an iframe remount, a retried request, a customer
reopening the page — accumulates several intents that all carry the same
`pledgeId`. Three consequences, all of which we have seen in production:

1. **Only one intent is ever paid.** The rest sit unpaid indefinitely.
2. **The session id you hold is whichever call returned last**, which need not
   be the one that gets paid. `get-checkout-session` on it then reports that
   session's own, unpaid, intent — correctly, but not the answer you wanted.
3. **An abandoned sibling intent that later declines sends you a
   `payment.failed` carrying the pledge id of a pledge that is fine.** If your
   handler keys on `pledgeId`, that marks a good pledge failed.

## Behaviour with a key

| Existing session for that key | What you get back |
|---|---|
| None | A new session, as today |
| `pending`, not expired | **The same** `sessionId` and intent, plus `"reused": true` |
| `complete` | **The same** session, plus `"reused": true` and `"status": "complete"` — a second call for something already paid cannot produce a second charge |
| `expired`, `failed` or `canceled` | A new session; the key moves to it, so a customer can legitimately retry |

The response gains two fields when a key matched. Everything else is unchanged:

```json
{
  "success": true,
  "sessionId": "cs_a1b2c3...",
  "reused": true,
  "status": "pending",
  "checkoutUrl": "https://divinitycoin.com/checkout/cs_a1b2c3...",
  "expiresAt": "2026-10-25T21:30:00.000Z"
}
```

Treat `reused: true` as success. Use the `checkoutUrl` you are given rather
than a cached one.

## Also new: `pledgeAlreadyPaid` on `payment.failed`

`payment.failed` now carries two additional fields:

```json
{
  "pledgeAlreadyPaid": true,
  "paidPaymentIntentId": "pi_3USOJQ..."
}
```

When `pledgeAlreadyPaid` is `true`, another PaymentIntent for that pledge has
already been paid, and this failure is an abandoned attempt — not the pledge
failing. Treat it as informational. This is additive; ignoring both fields
leaves your current behaviour unchanged.

## Also new: the same fields on every `checkout.*` event

`checkout.completed`, `checkout.expired`, `checkout.failed` and
`checkout.canceled` now carry:

```json
{
  "pledgeAlreadyPaid": true,
  "paidPaymentIntentId": "pi_3USOJQ...",
  "paidSessionId": "cs_207df7b..."
}
```

`pledgeAlreadyPaid` is `true` when a **different** session for the same pledge
has been paid. Read it per event:

| Event | `pledgeAlreadyPaid: true` means |
|---|---|
| `checkout.expired` / `failed` / `canceled` | An abandoned sibling of a paid pledge. Informational; the pledge is fine. |
| `checkout.completed` | **The pledge has been paid twice.** Contact us — this should not happen once you send an `idempotencyKey`. |

Sessions abandoned before the expiry sweep existed will emit `checkout.expired`
as the sweep reaches them. For a pledge that was paid on another session, every
one of those carries `pledgeAlreadyPaid: true` and `paidSessionId` naming the
session that was.

## The hosted page no longer reports "complete" while a payment is in flight

Previously, if the processor still had a payment as `processing` when the
customer submitted, the hosted page treated that as terminal: it showed a
done state and sent the parent frame a `complete` message whose `status` was
`"pending"`. That message could arrive a minute or more before the payment
actually completed.

Now the page keeps re-checking until the processor reports a terminal state,
and only then sends `complete`. The `status` on a `complete` message is now
always one of `complete`, `failed`, `expired` or `canceled` — never `pending`.
If your handler already ignored `pending`, nothing changes.

## If you embed the hosted page in an iframe

With `disableAutoRedirect: true` we deliberately do **not** navigate the top
window on completion — you own all post-completion navigation. If your parent
frame does not act on the `complete` `postMessage`, the customer is left on our
page after a successful payment. Confirm your message handler navigates or
transitions your own UI.

## Nothing else changes

No existing field, response shape or event is altered. Partners that send no
`idempotencyKey` keep today's behaviour exactly.
