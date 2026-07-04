# RSTR v2 — plan

RSTR does one thing: turn a raster image into a plottable, multi-pen SVG.
v2 rebuilds it around the `rstr-v3-cmy` sketch from SVG-Studio, which proved
out a fast pipeline and a layer model where every layer maps to one physical
pen. The focus is the _play_ experience: instant feedback while dragging
sliders, sensible defaults, nothing between the user and the picture.

## Pipeline (ported from the sketch)

```
image -> pixels -> cell grid -> color adjust -> per-layer channel extract
      -> segmentation (watershed | posterize | k-means)
      -> region geometry (contours + holes)
      -> hatching (ink-driven line spacing per region)
      -> preview (canvas) + export (SVG per pen / PNG)
```

Each stage is an independent `$effect` with its own dependency set, so a
slider only recomputes from its own stage downstream — moving a pen-width
slider never re-runs the watershed. Long stages yield to the frame loop and
abandon stale generations.

## Code layout

- `src/lib/rstr2/` — the engine, pure TypeScript, no framework imports:
  - `grid.ts` — image downsampling to the working cell grid
  - `imageAdjust.ts` — brightness/contrast/gamma/saturation/vibrance
  - `layers.ts` — layer model (channel + pen mapping), defaults, persistence
  - `segmentation.ts` — watershed / posterize / k-means + shared post-processing
  - `regionTools.ts` — region contour tracing (holes included)
  - `hatchTools.ts` — hatch line generation, ink→spacing curves
  - `svgExport.ts` — standalone SVG document assembly (one group per pen)
  - `params.ts` — global parameter defaults + persistence
  - `rstr2.test.ts` — unit tests over all of the above
- `src/routes/v2/+page.svelte` — the tool page: drop/browse an image,
  layer stack, grouped controls, live preview, SVG/PNG download.
  Settings and layers persist in localStorage; the image never leaves the
  browser.

v1 (`/` + `src/lib/rstr`) is untouched while v2 matures at `/v2`.

## Roadmap

1. **Done here** — engine port + first playable page at `/v2`.
2. **Feel** — tune defaults per algorithm, preset stacks (CMY, CMYK, mono,
   duotone), one-click randomize, example images to start from without
   hunting for a file.
3. **Performance** — move segmentation + hatching into a Web Worker so the
   sliders stay 60fps on large grids; consider OffscreenCanvas for preview.
4. **Export polish** — per-pen file download (one SVG per pen for plotters
   without layer support), path ordering/merging for plot time, pen catalog
   (real pen widths/colors).
5. **Promote** — replace the v1 homepage with v2 once it clearly wins;
   keep v1 reachable (e.g. `/classic`) for a release or two.

## Open questions

- Does v2 replace the homepage outright, or live alongside v1 long-term?
- Keep the hand-rolled control panel or move to tweakpane like v1?
  (Hand-rolled currently — full control over the layer stack UI.)
- Mobile: what does "playing" look like on a phone — reduced control set?
