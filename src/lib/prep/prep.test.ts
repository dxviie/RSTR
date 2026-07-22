import { describe, it, expect } from 'vitest';
import { pageDims, parseMm, svgDimensions } from './pages';
import { reversePathData, reversePoints } from './reverse';
import { buildCalibrationBlock } from './calibration';
import { handDrawnPolylines, polylinesToSvgPath } from '../rstr2/handDrawn';

describe('parseMm', () => {
	it('converts units to mm', () => {
		expect(parseMm('210mm')).toBe(210);
		expect(parseMm('1cm')).toBe(10);
		expect(parseMm('1in')).toBeCloseTo(25.4);
		expect(parseMm('96px')).toBeCloseTo(25.4);
		expect(parseMm('96')).toBeCloseTo(25.4);
		expect(parseMm('72pt')).toBeCloseTo(25.4);
	});

	it('rejects garbage', () => {
		expect(parseMm('')).toBeNull();
		expect(parseMm(null)).toBeNull();
		expect(parseMm('12em')).toBeNull();
	});
});

describe('pageDims / svgDimensions', () => {
	it('swaps dimensions for landscape', () => {
		expect(pageDims('A3', 'portrait')).toEqual([297, 420]);
		expect(pageDims('A3', 'landscape')).toEqual([420, 297]);
	});

	it('derives physical size from the viewBox when width/height are missing', () => {
		const dims = svgDimensions('0 0 96 192', null, null);
		expect(dims.wMm).toBeCloseTo(25.4);
		expect(dims.hMm).toBeCloseTo(50.8);
		expect(dims.viewBox).toEqual([0, 0, 96, 192]);
	});

	it('completes a missing dimension from the aspect ratio', () => {
		const dims = svgDimensions('0 0 100 50', '200mm', null);
		expect(dims.wMm).toBe(200);
		expect(dims.hMm).toBe(100);
	});

	it('synthesizes a viewBox from width/height alone', () => {
		const dims = svgDimensions(null, '25.4mm', '50.8mm');
		expect(dims.viewBox[2]).toBeCloseTo(96);
		expect(dims.viewBox[3]).toBeCloseTo(192);
	});
});

describe('reversePathData', () => {
	it('reverses a simple polyline path', () => {
		expect(reversePathData('M0 0L10 0L10 10')).toBe('M10 10L10 0L0 0');
	});

	it('reverses subpath order too (RSTR hatch style)', () => {
		expect(reversePathData('M1 2L3 4M5 6L7 8')).toBe('M7 8L5 6M3 4L1 2');
	});

	it('resolves relative and shorthand commands', () => {
		expect(reversePathData('m10 10l5 0v5h-5')).toBe('M10 15L15 15L15 10L10 10');
	});

	it('reverses cubic curves by swapping control points', () => {
		expect(reversePathData('M0 0C1 0 2 1 3 1')).toBe('M3 1C2 1 1 0 0 0');
	});

	it('resolves smooth (S) control point reflection', () => {
		// S reflects the previous C's second control point (2,1) about (3,1) -> (4,1)
		expect(reversePathData('M0 0C1 0 2 1 3 1S5 2 6 2')).toBe('M6 2C5 2 4 1 3 1C2 1 1 0 0 0');
	});

	it('reverses quadratic curves keeping the control point', () => {
		expect(reversePathData('M0 0Q1 2 2 0')).toBe('M2 0Q1 2 0 0');
	});

	it('flips the sweep flag of arcs', () => {
		expect(reversePathData('M0 0A5 5 0 0 1 10 0')).toBe('M10 0A5 5 0 0 0 0 0');
	});

	it('keeps closed subpaths closed', () => {
		expect(reversePathData('M0 0L10 0L10 10Z')).toBe('M0 0L10 10L10 0L0 0Z');
	});

	it('round-trips: reversing twice restores the geometry', () => {
		const d = 'M1.5 2.25L10 0L10 10M20 20Q25 30 30 20L40 20Z';
		expect(reversePathData(reversePathData(d))).toBe(reversePathData(reversePathData(d)));
		// endpoints of the double reversal match the original
		expect(reversePathData(reversePathData(d)).startsWith('M1.5 2.25')).toBe(true);
	});
});

