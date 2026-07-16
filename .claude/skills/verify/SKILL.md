---
name: verify
description: Build, launch and drive the RSTR app to verify changes end-to-end (vite dev server + headless Chromium via Playwright).
---

# Verifying RSTR changes

SvelteKit app. Unit tests (`npm test`) cover the pure `$lib` modules; anything
touching the pages, canvas rendering or exports needs a real browser.

## Launch

```bash
npm ci                                  # once
npm run dev -- --port 5199 --strictPort # http://localhost:5199
```

Routes: `/studio` (main app, `/v2` redirects here), `/classic`, `/prep`,
`/` (landing).

## Drive (headless Chromium)

In the remote environment Playwright is installed globally, browsers under
`/opt/pw-browsers`. ESM scripts must import it by absolute path — bare
`import 'playwright'` won't resolve outside a package:

```js
import { chromium } from 'file:///opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
```

## Studio gotchas

- A fresh session (empty localStorage) loads a **random** sample image and a
  random built-in preset — some presets have a single layer. Pick a preset
  deterministically via the select under the "presets" group title
  (`page.selectOption('select:below(:text("presets"))', 'CMY classic')`).
- The export buttons (`↓ SVG`, `↓ PNG`) are disabled while
  segmentation/hatching runs; wait for the PNG button to become enabled
  before and after every settings change.
- Downloads: `Promise.all([page.waitForEvent('download'), page.click(...)])`,
  then `download.saveAs(...)` and inspect the file.
- To eyeball a canvas/PNG region, crop it in-page (`drawImage` onto a small
  canvas, `toDataURL()`) and save the base64 — screenshots of the full page
  scale the render down too much.
