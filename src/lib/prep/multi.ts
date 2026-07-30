// Multi-SVG (frame sequence) support for the plot-prep tool: grid layout
// of same-size frames across output pages, filename utilities, and the
// layer merge that keeps one Saxi-selectable layer per color across all
// frames on a page.
//
// The layout math and name helpers are pure (unit-tested); mergeFrameLayers
// works on parsed DOM elements and only runs in the browser.

import { addReversedLayers, INKSCAPE_NS, isLayerGroup, layerLabel, NON_DRAWABLE } from './reverse';

//***************************************************************
// 														GRID LAYOUT
//***************************************************************

export interface GridSpec {
	pageW: number;
	pageH: number;
	/** cell = frame + its margin on every side */
	cellW: number;
	cellH: number;
	/** extra space between adjacent cells */
	gap: number;
	/** clearance kept from the page edges */
	edge: number;
}

export interface GridLayout {
	cols: number;
	rows: number;
	perPage: number;
	/** top-left of the (centered) grid block in page mm */
	x0: number;
	y0: number;
	cellW: number;
	cellH: number;
	gap: number;
	/** false when even a single cell overflows the usable area */
	fits: boolean;
}

/**
 * Fit as many cells as possible on the page: cells never overlap, keep
 * `gap` between them and stay `edge` away from the page borders. The grid
 * block is centered; at least one cell per page is always laid out (with
 * `fits: false` when it genuinely doesn't fit).
 */
export const gridLayout = ({ pageW, pageH, cellW, cellH, gap, edge }: GridSpec): GridLayout => {
	const usableW = pageW - 2 * edge;
	const usableH = pageH - 2 * edge;
	const count = (usable: number, cell: number) =>
		Math.max(1, Math.floor((usable + gap) / (cell + gap) + 1e-9));
	const cols = count(usableW, cellW);
	const rows = count(usableH, cellH);
	const gridW = cols * cellW + (cols - 1) * gap;
	const gridH = rows * cellH + (rows - 1) * gap;
	return {
		cols,
		rows,
		perPage: cols * rows,
		x0: (pageW - gridW) / 2,
		y0: (pageH - gridH) / 2,
		cellW,
		cellH,
		gap,
		fits: cellW <= usableW + 1e-9 && cellH <= usableH + 1e-9
	};
};

/** top-left of cell `index` (row-major, 0-based within the page) */
export const cellPosition = (layout: GridLayout, index: number): { x: number; y: number } => ({
	x: layout.x0 + (index % layout.cols) * (layout.cellW + layout.gap),
	y: layout.y0 + Math.floor(index / layout.cols) * (layout.cellH + layout.gap)
});

//***************************************************************
// 														NAMES
//***************************************************************

/** natural filename order, so frame-2 sorts before frame-10 */
export const compareFrameNames = (a: string, b: string): number =>
	a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * The frame number to print next to a frame: the last digit run in the
 * filename (frame-00042.svg → "42"), or the 1-based position when the name
 * carries no number.
 */
export const frameLabel = (name: string, index: number): string => {
	const stem = name.replace(/\.[^.]*$/, '');
	const digits = stem.match(/(\d+)(?!.*\d)/)?.[1];
	return digits ? String(parseInt(digits, 10)) : String(index + 1);
};

/**
 * A shared base name for the export: the common filename prefix, trimmed
 * of trailing digits and separators (frame-00001…frame-00040 → "frame").
 */
export const commonBase = (names: string[]): string => {
	if (names.length === 0) return 'frames';
	let prefix = names[0].replace(/\.[^.]*$/, '');
	for (const name of names.slice(1)) {
		const stem = name.replace(/\.[^.]*$/, '');
		while (prefix && !stem.startsWith(prefix)) prefix = prefix.slice(0, -1);
	}
	prefix = prefix.replace(/[\s\-_.0-9]+$/, '');
	return prefix || 'frames';
};

//***************************************************************
// 												LAYER MERGE (browser only)
//***************************************************************

export interface PlacedFrame {
	/** parsed <svg> root of the frame */
	root: Element;
	viewBox: [number, number, number, number];
	wMm: number;
	hMm: number;
	/** artwork top-left on the page, mm */
	x: number;
	y: number;
}

export interface MergedLayer {
	label: string;
	/** the frames' contributions to this layer, concatenated markup */
	content: string;
}

const fmt = (n: number) => String(parseFloat(n.toFixed(6)));

/**
 * Combine the frames of one page into per-label layers: every frame's
 * "CYAN" layer lands in one output "CYAN" layer, so pen/layer selection in
 * Saxi or Inkscape stays as simple as for a single SVG. Frames without
 * layer groups contribute to a shared "artwork" layer. Layer order follows
 * first appearance; ids are stripped (they'd collide across frames).
 */
export const mergeFrameLayers = (
	frames: PlacedFrame[],
	options: { addReversed?: boolean } = {}
): MergedLayer[] => {
	const serializer = new XMLSerializer();
	const merged = new Map<string, string[]>();
	const push = (label: string, markup: string) => {
		const parts = merged.get(label);
		if (parts) parts.push(markup);
		else merged.set(label, [markup]);
	};

	for (const frame of frames) {
		const clone = frame.root.cloneNode(true) as Element;
		if (options.addReversed) addReversedLayers(clone);
		for (const el of Array.from(clone.querySelectorAll('[id]'))) el.removeAttribute('id');
		clone.removeAttribute('id');

		const [vx, vy, vw, vh] = frame.viewBox;
		const sx = frame.wMm / (vw || 1);
		const sy = frame.hMm / (vh || 1);
		const place = `translate(${fmt(frame.x - vx * sx)},${fmt(frame.y - vy * sy)}) scale(${fmt(sx)},${fmt(sy)})`;

		const children = Array.from(clone.children);
		const layers = children.filter(isLayerGroup);
		if (layers.length === 0) {
			const drawables = children.filter((el) => !NON_DRAWABLE.has(el.localName));
			if (drawables.length === 0) continue;
			const markup = drawables.map((el) => serializer.serializeToString(el)).join('');
			push('artwork', `<g transform="${place}">${markup}</g>`);
			continue;
		}
		for (const [index, layer] of layers.entries()) {
			const label = layerLabel(layer, `layer-${index + 1}`);
			// the merged output group carries the layer identity — strip it here
			layer.removeAttribute('inkscape:label');
			layer.removeAttributeNS(INKSCAPE_NS, 'label');
			layer.removeAttribute('inkscape:groupmode');
			layer.removeAttributeNS(INKSCAPE_NS, 'groupmode');
			const own = layer.getAttribute('transform');
			layer.setAttribute('transform', own ? `${place} ${own}` : place);
			push(label, serializer.serializeToString(layer));
		}
	}

	return Array.from(merged.entries()).map(([label, parts]) => ({
		label,
		content: parts.join('\n')
	}));
};
