import { describe, it, expect } from 'vitest';
import { EXAMPLES, exampleById } from './examples';
import { sanitizeSettings } from './presets';

describe('studio examples', () => {
	it('ship settings the studio accepts unchanged', () => {
		for (const example of Object.values(EXAMPLES)) {
			expect(sanitizeSettings(example.settings)).toEqual(example.settings);
		}
	});

	it('keep the milkmaid on the settings behind the landing page numbers', () => {
		const { params, layers } = EXAMPLES.milkmaid.settings;
		expect(params).toMatchObject({
			algorithm: 'watershed',
			resolution: 256,
			smoothing: 1,
			tolerance: 0.05,
			minRegionSize: 1,
			imageGamma: 1.3,
			penWidthMm: 0.5,
			spacingMinMm: 0.6,
			spacingMaxMm: 4,
			hatchGamma: 2.6,
			inkBoost: 1.6,
			outputWidthMm: 200
		});
		expect(layers).toHaveLength(1);
		expect(layers[0]).toMatchObject({ channel: 'luma-inv', angleMin: 0, angleMax: 360 });
	});

	it('looks examples up by id and ignores anything else', () => {
		expect(exampleById('milkmaid')).toBe(EXAMPLES.milkmaid);
		expect(exampleById('nope')).toBeNull();
		expect(exampleById('constructor')).toBeNull();
		expect(exampleById(null)).toBeNull();
		expect(exampleById('')).toBeNull();
	});
});