// The studio's hand-drawn mode exports each hatch line as a many-point
// polyline with implicitly repeated LineTos ("M x y L x y x y …") instead of
// a plain two-point segment — make sure the reversed-layer feature handles
// exactly that shape.
describe('reversePathData × hand-drawn hatch paths', () => {
	/** every coordinate pair in a path string, in order */
	const points = (d: string): string[] => d.match(/-?[\d.]+ -?[\d.]+/g) ?? [];

	it('reverses implicitly repeated LineTos', () => {
		expect(reversePathData('M0 1L2 3 4 5 6 7')).toBe('M6 7L4 5L2 3L0 1');
	});

	it('reverses multiple wobbly subpaths including their order', () => {
		expect(reversePathData('M0 0L1 0.5 2 0M10 0L11 -0.5 12 0')).toBe(
			'M12 0L11 -0.5L10 0M2 0L1 0.5L0 0'
		);
	});

	it('reverses a real hand-drawn export line point for point', () => {
		const lines = handDrawnPolylines([12.5, 30, 180.25, 95.75], {
			amplitudePx: 3,
			wavelengthPx: 25,
			seed: 7
		});
		const d = polylinesToSvgPath(lines);
		expect(points(d).length).toBeGreaterThan(4); // the line actually wobbles
		const reversed = reversePathData(d);
		expect(points(reversed)).toEqual(points(d).reverse());
		// reversing again restores the original point order
		expect(points(reversePathData(reversed))).toEqual(points(d));
	});
});

describe('reversePoints', () => {
	it('reverses coordinate pairs', () => {
		expect(reversePoints('0,0 10,0 10,10')).toBe('10,10 10,0 0,0');
	});

	it('handles space/comma soup and drops an odd trailing value', () => {
		expect(reversePoints(' 1 2, 3 4  5 ')).toBe('3,4 1,2');
	});
});

describe('buildCalibrationBlock', () => {
	it('produces per-pen layers plus shared circle, ruler and half layers on export', () => {
		const block = buildCalibrationBlock({
			pageW: 420,
			pageH: 297,
			penCount: 3,
			forExport: true,
			rotated: false,
			x: null,
			y: null
		});
		expect(block.svg).toContain('inkscape:label="cal-circle"');
		expect(block.svg).toContain('inkscape:label="cal-rulers"');
		expect(block.svg).toContain('inkscape:label="cal-pen-1"');
		expect(block.svg).toContain('inkscape:label="cal-pen-3"');
		expect(block.svg).toContain('inkscape:label="cal-half"');
		expect(block.svg).not.toContain('cal-pen-4');
		expect(block.bw).toBeGreaterThan(0);
		expect(block.bh).toBeGreaterThan(0);
	});

	it('compact mode keeps only the pen + half layers in a smaller box', () => {
		const opts = {
			pageW: 420,
			pageH: 297,
			penCount: 3,
			forExport: true,
			rotated: false,
			x: null,
			y: null
		};
		const full = buildCalibrationBlock(opts);
		const compact = buildCalibrationBlock({ ...opts, compact: true });
		expect(compact.svg).toContain('inkscape:label="cal-pen-1"');
		expect(compact.svg).toContain('inkscape:label="cal-pen-3"');
		expect(compact.svg).toContain('inkscape:label="cal-half"');
		expect(compact.svg).not.toContain('cal-circle');
		expect(compact.svg).not.toContain('cal-rulers');
		expect(compact.svg).not.toContain('CALIBRATION');
		expect(compact.bw).toBeLessThan(full.bw);
		expect(compact.bh).toBeLessThan(full.bh);
	});

	it('defaults to the top-right corner and swaps its box when rotated', () => {
		const flat = buildCalibrationBlock({
			pageW: 420,
			pageH: 297,
			penCount: 2,
			forExport: false,
			rotated: false,
			x: null,
			y: null
		});
		const rotated = buildCalibrationBlock({
			pageW: 420,
			pageH: 297,
			penCount: 2,
			forExport: false,
			rotated: true,
			x: null,
			y: null
		});
		expect(flat.bx + flat.bw).toBeCloseTo(420 - 8);
		expect(flat.by).toBe(8);
		expect(rotated.bw).toBeCloseTo(flat.bh);
		expect(rotated.bh).toBeCloseTo(flat.bw);
	});
});
