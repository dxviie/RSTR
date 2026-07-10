import { describe, it, expect } from 'vitest';
import { RANDOM_CURVES, randomizeSettings, sampleCurve, weightedPick, type Rng } from './randomize';
import { defaultParams } from './params';
import { builtinPresets } from './presets';
import { defaultCmyLayers, sanitizeLayers } from './layers';

/** deterministic rng (mulberry32) so the dice can be tested */
const seededRng = (seed: number): Rng => {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const currentSettings = () => ({ params: defaultParams(), layers: defaultCmyLayers() });

describe('sampleCurve', () => {
	it('stays inside the bounds and on the step grid', () => {
		const rng = seededRng(7);
		const curve = { mean: 0.4, stdDev: 5, min: 0.1, max: 1.5, step: 0.05 };
		for (let i = 0; i < 500; i++) {
			const value = sampleCurve(curve, rng);
			expect(value).toBeGreaterThanOrEqual(curve.min);
			expect(value).toBeLessThanOrEqual(curve.max);
			expect(Math.round(value / curve.step) * curve.step).toBeCloseTo(value, 9);
		}
	});

	it('clusters around the mean', () => {
		const rng = seededRng(11);
		const curve = { mean: 100, stdDev: 10, min: 0, max: 200, step: 1 };
		const samples = Array.from({ length: 1000 }, () => sampleCurve(curve, rng));
		const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
		expect(avg).toBeGreaterThan(95);
		expect(avg).toBeLessThan(105);
		// a gaussian, unlike a uniform roll, keeps most mass within one sigma
		const withinOneSigma = samples.filter((v) => Math.abs(v - 100) <= 10).length;
		expect(withinOneSigma / samples.length).toBeGreaterThan(0.6);
	});
});

describe('weightedPick', () => {
	it('respects the weights', () => {
		const rng = seededRng(3);
		const options = [
			{ value: 'a', weight: 9 },
			{ value: 'b', weight: 1 }
		];
		const picks = Array.from({ length: 1000 }, () => weightedPick(options, rng));
		const aShare = picks.filter((value) => value === 'a').length / picks.length;
		expect(aShare).toBeGreaterThan(0.8);
		expect(aShare).toBeLessThan(0.98);
	});
});

describe('randomizeSettings', () => {
	it('is deterministic for a given rng', () => {
		expect(randomizeSettings(currentSettings(), false, seededRng(42)).params).toEqual(
			randomizeSettings(currentSettings(), false, seededRng(42)).params
		);
	});

	it('keeps every rolled parameter inside its curve bounds', () => {
		for (let seed = 0; seed < 50; seed++) {
			const { params } = randomizeSettings(currentSettings(), false, seededRng(seed));
			expect(params.resolution).toBeGreaterThanOrEqual(RANDOM_CURVES.resolution.min);
			expect(params.resolution).toBeLessThanOrEqual(RANDOM_CURVES.resolution.max);
			expect(params.penWidthMm).toBeGreaterThanOrEqual(RANDOM_CURVES.penWidthMm.min);
			expect(params.penWidthMm).toBeLessThanOrEqual(RANDOM_CURVES.penWidthMm.max);
			expect(params.spacingMinMm).toBeLessThanOrEqual(params.spacingMaxMm);
			expect(params.hatchGamma).toBeGreaterThanOrEqual(RANDOM_CURVES.hatchGamma.min);
			expect(params.hatchGamma).toBeLessThanOrEqual(RANDOM_CURVES.hatchGamma.max);
		}
	});

	it('leaves the adjust and export parameters alone', () => {
		const current = currentSettings();
		current.params.brightness = 0.3;
		current.params.vibrance = -0.5;
		current.params.outputWidthMm = 321;
		const { params } = randomizeSettings(current, false, seededRng(5));
		expect(params.brightness).toBe(0.3);
		expect(params.vibrance).toBe(-0.5);
		expect(params.outputWidthMm).toBe(321);
	});

	it('produces a valid layer stack', () => {
		for (let seed = 0; seed < 30; seed++) {
			const { layers } = randomizeSettings(currentSettings(), false, seededRng(seed));
			expect(layers.length).toBeGreaterThanOrEqual(RANDOM_CURVES.layerCount.min);
			expect(layers.length).toBeLessThanOrEqual(RANDOM_CURVES.layerCount.max);
			// round-trips through the same validation as storage / imports
			expect(sanitizeLayers(JSON.parse(JSON.stringify(layers)))).not.toBeNull();
			for (const layer of layers) {
				expect(layer.color).toMatch(/^#[0-9A-F]{6}$/);
				expect(layer.angleMax).toBeGreaterThanOrEqual(layer.angleMin);
				expect(layer.enabled).toBe(true);
			}
			// no duplicate channels while there is room to avoid them
			const channels = layers.map((layer) => layer.channel);
			expect(new Set(channels).size).toBe(channels.length);
		}
	});

	it('sticks to a built-in ink + pen width combination when asked', () => {
		const presets = builtinPresets();
		for (let seed = 0; seed < 30; seed++) {
			const { params, layers } = randomizeSettings(currentSettings(), true, seededRng(seed));
			// the result must reproduce a real built-in combination, pen width
			// included — some presets share a layer stack but differ in pen width
			const match = presets.find(
				(preset) =>
					preset.settings.params.penWidthMm === params.penWidthMm &&
					preset.settings.layers.length === layers.length &&
					preset.settings.layers.every(
						(layer, i) =>
							layer.color === layers[i].color &&
							layer.channel === layers[i].channel &&
							layer.penWidthMm === layers[i].penWidthMm
					)
			);
			expect(match).toBeDefined();
			// spacings and angles still roll
			expect(layers[0].angleMax).toBeGreaterThanOrEqual(layers[0].angleMin);
		}
	});
});
