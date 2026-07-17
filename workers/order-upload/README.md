# order-upload worker

Receives the plot `.svg` the studio exports when someone confirms an order,
and stores it in the `rstr-order-files` R2 bucket as
`orders/<design-hash>.svg`. This is the primary channel — the file only
downloads to the customer's device when this upload fails. The Tally order
submission carries the same hash in its `design` hidden field, and its
`upload` field says `ok` when the file arrived this way — submissions
without it fall back to the form's manual attach step, so a broken or
unreachable worker can never block an order.

## Guardrails

The endpoint is deliberately unauthenticated (the studio is a public static
site — any secret it held would be public too), so the protection is
layered instead:

- **Origin allowlist** — browsers only get CORS approval from the d17e.dev
  zone (https) and loopback/LAN dev origins; everything else 403s.
- **Rate limits** — per-IP (`RATE_IP`, 10 PUT/min) and endpoint-wide
  (`RATE_GLOBAL`, 60 PUT/min) budgets via Workers ratelimit bindings.
  Per-colo and best-effort by design: a cost fuse, not accounting. Missing
  bindings fail open so an order is never lost to a limiter.
- **Content address** — the key must equal the first 12 hex chars of the
  body's SHA-256, the same fingerprint the studio computes. A request can
  only write the file its own bytes name: junk can't overwrite a real
  order, and uploads are idempotent.
- **Size & shape** — declared Content-Length required, 30 MB cap re-checked
  after buffering, strict `orders/<12-hex>` key, SVG sniff on the head.

Every rejection is CORS-tagged so the studio can read it and fall back to
the download + manual-attach flow.

## Deploy

```bash
cd workers/order-upload
npx wrangler login   # once
npx wrangler deploy  # needs wrangler >= 4.36 (ratelimit bindings)
```

The deploy prints the public URL. It must match `ORDER_UPLOAD_ENDPOINT` in
`src/lib/rstr2/orderUpload.ts`; update that constant if it differs.

## One-time account setup (dashboard)

Two guardrails live outside this config — set them once:

1. **Retention**: R2 → `rstr-order-files` → Settings → Object lifecycle
   rules → add a rule on prefix `orders/` deleting objects after **90
   days** (also doubles as the privacy retention policy — abandoned-order
   uploads age out by themselves). CLI alternative:
   `npx wrangler r2 bucket lifecycle add rstr-order-files` (interactive).
2. **Billing alarm**: Notifications → add a usage alert on R2 storage and
   Workers requests, so a flood that somehow outruns the rate limits pages
   you instead of surprising the invoice.

Keep the bucket **private**. The objects are user-supplied SVGs; if they
were ever served over HTTP from a public bucket domain they could carry
scripts. Retrieval stays via the dashboard/wrangler.

## Retrieval

Files sit in the R2 bucket (Cloudflare dashboard → R2 → rstr-order-files →
`orders/`). Match an order to its file via the `design` hidden field on the
Tally submission. Each object carries the original export file name and the
receive time as custom metadata. Uploads also happen for orders that are
never submitted (people who bail at the form) — the lifecycle rule above
prunes those automatically.
