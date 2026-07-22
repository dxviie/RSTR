import { describe, it, expect } from 'vitest';
import {
	handDrawnPolylines,
	polylinesToSegments,
	polylinesToSvgPath,
	type HandDrawnOptions
} from './handDrawn';
import { segmentsToSvgPath } from './hatchTools';

const options = (overrides: Partial<HandDrawnOptions> = {}): HandDrawnOptions => ({
	amplitudePx: 3,
	wavelengthPx: 40,
	seed: 1,
	...overrides
});

/** perpendicular distance of (x, y) from the infinite line p1 -> p2 */
const deviation = (
	x: number,
	y: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number
): number => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy);
	return Math.abs(((x - x1) * dy - (y - y1) * dx) / len);
};

describe('handDrawnPolylines', () => {
	const segment = [10, 20, 210, 20];

	it('keeps the exact endpoints of every line', () => {
		const [line] = handDrawnPolylines(segment, options());
		expect(line[0]).toBe(10);
		expect(line[1]).toBe(20);
		expect(line[line.length - 2]).toBe(210);
		expect(line[line.length - 1]).toBe(20);
	});

	it('adds interior points that stay within the amplitude', () => {
		const [line] = handDrawnPolylines(segment, options());
		expect(line.length).toBeGreaterThan(4);
		let maxDev = 0;
		for (let k = 2; k + 1 < line.length - 2; k += 2) {
			maxDev = Math.max(maxDev, deviation(line[k], line[k + 1], 10, 20, 210, 20));
		}
		expect(maxDev).toBeGreaterThan(0); // it actually wobbles
		expect(maxDev).toBeLessThanOrEqual(3);
	});

	it('is deterministic — same line, same seed, same wobble', () => {
		const a = handDrawnPolylines(segment, options());
		const b = handDrawnPolylines(segment, options());
		expect(a).toEqual(b);
	});

	it('rerolls the pattern when the seed changes', () => {
		const [a] = handDrawnPolylines(segment, options({ seed: 1 }));
		const [b] = handDrawnPolylines(segment, options({ seed: 2 }));
		expect(a.length).toBeGreaterThan(4);
		expect(a).not.toEqual(b);
	});

	it('wobbles neighbouring lines independently', () => {
		const two = handDrawnPolylines([0, 0, 200, 0, 0, 10, 200, 10], options());
		expect(two).toHaveLength(2);
		const offsetsA = two[0].filter((_, i) => i % 2 === 1).map((y) => y - 0);
		const offsetsB = two[1].filter((_, i) => i % 2 === 1).map((y) => y - 10);
		expect(offsetsA).not.toEqual(offsetsB);
	});

	it('handles diagonal lines (deviation measured across the line)', () => {
		const [line] = handDrawnPolylines([0, 0, 150, 150], options({ amplitudePx: 2 }));
		for (let k = 2; k + 1 < line.length - 2; k += 2) {
			expect(deviation(line[k], line[k + 1], 0, 0, 150, 150)).toBeLessThanOrEqual(2);
		}
	});

	it('keeps near-zero-length and effectively straight lines as plain segments', () => {
		expect(handDrawnPolylines([5, 5, 5.05, 5], options())).toEqual([[5, 5, 5.05, 5]]);
		expect(handDrawnPolylines(segment, options({ amplitudePx: 0 }))).toEqual([segment]);
	});

	it('scales the wobble down on short strokes', () => {
		const long = handDrawnPolylines([0, 0, 400, 0], options())[0];
		const short = handDrawnPolylines([0, 0, 30, 0], options())[0];
		const maxOffset = (line: number[], y = 0) =>
			Math.max(...line.filter((_, i) => i % 2 === 1).map((v) => Math.abs(v - y)));
		expect(maxOffset(short)).toBeLessThan(maxOffset(long));
	});

	it('survives a degenerate wavelength', () => {
		const [line] = handDrawnPolylines(segment, options({ wavelengthPx: 0 }));
		expect(line[0]).toBe(10);
		expect(line[line.length - 2]).toBe(210);
	});
});

describe('polylinesToSvgPath', () => {
	it('formats a 2-point line exactly like segmentsToSvgPath', () => {
		const coords = [0.111, 1, 2.345, 3];
		expect(polylinesToSvgPath([coords])).toBe(segmentsToSvgPath(coords));
	});

	it('repeats the L implicitly for longer lines', () => {
		expect(polylinesToSvgPath([[0, 1, 2, 3, 4, 5]])).toBe('M0 1L2 3 4 5');
		expect(
			polylinesToSvgPath([
				[0, 0, 1, 0],
				[2, 0, 3, 0]
			])
		).toBe('M0 0L1 0M2 0L3 0');
	});

	it('skips degenerate entries', () => {
		expect(polylinesToSvgPath([[], [1, 2]])).toBe('');
	});
});

describe('polylinesToSegments', () => {
	it('chains a polyline into endpoint-sharing 4-tuples', () => {
		expect(polylinesToSegments([[0, 0, 10, 1, 20, 0]])).toEqual([0, 0, 10, 1, 10, 1, 20, 0]);
	});

	it('round-trips plain segments untouched', () => {
		expect(polylinesToSegments([[0, 0, 10, 1]])).toEqual([0, 0, 10, 1]);
	});
});
