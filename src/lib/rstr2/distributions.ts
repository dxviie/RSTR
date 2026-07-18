// Sampling strategies for the dice. A Distribution describes how one numeric
// parameter is rolled: pick a shape (kind), bound it, done — every kind runs
// through the same clamp + step-rounding the original gaussian dice used, so
// swapping shapes never breaks a parameter's contract. randomize.ts samples
// the shipped defaults through these; the studio's rng debug panel (dev tool)
// edits them live and draws them with distributionDensity.

import type { Rng } from './rngSources';

/** bounds + rounding shared by every distribution kind */
export interface DistributionBounds {
	/** hard clamp, applied after sampling */
	min: number;
	max: number;
	/** rounding grid of the result (1 = integers) */
	step: number;
}

export interface WeightedValue {
	value: number;
	weight: number;
}

export type Distribution =
	| ({ kind: 'gaussian'; mean: number; stdDev: number } & DistributionBounds)
	| ({ kind: 'uniform' } & DistributionBounds)
	| ({ kind: 'triangular'; mode: number } & DistributionBounds)
	// min + (max-min)·u^gamma — gamma > 1 crowds the low end, < 1 the high end
	| ({ kind: 'power'; gamma: number } & DistributionBounds)
	| ({
			kind: 'bimodal';
			meanA: number;
			stdDevA: number;
			meanB: number;
			stdDevB: number;
			/** probability of drawing from bell A (0..1) */
			mixA: number;
	  } & DistributionBounds)
	| ({ kind: 'constant'; value: number } & DistributionBounds)
	// weighted pick of explicit values — used verbatim, the step grid is not applied
	| ({ kind: 'choice'; options: WeightedValue[] } & DistributionBounds);

export type DistributionKind = Distribution['kind'];

export const DISTRIBUTION_LABELS: Record<DistributionKind, string> = {
	gaussian: 'gaussian bell',
	uniform: 'uniform',
	triangular: 'triangular',
	power: 'power bias',
	bimodal: 'bimodal · two bells',
	constant: 'constant',
	choice: 'weighted values'
};

export const DISTRIBUTION_KINDS = Object.keys(DISTRIBUTION_LABELS) as DistributionKind[];

// ─── sampling ────────────────────────────────────────────────────────────────

