# RSTR — quality & security audit

**Date:** 2026-07-17 · **Scope:** full repository at `a81a1ad` (app, order-upload worker, static assets, full 205-commit git history) · **Occasion:** pre-marketing / making the repository public.

> ⚠️ This document itself describes the current hardening gaps. Either resolve the items below **before** the repo goes public, or drop this file from the public tree — don't publish an open to-do list of weaknesses.

---

## Executive summary

The codebase is in genuinely good shape: strict TypeScript, 167 passing unit tests (including edge-case tests for the worker's origin gate), clean ESLint/Prettier/svelte-check runs, a green production build, careful escaping and input sanitization everywhere untrusted data enters, and **no secrets anywhere in the working tree or the full git history**. Nothing found is a critical vulnerability.

What remains falls into four buckets:

1. **Abuse hardening** on the one server-side component (the unauthenticated upload worker → R2 cost exposure).
2. **Publication/IP issues** — copyrighted PDFs in `_docs/`, commercial webfonts still living in git history, an uninspectable 7z archive.
3. **Claim accuracy & privacy** — "Nothing is uploaded" vs. the silent order upload; no privacy note for the order flow.
4. **Best-practice gaps** — no CSP/security headers, ~24 MB service-worker precache, no CI, dual lockfiles, missing license metadata.

Recommended order of attack before the announcement: **L1/L2 (history + `_docs`) → S1 (worker abuse) → P1 (claims) → S2/Q1 (headers, precache) → the rest.** L2 especially: rewriting history is only cheap _now_, while nobody has cloned the repo.

---

## Security

### S1 · Order-upload worker: no rate limiting or storage abuse controls — **Medium**

`workers/order-upload/src/index.js` is deliberately unauthenticated (correct reasoning: a static site can't hold a secret) and already has good guardrails: origin allowlist, 30 MB cap, strict `orders/<12-hex>.svg` key shape, SVG sniff, idempotent keys, private bucket.

What's missing is everything that bounds _volume_. The `Origin` header is only a browser courtesy — `curl` can set it to `https://d17e.dev` — so any scripted client can PUT 30 MB per request across a 16^12 key space into `rstr-order-files`. R2 storage is billed; a bored attacker (marketing brings attention) can turn the bucket into a recurring invoice. The worker README already anticipates junk from abandoned orders ("prune those occasionally").

**Recommend (all dashboard-level, no code changes):**

- Cloudflare **rate-limiting rule** on the worker route (e.g. a handful of PUTs per IP per minute — a real customer needs exactly one).
- **R2 lifecycle rule** on the `orders/` prefix (auto-delete after e.g. 60–90 days) so junk and abandoned-order files age out instead of accruing — this also gives the personal-data retention story a real answer (see P1).
- A **billing/usage alert** on R2 storage and worker requests.
- Keep the bucket exactly as private as it is now. If uploaded files are ever served back over HTTP (r2.dev or a custom domain), they are attacker-supplied SVGs → stored XSS on whatever origin serves them. Retrieval via dashboard/wrangler only, or behind `Content-Disposition: attachment`.

Minor nits, take or leave: `x-rstr-name` metadata is length-capped but not stripped of control characters; a request without `Content-Length` (chunked) is only caught by the post-buffering re-check, which is fine given Workers' own body limits.

### S2 · No CSP or security headers anywhere — **Medium**

`src/app.html` and the repo contain no Content-Security-Policy, and there's no `static/_headers` or `kit.csp` config. Today the exposure is modest — the app is static, cookie-less and auth-less, and the only third-party script is self-hosted umami — but CSP is exactly the safety net that makes a future XSS or a compromised analytics host a non-event, and it's cheap to add now.

**Recommend** either SvelteKit's built-in `kit.csp` (it nonces/hashes its own inline init script) or host-level headers. The app's real needs are tight:

```
default-src 'self';
script-src 'self' https://umami.d17e.dev;
connect-src 'self' https://umami.d17e.dev https://rstr-order-upload.david-cloudflare-862.workers.dev;
frame-src https://tally.so;
img-src 'self' blob: data:;
style-src 'self' 'unsafe-inline';
frame-ancestors 'none';
```

Plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a minimal `Permissions-Policy`. Test against the studio (blob workers, canvas, video) before shipping.

### S3 · `npm audit`: 3 low-severity findings — **Low**

All three trace to `cookie < 0.7.0` via `@sveltejs/kit` (GHSA-pxg6-pf52-xh8x, out-of-bounds characters in cookie names/paths/domains). The vulnerable code is Kit's _server_ runtime handling cookies — this deployment is fully client-side/prerendered and never feeds attacker input into cookie attributes, so practical impact is nil. Clear it when convenient with an `overrides: { "cookie": "^0.7.0" }` in `package.json` (ignore `npm audit fix --force`'s suggestion to "fix" by installing kit 0.0.30 — that's nonsense).

### S4 · Secrets & history scan — **Clean ✅**

Scanned the working tree and **all 205 commits** (after unshallowing) for key/token/password patterns, private keys, provider token formats (AWS/GitHub/Slack/OpenAI-style), emails and IP addresses. Findings: none. No `.env` was ever committed. The only IPs in history are loopback/RFC-1918 test fixtures. The identifiers that _are_ in the code — the workers.dev endpoint, Tally form ID `NpQY5G`, umami website ID — are public-by-design values that already ship to every visitor's browser; publishing the repo adds nothing.

The Dutch KvK/BTW numbers in `BrandFooter.svelte` are legally required public info for an EU webshop — correct to display, fine to publish.

### S5 · Worker dev-origin allowance in production — **Info**

`DEV_HOSTNAME_RE` permanently admits loopback + RFC-1918 origins over plain http in the deployed worker. Since the origin gate only stops _browser_ cross-site abuse anyway (see S1), the marginal exposure is a malicious page on someone's LAN uploading from a visitor's browser — negligible. If you ever want it tighter, gate the dev regex behind an env var, but it's defensible as-is and well-commented.

### Positives worth keeping

- `/prep` renders untrusted SVG the _right_ way: `DOMParser` (inert), preview through an `<img>`+blob (scripts/external loads don't execute in image context), and the `{@html}` block only ever receives locally generated markup — with a comment and eslint-disable documenting exactly that invariant. Keep that invariant; inlining the artwork markup into the live DOM would create an XSS the moment an operator opens a customer's SVG.
- Tally handoff: no third-party script, iframe pinned to `tally.so`, `postMessage` origin-checked (`orderFormSignal`), lookalike-origin tests in place, fallback links carry `rel="noreferrer"`.
- Every JSON surface (localStorage params/layers/presets/video/plotter, imported settings files) passes through explicit field-by-field sanitizers — resistant to both corrupt data and prototype-pollution-style tricks.
- `svgExport.ts` escapes attribute values and hyphen-breaks XML comments (`commentSafe`) so user-named layers can't break out of the settings comment.
- Service worker only handles same-origin GETs; export filenames are slugged to `[a-z0-9-_]` (no header/path injection via `x-rstr-name`).

---

## Privacy & marketing claims

### P1 · "Nothing is uploaded" vs. the silent order upload — **Medium (trust/accuracy)**

- `README.md`: "**Nothing is uploaded; every pixel stays on your device.**"
- Landing page: "It never leaves your browser." / "your photos never leave your device."
- Reality: clicking **continue to order** silently PUTs the exported SVG to the worker _before_ the form opens — and that file persists in R2 even when the customer then abandons the form (worker README acknowledges this). A dense multi-pen plot is a recognizable derivative of the source photo.

The studio itself already words this honestly ("ordering sends only the plot file (.svg) — the lines to draw — never your image. it goes straight into my plot queue"). The README and landing claims are broader than the truth. Before marketing amplifies those exact sentences:

- Qualify README/landing the same way the studio does — e.g. "Nothing is uploaded — until you order a plot; then only the drawn lines (SVG), never your photo."
- Add a short **privacy note** page (or help-page section): order files stored in R2 (+ retention period — pair with the S1 lifecycle rule), order form data handled by Tally, self-hosted cookie-less umami analytics. As an EU (NL) seller taking orders, a written privacy/retention statement is expected, and it's a marketing asset for exactly this product.
- Small one: the order payload's `image` field sends the customer's source _filename_ to Tally. Filenames occasionally carry personal info; either keep and mention it in the privacy note, or drop the field.

### P2 · Analytics — **Info**

Self-hosted, cookie-less umami is a privacy-friendly choice; say so out loud in the privacy note — it's a selling point.

---

## Licensing & IP (before the repo goes public)

### L1 · Copyrighted academic PDFs committed in `_docs/` — **High (for publication)**

`kang-et-al-coherent-line-drawing-coon.pdf`, `kang_npar07_hi.pdf`, `ohesham_painterly_finalreport.pdf` (~13 MB). Keeping private reading copies is one thing; a public GPL repo _redistributes_ them. Replace with links (the Kang NPAR07 paper has an official author page) and cite in the README as you already do.

### L2 · Commercial webfonts (and other removed files) still in git history — **Medium**

Full-history scan shows previously deleted files that remain fetchable from any clone once public, notably `static/fonts/argestatext-regular-webfont.woff` and `static/fonts/nudicamono-{bold,light}-webfont.woff` — **Argesta and Nudica are Atipo Foundry commercial fonts**; their license doesn't allow redistribution. Also in history: an `.afdesign` working file and old e2e assets.

**This is the one decision that must happen _before_ the first public clone:** history rewriting (`git filter-repo` dropping the font blobs, `_docs` binaries, `.afdesign`) is trivial now and disruptive forever after. Bonus: the pack shrinks from ~49 MiB. If you'd rather not rewrite, at least be aware the fonts ship with every clone.

### L3 · Uninspectable archive: `_docs/weighted_stippling_working_with_sobel_6 - Copy.7z` — **Low**

2.8 MB of unknown content (no 7z tool in this environment to verify). "- Copy" suggests a desktop backup that wandered in. Verify what's inside or (simpler) delete it — ideally via the same history rewrite.

### L4 · Font & license paperwork — **Low**

- IBM Plex (`static/fonts/*.woff2`) is OFL-1.1; the OFL asks that the license text accompany redistributed fonts. Add an `OFL.txt` next to them (README already credits correctly).
- `package.json` has no `"license"` field — add `"license": "GPL-3.0-only"` (or `-or-later`, your intent).
- `license.txt` works, but `LICENSE` is the conventional name GitHub tooling looks for first.

---

## Quality & best practices

### Q1 · Service worker precaches ~24 MB on first visit — **Medium (performance)**

`src/service-worker.ts` precaches `build` + _everything_ in `static/` except four skipped files. `static/` is 26 MB — 22 MB of it the gallery at all three responsive widths (the landing page only ever shows a subset per viewport). So a first-time visitor on mobile pays ~24 MB of background downloads, and because the cache name is version-keyed and old caches are deleted, **every deploy re-downloads it all**. A failed `cache.addAll` (one 404) also aborts SW install atomically.

Precache the app shell + fonts + icons + help images only, and let the existing network-first runtime handler cache gallery images on demand (it already does exactly that). One-line version: add `/gallery/` to the skip filter.

### Q2 · Pin the deployment adapter — **Low**

Build log: `adapter-auto: "Could not detect a supported production environment."` Works on the host platform, but pinning the real adapter (e.g. `@sveltejs/adapter-cloudflare` or `adapter-static`) makes builds reproducible anywhere and documents how the site ships. Add a one-line deploy note to the README.

### Q3 · No CI, and no repo guardrails — **Low (but do it before contributors arrive)**

`lint`, `check`, `test` all pass and cost ~2 minutes — wire them into a GitHub Actions workflow on push/PR. When the repo flips public also enable: branch protection on `main`, Dependabot (or Renovate) security updates, GitHub secret scanning + push protection, and a `SECURITY.md` with a contact for vulnerability reports (an email is enough) — that last one matters once you're marketing a site that takes orders.

### Q4 · Dual lockfiles — **Low**

Both `bun.lock` and `package-lock.json` are committed (README even advertises it). Two lockfiles _will_ drift and produce "works for me" installs. Pick the one CI uses as canonical (npm, given `engine-strict` + `package-lock`), and either drop the other or accept it's best-effort.

### Q5 · Repo weight & stray experiments — **Info**

49 MiB pack for a web app repo (gallery + `_docs` + history blobs). The L1–L3 cleanup plus optionally moving marketing imagery out of the precache path (Q1) covers the worst of it. `_docs/kmeans-worker.js` + `test-kmeans.html` are leftover experiments — fine to keep, just conscious clutter.

### Q6 · `maximum-scale=1` blocks pinch-zoom on Android — **Info (a11y)**

The comment in `app.html` correctly notes iOS ≥10 ignores it, but **Android Chrome honors `maximum-scale=1`** unless the user has "force enable zoom" on — a WCAG 1.4.4 miss for low-vision users on Android. Consider dropping it and accepting the iOS input-zoom quirk (the studio already keeps inputs at 16 px on small screens, which is the actual fix for that).

### Q7 · Watermark kill-switch becomes public knowledge — **Info**

The console switch (`localStorage 'rstr:v2:watermark' = 'off'`) is documented in source comments, which the comments themselves acknowledge is obfuscation-not-protection. Open-sourcing turns it from "hidden from casual users" into "first search result." If the mark matters commercially, decide now that you're fine with that (the honest answer for a GPL project is probably yes).

### Q8 · SEO plumbing for the marketing push — **Low**

No `robots.txt` or `sitemap.xml` in `static/`. Meta/OG/Twitter tags are already thorough; add the two files and you're done.

### What's already excellent ✅

Strict TS everywhere (`"strict": true`, zero svelte-check errors across 574 files) · pure, unit-tested engine (`src/lib/rstr2`, 167 tests incl. worker origin-gate edges and lookalike-domain negatives) · disciplined escaping and sanitization at every trust boundary · legacy `/classic` code explicitly frozen and lint-fenced instead of half-maintained · self-contained ZIP writer instead of a dependency · dependency footprint impressively small (6 runtime deps) · honest, unusually good code comments throughout.

---

## Pre-launch checklist (suggested order)

1. **Rewrite git history** to drop Atipo fonts, `_docs` PDFs/7z, `.afdesign` (L2/L1/L3) — only cheap while the repo is still private.
2. **Worker abuse hardening**: R2 lifecycle rule on `orders/`, rate-limit rule, billing alert (S1).
3. **Fix the claims**: qualify "Nothing is uploaded" in README + landing; add a short privacy note (P1).
4. **Security headers/CSP** at the host or via `kit.csp` (S2).
5. **Trim the SW precache** to the app shell (Q1).
6. **Repo paperwork**: `license` field, OFL.txt, `SECURITY.md`, robots/sitemap (L4, Q3, Q8).
7. **CI + GitHub protections** on flip-to-public: Actions (lint/check/test), branch protection, Dependabot, secret scanning (Q3).
8. When convenient: cookie override (S3), pin adapter (Q2), single lockfile (Q4), Android zoom (Q6).
9. **Remove or keep this audit file** in the public tree — deliberate choice either way.
