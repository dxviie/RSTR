import { describe, it, expect } from 'vitest';
import {
	convertDistribution,
	DISTRIBUTION_KINDS,
	distributionDensity,
	sampleDistribution,
	sanitizeDistribution,
	type Distribution
} from './distributions';
import { mulberry32 } from './rngSources';
import { sampleCurve } from './randomize';

const bounds = { min: 0, max: 10, step: 0.1 };

const onGrid = (value: number, step: number) =>
	expect(Math.round(value / step) * step).toBeCloseTo(value, 9);

describe('sampleDistribution', () => {
	it('keeps every kind inside its bounds and on the step grid', () => {
		const dists: Distribution[] = [
			{ kind: 'gaussian', mean: 5, stdDev: 4, ...bounds },
			{ kind: 'uniform', ...bounds },
			{ kind: 'triangular', mode: 2, ...bounds },
			{ kind: 'power', gamma: 2.5, ...bounds },
			{ kind: 'bimodal', meanA: 2, stdDevA: 1, meanB: 8, stdDevB: 1, mixA: 0.5, ...bounds },
			{ kind: 'constant', value: 3.14, ...bounds }
		];
		for (const dist of dists) {
			const rng = mulberry32(99);
			for (let i = 0; i < 400; i++) {
				const value = sampleDistribution(dist, rng);
				expect(value).toBeGreaterThanOrEqual(bounds.min);
				expect(value).toBeLessThanOrEqual(bounds.max);
				onGrid(value, bounds.step);
			}
		}
	});

	it('gaussian matches the original sampleCurve exactly', () => {
		const curve = { mean: 0.5, stdDev: 0.2, min: 0.2, max: 1.5, step: 0.05 };
		const a = mulberry32(7);
		const b = mulberry32(7);
		for (let i = 0; i < 200; i++) {
			expect(sampleDistribution({ kind: 'gaussian', ...curve }, a)).toBe(sampleCurve(curve, b));
		}
	});

	it('uniform spreads flat across the range', () => {
		const rng = mulberry32(3);
		const dist: Distribution = { kind: 'uniform', ...bounds };
		const samples = Array.from({ length: 3000 }, () => sampleDistribution(dist, rng));
		const low = samples.filter((v) => v < 3.33).length / samples.length;
		const high = samples.filter((v) => v > 6.66).length / samples.length;
		expect(low).toBeGreaterThan(0.28);
		expect(low).toBeLessThan(0.39);
		expect(high).toBeGreaterThan(0.28);
		expect(high).toBeLessThan(0.39);
	});

	it('power gamma > 1 crowds the low end, < 1 the high end', () => {
		const rng = mulberry32(5);
		const lowBias: Distribution = { kind: 'power', gamma: 3, ...bounds };
		const highBias: Distribution = { kind: 'power', gamma: 1 / 3, ...bounds };
		const lows = Array.from({ length: 2000 }, () => sampleDistribution(lowBias, rng));
		const highs = Array.from({ length: 2000 }, () => sampleDistribution(highBias, rng));
		expect(lows.filter((v) => v < 5).length / lows.length).toBeGreaterThan(0.8);
		expect(highs.filter((v) => v > 5).length / highs.length).toBeGreaterThan(0.8);
	});

	it('triangular clusters around its mode', () => {
		const rng = mulberry32(11);
		const dist: Distribution = { kind: 'triangular', mode: 8, ...bounds };
		const samples = Array.from({ length: 3000 }, () => sampleDistribution(dist, rng));
		// theory for tri(0, 8, 10): P(7 ≤ x ≤ 9) ≈ 0.34, P(x ≤ 2) = 0.05
		const nearMode = samples.filter((v) => v >= 7 && v <= 9).length / samples.length;
		const farTail = samples.filter((v) => v <= 2).length / samples.length;
		expect(nearMode).toBeGreaterThan(0.28);
		expect(farTail).toBeLessThan(0.09);
	});

	it('bimodal lands in two clusters with the requested mix', () => {
		const rng = mulberry32(13);
		const dist: Distribution = {
			kind: 'bimodal',
			meanA: 2,
			stdDevA: 0.5,
			meanB: 8,
			stdDevB: 0.5,
			mixA: 0.7,
			...bounds
		};
		const samples = Array.from({ length: 3000 }, () => sampleDistribution(dist, rng));
		const nearA = samples.filter((v) => Math.abs(v - 2) < 1.5).length / samples.length;
		const nearB = samples.filter((v) => Math.abs(v - 8) < 1.5).length / samples.length;
		const middle = samples.filter((v) => v > 4 && v < 6).length / samples.length;
		expect(nearA).toBeGreaterThan(0.55);
		expect(nearB).toBeGreaterThan(0.2);
		expect(middle).toBeLessThan(0.05);
	});

	it('constant always returns its (quantized) value', () => {
		const rng = mulberry32(17);
		const dist: Distribution = { kind: 'constant', value: 3.14, ...bounds };
		for (let i = 0; i < 20; i++) expect(sampleDistribution(dist, rng)).toBe(3.1);
	});

	it('choice picks exact values along the weights', () => {
		const rng = mulberry32(19);
		const dist: Distribution = {
			kind: 'choice',
			options: [
				{ value: 64, weight: 9 },
				{ value: 512, weight: 1 }
			],
			min: 0,
			max: 1024,
			step: 1
		};
		const samples = Array.from({ length: 1000 }, () => sampleDistribution(dist, rng));
		expect(new Set(samples)).toEqual(new Set([64, 512]));
		const share = samples.filter((v) => v === 64).length / samples.length;
		expect(share).toBeGreaterThan(0.8);
		expect(share).toBeLessThan(0.98);
	});
});

