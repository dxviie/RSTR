// Hatch-line generation for region contours.
//
// Works directly on the flat contour arrays produced by regionTools — no
// path-string round trips. Each scanline is described in an orthonormal
// (dir, perp) basis, so intersections only need their scalar position along
// the line; endpoint coordinates are reconstructed from that scalar.

/** Flat segment list: [x1, y1, x2, y2, ...] in pixel space. */
export type HatchSegments = number[];

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Fill a polygon (outer loops + holes) with parallel lines.
 *
 * @param loops flat [x0,y0,x1,y1,...] closed contours in pixel space
 * @param angleDeg hatch direction in degrees
 * @param spacingPx distance between neighbouring lines
 * @param insetPx total shortening applied to each segment (pen width), keeps
 *                ink inside the region outline
 */
export const hatchPolygon = (
	loops: Float64Array[],
	angleDeg: number,
	spacingPx: number,
	insetPx: number
): HatchSegments => {
	const segments: HatchSegments = [];
	if (loops.length === 0 || spacingPx <= 0) return segments;

	const angleRad = (angleDeg * Math.PI) / 180;
	const dx = Math.cos(angleRad);
	const dy = Math.sin(angleRad);
	const px = -dy;
	const py = dx;

	// Range of the polygon along the perpendicular axis
	let minP = Infinity;
	let maxP = -Infinity;
	for (const loop of loops) {
		for (let k = 0; k < loop.length; k += 2) {
			const p = loop[k] * px + loop[k + 1] * py;
			if (p < minP) minP = p;
			if (p > maxP) maxP = p;
		}
	}
	if (!isFinite(minP) || maxP - minP < 1e-9) return segments;

	const ts: number[] = [];
	// Small irrational-ish phase offset avoids scanlines passing exactly
	// through contour vertices (degenerate intersection counts).
	for (let off = minP + spacingPx * 0.5 + spacingPx * 0.0137; off < maxP; off += spacingPx) {
		ts.length = 0;
		for (const loop of loops) {
			const len = loop.length;
			let ax = loop[len - 2];
			let ay = loop[len - 1];
			let fa = ax * px + ay * py - off;
			for (let k = 0; k < len; k += 2) {
				const bx = loop[k];
				const by = loop[k + 1];
				const fb = bx * px + by * py - off;
				if (fa < 0 !== fb < 0) {
					const s = fa / (fa - fb);
					const ix = ax + s * (bx - ax);
					const iy = ay + s * (by - ay);
					ts.push(ix * dx + iy * dy);
				}
				ax = bx;
				ay = by;
				fa = fb;
			}
		}
		if (ts.length < 2) continue;
		ts.sort((a, b) => a - b);

		const ox = px * off;
		const oy = py * off;
		for (let j = 0; j + 1 < ts.length; j += 2) {
			const t0 = ts[j] + insetPx / 2;
			const t1 = ts[j + 1] - insetPx / 2;
			if (t1 - t0 < insetPx * 0.25) continue; // too short to plot cleanly
			segments.push(ox + dx * t0, oy + dy * t0, ox + dx * t1, oy + dy * t1);
		}
	}
	return segments;
};

export type SpacingCurve = 'coverage' | 'gamma' | 'log' | 'linear';

export interface SpacingOptions {
	curve: SpacingCurve;
	/** perceptual weight applied to the ink value before mapping */
	gamma: number;
	/** coverage multiplier — >1 pushes dark regions denser (into overlap) */
	inkBoost: number;
}

/**
 * Map ink intensity (0..1) to a line spacing, clamped to the nominal
 * [min, max] bounds — a minimum below the pen width deliberately produces
 * overlapping lines.
 *
 * The default 'coverage' curve recreates the actual color density on paper:
 * area coverage ≈ penWidth / spacing, so spacing = penWidth / ink^gamma makes
 * the inked fraction match the (perceptually weighted) channel value. The
 * other curves interpolate between the spacing bounds.
 */
export const spacingForInk = (
	ink: number,
	penWidthPx: number,
	minSpacingPx: number,
	maxSpacingPx: number,
	options: SpacingOptions
): number => {
	const v = Math.max(0, Math.min(1, ink));
	const gamma = options.gamma > 0 ? options.gamma : 1.8;
	let spacing: number;

	if (options.curve === 'gamma') {
		const t = Math.pow(v, gamma);
		spacing = maxSpacingPx - t * (maxSpacingPx - minSpacingPx);
	} else if (options.curve === 'log') {
		const t = Math.log(1 + 4 * v) / Math.log(5);
		spacing = maxSpacingPx - t * (maxSpacingPx - minSpacingPx);
	} else if (options.curve === 'linear') {
		spacing = maxSpacingPx - v * (maxSpacingPx - minSpacingPx);
	} else {
		// coverage (default)
		const coverage = Math.pow(v, gamma) * options.inkBoost;
		spacing = coverage <= 1e-6 ? maxSpacingPx : penWidthPx / coverage;
	}

	return Math.max(minSpacingPx, Math.min(maxSpacingPx, spacing));
};

/** Compact SVG path ("M x y L x y M ...") for a flat segment list. */
export const segmentsToSvgPath = (segments: HatchSegments): string => {
	let d = '';
	for (let k = 0; k < segments.length; k += 4) {
		d += `M${round2(segments[k])} ${round2(segments[k + 1])}L${round2(segments[k + 2])} ${round2(segments[k + 3])}`;
	}
	return d;
};
