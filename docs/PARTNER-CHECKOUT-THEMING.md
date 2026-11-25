# Checkout theming — make the Divinity Payments checkout match your site

**Optional, and nothing changes unless you opt in. Add a few values to the
`checkoutUrl` you already use and the checkout renders dark, or in your own
colours, instead of light.**

---

## The short version

Append one of these to the `checkoutUrl` returned by `create-checkout-session`:

| You want | Add to `checkoutUrl` |
| --- | --- |
| Our dark theme | `?theme=dark` |
| Dark or light to match each visitor's device | `?theme=auto` |
| Dark theme, your brand colour on the pay button | `?theme=dark&accent=e11d48` |
| Your own colours throughout | `?bg=14110f&text=f5ede6&accent=e11d48` |

That is the whole integration for most partners. It works the same whether you
embed the checkout in an iframe or redirect to it.

---

## Why you have to tell us

The embedded checkout is an iframe served from `divinitycoin.com`. Browsers do
not let a cross-origin iframe read the styles of the page around it, so it
cannot pick up your colours on its own. You pass them in; we derive the rest.

---

## The controls

All four are optional and can be combined.

| Param | Values | What it does |
| --- | --- | --- |
| `theme` | `light` (default), `dark`, `auto` | Built-in preset. `dark` is our dark theme. `auto` follows the visitor's device setting. Ignored when `bg` is set. |
| `bg` | hex colour | Page background. Use the colour of the surface the checkout sits on (your modal or page background). |
| `text` | hex colour | Main text colour. Only used together with `bg`. |
| `accent` | hex colour | Pay button, links and focus rings. Works with `theme`, with `bg`/`text`, or alone. |

Things worth knowing:

- **Two colours are enough.** The card, borders, dividers, card-number fields
  and the warning / error / success messages are all derived from `bg` and
  `text`. You do not set them individually.
- **Hex format.** 3 or 6 digits. In a URL leave off the `#` (`bg=14110f`), or
  encode it as `%23`.
- **Readability is enforced.** If `text` is missing, or too close to `bg` to
  read (under 4.5:1 contrast), we substitute near-black or near-white. The pay
  button's label likewise flips between white and near-black to suit your
  `accent`.
- **Bad values are ignored, not rejected.** Anything we cannot parse falls back
  to the default look. A typo never breaks a checkout.
- **Our branding stays.** The "Divinity Payments" header and the "Secure
  payment by Divinity Payments" line are always shown. Your customer's card
  statement carries our name, and the page they paid on needs to match it.
- **If your `checkoutUrl` handling already adds query params**, join with `&`
  rather than `?` as usual.

---

## Setting colours at runtime (optional)

Use this if your site has its own light/dark toggle, or you would rather read
the colours off your page than hard-code them. Post a `theme` message to the
iframe. The fields are the same as the query params; a leading `#` is fine here.

```html
<iframe
  id="dc-checkout"
  src="https://divinitycoin.com/checkout/cs_...?theme=dark"
  style="width: 100%; border: 0; min-height: 480px;"
  allow="payment *; publickey-credentials-get *"
></iframe>
<script>
  const frame = document.getElementById('dc-checkout');

  function sendTheme() {
    frame.contentWindow.postMessage({
      namespace: 'divinitycoin-checkout',
      type: 'theme',
      bg: '#14110f',       // or theme: 'dark' / 'auto' instead of colours
      text: '#f5ede6',
      accent: '#e11d48',
    }, 'https://divinitycoin.com');
  }

  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://divinitycoin.com') return;
    if (e.data?.namespace !== 'divinitycoin-checkout') return;
    if (e.data.type === 'ready') sendTheme();
  });

  // Call sendTheme() again whenever your own theme changes.
</script>
```

- Send it when you receive our `ready` message. We send `ready` on every load,
  including after a 3D Secure round-trip, so replying to it keeps the theme
  applied.
- Each message replaces the previous theme and takes precedence over the query
  params.
- Values must be hex. `getComputedStyle` returns `rgb(...)`, so convert before
  sending if you read colours from the page.
- **Still put the colours on the `checkoutUrl` too.** That avoids a flash of the
  light theme before your message arrives, and on iOS — where the embedded
  checkout hands off to a "Continue securely" tab — only the query params carry
  over to that tab.

---

## What does not change

- No API changes. `create-checkout-session` and every other action take and
  return exactly what they did before.
- The existing `ready`, `resize` and `complete` messages are unchanged.
- A `checkoutUrl` with no theme params renders exactly as it does today.

Full reference: <https://divinitycoin.com/developers#checkout-theming>
