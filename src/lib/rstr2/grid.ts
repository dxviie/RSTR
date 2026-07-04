// Image downsampling: raw pixels -> cell grid.
//
// All downstream work (adjustment, segmentation, hatching) runs on this
// grid, so its resolution is the single knob that trades detail for speed.

export interface CellGrid {
	cols: number;
	rows: number;
	/** cell size in source-image pixels */
	cellW: number;
	cellH: number;
	/** per-cell mean channel values, 0..1 */
	r: Float32Array;
	g: Float32Array;
	b: Float32Array;
}

/**
 * Average the source pixels into a grid of `resolution` cells across, in a
 * single pass over the pixel buffer. Rows follow from the image aspect so
 * cells stay square.
 */
export const computeCellGrid = (
	px: Uint8ClampedArray,
	width: number,
	height: number,
	resolution: number
): CellGrid => {
	const cols = Math.max(1, Math.min(Math.round(resolution), width));
	const cellW = width / cols;
	const rows = Math.max(1, Math.round(height / cellW));
	const cellH = height / rows;

	const n = cols * rows;
	const sumR = new Float64Array(n);
	const sumG = new Float64Array(n);
	const sumB = new Float64Array(n);
	const count = new Uint32Array(n);

	for (let y = 0; y < height; y++) {
		const cy = Math.min(rows - 1, (y * rows) / height) | 0;
		const rowBase = cy * cols;
		let p = y * width * 4;
		for (let x = 0; x < width; x++, p += 4) {
			const cx = Math.min(cols - 1, (x * cols) / width) | 0;
			const c = rowBase + cx;
			sumR[c] += px[p];
			sumG[c] += px[p + 1];
			sumB[c] += px[p + 2];
			count[c]++;
		}
	}

	const r = new Float32Array(n);
	const g = new Float32Array(n);
	const b = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const cnt = count[i] || 1;
		r[i] = sumR[i] / cnt / 255;
		g[i] = sumG[i] / cnt / 255;
		b[i] = sumB[i] / cnt / 255;
	}
	return { cols, rows, cellW, cellH, r, g, b };
};
