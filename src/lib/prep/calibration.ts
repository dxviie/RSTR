// Calibration marker block for the plot-prep tool, ported from
// tools/plot-prep. Layout (local mm coordinates):
//
//  ┌─────────────────────────────┐
//  │ CALIBRATION · P1=ref        │
//  │      [verify circle ø8]     │  ← cal-circle layer (single, shared)
//  │         ΔY│                 │  ← cal-rulers layer
//  │    ── ── ─┤   ← H-lines     │  ← cal-pen-N layers
//  │    ΔX ────┼──────           │
//  │           │  │  │ ← V-lines │
//  │          P1 P2 P3           │
//  └─────────────────────────────┘
//  + cal-half layer: all markers at half length (closest to the rulers)
//  + optional 90° rotation (swaps to a wide horizontal block)
//
// Exported markers are black on separate Inkscape layers; the preview gets
// colors that read on the white page of the light UI.

/** preview colors of the calibration pens (readable on white paper) */
export const PREVIEW_PEN_COLORS = [
	'#FF2AA6',
	'#FFB000',
	'#00BFE8',
	'#7C4DFF',
	'#00C853',
	'#FF6D00',
	'#D50000',
	'#00838F'
];

export interface CalibrationOptions {
	pageW: number;
	pageH: number;
	penCount: number;
	/** true: black strokes + Inkscape layer groups; false: preview colors */
	forExport: boolean;
	/** rotate the whole block 90° (wide instead of tall) */
	rotated: boolean;
	/** top-left position in page mm — null puts it in the top-right corner */
	x: number | null;
	y: number | null;
}

export interface CalibrationBlock {
	svg: string;
	/** bounding box in page coordinates, for the drag handle */
	bx: number;
	by: number;
	bw: number;
	bh: number;
}