describe('distributionDensity', () => {
	it('is zero outside the bounds and shaped inside', () => {
		const dist: Distribution = { kind: 'gaussian', mean: 5, stdDev: 1, ...bounds };
		expect(distributionDensity(dist, -1)).toBe(0);
		expect(distributionDensity(dist, 11)).toBe(0);
		expect(distributionDensity(dist, 5)).toBeGreaterThan(distributionDensity(dist, 7));
	});
});

describe('convertDistribution', () => {
	it('reaches every kind and keeps bounds + step', () => {
		const start: Distribution = { kind: 'gaussian', mean: 5, stdDev: 1, ...bounds };
		for (const kind of DISTRIBUTION_KINDS) {
			const converted = convertDistribution(start, kind);
			expect(converted.kind).toBe(kind);
			expect(converted.min).toBe(bounds.min);
			expect(converted.max).toBe(bounds.max);
			expect(converted.step).toBe(bounds.step);
		}
	});

	it('carries the center into kinds that have one', () => {
		const start: Distribution = { kind: 'gaussian', mean: 7, stdDev: 1, ...bounds };
		expect(convertDistribution(start, 'constant')).toMatchObject({ value: 7 });
		expect(convertDistribution(start, 'triangular')).toMatchObject({ mode: 7 });
	});
});

describe('sanitizeDistribution', () => {
	const fallback: Distribution = { kind: 'gaussian', mean: 5, stdDev: 1, ...bounds };

	it('passes a valid distribution through', () => {
		const dist = { kind: 'power', gamma: 2, min: 0, max: 4, step: 0.5 };
		expect(sanitizeDistribution(dist, fallback)).toEqual(dist);
	});

	it('falls back on garbage', () => {
		expect(sanitizeDistribution(null, fallback)).toEqual(fallback);
		expect(sanitizeDistribution({ kind: 'nope' }, fallback)).toEqual(fallback);
		expect(sanitizeDistribution({ kind: 'gaussian', mean: 'x' }, fallback)).toEqual(fallback);
		expect(sanitizeDistribution({ kind: 'uniform', min: 5, max: 1, step: 1 }, fallback)).toEqual(
			fallback
		);
		expect(
			sanitizeDistribution({ kind: 'power', gamma: -1, min: 0, max: 1, step: 0.1 }, fallback)
		).toEqual(fallback);
	});

	it('drops broken choice options but keeps good ones', () => {
		const dist = sanitizeDistribution(
			{
				kind: 'choice',
				options: [{ value: 1, weight: 2 }, { value: 'x', weight: 1 }, null],
				min: 0,
				max: 4,
				step: 1
			},
			fallback
		);
		expect(dist).toEqual({
			kind: 'choice',
			options: [{ value: 1, weight: 2 }],
			min: 0,
			max: 4,
			step: 1
		});
	});
});
