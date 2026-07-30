// Single-stroke digits from the public-domain Hershey "simplex" font, for
// plottable frame numbers on multi-SVG (frame sequence) exports. Only the
// characters a frame number needs are included.
//
// Glyph data is the classic Hershey vertex list: y grows upward, the
// baseline sits at y=0 and the cap height at y=21; `width` is the cursor
// advance. Rendering flips y so the output is standard SVG (y down) with
// the origin on the baseline.

interface Glyph {
	width: number;
	/** polylines as flat [x0,y0, x1,y1, …] vertex runs */
	strokes: number[][];
}

const GLYPHS: Record<string, Glyph> = {
	'0': {
		width: 20,
		strokes: [
			[
				9, 21, 6, 20, 4, 17, 3, 12, 3, 9, 4, 4, 6, 1, 9, 0, 11, 0, 14, 1, 16, 4, 17, 9, 17, 12, 16,
				17, 14, 20, 11, 21, 9, 21
			]
		]
	},
	'1': { width: 20, strokes: [[6, 17, 8, 18, 11, 21, 11, 0]] },
	'2': {
		width: 20,
		strokes: [
			[
				4, 16, 4, 17, 5, 19, 6, 20, 8, 21, 12, 21, 14, 20, 15, 19, 16, 17, 16, 15, 15, 13, 13, 10,
				3, 0, 17, 0
			]
		]
	},
	'3': {
		width: 20,
		strokes: [
			[
				5, 21, 16, 21, 10, 13, 13, 13, 15, 12, 16, 11, 17, 8, 17, 6, 16, 3, 14, 1, 11, 0, 8, 0, 5,
				1, 4, 2, 3, 4
			]
		]
	},
	'4': {
		width: 20,
		strokes: [
			[13, 21, 3, 7, 18, 7],
			[13, 21, 13, 0]
		]
	},
	'5': {
		width: 20,
		strokes: [
			[
				15, 21, 5, 21, 4, 12, 5, 13, 8, 14, 11, 14, 14, 13, 16, 11, 17, 8, 17, 6, 16, 3, 14, 1, 11,
				0, 8, 0, 5, 1, 4, 2, 3, 4
			]
		]
	},
	'6': {
		width: 20,
		strokes: [
			[
				16, 18, 15, 20, 12, 21, 10, 21, 7, 20, 5, 17, 4, 12, 4, 7, 5, 3, 7, 1, 10, 0, 11, 0, 14, 1,
				16, 3, 17, 6, 17, 7, 16, 10, 14, 12, 11, 13, 10, 13, 7, 12, 5, 10, 4, 7
			]
		]
	},
	'7': {
		width: 20,
		strokes: [
			[17, 21, 7, 0],
			[3, 21, 17, 21]
		]
	},
	'8': {
		width: 20,
		strokes: [
			[
				8, 21, 5, 20, 4, 18, 4, 16, 5, 14, 7, 13, 11, 12, 14, 11, 16, 9, 17, 7, 17, 4, 16, 2, 15, 1,
				12, 0, 8, 0, 5, 1, 4, 2, 3, 4, 3, 7, 4, 9, 6, 11, 9, 12, 13, 13, 15, 14, 16, 16, 16, 18, 15,
				20, 12, 21, 8, 21
			]
		]
	},
	'9': {
		width: 20,
		strokes: [
			[
				16, 14, 15, 11, 13, 9, 10, 8, 9, 8, 6, 9, 4, 11, 3, 14, 3, 15, 4, 18, 6, 20, 9, 21, 10, 21,
				13, 20, 15, 18, 16, 14, 16, 9, 15, 4, 13, 1, 10, 0, 8, 0, 5, 1, 4, 3
			]
		]
	},
	'-': { width: 26, strokes: [[4, 9, 22, 9]] },
	'#': {
		width: 21,
		strokes: [
			[11, 25, 4, -7],
			[17, 25, 10, -7],
			[4, 12, 18, 12],
			[3, 6, 17, 6]
		]
	}
};

const CAP_HEIGHT = 21;

/**
 * Render `text` as single-stroke path data, `height` mm tall (cap height),
 * with the origin at the baseline's left end. Characters without a glyph are
 * skipped. Returns the path data and the advance width in mm.
 */
export const hersheyPathData = (text: string, height: number): { d: string; width: number } => {
	const s = height / CAP_HEIGHT;
	const fmt = (n: number) => String(parseFloat(n.toFixed(3)));
	let d = '';
	let cursor = 0;
	for (const ch of text) {
		const glyph = GLYPHS[ch];
		if (!glyph) continue;
		for (const stroke of glyph.strokes) {
			for (let i = 0; i + 1 < stroke.length; i += 2) {
				const x = cursor + stroke[i] * s;
				const y = -stroke[i + 1] * s;
				d += `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
			}
		}
		cursor += glyph.width * s;
	}
	return { d, width: cursor };
};