export const buildCalibrationBlock = (options: CalibrationOptions): CalibrationBlock => {
	const { pageW, penCount, forExport, rotated } = options;

	// ── constants ──────────────────────────────────────────────────────
	const rulerR = 10; // ruler ±10 mm
	const penPitch = 3; // mm between adjacent pen lines
	const lineLen = 5; // total cal line length (mm)
	const circR = 4; // verification circle radius (diameter = 8mm)
	const ipad = 3; // inner padding from bbox edge to content
	const headerH = 5; // header text row height
	const circGap = 6; // gap: circle bottom → Y-ruler top
	const labelW = 7; // width for Y-ruler tick labels
	const tickMaj = 2.2; // major tick protrusion
	const tickMin = 0.9;
	const lineGap = 2; // gap: ruler baseline → nearest end of cal line
	const vGap = 7; // vert gap: Y-ruler bottom → X-ruler

	const sw = (v: number) => (forExport ? v : v * 1.5);
	const col = (p: number) =>
		forExport ? 'black' : PREVIEW_PEN_COLORS[p % PREVIEW_PEN_COLORS.length];
	const dim = forExport ? 'black' : '#60739f';
	const dim2 = forExport ? 'black' : '#93a1bd';
	const circCol = forExport ? 'black' : '#00838F';

	// ── horizontal layout (local x) ────────────────────────────────────
	const yRulerX = ipad + labelW + tickMaj;
	const hX1 = yRulerX + lineGap;
	const hX2 = hX1 + lineLen;
	const hXhalf = hX1 + lineLen * 0.5;
	const xRulerX0 = yRulerX;
	const circCX = yRulerX;

	// ── vertical layout (local y) ──────────────────────────────────────
	const circCY = ipad + headerH + circR;
	const yRulerTop = circCY + circR + circGap;
	const hY0 = yRulerTop + rulerR;
	const xRulerY = hY0 + rulerR + vGap;
	const vY1 = xRulerY + lineGap;
	const vY2 = vY1 + lineLen;
	const vYhalf = vY1 + lineLen * 0.5;

	// pen line positions, symmetric around the reference
	const hY = (p: number) => hY0 + (p - (penCount - 1) / 2) * penPitch;
	const vX = (p: number) => xRulerX0 + (p - (penCount - 1) / 2) * penPitch;

	// ── bounding box (local) ───────────────────────────────────────────
	const bwLoc = Math.max(hX2 + 6, xRulerX0 + rulerR + 2);
	const bhLoc = vY2 + 4 + ipad;

	// ── page-space placement ───────────────────────────────────────────
	const effectW = rotated ? bhLoc : bwLoc;
	const effectH = rotated ? bwLoc : bhLoc;
	const M = 8;
	const tx = options.x ?? pageW - M - effectW;
	const ty = options.y ?? M;

	const rotT = rotated ? ` translate(0,${bwLoc}) rotate(-90)` : '';
	const T = `translate(${tx},${ty})${rotT}`;

	let g = forExport
		? `<g inkscape:label="calibration" inkscape:groupmode="layer" id="layer-calibration" transform="${T}">`
		: `<g transform="${T}">`;

	// bounding box outline (preview only)
	if (!forExport) {
		g += `<rect x="0" y="0" width="${bwLoc}" height="${bhLoc}"
      fill="rgba(96,115,159,0.05)" stroke="#cbd3e1" stroke-width="0.4" stroke-dasharray="2 1.5"/>`;
	}

	// header
	g += `<text x="${ipad}" y="${ipad + 3}" font-size="2" font-family="monospace"
    fill="${dim}" opacity="0.6">CALIBRATION · P1=ref</text>`;

	// ── circle layer (single shared verify circle) ─────────────────────
	g += forExport
		? `<g inkscape:label="cal-circle" inkscape:groupmode="layer" id="cal-circle">`
		: `<g>`;
	const circLw = sw(0.35);
	const cch = sw(1.0);
	g += `<circle cx="${circCX}" cy="${circCY}" r="${circR}"
    fill="none" stroke="${circCol}" stroke-width="${circLw}"/>`;
	g += `<line x1="${circCX - cch}" y1="${circCY}" x2="${circCX + cch}" y2="${circCY}"
    stroke="${circCol}" stroke-width="${sw(0.18)}"/>`;
	g += `<line x1="${circCX}" y1="${circCY - cch}" x2="${circCX}" y2="${circCY + cch}"
    stroke="${circCol}" stroke-width="${sw(0.18)}"/>`;
	g += `<text x="${circCX}" y="${circCY - circR - 1.5}" font-size="1.6"
    text-anchor="middle" font-family="monospace" fill="${dim}" opacity="0.55">verify</text>`;
	g += `<text x="${circCX}" y="${circCY + circR + 2.8}" font-size="1.6"
    text-anchor="middle" font-family="monospace" fill="${dim}" opacity="0.55">ø${circR * 2}mm</text>`;
	g += `</g>`;

	// ── rulers layer (shared reference, plot on every pen swap) ────────
	g += forExport
		? `<g inkscape:label="cal-rulers" inkscape:groupmode="layer" id="cal-rulers">`
		: `<g>`;

	// Y-ruler: vertical line; ticks and labels left
	g += `<line x1="${yRulerX}" y1="${hY0 - rulerR}" x2="${yRulerX}" y2="${hY0 + rulerR}"
    stroke="${dim}" stroke-width="${sw(0.18)}"/>`;
	for (let i = -rulerR; i <= rulerR; i++) {
		const maj = i % 5 === 0;
		const tl = maj ? tickMaj : tickMin;
		const tc = maj ? dim : dim2;
		g += `<line x1="${yRulerX - tl}" y1="${hY0 + i}" x2="${yRulerX}" y2="${hY0 + i}"
      stroke="${tc}" stroke-width="${sw(maj ? 0.18 : 0.1)}"/>`;
		if (maj) {
			const lbl = i === 0 ? '0' : i > 0 ? `+${i}` : `${i}`;
			g += `<text x="${yRulerX - tl - 0.8}" y="${hY0 + i + 0.65}" font-size="1.8"
        text-anchor="end" font-family="monospace" fill="${tc}">${lbl}</text>`;
		}
	}
	g += `<text x="${yRulerX}" y="${hY0 - rulerR - 1.5}" font-size="1.6"
    text-anchor="middle" font-family="monospace" fill="${dim}" opacity="0.6">ΔY</text>`;

	// X-ruler: horizontal line; ticks up, labels above
	g += `<line x1="${xRulerX0 - rulerR}" y1="${xRulerY}" x2="${xRulerX0 + rulerR}" y2="${xRulerY}"
    stroke="${dim}" stroke-width="${sw(0.18)}"/>`;
	for (let i = -rulerR; i <= rulerR; i++) {
		const maj = i % 5 === 0;
		const tl = maj ? tickMaj : tickMin;
		const tc = maj ? dim : dim2;
		g += `<line x1="${xRulerX0 + i}" y1="${xRulerY - tl}" x2="${xRulerX0 + i}" y2="${xRulerY}"
      stroke="${tc}" stroke-width="${sw(maj ? 0.18 : 0.1)}"/>`;
		if (maj) {
			const lbl = i === 0 ? '0' : i > 0 ? `+${i}` : `${i}`;
			g += `<text x="${xRulerX0 + i}" y="${xRulerY - tl - 0.7}" font-size="1.8"
        text-anchor="middle" font-family="monospace" fill="${tc}">${lbl}</text>`;
		}
	}
	g += `<text x="${xRulerX0 - rulerR - 1}" y="${xRulerY - 0.4}" font-size="1.6"
    text-anchor="end" font-family="monospace" fill="${dim}" opacity="0.6">ΔX</text>`;
	g += `</g>`;

	// ── per-pen layers (full-length markers) ───────────────────────────
	for (let p = 0; p < penCount; p++) {
		const c = col(p);
		const lw = sw(0.35);
		g += forExport
			? `<g inkscape:label="cal-pen-${p + 1}" inkscape:groupmode="layer" id="cal-pen-${p + 1}">`
			: `<g>`;
		const hy = hY(p);
		g += `<line x1="${hX1}" y1="${hy}" x2="${hX2}" y2="${hy}"
      stroke="${c}" stroke-width="${lw}"/>`;
		g += `<text x="${hX2 + 1.2}" y="${hy + 0.65}" font-size="1.9"
      font-family="monospace" fill="${c}">P${p + 1}</text>`;
		const vx = vX(p);
		g += `<line x1="${vx}" y1="${vY1}" x2="${vx}" y2="${vY2}"
      stroke="${c}" stroke-width="${lw}"/>`;
		g += `<text x="${vx}" y="${vY2 + 3.2}" font-size="1.9"
      text-anchor="middle" font-family="monospace" fill="${c}">P${p + 1}</text>`;
		g += `</g>`;
	}

	// ── half-size markers layer (quick single-pen alignment sweep) ─────
	g += forExport
		? `<g inkscape:label="cal-half" inkscape:groupmode="layer" id="cal-half">`
		: `<g opacity="0.5">`;
	for (let p = 0; p < penCount; p++) {
		const c = col(p);
		const lw = sw(0.35);
		const hy = hY(p);
		const vx = vX(p);
		g += `<line x1="${hX1}" y1="${hy}" x2="${hXhalf}" y2="${hy}"
      stroke="${c}" stroke-width="${lw}"/>`;
		g += `<line x1="${vx}" y1="${vY1}" x2="${vx}" y2="${vYhalf}"
      stroke="${c}" stroke-width="${lw}"/>`;
	}
	g += `</g>`;

	g += `</g>`;
	return { svg: g, bx: tx, by: ty, bw: effectW, bh: effectH };
};
