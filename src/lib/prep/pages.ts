// Output page definitions and SVG dimension parsing for the plot-prep tool.

/** [portrait-width, portrait-height] in mm */
export const PAGES = {
	A6: [105, 148],
	A5: [148, 210],
	A4: [210, 297],
	A3: [297, 420],
	A2: [420, 594],
	A1: [594, 841],
	A0: [841, 1189],
	AxiV3: [300, 430],
	AxiA1: [594, 864]
} as const;

export type PageId = keyof typeof PAGES;

export const PAGE_LABELS: Record<PageId, string> = {
	A6: 'A6 105 × 148 mm',
	A5: 'A5 148 × 210 mm',
	A4: 'A4 210 × 297 mm',
	A3: 'A3 297 × 420 mm',
	A2: 'A2 420 × 594 mm',
	A1: 'A1 594 × 841 mm',
	A0: 'A0 841 × 1189 mm',
	AxiV3: 'AxiDraw V3 300 × 430 mm',
	AxiA1: 'AxiDraw A1 864 × 594 mm'
};

export type Orientation = 'landscape' | 'portrait';

export const pageDims = (page: PageId, orient: Orientation): [number, number] => {
	const [pw, ph] = PAGES[page];
	return orient === 'landscape' ? [ph, pw] : [pw, ph];
};

/** parse an SVG length into mm (unitless values are CSS px at 96dpi) */
export const parseMm = (str: string | null | undefined): number | null => {
	if (!str) return null;
	const match = String(str)
		.trim()
		.match(/^([0-9.e+-]+)\s*(mm|cm|in|px|pt|pc)?$/i);
	if (!match) return null;
	const value = parseFloat(match[1]);
	const unit = (match[2] || 'px').toLowerCase();
	const perUnit: Record<string, number> = {
		mm: 1,
		cm: 10,
		in: 25.4,
		px: 25.4 / 96,
		pt: 25.4 / 72,
		pc: 25.4 / 6
	};
	return value * (perUnit[unit] ?? 25.4 / 96);
};

export interface SvgDimensions {
	viewBox: [number, number, number, number];
	wMm: number;
	hMm: number;
}

/**
 * Resolve an SVG's physical size and viewBox from its root attributes,
 * mirroring how browsers do: explicit width/height win, a missing one follows
 * the viewBox aspect, and without any the viewBox (or 100mm) decides.
 */
export const svgDimensions = (
	viewBoxAttr: string | null,
	widthAttr: string | null,
	heightAttr: string | null
): SvgDimensions => {
	if (viewBoxAttr) {
		const vb = viewBoxAttr
			.trim()
			.split(/[\s,]+/)
			.map(Number) as [number, number, number, number];
		let wMm = widthAttr ? parseMm(widthAttr) : null;
		let hMm = heightAttr ? parseMm(heightAttr) : null;
		if (!wMm && !hMm) {
			wMm = (vb[2] * 25.4) / 96;
			hMm = (vb[3] * 25.4) / 96;
		} else if (!wMm) {
			wMm = (hMm! * vb[2]) / vb[3];
		} else if (!hMm) {
			hMm = (wMm * vb[3]) / vb[2];
		}
		return { viewBox: vb, wMm: wMm!, hMm: hMm! };
	}
	const wMm = parseMm(widthAttr) ?? 100;
	const hMm = parseMm(heightAttr) ?? 100;
	return { viewBox: [0, 0, (wMm * 96) / 25.4, (hMm * 96) / 25.4], wMm, hMm };
};
