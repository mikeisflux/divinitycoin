# Sending the purchaser's IP — what we need you to build

**Two optional fields, on two existing endpoints. Nothing breaks if you skip
them, but a fraud dispute on your campaign becomes close to unwinnable.**

---

## Why we're asking

Your calls to DivinityCoin are server-to-server. The only IP we can observe is
your server's — the same value for every one of your backers. It is useless as
evidence and misleading if we ever presented it as the buyer's.

The end user's real IP is something only you can see.

It matters in two places:

**Fraud chargebacks.** When a cardholder claims "I never authorised this", the
card network expects the merchant to show the purchase came from the buyer. We
recently lost that argument on a $50 charge with nothing to offer: no IP, no
device, no receipt. The money and the dispute fee come out of the campaign.

**Ban matching.** Our chargeback-ban prefilter matches on IP among other
identifiers. Without a real end-user IP it cannot tell one of your backers from
another, so a banned backer can return under a new email unchallenged.

---

## What to send

Two new optional fields on the request body:

| Field | Type | Notes |
|---|---|---|
| `customerIpAddress` | string | The end user's IP. 3–45 chars, IPv4 or IPv6. |
| `customerUserAgent` | string | The end user's `User-Agent`. Truncated at 512 chars. |

On both endpoints that create a charge:

- `POST /internal?action=create-payment-intent`
- `POST /internal?action=charge-saved-payment-method`

```json
{
  "platformUserId": "user_123",
  "email": "backer@example.com",
  "amount": 5000,
  "pledgeId": "pledge_abc",
  "projectId": "proj_xyz",
  "customerIpAddress": "203.0.113.42",
  "customerUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ..."
}
```

We record both **as reported** and never treat them as verified. Anything that
fails a basic length/charset check is stored as null rather than rejecting your
request — a malformed IP will never cost you a charge.

---

## Getting the right value

The value you want is the IP of the browser that hit *your* checkout, captured
in the request handler that serves it — not in the code that calls us.

### Node / Express

```js
// Required, or req.ip returns your load balancer's address:
app.set('trust proxy', true);

// In the route that handles checkout:
const customerIpAddress = req.ip;
const customerUserAgent = req.get('user-agent');
```

### Next.js (App Router)

```ts
import { headers } from 'next/headers';

const h = await headers();
const customerIpAddress =
  h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined;
const customerUserAgent = h.get('user-agent') ?? undefined;
```

### Anything else

Take the **first** entry of `X-Forwarded-For`, or whatever your framework
reports as the client IP once it is configured to trust your proxy.

### Four ways to get it wrong

1. **Reading it in the wrong place.** Capture it in the handler serving the
   browser, then pass it through to the call. Read at call time you get your own
   server.
2. **Sending the whole `X-Forwarded-For` header.** It is a comma-separated
   chain. Send the first entry only.
3. **Forgetting proxy trust.** Behind nginx or a load balancer, `req.ip` and
   equivalents return the proxy's address until the framework is told to trust
   it.
4. **Sending the last `X-Forwarded-For` entry.** That is your own edge.

Sanity check: the value should vary between backers and look like a residential
or mobile address. If every request carries the same IP, you are sending your
own infrastructure.

---

## Scheduled and off-session charges

`charge-saved-payment-method` on a cron has no browser present, so there is no
IP to capture at that moment. Two options, in order of preference:

1. **Send the IP recorded when the payment method was saved**, if you keep it.
   That still shows where the card was entered.
2. **Omit the fields.** Do not substitute your server's IP — a wrong value is
   worse than none, because it looks like evidence until someone checks it.

---

## Effort and rollout

Realistically an hour: capture two values in your checkout handler, thread them
through to the DivinityCoin call, add them to the body. No response shape
changes and no migration on our side.

There is no backfill. Charges made before you adopt this stay without an origin,
so the sooner it ships the sooner it covers you.

Full reference: https://divinitycoin.com/developers
