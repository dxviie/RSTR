// The dice: randomized settings for the v2 pipeline.
//
// Randomness is gaussian, not uniform — every parameter gets its own curve so
// the rolls cluster around values that tend to produce good plots while still
// reaching into the weird ends of each range now and then. ALL the numeric
// tuning lives in the curve tables below (RANDOM_CURVES, ALGORITHM_WEIGHTS,
// CHANNEL_WEIGHTS): tweak mean/stdDev/min/max per parameter by hand here and
// the UI picks it up. Layer colours are not rolled numerically — they come
// from a curated real-ink palette and its colour harmonies (see inkColors.ts),
// so a multi-pen stack lands on a deliberate scheme instead of random hues,
// and 75% of rolls reserve one layer for a vibrant Diamine Forever accent ink.
// The adjust (image) and export settings are deliberately left alone — those
// belong to the source image, not to the look.
//
// With "stick to built-in presets" enabled the layer stack (ink colors,
// channels, pen widths) is taken verbatim from a random built-in preset —
// those are the physical ink + pen combinations that actually exist — and
// only the plot-safe parameters (segmentation, spacings, angles, ink
// mapping) are rolled.

import type { Rstr2Params, SegmentationAlgorithm } from './params';
import { nextLayerId, type LayerChannel, type LayerConfig } from './layers';
import { builtinPresets, type Rstr2Settings } from './presets';
import { pickInkScheme } from './inkColors';

export interface GaussianCurve {
	/** center of the bell */
	mean: number;
	/** width of the bell — ~68% of rolls land within one stdDev of the mean */
	stdDev: number;
	/** hard clamp, applied after sampling */
	min: number;
	max: number;
	/** rounding grid of the result (1 = integers) */
	step: number;
}

export interface WeightedOption<T> {
	value: T;
	weight: number;
}

// ─── the central tuning table ────────────────────────────────────────────────

export const RANDOM_CURVES = {
	// Segmentation. The "unrecognizable" rolls come from the coarse end of
	// these — too few, too-merged, or over-smoothed regions lose the subject.
	// Detail (the high end) is safe, so only the coarse bound is pulled in and
	// the bells are tightened around the known-good defaults in params.ts.
	resolution: { mean: 256, stdDev: 128, min: 32, max: 512, step: 1 },
	smoothing: { mean: 1, stdDev: 0.9, min: 0, max: 3, step: 1 },
	tolerance: { mean: 0.07, stdDev: 0.04, min: 0.01, max: 0.3, step: 0.01 },
	minRegionSize: { mean: 4, stdDev: 5, min: 1, max: 28, step: 1 },
	slicCellSize: { mean: 8, stdDev: 4, min: 2, max: 24, step: 1 },
	slicCompactness: { mean: 0.5, stdDev: 0.25, min: 0, max: 1, step: 0.02 },
	// Lines. Faint, washed-out rolls come from sparse spacing + starved ink;
	// the sparse/low ends are pulled in so every layer keeps enough ink to read.
	penWidthMm: { mean: 0.5, stdDev: 0.2, min: 0.2, max: 1.5, step: 0.05 },
	spacingMinMm: { mean: 0.55, stdDev: 0.3, min: 0.2, max: 1.5, step: 0.05 },
	spacingMaxMm: { mean: 3.5, stdDev: 1.4, min: 1.5, max: 6.5, step: 0.05 },
	hatchThreshold: { mean: 0.08, stdDev: 0.05, min: 0, max: 0.25, step: 0.01 },
	hatchGamma: { mean: 1.7, stdDev: 0.45, min: 0.8, max: 2.8, step: 0.05 },
	inkBoost: { mean: 1.15, stdDev: 0.35, min: 0.7, max: 2.2, step: 0.05 },
	// layers
	layerCount: { mean: 3, stdDev: 1, min: 1, max: 5, step: 1 },
	/** first hatch direction of a layer */
	angleStart: { mean: 45, stdDev: 70, min: -90, max: 225, step: 5 },
	/** angleMax = angleStart + spread — 0 keeps a single direction */
	angleSpread: { mean: 70, stdDev: 55, min: 0, max: 180, step: 5 }
	// (layer colours are picked from the ink palette in inkColors.ts, not a curve)
} as const satisfies Record<string, GaussianCurve>;

export const ALGORITHM_WEIGHTS: WeightedOption<SegmentationAlgorithm>[] = [
	{ value: 'watershed', weight: 4 },
	{ value: 'slic', weight: 3 },
	{ value: 'kmeans', weight: 2 },
	{ value: 'posterize', weight: 2 }
];

export const CHANNEL_WEIGHTS: WeightedOption<LayerChannel>[] = [
	{ value: 'c', weight: 3 },
	{ value: 'm', weight: 3 },
	{ value: 'y', weight: 3 },
	{ value: 'k', weight: 2 },
	{ value: 'luma-inv', weight: 2 },
	{ value: 'r', weight: 1 },
	{ value: 'g', weight: 1 },
	{ value: 'b', weight: 1 },
	{ value: 'luma', weight: 1 }
];

const CHANNEL_NAMES: Record<LayerChannel, string> = {
	c: 'Cyan',
	m: 'Magenta',
	y: 'Yellow',
	k: 'Key',
	r: 'Red',
	g: 'Green',
	b: 'Blue',
	luma: 'Luma',
	'luma-inv': 'Ink'
};