/** standard normal via Box–Muller */
export const gaussian01 = (rng: Rng): number => {
	let u = 0;
	let v = 0;
	while (u === 0) u = rng();
	while (v === 0) v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** clamp into the bounds, round onto the step grid, strip float noise */
export const quantize = (raw: number, bounds: DistributionBounds): number => {
	const clamped = Math.min(bounds.max, Math.max(bounds.min, raw));
	const stepped = Math.round(clamped / bounds.step) * bounds.step;
	// step rounding can nudge past a bound; also strip float noise (0.30000004)
	const bounded = Math.min(bounds.max, Math.max(bounds.min, stepped));
	return parseFloat(bounded.toFixed(6));
};

const pickWeightedValue = (options: WeightedValue[], rng: Rng): number => {
	const total = options.reduce((sum, option) => sum + Math.max(0, option.weight), 0);
	if (total <= 0) return options[0].value;
	let roll = rng() * total;
	for (const option of options) {
		roll -= Math.max(0, option.weight);
		if (roll <= 0) return option.value;
	}
	return options[options.length - 1].value;
};

/** one clamped, step-rounded sample from a distribution */
export const sampleDistribution = (dist: Distribution, rng: Rng): number => {
	switch (dist.kind) {
		case 'gaussian':
			return quantize(dist.mean + gaussian01(rng) * dist.stdDev, dist);
		case 'uniform':
			return quantize(dist.min + rng() * (dist.max - dist.min), dist);
		case 'triangular': {
			const { min, max } = dist;
			const mode = Math.min(max, Math.max(min, dist.mode));
			const span = max - min;
			if (span <= 0) return quantize(min, dist);
			// inverse CDF of the triangle min..mode..max
			const u = rng();
			const cut = (mode - min) / span;
			const raw =
				u < cut
					? min + Math.sqrt(u * span * (mode - min))
					: max - Math.sqrt((1 - u) * span * (max - mode));
			return quantize(raw, dist);
		}
		case 'power':
			return quantize(dist.min + (dist.max - dist.min) * Math.pow(rng(), dist.gamma), dist);
		case 'bimodal': {
			const fromA = rng() < dist.mixA;
			const mean = fromA ? dist.meanA : dist.meanB;
			const stdDev = fromA ? dist.stdDevA : dist.stdDevB;
			return quantize(mean + gaussian01(rng) * stdDev, dist);
		}
		case 'constant':
			return quantize(dist.value, dist);
		case 'choice':
			return dist.options.length > 0 ? pickWeightedValue(dist.options, rng) : quantize(0, dist);
	}
};

// ─── drawing support (rng debug panel) ───────────────────────────────────────

// the power spike at its dense end is infinite — cap it for display
const DENSITY_CAP = 40;

const gaussShape = (x: number, mean: number, stdDev: number): number => {
	if (stdDev <= 0) return x === mean ? 1 : 0;
	const z = (x - mean) / stdDev;
	// 1/√2π dropped — density here is on an arbitrary relative scale
	return Math.exp(-0.5 * z * z) / stdDev;
};

/**
 * Relative density of a continuous distribution at x — for drawing only, the
 * scale is arbitrary (the editor normalizes to the peak). Discrete kinds
 * (constant, choice) return 0 everywhere; they are drawn as bars instead.
 */
export const distributionDensity = (dist: Distribution, x: number): number => {
	if (x < dist.min || x > dist.max) return 0;
	switch (dist.kind) {
		case 'gaussian':
			return gaussShape(x, dist.mean, dist.stdDev);
		case 'uniform':
			return 1;
		case 'triangular': {
			const { min, max } = dist;
			const mode = Math.min(max, Math.max(min, dist.mode));
			if (max <= min) return 0;
			if (x < mode) return mode === min ? 0 : (x - min) / (mode - min);
			return mode === max ? 0 : (max - x) / (max - mode);
		}
		case 'power': {
			const span = dist.max - dist.min;
			if (span <= 0) return 0;
			const t = (x - dist.min) / span;
			const exponent = 1 / dist.gamma - 1;
			if (exponent === 0) return 1;
			if (t <= 0) return exponent < 0 ? DENSITY_CAP : 0;
			return Math.min(DENSITY_CAP, Math.pow(t, exponent));
		}
		case 'bimodal':
			return (
				dist.mixA * gaussShape(x, dist.meanA, dist.stdDevA) +
				(1 - dist.mixA) * gaussShape(x, dist.meanB, dist.stdDevB)
			);
		case 'constant':
		case 'choice':
			return 0;
	}
};

/** compact one-line description for collapsed editor cards */
export const describeDistribution = (dist: Distribution): string => {
	switch (dist.kind) {
		case 'gaussian':
			return `μ ${dist.mean} · σ ${dist.stdDev}`;
		case 'uniform':
			return `flat ${dist.min} – ${dist.max}`;
		case 'triangular':
			return `peak ${dist.mode}`;
		case 'power':
			return `γ ${dist.gamma} → ${dist.gamma > 1 ? 'low' : dist.gamma < 1 ? 'high' : 'flat'}`;
		case 'bimodal':
			return `${dist.meanA} ⇄ ${dist.meanB} · ${Math.round(dist.mixA * 100)}%`;
		case 'constant':
			return `= ${dist.value}`;
		case 'choice':
			return `${dist.options.length} value${dist.options.length === 1 ? '' : 's'}`;
	}
};

// ─── kind conversion (editor strategy switch) ────────────────────────────────

const tidy = (value: number): number => parseFloat(value.toFixed(4));

const centerOf = (dist: Distribution): number => {
	switch (dist.kind) {
		case 'gaussian':
			return dist.mean;
		case 'triangular':
			return dist.mode;
		case 'bimodal':
			return dist.mixA >= 0.5 ? dist.meanA : dist.meanB;
		case 'constant':
			return dist.value;
		case 'choice': {
			if (dist.options.length === 0) return (dist.min + dist.max) / 2;
			return dist.options.reduce((best, o) => (o.weight > best.weight ? o : best)).value;
		}
		default:
			return (dist.min + dist.max) / 2;
	}
};

const spreadOf = (dist: Distribution): number => {
	const fallback = (dist.max - dist.min) / 6;
	switch (dist.kind) {
		case 'gaussian':
			return dist.stdDev > 0 ? dist.stdDev : fallback;
		case 'bimodal':
			return Math.max(dist.stdDevA, dist.stdDevB, fallback / 2);
		default:
			return fallback;
	}
};

/**
 * Switch a distribution to another kind, carrying over what translates
 * (bounds and step always; center and spread where the target has them).
 */
export const convertDistribution = (dist: Distribution, kind: DistributionKind): Distribution => {
	if (dist.kind === kind) return dist;
	const bounds = { min: dist.min, max: dist.max, step: dist.step };
	const clampIn = (v: number) => tidy(Math.min(bounds.max, Math.max(bounds.min, v)));
	const center = clampIn(centerOf(dist));
	const spread = tidy(spreadOf(dist));
	switch (kind) {
		case 'gaussian':
			return { kind, mean: center, stdDev: spread, ...bounds };
		case 'uniform':
			return { kind, ...bounds };
		case 'triangular':
			return { kind, mode: center, ...bounds };
		case 'power':
			return { kind, gamma: 1, ...bounds };
		case 'bimodal': {
			const offset = Math.max(spread, (bounds.max - bounds.min) / 6);
			return {
				kind,
				meanA: clampIn(center - offset),
				stdDevA: tidy(Math.max(spread / 2, (bounds.max - bounds.min) / 40)),
				meanB: clampIn(center + offset),
				stdDevB: tidy(Math.max(spread / 2, (bounds.max - bounds.min) / 40)),
				mixA: 0.5,
				...bounds
			};
		}
		case 'constant':
			return { kind, value: center, ...bounds };
		case 'choice':
			return {
				kind,
				options: [
					{ value: bounds.min, weight: 1 },
					{ value: center, weight: 2 },
					{ value: bounds.max, weight: 1 }
				],
				...bounds
			};
	}
};

// ─── storage validation ──────────────────────────────────────────────────────

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

/**
 * Validate a parsed distribution; anything broken falls back to `fallback`
 * wholesale (same spirit as sanitizeParams — no partial repairs).
 */
export const sanitizeDistribution = (value: unknown, fallback: Distribution): Distribution => {
	if (typeof value !== 'object' || value === null) return fallback;
	const d = value as Record<string, unknown>;
	if (!isFiniteNumber(d.min) || !isFiniteNumber(d.max) || !isFiniteNumber(d.step)) return fallback;
	if (!(d.step > 0) || d.min > d.max) return fallback;
	const bounds = { min: d.min, max: d.max, step: d.step };
	switch (d.kind) {
		case 'gaussian':
			return isFiniteNumber(d.mean) && isFiniteNumber(d.stdDev) && d.stdDev >= 0
				? { kind: 'gaussian', mean: d.mean, stdDev: d.stdDev, ...bounds }
				: fallback;
		case 'uniform':
			return { kind: 'uniform', ...bounds };
		case 'triangular':
			return isFiniteNumber(d.mode) ? { kind: 'triangular', mode: d.mode, ...bounds } : fallback;
		case 'power':
			return isFiniteNumber(d.gamma) && d.gamma > 0
				? { kind: 'power', gamma: d.gamma, ...bounds }
				: fallback;
		case 'bimodal':
			return isFiniteNumber(d.meanA) &&
				isFiniteNumber(d.stdDevA) &&
				d.stdDevA >= 0 &&
				isFiniteNumber(d.meanB) &&
				isFiniteNumber(d.stdDevB) &&
				d.stdDevB >= 0 &&
				isFiniteNumber(d.mixA)
				? {
						kind: 'bimodal',
						meanA: d.meanA,
						stdDevA: d.stdDevA,
						meanB: d.meanB,
						stdDevB: d.stdDevB,
						mixA: Math.min(1, Math.max(0, d.mixA)),
						...bounds
					}
				: fallback;
		case 'constant':
			return isFiniteNumber(d.value) ? { kind: 'constant', value: d.value, ...bounds } : fallback;
		case 'choice': {
			if (!Array.isArray(d.options)) return fallback;
			const options: WeightedValue[] = [];
			for (const entry of d.options) {
				if (typeof entry !== 'object' || entry === null) continue;
				const { value: v, weight } = entry as Record<string, unknown>;
				if (isFiniteNumber(v) && isFiniteNumber(weight) && weight >= 0) {
					options.push({ value: v, weight });
				}
			}
			return options.length > 0 ? { kind: 'choice', options, ...bounds } : fallback;
		}
		default:
			return fallback;
	}
};
