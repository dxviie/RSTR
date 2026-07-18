// The dice: randomized settings for the v2 pipeline.
//
// Randomness is gaussian by default, not uniform — every parameter gets its
// own curve so the rolls cluster around values that tend to produce good
// plots while still reaching into the weird ends of each range now and then.
// ALL the numeric tuning lives in the curve tables below (RANDOM_CURVES,
// ALGORITHM_WEIGHTS, CHANNEL_WEIGHTS): tweak mean/stdDev/min/max per
// parameter by hand here and the UI picks it up. Layer colours are not rolled
// numerically — they come from a curated real-ink palette and its colour
// harmonies (see inkColors.ts), so a multi-pen stack lands on a deliberate
// scheme instead of random hues, and 75% of rolls reserve one layer for a
// vibrant Diamine Forever accent ink. The adjust (image) and export settings
// are deliberately left alone — those belong to the source image, not to the
// look.
//
// The tables can also be overridden at roll time with an RngProfile: the same
// parameters, but each curve free to use any Distribution shape (uniform,
// bimodal, power bias, … — see distributions.ts) and the weights editable.
// Profiles are authored in the studio's rng debug panel (a dev tool); the
// shipped tables double as the built-in profile via defaultRngProfile().
//
// With "stick to built-in presets" enabled the layer stack (ink colors,
// channels, pen widths) is taken verbatim from a random built-in preset —
// those are the physical ink + pen combinations that actually exist — and
// only the plot-safe parameters (segmentation, spacings, angles, ink
// mapping) are rolled.

import type { Rstr2Params, SegmentationAlgorithm } from './params';
import {
	CHANNEL_AXES,
	CHANNEL_INVERSES,
	nextLayerId,
	type LayerChannel,
	type LayerConfig
} from './layers';
import { builtinPresets, type Rstr2Settings } from './presets';
import {
	defaultColorOptions,
	pickInkScheme,
	type ColorRollOptions,
	type InkColor
} from './inkColors';
import { sampleDistribution, type Distribution } from './distributions';
import type { Rng } from './rngSources';

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

// ─── sampling primitives ─────────────────────────────────────────────────────

export type { Rng } from './rngSources';

/** one clamped, step-rounded sample from a gaussian curve */
export const sampleCurve = (curve: GaussianCurve, rng: Rng): number =>
	sampleDistribution({ kind: 'gaussian', ...curve }, rng);

export const weightedPick = <T>(options: WeightedOption<T>[], rng: Rng): T => {
	const total = options.reduce((sum, option) => sum + option.weight, 0);
	let roll = rng() * total;
	for (const option of options) {
		roll -= option.weight;
		if (roll <= 0) return option.value;
	}
	return options[options.length - 1].value;
};

// ─── rng profiles ────────────────────────────────────────────────────────────

export type RandomCurveKey = keyof typeof RANDOM_CURVES;

/** the per-layer override fields the dice can roll (null = inherit global) */
export const LAYER_OVERRIDE_KEYS = [
	'penWidthMm',
	'spacingMinMm',
	'spacingMaxMm',
	'threshold',
	'inkGamma',
	'inkBoost'
] as const;

export type LayerOverrideKey = (typeof LAYER_OVERRIDE_KEYS)[number];

// the profile curve an override samples when it rolls — the same physical
// quantity as its global, so the same curve applies
const OVERRIDE_VALUE_CURVES: Record<LayerOverrideKey, RandomCurveKey> = {
	penWidthMm: 'penWidthMm',
	spacingMinMm: 'spacingMinMm',
	spacingMaxMm: 'spacingMaxMm',
	threshold: 'hatchThreshold',
	inkGamma: 'hatchGamma',
	inkBoost: 'inkBoost'
};

/**
 * A named, editable version of the dice: one distribution per rolled
 * parameter, the algorithm/channel weights, the colour-scheme knobs
 * (accent rate + harmony weights, see inkColors.ts) and the per-layer
 * override chances. The shipped tables are the built-in profile; extra
 * profiles are authored in the studio's rng debug panel and graduate into
 * rngBuiltinProfiles.ts once they earn it — docs/rng-profiles.md walks
 * through the whole workflow.
 */
