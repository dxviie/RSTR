// The dice: randomized settings for the v2 pipeline.
//
// Randomness is gaussian, not uniform — every parameter gets its own curve so
// the rolls cluster around values that tend to produce good plots while still
// reaching into the weird ends of each range now and then. ALL the tuning
// lives in the curve tables below (RANDOM_CURVES, ALGORITHM_WEIGHTS,
// CHANNEL_WEIGHTS): tweak mean/stdDev/min/max per parameter by hand here and
// the UI picks it up. The adjust (image) and export settings are deliberately
// left alone — those belong to the source image, not to the look.
//
// With "stick to built-in presets" enabled the layer stack (ink colors,
// channels, pen widths) is taken verbatim from a random built-in preset —
// those are the physical ink + pen combinations that actually exist — and
// only the plot-safe parameters (segmentation, spacings, angles, ink
// mapping) are rolled.

import type { Rstr2Params, SegmentationAlgorithm } from './params';
import { nextLayerId, type LayerChannel, type LayerConfig } from './layers';
import { builtinPresets, type Rstr2Settings } from './presets';

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
	// segmentation
	resolution: { mean: 110, stdDev: 60, min: 24, max: 320, step: 1 },
	smoothing: { mean: 1, stdDev: 1.2, min: 0, max: 4, step: 1 },
	tolerance: { mean: 0.09, stdDev: 0.06, min: 0.01, max: 0.35, step: 0.01 },
	minRegionSize: { mean: 6, stdDev: 10, min: 1, max: 64, step: 1 },
	slicCellSize: { mean: 9, stdDev: 6, min: 2, max: 48, step: 1 },
	slicCompactness: { mean: 0.5, stdDev: 0.25, min: 0, max: 1, step: 0.02 },
	// lines
	penWidthMm: { mean: 0.4, stdDev: 0.25, min: 0.1, max: 1.5, step: 0.05 },
	spacingMinMm: { mean: 0.7, stdDev: 0.4, min: 0.2, max: 2.5, step: 0.05 },
	spacingMaxMm: { mean: 4, stdDev: 2, min: 1, max: 9, step: 0.05 },
	hatchThreshold: { mean: 0.1, stdDev: 0.07, min: 0, max: 0.4, step: 0.01 },
	hatchGamma: { mean: 1.8, stdDev: 0.5, min: 0.7, max: 3.2, step: 0.05 },
	inkBoost: { mean: 1.1, stdDev: 0.4, min: 0.4, max: 2.5, step: 0.05 },
	// layers
	layerCount: { mean: 3, stdDev: 1, min: 1, max: 5, step: 1 },
	/** first hatch direction of a layer */
	angleStart: { mean: 45, stdDev: 70, min: -90, max: 225, step: 5 },
	/** angleMax = angleStart + spread — 0 keeps a single direction */
	angleSpread: { mean: 70, stdDev: 55, min: 0, max: 180, step: 5 },
	// random pen colors (HSL — hue is uniform on purpose, see randomColor)
	colorSaturation: { mean: 0.85, stdDev: 0.2, min: 0.3, max: 1, step: 0.01 },
	colorLightness: { mean: 0.48, stdDev: 0.12, min: 0.2, max: 0.7, step: 0.01 }
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

const hslToHex = (h: number, s: number, l: number): string => {
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(value * 255)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

// ─── the roll itself ─────────────────────────────────────────────────────────

const randomAngles = (rng: Rng): { angleMin: number; angleMax: number } => {
	const angleMin = sampleCurve(RANDOM_CURVES.angleStart, rng);
	const spread = sampleCurve(RANDOM_CURVES.angleSpread, rng);
	return { angleMin, angleMax: Math.min(angleMin + spread, 360) };
};

const randomColor = (rng: Rng): string =>
	// hue stays uniform — no direction of the color wheel is more plottable
	hslToHex(
		rng() * 360,
		sampleCurve(RANDOM_CURVES.colorSaturation, rng),
		sampleCurve(RANDOM_CURVES.colorLightness, rng)
	);

const randomLayer = (rng: Rng, taken: Set<LayerChannel>): LayerConfig => {
	// prefer channels the stack doesn't use yet, so multi-layer rolls
	// separate the image instead of drawing it twice
	const free = CHANNEL_WEIGHTS.filter((option) => !taken.has(option.value));
	const channel = weightedPick(free.length > 0 ? free : CHANNEL_WEIGHTS, rng);
	taken.add(channel);
	return {
		id: nextLayerId(),
		name: CHANNEL_NAMES[channel],
		channel,
		color: randomColor(rng),
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
		const taken = new Set<LayerChannel>();
		layers = Array.from({ length: count }, () => randomLayer(rng, taken));
	}

	return { params, layers };
};
