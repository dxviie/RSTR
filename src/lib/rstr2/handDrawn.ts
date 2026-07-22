// Hand-drawn wobble for hatch lines.
//
// A post-processing step over the straight segments from hatchPolygon: each
// segment becomes a polyline that meanders around the ideal line like a real
// pen stroke. The classic straight output stays untouched — when the effect
// is off, callers never enter this module and render/export the segments
// exactly as before.
//
// Everything here is pure and deterministic: a line's wobble depends only on
// its endpoints and the variation seed (value noise from a seeded PRNG), so
// the canvas preview, the exported SVG and the plot-time estimate all see the
// same geometry, and re-renders don't flicker.

import type { HatchSegments } from './hatchTools';

/** One wobbled hatch line: flat [x0,y0, x1,y1, ...] point list (≥ 2 points). */
export type HatchPolyline = number[];

export interface HandDrawnOptions {
	/** peak sideways deviation from the ideal line (px) */
	amplitudePx: number;
	/** distance between direction changes along the line (px) */
	wavelengthPx: number;
	/** variation seed — rerolls the whole wobble pattern */
	seed: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

// second noise octave: finer detail at a non-integer fraction of the
// wavelength so the two octaves never phase-lock into a repeating pattern
const OCTAVE2_RATIO = 2.3;
const OCTAVE2_WEIGHT = 0.35;

/**
 * Murmur3-style hash of a line's quantized endpoints and the variation seed.
 * This is what makes the wobble deterministic per line: the same line always
 * wobbles the same way, and neighbouring lines are uncorrelated.
 */
const hashLine = (x1: number, y1: number, x2: number, y2: number, seed: number): number => {
	let h = (0x9e3779b9 ^ Math.imul(seed | 0, 0x85ebca6b)) | 0;
	for (const v of [x1, y1, x2, y2]) {
		let k = Math.round(v * 100) | 0;
		k = Math.imul(k, 0xcc9e2d51);
		k = (k << 15) | (k >>> 17);
		k = Math.imul(k, 0x1b873593);
		h ^= k;
		h = (h << 13) | (h >>> 19);
		h = (Math.imul(h, 5) + 0xe6546b64) | 0;
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return h | 0;
};

/** tiny seeded PRNG (mulberry32) — good enough spread for visual noise */
const mulberry32 = (a: number): (() => number) => {
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** cosine-interpolated 1D value noise over knots spaced 1 apart */
const knotNoise = (knots: number[], t: number): number => {
	const i = Math.min(Math.floor(t), knots.length - 2);
	const f = t - i;
	const s = (1 - Math.cos(Math.PI * f)) / 2;
	return knots[i] * (1 - s) + knots[i + 1] * s;
};

const smoothstep = (u: number): number => u * u * (3 - 2 * u);

/**
 * Turn straight hatch segments into hand-drawn-looking polylines.
 *
 * Each segment keeps its exact endpoints (so lines still start and end on the
 * inset region contour and pen-path joining behaves as before) and gains
 * interior points displaced perpendicular to the ideal line by two octaves of
 * smooth value noise. The displacement tapers to zero at both ends, short
 * strokes wobble proportionally less (a hand is more accurate over 5 mm than
 * over 50), and every line gets its own pressure factor — no two lines share
 * a wobble.
 */
export const handDrawnPolylines = (
	segments: HatchSegments,
	options: HandDrawnOptions
): HatchPolyline[] => {
	const lines: HatchPolyline[] = [];
	const amplitude = Math.max(0, options.amplitudePx);
	const wavelength = Math.max(1e-3, options.wavelengthPx);

	for (let k = 0; k + 3 < segments.length; k += 4) {
		const x1 = segments[k];
		const y1 = segments[k + 1];
		const x2 = segments[k + 2];
		const y2 = segments[k + 3];
		const dx = x2 - x1;
		const dy = y2 - y1;
		const len = Math.hypot(dx, dy);

		const rng = mulberry32(hashLine(x1, y1, x2, y2, options.seed));
		// per-line "hand pressure": every stroke wanders a different amount,
		// capped at 1 so the amplitude slider stays a true maximum
		const pressure = 0.5 + 0.5 * rng();
		// short strokes are steadier than long ones
		const lengthScale = Math.min(1, len / (2 * wavelength));
		const amp = amplitude * pressure * lengthScale;

		if (len < 1e-9 || amp < 0.01) {
			lines.push([x1, y1, x2, y2]);
			continue;
		}

		const ux = dx / len;
		const uy = dy / len;
		// perpendicular of (ux, uy)
		const px = -uy;
		const py = ux;

		// noise knots for both octaves, one value per wavelength interval
		const knots1: number[] = [];
		const wavelength2 = wavelength / OCTAVE2_RATIO;
		const knots2: number[] = [];
		for (let i = 0, n = Math.ceil(len / wavelength) + 2; i < n; i++) knots1.push(rng() * 2 - 1);
		for (let i = 0, n = Math.ceil(len / wavelength2) + 2; i < n; i++) knots2.push(rng() * 2 - 1);

		// enough samples to look smooth, few enough to keep exports lean
		const step = Math.max(wavelength / 5, 1.5);
		const count = Math.max(2, Math.ceil(len / step));
		const taperLen = Math.min(wavelength / 2, len * 0.25);

		const line: HatchPolyline = [x1, y1];
		for (let i = 1; i < count; i++) {
			const t = (len * i) / count;
			const taper = smoothstep(Math.min(1, Math.min(t, len - t) / taperLen));
			const noise =
				(knotNoise(knots1, t / wavelength) + OCTAVE2_WEIGHT * knotNoise(knots2, t / wavelength2)) /
				(1 + OCTAVE2_WEIGHT);
			const offset = amp * taper * noise;
			line.push(x1 + ux * t + px * offset, y1 + uy * t + py * offset);
		}
		line.push(x2, y2);
		lines.push(line);
	}
	return lines;
};

/**
 * Compact SVG path for wobbled lines: one M per line, the L repeated
 * implicitly ("M x0 y0 L x1 y1 x2 y2 …"). A 2-point line produces exactly the
 * same "M x y L x y" text as segmentsToSvgPath, digit for digit.
 */
export const polylinesToSvgPath = (lines: HatchPolyline[]): string => {
	let d = '';
	for (const line of lines) {
		if (line.length < 4) continue;
		d += `M${round2(line[0])} ${round2(line[1])}L${round2(line[2])} ${round2(line[3])}`;
		for (let k = 4; k + 1 < line.length; k += 2) {
			d += ` ${round2(line[k])} ${round2(line[k + 1])}`;
		}
	}
	return d;
};

/**
 * Flatten polylines into the 4-tuple segment list the plot-time estimator
 * eats. Consecutive pieces of one line share their endpoint exactly, so the
 * estimator's path joining keeps treating each wobbled line as a single
 * pen-down stroke.
 */
export const polylinesToSegments = (lines: HatchPolyline[]): HatchSegments => {
	const segments: HatchSegments = [];
	for (const line of lines) {
		for (let k = 0; k + 3 < line.length; k += 2) {
			segments.push(line[k], line[k + 1], line[k + 2], line[k + 3]);
		}
	}
	return segments;
};