export interface RngProfile {
	id: string;
	name: string;
	curves: Record<RandomCurveKey, Distribution>;
	algorithmWeights: WeightedOption<SegmentationAlgorithm>[];
	channelWeights: WeightedOption<LayerChannel>[];
	colors: ColorRollOptions;
	/**
	 * chance (0..1) per field that a rolled layer gets its own value instead
	 * of inheriting the global — values sample the field's curve above.
	 * All zeros (the shipped default) rolls no overrides and consumes no
	 * extra randomness.
	 */
	layerOverrideChances: Record<LayerOverrideKey, number>;
}

export const DEFAULT_RNG_PROFILE_ID = 'built-in';

/** the shipped dice, wrapped as a profile — fresh objects on every call */
export const defaultRngProfile = (): RngProfile => ({
	id: DEFAULT_RNG_PROFILE_ID,
	name: 'built-in',
	curves: Object.fromEntries(
		Object.entries(RANDOM_CURVES).map(([key, curve]) => [key, { kind: 'gaussian', ...curve }])
	) as Record<RandomCurveKey, Distribution>,
	algorithmWeights: ALGORITHM_WEIGHTS.map((option) => ({ ...option })),
	channelWeights: CHANNEL_WEIGHTS.map((option) => ({ ...option })),
	colors: defaultColorOptions(),
	layerOverrideChances: Object.fromEntries(LAYER_OVERRIDE_KEYS.map((key) => [key, 0])) as Record<
		LayerOverrideKey,
		number
	>
});

// ─── the roll itself ─────────────────────────────────────────────────────────

const randomAngles = (
	rng: Rng,
	curves: RngProfile['curves']
): { angleMin: number; angleMax: number } => {
	const angleMin = sampleDistribution(curves.angleStart, rng);
	const spread = sampleDistribution(curves.angleSpread, rng);
	return { angleMin, angleMax: Math.min(angleMin + spread, 360) };
};

/**
 * Per-layer overrides for one rolled layer. Each field rolls its own value
 * (from the same curve as its global) with the profile's chance for that
 * field, and inherits (null) otherwise. A zero chance consumes no
 * randomness, so the shipped all-zeros default stays bit-identical to the
 * pre-override dice and seeded sessions stay comparable.
 */
const rolledOverrides = (
	rng: Rng,
	profile: RngProfile,
	globals: Rstr2Params
): Record<LayerOverrideKey, number | null> => {
	const overrides = {} as Record<LayerOverrideKey, number | null>;
	for (const key of LAYER_OVERRIDE_KEYS) {
		const chance = profile.layerOverrideChances[key];
		overrides[key] =
			chance > 0 && rng() < chance
				? sampleDistribution(profile.curves[OVERRIDE_VALUE_CURVES[key]], rng)
				: null;
	}
	// keep the layer's EFFECTIVE spacing pair (override ?? global, the same
	// resolution the hatcher uses) ordered, whichever side rolled
	const effectiveMin = overrides.spacingMinMm ?? globals.spacingMinMm;
	const effectiveMax = overrides.spacingMaxMm ?? globals.spacingMaxMm;
	if (effectiveMin > effectiveMax) {
		if (overrides.spacingMinMm !== null && overrides.spacingMaxMm !== null) {
			[overrides.spacingMinMm, overrides.spacingMaxMm] = [
				overrides.spacingMaxMm,
				overrides.spacingMinMm
			];
		} else if (overrides.spacingMinMm !== null) {
			overrides.spacingMinMm = effectiveMax;
		} else {
			overrides.spacingMaxMm = effectiveMin;
		}
	}
	return overrides;
};

