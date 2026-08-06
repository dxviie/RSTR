import { describe, it, expect } from 'vitest';
import {
	autoOrientation,
	clampMarginMm,
	CUSTOM_FORMAT_ID,
	formatById,
	frameHeightFor,
	MORE_FORMATS,
	QUICK_FORMATS,
	resolveOutputFormat,
	sanitizeCustomMm
} from './outputFormat';

describe('format catalog', () => {
	it('offers the A6..A3 quick toggles', () => {
		expect(QUICK_FORMATS.map((format) => format.id)).toEqual(['A6', 'A5', 'A4', 'A3']);
		expect(formatById('A4')).toMatchObject({ w: 210, h: 297 });
	});

	it('resolves every catalog id and rejects unknown ones', () => {
		for (const def of [...QUICK_FORMATS, ...MORE_FORMATS]) {
			expect(formatById(def.id)).toBe(def);
		}
		expect(formatById('A9')).toBeNull();
		expect(formatById('')).toBeNull();
	});
});

describe('resolveOutputFormat', () => {
	it('resolves nothing for the empty selection', () => {
		expect(resolveOutputFormat('', 100, 100, 'portrait')).toBeNull();
	});

	it('orients named pages', () => {
		expect(resolveOutputFormat('A4', 0, 0, 'portrait')).toMatchObject({ wMm: 210, hMm: 297 });
		expect(resolveOutputFormat('A4', 0, 0, 'landscape')).toMatchObject({ wMm: 297, hMm: 210 });
	});

	it('leaves squares alone and marks them non-orientable', () => {
		expect(resolveOutputFormat('sq15', 0, 0, 'landscape')).toEqual({
			wMm: 150,
			hMm: 150,
			orientable: false
		});
	});

	it('takes custom dimensions as typed, sanitized', () => {
		expect(resolveOutputFormat(CUSTOM_FORMAT_ID, 300, 120, 'portrait')).toEqual({
			wMm: 300,
			hMm: 120,
			orientable: false
		});
		expect(resolveOutputFormat(CUSTOM_FORMAT_ID, 3, 99999, 'portrait')).toEqual({
			wMm: 20,
			hMm: 2000,
			orientable: false
		});
	});
});

describe('sanitizeCustomMm', () => {
	it('clamps and rounds to tenth millimeters', () => {
		expect(sanitizeCustomMm(210.06)).toBe(210.1);
		expect(sanitizeCustomMm(1)).toBe(20);
		expect(sanitizeCustomMm(1e9)).toBe(2000);
		expect(sanitizeCustomMm(NaN)).toBe(210);
	});
});

describe('autoOrientation', () => {
	it('matches the source, squarish counting as portrait', () => {
		expect(autoOrientation(4000, 3000)).toBe('landscape');
		expect(autoOrientation(3000, 4000)).toBe('portrait');
		expect(autoOrientation(1000, 1000)).toBe('portrait');
		expect(autoOrientation(1040, 1000)).toBe('portrait'); // within the 5% band
	});
});

describe('frameHeightFor', () => {
	it('derives the frame height from the page aspect', () => {
		const a4 = resolveOutputFormat('A4', 0, 0, 'portrait')!;
		expect(frameHeightFor(1000, a4)).toBe(Math.round((1000 * 297) / 210));
		const square = resolveOutputFormat('sq15', 0, 0, 'portrait')!;
		expect(frameHeightFor(640, square)).toBe(640);
	});
});

describe('clampMarginMm', () => {
	const a6 = resolveOutputFormat('A6', 0, 0, 'portrait')!;

	it('allows zero (no mask) and everyday margins', () => {
		expect(clampMarginMm(0, a6)).toBe(0);
		expect(clampMarginMm(10, a6)).toBe(10);
	});

	it('never swallows the page', () => {
		// 0.45 × 105 = 47.25 → floor 47; two margins leave 11 mm drawable
		expect(clampMarginMm(500, a6)).toBe(47);
		expect(clampMarginMm(-5, a6)).toBe(0);
		expect(clampMarginMm(NaN, a6)).toBe(0);
	});
});
