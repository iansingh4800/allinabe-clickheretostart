# All In Abe — "Join to get in"

The All In Abe gate page as a Whop app, with Whop's embedded **Checkout Element** for the 2-Day Pass (`plan_rFD30uR1jYf1w`). Plain static files: hosted on Vercel, shown inside Whop as an experience.

| File | What it is |
| --- | --- |
| `index.html` | The gate page. "Get access" opens the checkout in a dialog. If JavaScript or Whop's script doesn't load, the button opens `https://whop.com/checkout/plan_rFD30uR1jYf1w` instead. |
| `assets/checkout.js` | Mounts the checkout (`https://cdn.whop.com/elements/amber/elements.js`). |
| `thanks.html` | Where buyers land after checkout (`?payment=…&status=…`) or from the checkout link's redirect (`?payment_id=…`). Query params are hints only; fulfil from Whop webhooks. |
| `vercel.json` | Serves `index.html` for Whop's `/experiences/<experienceId>` path. |

## 1. Deploy to Vercel

1. vercel.com → **Add New… → Project** → import `iansingh4800/allinabe-clickheretostart`.
2. Framework preset **Other**. Leave the build command and output directory empty. **Deploy**.
3. Copy the production URL, e.g. `https://allinabe-clickheretostart.vercel.app`.

Use the main production domain (`<project>.vercel.app` or your own domain), not a per-deployment URL like `<project>-abc123-<team>.vercel.app`. Vercel puts a login wall on those, and Whop would show it inside the app.

Vercel redeploys on every push to the production branch (the repo's default branch).

## 2. Add it to Whop

1. [Whop developer dashboard](https://whop.com/dashboard/developer) → create an app (or open your existing one).
2. In **Hosting**, set:
   - **Base URL:** your Vercel URL
   - **Experience view path:** `/experiences/[experienceId]`
3. Install the app into your whop. It shows up in the sidebar as an experience.

## 3. Checkout settings

- **After payment:** the embedded checkout sends buyers to `/thanks.html`. Also set the checkout link's redirect URL (Whop dashboard → Checkout links) to `https://<your-vercel-url>/thanks.html` so both paths match.
- **Test once for real:** buy with a cheap plan or a promo that leaves $1, then refund. A 100%-off code skips the card step.

## Local preview

```bash
npx serve .
```

`/experiences/...` only resolves on Vercel (it's the `vercel.json` rewrite). Locally, open `/`.