const randomLayer = (
	rng: Rng,
	taken: Set<LayerChannel>,
	ink: InkColor,
	profile: RngProfile,
	globals: Rstr2Params
): LayerConfig => {
	// The channel pick prefers, in order: a whole new information axis (see
	// CHANNEL_AXES — guarantees min(count, 4) distinct axes per stack), then
	// an unused channel that is not the exact negative of a taken one (a
	// c+r style pair inks to a constant between them), then any unused
	// channel — so multi-layer rolls separate the image instead of drawing
	// the same signal, or its negative, twice. Zero-weighted channels stay
	// out of the draw unless literally nothing else is left.
	const free = profile.channelWeights.filter((option) => !taken.has(option.value));
	const weighted = free.filter((option) => option.weight > 0);
	const takenAxes = new Set(Array.from(taken, (used) => CHANNEL_AXES[used]));
	const freshAxis = weighted.filter((option) => !takenAxes.has(CHANNEL_AXES[option.value]));
	const nonInverse = weighted.filter((option) => {
		const inverse = CHANNEL_INVERSES[option.value];
		return inverse === undefined || !taken.has(inverse);
	});
	const pool =
		freshAxis.length > 0
			? freshAxis
			: nonInverse.length > 0
				? nonInverse
				: weighted.length > 0
					? weighted
					: free.length > 0
						? free
						: profile.channelWeights;
	const channel = weightedPick(pool, rng);
	taken.add(channel);
	return {
		id: nextLayerId(),
		// the layer is named after the pen that draws it, not the channel it reads
		name: ink.name,
		channel,
		color: ink.hex,
		...randomAngles(rng, profile.curves),
		// per-layer overrides inherit (null) unless the profile gives a field
		// a roll chance — see rolledOverrides
		...rolledOverrides(rng, profile, globals),
		enabled: true
	};
};

/**
 * Roll new settings. Adjust (image) parameters and the output size are kept
 * from `current`; segmentation, lines and layers are randomized along the
 * curves of the given profile (the shipped tables above by default).
 *
 * @param stickToPresets keep the ink + pen width combination of a random
 *   built-in preset (the ones that physically exist) and only roll the
 *   plot-safe parameters — segmentation, spacings, angles, ink mapping.
 * @param profile the rng profile to roll along; omit for the built-in dice.
 */
export const randomizeSettings = (
	current: Rstr2Settings,
	stickToPresets: boolean,
	rng: Rng = Math.random,
	profile: RngProfile = defaultRngProfile()
): Rstr2Settings => {
	const params: Rstr2Params = { ...current.params };
	const curves = profile.curves;

	params.algorithm = weightedPick(profile.algorithmWeights, rng);
	params.resolution = sampleDistribution(curves.resolution, rng);
	params.smoothing = sampleDistribution(curves.smoothing, rng);
	params.tolerance = sampleDistribution(curves.tolerance, rng);
	params.minRegionSize = sampleDistribution(curves.minRegionSize, rng);
	params.slicCellSize = sampleDistribution(curves.slicCellSize, rng);
	params.slicCompactness = sampleDistribution(curves.slicCompactness, rng);

	params.penWidthMm = sampleDistribution(curves.penWidthMm, rng);
	params.spacingMinMm = sampleDistribution(curves.spacingMinMm, rng);
	params.spacingMaxMm = sampleDistribution(curves.spacingMaxMm, rng);
	if (params.spacingMaxMm < params.spacingMinMm) {
		[params.spacingMinMm, params.spacingMaxMm] = [params.spacingMaxMm, params.spacingMinMm];
	}
	params.hatchThreshold = sampleDistribution(curves.hatchThreshold, rng);
	params.hatchGamma = sampleDistribution(curves.hatchGamma, rng);
	params.inkBoost = sampleDistribution(curves.inkBoost, rng);

	let layers: LayerConfig[];
	if (stickToPresets) {
		const presets = builtinPresets();
		const preset = presets[Math.min(Math.floor(rng() * presets.length), presets.length - 1)];
		// the preset's pen width is part of the physical combination — keep it
		params.penWidthMm = preset.settings.params.penWidthMm;
		layers = preset.settings.layers.map((layer) => ({
			...layer,
			...randomAngles(rng, curves)
		}));
	} else {
		// a profile curve can in principle roll fractions or zero — the stack
		// needs a whole, positive layer count no matter what the curve says
		const count = Math.max(1, Math.round(sampleDistribution(curves.layerCount, rng)));
		// pick a whole colour scheme first, then hand one ink to each layer, so
		// the pens land on a deliberate harmony rather than random hues
		const inks = pickInkScheme(count, rng, profile.colors);
		const taken = new Set<LayerChannel>();
		layers = Array.from({ length: count }, (_, i) =>
			randomLayer(rng, taken, inks[i], profile, params)
		);
	}

	return { params, layers };
};
