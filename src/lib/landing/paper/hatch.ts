// Geometry for the hand-built hatching on the "paper & ink" landing page:
// the margin test swatches and the spacing explainer in "what's a plotter".

/**
 * Parallel lines `gap` apart at `angle` degrees, clipped to a w × h box, as
 * one SVG path. Drawing real lines (instead of an SVG <pattern>) keeps every
 * stroke crisp: patterns are tiled bitmaps and can show seams once rotated.
 */
export const hatch = (w: number, h: number, angle: number, gap: number): string => {
	const a = (angle * Math.PI) / 180;
	const dx = Math.cos(a);
	const dy = Math.sin(a);
	// offsets are measured along the normal, so project the corners onto it
	const reach = [0, w * -dy, h * dx, w * -dy + h * dx];
	const from = Math.min(...reach);
	const to = Math.max(...reach);

	let d = '';
	for (let k = Math.ceil(from / gap); k * gap <= to; k++) {
		const px = k * gap * -dy;
		const py = k * gap * dx;
		// clip the infinite line p + t·dir to the box (Liang-Barsky)
		let t0 = -Infinity;
		let t1 = Infinity;
		if (Math.abs(dx) > 1e-9) {
			const ta = -px / dx;
			const tb = (w - px) / dx;
			t0 = Math.max(t0, Math.min(ta, tb));
			t1 = Math.min(t1, Math.max(ta, tb));
		} else if (px < 0 || px > w) continue;
		if (Math.abs(dy) > 1e-9) {
			const ta = -py / dy;
			const tb = (h - py) / dy;
			t0 = Math.max(t0, Math.min(ta, tb));
			t1 = Math.min(t1, Math.max(ta, tb));
		} else if (py < 0 || py > h) continue;
		if (t1 - t0 < 0.5) continue;
		const x0 = (px + t0 * dx).toFixed(1);
		const y0 = (py + t0 * dy).toFixed(1);
		const x1 = (px + t1 * dx).toFixed(1);
		const y1 = (py + t1 * dy).toFixed(1);
		d += `M${x0} ${y0}L${x1} ${y1}`;
	}
	return d;
};

/** "3831" → "3,831", the same on the server and in every browser */
export const formatCount = (n: number) => n.toLocaleString('en-US');
