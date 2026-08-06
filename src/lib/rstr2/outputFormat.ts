// Output format: an optional fixed page the studio composes into.
//
// Without a format the render keeps the source's aspect and the output width
// slider decides the physical size. With one active, the working frame takes
// the page's aspect (the crop view composes the input into it), the page's
// dimensions drive the physical size, and the margin becomes a mask — a band
// kept clear of ink around the drawable area. The selection is deliberately
// ephemeral: it belongs to the loaded content, like the crop itself.

import { PAGES, type Orientation, type PageId } from '../prep/pages';

export interface OutputFormatDef {
	id: string;
	/** picker label */
	label: string;
	/** portrait dimensions, mm */
	w: number;
	h: number;
}

export const CUSTOM_FORMAT_ID = 'custom';

const pageFormat = (id: PageId): OutputFormatDef => {
	const [w, h] = PAGES[id];
	return { id, label: `${id} · ${w} × ${h} mm`, w, h };
};

/** the always-visible quick toggles */
export const QUICK_FORMATS: OutputFormatDef[] = (['A6', 'A5', 'A4', 'A3'] as PageId[]).map(
	pageFormat
);

/** the rest of the catalog, offered in the "more formats" picker */
export const MORE_FORMATS: OutputFormatDef[] = [
	pageFormat('A2'),
	pageFormat('A1'),
	pageFormat('A0'),
	{ id: 'B6', label: 'B6 · 125 × 176 mm', w: 125, h: 176 },
	{ id: 'B5', label: 'B5 · 176 × 250 mm', w: 176, h: 250 },
	{ id: 'B4', label: 'B4 · 250 × 353 mm', w: 250, h: 353 },
	{ id: 'letter', label: 'US letter · 216 × 279 mm', w: 215.9, h: 279.4 },
	{ id: 'legal', label: 'US legal · 216 × 356 mm', w: 215.9, h: 355.6 },
	{ id: 'tabloid', label: 'US tabloid · 279 × 432 mm', w: 279.4, h: 431.8 },
	{ id: 'sq10', label: 'square · 10 × 10 cm', w: 100, h: 100 },
	{ id: 'sq15', label: 'square · 15 × 15 cm', w: 150, h: 150 },
	{ id: 'sq21', label: 'square · 21 × 21 cm', w: 210, h: 210 },
	{ id: 'sq30', label: 'square · 30 × 30 cm', w: 300, h: 300 },
	{ id: 'AxiV3', label: 'AxiDraw V3/A3 bed · 300 × 430 mm', w: 300, h: 430 },
	{ id: 'AxiA1', label: 'AxiDraw A1 bed · 594 × 864 mm', w: 594, h: 864 }
];

export const formatById = (id: string): OutputFormatDef | null =>
	QUICK_FORMATS.find((format) => format.id === id) ??
	MORE_FORMATS.find((format) => format.id === id) ??
	null;

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

/** custom page edges stay printable-real: 20 mm .. 2 m, tenth-mm steps */
export const sanitizeCustomMm = (value: number): number => {
	if (!isFinite(value)) return 210;
	return Math.round(clamp(value, 20, 2000) * 10) / 10;
};

/** the orientation that matches the source, mirroring the old fit-on-page rule */
export const autoOrientation = (srcW: number, srcH: number): Orientation =>
	srcH > 0 && srcW / srcH > 1.05 ? 'landscape' : 'portrait';

export interface ResolvedFormat {
	/** oriented page dimensions, mm */
	wMm: number;
	hMm: number;
	/** true for named catalog pages (they can be turned); custom is as-typed */
	orientable: boolean;
}

/**
 * Resolve a format selection to oriented page dimensions. '' (no format)
 * resolves to null; custom dimensions are taken as typed.
 */
export const resolveOutputFormat = (
	id: string,
	customW: number,
	customH: number,
	orientation: Orientation
): ResolvedFormat | null => {
	if (!id) return null;
	if (id === CUSTOM_FORMAT_ID) {
		return { wMm: sanitizeCustomMm(customW), hMm: sanitizeCustomMm(customH), orientable: false };
	}
	const def = formatById(id);
	if (!def) return null;
	const landscape = orientation === 'landscape' && def.w !== def.h;
	return {
		wMm: landscape ? def.h : def.w,
		hMm: landscape ? def.w : def.h,
		orientable: def.w !== def.h
	};
};

/** frame height in px for a frame width that spans the page width */
export const frameHeightFor = (frameW: number, format: ResolvedFormat): number =>
	Math.max(1, Math.round((frameW * format.hMm) / format.wMm));

/** the mask margin, kept below where it would swallow the whole page */
export const clampMarginMm = (marginMm: number, format: ResolvedFormat): number => {
	if (!isFinite(marginMm)) return 0;
	return clamp(marginMm, 0, Math.floor(0.45 * Math.min(format.wMm, format.hMm)));
};