// ─── sampling primitives ─────────────────────────────────────────────────────

export type Rng = () => number;

/** standard normal via Box–Muller */
const gaussian = (rng: Rng): number => {
	let u = 0;
	let v = 0;
	while (u === 0) u = rng();
	while (v === 0) v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** one clamped, step-rounded sample from a curve */
export const sampleCurve = (curve: GaussianCurve, rng: Rng): number => {
	const raw = curve.mean + gaussian(rng) * curve.stdDev;
	const clamped = Math.min(curve.max, Math.max(curve.min, raw));
	const stepped = Math.round(clamped / curve.step) * curve.step;
	// step rounding can nudge past a bound; also strip float noise (0.30000004)
	const bounded = Math.min(curve.max, Math.max(curve.min, stepped));
	return parseFloat(bounded.toFixed(6));
};

export const weightedPick = <T>(options: WeightedOption<T>[], rng: Rng): T => {
	const total = options.reduce((sum, option) => sum + option.weight, 0);
	let roll = rng() * total;
	for (const option of options) {
		roll -= option.weight;
		if (roll <= 0) return option.value;
	}
	return options[options.length - 1].value;
};

// ─── the roll itself ─────────────────────────────────────────────────────────

const randomAngles = (rng: Rng): { angleMin: number; angleMax: number } => {
	const angleMin = sampleCurve(RANDOM_CURVES.angleStart, rng);
	const spread = sampleCurve(RANDOM_CURVES.angleSpread, rng);
	return { angleMin, angleMax: Math.min(angleMin + spread, 360) };
};

const randomLayer = (rng: Rng, taken: Set<LayerChannel>, color: string): LayerConfig => {
	// prefer channels the stack doesn't use yet, so multi-layer rolls
	// separate the image instead of drawing it twice
	const free = CHANNEL_WEIGHTS.filter((option) => !taken.has(option.value));
	const channel = weightedPick(free.length > 0 ? free : CHANNEL_WEIGHTS, rng);
	taken.add(channel);
	return {
		id: nextLayerId(),
		name: CHANNEL_NAMES[channel],
		channel,
		color,
		...randomAngles(rng),
		// per-layer overrides stay inherited — the roll works the globals
		penWidthMm: null,
		spacingMinMm: null,
		spacingMaxMm: null,
		threshold: null,
		inkGamma: null,
		inkBoost: null,
		enabled: true
	};
};

/**
 * Roll new settings. Adjust (image) parameters and the output size are kept
 * from `current`; segmentation, lines and layers are randomized along the
 * curves above.
 *
 * @param stickToPresets keep the ink + pen width combination of a random
 *   built-in preset (the ones that physically exist) and only roll the
 *   plot-safe parameters — segmentation, spacings, angles, ink mapping.
 */
export const randomizeSettings = (
	current: Rstr2Settings,
	stickToPresets: boolean,
	rng: Rng = Math.random
): Rstr2Settings => {
	const params: Rstr2Params = { ...current.params };

	params.algorithm = weightedPick(ALGORITHM_WEIGHTS, rng);
	params.resolution = sampleCurve(RANDOM_CURVES.resolution, rng);
	params.smoothing = sampleCurve(RANDOM_CURVES.smoothing, rng);
	params.tolerance = sampleCurve(RANDOM_CURVES.tolerance, rng);
	params.minRegionSize = sampleCurve(RANDOM_CURVES.minRegionSize, rng);
	params.slicCellSize = sampleCurve(RANDOM_CURVES.slicCellSize, rng);
	params.slicCompactness = sampleCurve(RANDOM_CURVES.slicCompactness, rng);

	params.penWidthMm = sampleCurve(RANDOM_CURVES.penWidthMm, rng);
	params.spacingMinMm = sampleCurve(RANDOM_CURVES.spacingMinMm, rng);
	params.spacingMaxMm = sampleCurve(RANDOM_CURVES.spacingMaxMm, rng);
	if (params.spacingMaxMm < params.spacingMinMm) {
		[params.spacingMinMm, params.spacingMaxMm] = [params.spacingMaxMm, params.spacingMinMm];
	}
	params.hatchThreshold = sampleCurve(RANDOM_CURVES.hatchThreshold, rng);
	params.hatchGamma = sampleCurve(RANDOM_CURVES.hatchGamma, rng);
	params.inkBoost = sampleCurve(RANDOM_CURVES.inkBoost, rng);

	let layers: LayerConfig[];
	if (stickToPresets) {
		const presets = builtinPresets();
		const preset = presets[Math.min(Math.floor(rng() * presets.length), presets.length - 1)];
		// the preset's pen width is part of the physical combination — keep it
		params.penWidthMm = preset.settings.params.penWidthMm;
		layers = preset.settings.layers.map((layer) => ({
			...layer,
			...randomAngles(rng)
		}));
	} else {
		const count = sampleCurve(RANDOM_CURVES.layerCount, rng);
		// pick a whole colour scheme first, then hand one ink to each layer, so
		// the pens land on a deliberate harmony rather than random hues
		const colors = pickInkScheme(count, rng);
		const taken = new Set<LayerChannel>();
		layers = Array.from({ length: count }, (_, i) => randomLayer(rng, taken, colors[i]));
	}

	return { params, layers };
};
