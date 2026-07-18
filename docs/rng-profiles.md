# RNG profiles — tuning and shipping the studio dice

The **randomize** button on `/studio` (“the dice”) rolls a complete look:
segmentation settings, line settings, the layer stack, hatch angles and the
ink palette. Everything about _how_ it rolls is described by an **RNG
profile**: one sampling distribution per numeric parameter, weighted picks
for the discrete choices, and the colour-scheme knobs. This document covers
the profile model, the debug panel that edits profiles visually, and the
workflow for shipping a tuned profile to everyone.

The cardinal rule of the whole system: **with no dev state present, the dice
rolls exactly the first entry of `rngBuiltinProfiles.ts`** — currently the
tuned `'built-in copy'` profile — through `Math.random`. The raw
`RANDOM_CURVES` tables stay available as the `'built-in'` profile (and as
the sanitizer's fallback), and the profile machinery itself adds no drift:
a default-profile roll is pinned bit-for-bit against a profile-less roll
(see [Guarantees](#guarantees--tests)).

## Module map

| File (in `src/lib/rstr2/`)     | Responsibility                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `randomize.ts`                 | The roll itself: `RANDOM_CURVES` / `ALGORITHM_WEIGHTS` / `CHANNEL_WEIGHTS` (the shipped tuning tables), the `RngProfile` type, `defaultRngProfile()`, `randomizeSettings()`. |
| `distributions.ts`             | The sampling strategies (`Distribution`): shapes, sampling, density (for drawing), kind conversion, validation.                                                              |
| `rngSources.ts`                | The raw random streams (`Rng`): `Math.random` plus seeded mulberry32 / sfc32 / xoshiro128\*\*.                                                                               |
| `inkColors.ts`                 | Ink palette + harmony sets, and `ColorRollOptions` — the colour knobs a profile can override.                                                                                |
| `rngBuiltinProfiles.ts`        | **The registry of shipped profiles.** Paste generated profiles here to ship them.                                                                                            |
| `rngProfiles.ts`               | Profile storage/sanitizing, editor metadata (`CURVE_META`), JSON file exchange, `rngProfileToCode()`.                                                                        |
| `rngRuntime.svelte.ts`         | Shared runtime state: active profile, advancing rng source, the roll log. The studio dice and the panel both roll through here.                                              |
| `src/lib/components/rngdebug/` | The panel UI: `RngDebugPanel.svelte`, `CurveEditor.svelte`, `WeightsEditor.svelte`.                                                                                          |

## What a roll does

`randomizeSettings(current, stickToPresets, rng, profile)`:

1. Picks a **segmentation algorithm** from `profile.algorithmWeights`.
2. Samples every **numeric parameter** (resolution, smoothing, tolerance,
   min region size, SLIC cell size/compactness, pen width, spacing min/max,
   ink threshold low/high, hatch gamma, ink boost) from its curve in
   `profile.curves`. The threshold pair is kept ordered — if a custom
   profile's curves cross, the sampled bounds are swapped.
3. Rolls the **layer stack**: layer count, per-layer channel (from
   `profile.channelWeights`) and hatch angle ranges. Channels are picked
   axis-first (`CHANNEL_AXES` in `layers.ts` groups them into red / green /
   blue / lightness): a stack is **guaranteed to span min(layerCount, 4)
   distinct information axes**, and while any non-degenerate option remains
   it never holds a channel together with its exact negative (`c`+`r`,
   `m`+`g`, `y`+`b`, `luma`+`luma-inv` — such a pair inks to a constant
   between them). Layer inks come from `pickInkScheme` — one harmony set
   for the whole stack, one distinct real ink per layer, steered by
   `profile.colors` (see below). Families are handed out in shuffle order
   and wrap to a second shade only after every family in the set has had a
   turn — the accent layer counts as its own family's turn — so a stack is
   **guaranteed to span min(layerCount, set families) distinct families**;
   a roll can never collapse onto a single family.
4. Optionally rolls **per-layer overrides** (pen width, spacings,
   threshold low/high, gamma, boost) along `profile.layerOverrideChances` —
   by default the chances are all 0 and every layer inherits the globals
   (see [Layer overrides](#layer-overrides-layeroverridechances)).
5. Leaves the **adjust** (image) parameters and the **export** size alone —
   those belong to the source image, not to the look.

With **stick to built-in presets** on, the ink + pen-width combination comes
verbatim from a random built-in preset (the physical pen sets that exist)
and only the plot-safe parameters and angles roll. The colour knobs are not
consulted on that path — the preset _is_ the palette.

## The RngProfile schema

```ts
interface RngProfile {
	id: string; // unique + stable; shipped ids lock the profile read-only
	name: string;
	curves: Record<RandomCurveKey, Distribution>; // one per rolled parameter
	algorithmWeights: WeightedOption<SegmentationAlgorithm>[];
	channelWeights: WeightedOption<LayerChannel>[];
	colors: ColorRollOptions;
	layerOverrideChances: Record<LayerOverrideKey, number>; // 0..1 per field
}
```

### Distributions (`curves`)

Every distribution carries `min` / `max` (hard clamp after sampling) and
`step` (rounding grid — `1` means integers), so swapping shapes never breaks
a parameter's contract. The kinds:

| kind         | extra fields                                   | shape / when to use                                                                                                  |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `gaussian`   | `mean`, `stdDev`                               | The classic bell — cluster around known-good values, tails reach the weird ends. The shipped default for everything. |
| `uniform`    | —                                              | Flat between the bounds. Even exploration; no taste.                                                                 |
| `triangular` | `mode`                                         | Linear ramp up to a peak and back. Like gaussian but with hard edges and a skewable peak.                            |
| `power`      | `gamma`                                        | `min + span·u^γ`: γ > 1 crowds the low end, γ < 1 the high end, 1 is uniform. Good for "usually small, rarely huge". |
| `bimodal`    | `meanA`, `stdDevA`, `meanB`, `stdDevB`, `mixA` | Two bells; `mixA` is the chance of drawing from bell A. "Either fine detail or chunky, nothing in between."          |
| `constant`   | `value`                                        | Pins the parameter. Use to freeze one variable while tuning the rest.                                                |
| `choice`     | `options: {value, weight}[]`                   | Weighted pick of explicit values (used verbatim — the step grid is not applied). E.g. resolution ∈ {64, 256, 512}.   |

The valid parameter keys and their editor ranges live in
`CURVE_META` (`rngProfiles.ts`); the shipped values in `RANDOM_CURVES`
(`randomize.ts`).

### Weighted picks

`algorithmWeights` and `channelWeights` are relative weights (not
probabilities — they don't need to sum to anything). Weight `0` removes an
option from the draw. The sanitizer guarantees every known option appears
exactly once: duplicates keep the first entry, unknown values are dropped,
missing ones get their shipped weight — so old stored profiles survive new
options being added.

Channel weights steer the draw _within_ the axis-coverage rule above: each
layer picks (weighted) among the channels of the axes the stack hasn't used
yet, falling back to unused non-inverse channels, then to any unused
channel. Weight `0` wins over axis coverage — a zeroed channel stays out of
the draw even when its axis is the only fresh one left (the stack then
reuses an axis instead).

### Colours (`colors`)

```ts
interface ColorRollOptions {
	accentRate: number; // 0..1
	harmonyWeights: { value: string; weight: number }[]; // keyed by HarmonySet.name
}
```

- **`accentRate`** — the chance a roll reserves one layer for a vibrant
  Diamine Forever accent ink (shipped: `0.75`). `0` disables the accent
  shelf entirely; `1` gives every multi-layer roll exactly one pop layer.
- **`harmonyWeights`** — how often each colour-harmony set is picked as the
  scheme for the whole stack. Keys are the set names in `HARMONY_SETS`
  (`inkColors.ts`) — e.g. `'blue / orange'`, `'primary triad'`,
  `'neutral + red'`. Same sanitizing rules as the other weights. Weighting a
  single set at > 0 pins every roll to that palette family combination.

The individual inks themselves are not part of a profile — the palette is
curated in `INK_COLORS` (real, buyable inks only). Add or retag inks there.

### Layer overrides (`layerOverrideChances`)

Each rolled layer carries seven nullable override fields (`penWidthMm`,
`spacingMinMm`, `spacingMaxMm`, `thresholdLow`, `thresholdHigh`,
`inkGamma`, `inkBoost`); `null` means "inherit the global" and is what the
dice always produced historically. `layerOverrideChances` gives each field
a 0..1 chance that a rolled layer gets its **own** value instead — sampled
from the same profile curve as the corresponding global (`thresholdLow` →
`hatchThresholdLow`, `thresholdHigh` → `hatchThresholdHigh`, `inkGamma` →
`hatchGamma`, the rest map by name), so one curve describes the physical
quantity wherever it's rolled.

Details worth knowing:

- Shipped default is `0` everywhere: layers always inherit, and a zero
  chance consumes **no randomness**, which is what keeps the default dice
  bit-identical to the pre-override behaviour.
- The layer's _effective_ spacing and threshold pairs (`override ?? global`,
  the same resolution the hatcher uses) are kept ordered: both-rolled pairs
  are sorted, a lone rolled side is clamped against the global counterpart.
- **Stick to built-in presets** never rolls overrides — the preset's pen
  combination is physical and stays verbatim.
- Enabling a chance changes how many rng draws a roll consumes, so seeded
  A/B comparisons are only draw-for-draw comparable between profiles with
  the same chances (same caveat as a layer-count tweak).

## The debug panel

A dev-only surface on `/studio` — end users never see it.

- **Open it:** the 🎲 chip bottom-left. It's present in dev builds
  (`npm run dev`) always, and in production builds only with `?rngdebug` in
  the URL (which also auto-opens the panel). The panel code is lazy-loaded
  on first open.
- **profile** — pick the active profile (this is what the dice rolls),
  rename, `+ new` / `⧉ duplicate` / `✕ delete`, `↓ export` / `↑ import`
  (JSON files), `⌗ copy as code` (see [Shipping](#shipping-a-profile)).
  Shipped profiles are read-only — duplicate one to start editing.
- **rng source** — the raw random stream. `Math.random` is the production
  default; pick a seeded source to make rolls replayable. `⚄ new` draws a
  fresh seed, `↺ restart` replays the sequence from the top.
- **roll** — `🎲 roll & apply` is the same action as the dice button
  (honours the _stick to built-in presets_ toggle). Below it, the **roll
  log**: the last 30 rolls with their full settings — expand for the exact
  parameter values and layer chips, `↩ apply` to bring any of them back.
- **curves** — one card per parameter, grouped like the studio panels. The
  grey histogram is the **ground truth**: 2 500 actual samples after
  clamping and step-rounding (bound pile-ups and step combing included);
  the ink line is the analytic shape. Drag the handles (mean, σ, mode,
  median, value) and the dashed min/max bounds; arrow keys nudge a focused
  handle. The kind dropdown converts the curve in place; numeric fields
  mirror everything for exact entry.
- **weighted picks** — bars for the algorithm and channel weights; drag a
  bar or type the weight.
- **colors** — the accent-rate slider and the harmony-set weights, each set
  with one swatch per family so you can see what you're weighting.
- **layer overrides** — the per-field chance sliders for rolled per-layer
  overrides (0 = always inherit, the shipped behaviour). Rolled override
  values show up in the studio's layer cards and in the roll-log chip
  tooltips.

### Recommended tuning workflow

1. Duplicate the profile you want to start from.
2. Switch the rng source to `mulberry32`, note the seed.
3. Roll a handful of times — the log records each result.
4. `↺ restart`, tweak a curve, roll again: **the same underlying random
   sequence** replays, so differences in the output come from your tweak,
   not from luck. (One caveat: a tweak that changes _how many_ random draws
   a roll consumes — e.g. a different layer count — shifts the sequence for
   everything after it within that roll.)
5. Keep the good rolls via the log; export the profile as JSON to share it,
   or copy it as code to ship it.

## Storage & file formats

| What          | Where / marker                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel state   | `localStorage["rstr:dev:rng"]` — `{ activeProfileId, profiles, source }`; only custom profiles are stored, shipped ones always load pristine from code.                                                                                                                                                                                                     |
| Profile files | `rstr-rng-profile-<name>.json` — `{ format: "rstr-rng-profile", version: 1, profile }`.                                                                                                                                                                                                                                                                     |
| Sanitizing    | Everything parsed is validated field-by-field (`sanitizeRngProfile`): broken curves fall back to the shipped ones, weights are repaired per the rules above, a profile without id/name is dropped. Corrupt storage falls back to defaults. A stored profile whose id collides with a shipped id is ignored, so browser state can never shadow shipped code. |

## Shipping a profile

Shipped profiles live in **`src/lib/rstr2/rngBuiltinProfiles.ts`** — a plain
list of `RngProfile` values. Everything in that list appears in the panel's
profile picker for every dev (marked _(shipped)_, read-only) and can be set
active like any other profile. The first entry is the default the dice uses
for everyone.

The recipe:

1. Tune a profile in the panel until it earns it.
2. Hit **⌗ copy as code**. The clipboard now holds a typed literal, e.g.:

   ```ts
   // RNG profile 'moody wide' — generated by the studio rng debug panel.
   // Ship it: paste into rngBuiltinProfiles.ts, add it to builtinRngProfiles(),
   // run npm test. Full workflow: docs/rng-profiles.md.
   export const MOODY_WIDE_RNG_PROFILE: RngProfile = {
   	id: 'moody-wide',
   	name: 'moody wide',
   	curves: { ... },
   	algorithmWeights: [ ... ],
   	channelWeights: [ ... ],
   	colors: { accentRate: 0.4, harmonyWeights: [ ... ] }
   };
   ```

3. Paste it into `rngBuiltinProfiles.ts` and add it to the array returned by
   `builtinRngProfiles()`.
4. `npm test` — the suite verifies every shipped profile has a unique id,
   survives its own sanitizer unchanged, and rolls inside its curve bounds.

Rules of the registry:

- **Ids must be unique and stable.** They key the active-profile pick in
  localStorage and mark the profile read-only in the panel. The code
  generator slugs the profile name (`'moody wide'` → `'moody-wide'`) —
  don't reuse or rename ids once shipped.
- **The first entry is the production default** — it is what every fresh
  session rolls (`shippedDefaultRngProfileId()`), and a test pins its id so
  a reorder is always a deliberate, reviewed change. The dice tooltip stays
  plain on the default and names any other active profile.
- Profiles can also be **authored directly in code** — see
  `uniformSweepProfile()` in the registry (every curve flattened to uniform;
  the profile to roll when hunting for combinations that break).
- To make a shipped profile _the_ default for end users, that's a product
  decision: today the dice always uses the first entry unless a dev picked
  another in the panel.

## Extending the system

- **New rolled parameter:** add its curve to `RANDOM_CURVES` and roll it in
  `randomizeSettings` (`randomize.ts`), then give it editor metadata in
  `CURVE_META` (`rngProfiles.ts`). Old stored profiles pick up the new
  curve's shipped values automatically via sanitizing.
- **New distribution kind:** extend the `Distribution` union and the
  switches in `distributions.ts` (`sampleDistribution`,
  `distributionDensity`, `describeDistribution`, `convertDistribution`,
  `sanitizeDistribution`), then teach `CurveEditor.svelte` its handles and
  numeric fields.
- **New rng source:** add it to `rngSources.ts` (`RngSourceKind`, labels,
  `createRng`) — the panel picks it up from the labels table.
- **New colour knob:** extend `ColorRollOptions` (`inkColors.ts`), consume
  it in `pickInkScheme`, default it in `defaultColorOptions`, sanitize it in
  `rngProfiles.ts`, surface it in the panel's colors section. Keep the rng
  consumption order identical when defaults are in effect (see below).

## Guarantees & tests

- **End users are unaffected** until a profile other than the default is
  made active: `rngProfiles.test.ts` asserts a default-profile roll equals a
  profile-less roll for the same seed, and `inkColors.test.ts` asserts
  default colour options pick identical schemes. When changing the sampling
  code, preserve the _order and number_ of `rng()` calls on the default
  path — that's what keeps these bit-identical (and keeps seeded sessions
  comparable across tweaks).
- `distributions.test.ts` pins every kind inside bounds and on the step
  grid, and pins the gaussian kind to the original `sampleCurve` math.
- `inkColors.test.ts` pins the **family coverage guarantee**: a multi-layer
  stack never lands on a single family, and a stack pinned to a known
  harmony set spans min(layerCount, set families) distinct families even
  with the accent forced on. This is what makes the harmony sets an
  enforced promise rather than a tendency.
- `rngProfiles.test.ts` pins the **channel axis guarantee**: 2–4 layer
  stacks read one channel per information axis, 5-layer stacks cover all
  four axes without ever pairing a channel with its exact negative, and
  zero-weighted channels stay out of the draw even when axis coverage has
  to degrade.
- `randomize.test.ts` is the original dice suite, untouched — it must keep
  passing without modification.
