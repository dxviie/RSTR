// Paper outline marks for the plot-prep tool: the classic full rectangle,
// or lighter corner / cross marks that stay out of the artwork's way and
// double as cut guides around multi-SVG frame cells.

export type OutlineStyle = 'full' | 'corners' | 'crosses';

export const OUTLINE_STYLE_LABELS: Record<OutlineStyle, string> = {
	full: 'full rectangle',
	corners: 'corners',
	crosses: 'crosses'
};

const fmt = (n: number) => String(parseFloat(n.toFixed(4)));

/**
 * Marks for the rectangle (x, y, w, h) in the given style, as SVG markup.
 * `attrs` carries the presentation attributes (stroke, stroke-width, …).
 * Corner marks run along the edges from each corner; crosses are centered
 * on the corners, reaching slightly outside the rectangle.
 */
export const outlineMarks = (
	x: number,
	y: number,
	w: number,
	h: number,
	style: OutlineStyle,
	attrs: string
): string => {
	if (style === 'full') {
		return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs}/>`;
	}
	const corners: [number, number, number, number][] = [
		// [corner-x, corner-y, inward-x-sign, inward-y-sign]
		[x, y, 1, 1],
		[x + w, y, -1, 1],
		[x, y + h, 1, -1],
		[x + w, y + h, -1, -1]
	];
	const line = (x1: number, y1: number, x2: number, y2: number) =>
		`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" ${attrs}/>`;
	let out = '';
	if (style === 'corners') {
		const arm = Math.min(8, w / 4, h / 4);
		for (const [cx, cy, dx, dy] of corners) {
			out += line(cx, cy, cx + dx * arm, cy);
			out += line(cx, cy, cx, cy + dy * arm);
		}
	} else {
		const arm = Math.min(3.5, w / 4, h / 4);
		for (const [cx, cy] of corners) {
			out += line(cx - arm, cy, cx + arm, cy);
			out += line(cx, cy - arm, cx, cy + arm);
		}
	}
	return out;
};
