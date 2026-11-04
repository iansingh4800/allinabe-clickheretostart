# All In Abe — "Join to get in"

Static copy of the All In Abe Whop app gate page, with Whop's embedded **Checkout Element** for the 2-Day Pass (`plan_rFD30uR1jYf1w`).

- `index.html` — the gate page. "Get access" opens the checkout in a dialog. If JavaScript or Whop's script doesn't load, the button opens `https://whop.com/checkout/plan_rFD30uR1jYf1w` instead.
- `assets/checkout.js` — mounts the checkout (`https://cdn.whop.com/elements/amber/elements.js`).
- `thanks.html` — where buyers land after a 3DS/bank step (`?payment=…&status=…`) or the checkout link's redirect (`?payment_id=…`). Query params are hints only; fulfil from Whop webhooks.

No build step — serve the folder over HTTPS (e.g. GitHub Pages, Netlify, Vercel). Locally: `python3 -m http.server`.

## Whop dashboard settings

- **Redirect after payment:** Checkout links → this link → set redirect URL to `https://<your-domain>/thanks.html`.
- **Apple Pay / Google Pay:** register your domain as a payment method domain in Whop.
