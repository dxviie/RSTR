# order-upload worker

Receives the plot `.svg` the studio exports when someone clicks
**⚡ download & order**, and stores it in the `rstr-order-files` R2 bucket as
`orders/<design-hash>.svg`. The Tally order submission carries the same hash
in its `design` hidden field, and its `upload` field says `ok` when the file
arrived this way — submissions without it fall back to the form's manual
attach step, so a broken or unreachable worker can never block an order.

## Deploy

```bash
cd workers/order-upload
npx wrangler login   # once
npx wrangler deploy
```

The deploy prints the public URL. It must match `ORDER_UPLOAD_ENDPOINT` in
`src/lib/rstr2/orderUpload.ts`; update that constant if it differs.

## Retrieval

Files sit in the R2 bucket (Cloudflare dashboard → R2 → rstr-order-files →
`orders/`). Match an order to its file via the `design` hidden field on the
Tally submission. Each object carries the original export file name and the
receive time as custom metadata. Uploads also happen for orders that are
never submitted (people who bail at the form) — prune those occasionally, or
add an R2 lifecycle rule if it ever gets noisy.
