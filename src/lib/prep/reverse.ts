// Direction reversal of SVG geometry, for the "add reversed layers" export
// option: a layer plotted once forward and once reversed lays down ink twice,
// once in each drawing direction.
//
// reversePathData / reversePoints are pure string transforms (unit-tested);
// the DOM helpers at the bottom clone whole layer groups and only run in the
// browser.

interface Point {
	x: number;
	y: number;
}

type Segment =
	| { type: 'L'; end: Point }
	| { type: 'C'; c1: Point; c2: Point; end: Point }
	| { type: 'Q'; c: Point; end: Point }
	| { type: 'A'; rx: number; ry: number; rot: number; largeArc: number; sweep: number; end: Point };

interface Subpath {
	start: Point;
	segments: Segment[];
	closed: boolean;
}

const TOKENS = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)/g;

const fmt = (n: number): string => String(parseFloat(n.toFixed(4)));

/**
 * Parse path data into absolute subpaths. H/V become L, relative commands
 * become absolute, S/T get their reflected control point resolved — so the
 * reversal only has to deal with L, C, Q and A.
 */
const parsePath = (d: string): Subpath[] => {
	const tokens: (string | number)[] = [];
	for (const match of d.matchAll(TOKENS)) {
		tokens.push(match[1] ?? parseFloat(match[2]));
	}

	const subpaths: Subpath[] = [];
	let current: Subpath | null = null;
	let pos: Point = { x: 0, y: 0 };
	let startPos: Point = { x: 0, y: 0 };
	let prevCubicC2: Point | null = null;
	let prevQuadC: Point | null = null;
	let i = 0;

	const num = (): number => {
		const token = tokens[i++];
		return typeof token === 'number' ? token : NaN;
	};
	const moreNumbers = (): boolean => typeof tokens[i] === 'number';

	while (i < tokens.length) {
		const token = tokens[i];
		if (typeof token !== 'string') {
			// stray number without a command — malformed, stop parsing
			break;
		}
		i++;
		const cmd = token;
		const rel = cmd === cmd.toLowerCase();
		const type = cmd.toUpperCase();

		const push = (segment: Segment) => {
			current?.segments.push(segment);
			pos = segment.end;
		};

		do {
			let nextCubic: Point | null = null;
			let nextQuad: Point | null = null;
			switch (type) {
				case 'M': {
					const x = num() + (rel ? pos.x : 0);
					const y = num() + (rel ? pos.y : 0);
					pos = { x, y };
					startPos = pos;
					current = { start: pos, segments: [], closed: false };
					subpaths.push(current);
					// following pairs are implicit LineTos
					while (moreNumbers()) {
						const lx = num() + (rel ? pos.x : 0);
						const ly = num() + (rel ? pos.y : 0);
						push({ type: 'L', end: { x: lx, y: ly } });
					}
					break;
				}
				case 'L': {
					const x = num() + (rel ? pos.x : 0);
					const y = num() + (rel ? pos.y : 0);
					push({ type: 'L', end: { x, y } });
					break;
				}
				case 'H': {
					const x = num() + (rel ? pos.x : 0);
					push({ type: 'L', end: { x, y: pos.y } });
					break;
				}
				case 'V': {
					const y = num() + (rel ? pos.y : 0);
					push({ type: 'L', end: { x: pos.x, y } });
					break;
				}
				case 'C': {
					const c1 = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					const c2 = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					const end = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					push({ type: 'C', c1, c2, end });
					nextCubic = c2;
					break;
				}
				case 'S': {
					const c1: Point = prevCubicC2
						? { x: 2 * pos.x - prevCubicC2.x, y: 2 * pos.y - prevCubicC2.y }
						: { ...pos };
					const c2 = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					const end = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					push({ type: 'C', c1, c2, end });
					nextCubic = c2;
					break;
				}
				case 'Q': {
					const c = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					const end = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					push({ type: 'Q', c, end });
					nextQuad = c;
					break;
				}
				case 'T': {
					const c: Point = prevQuadC
						? { x: 2 * pos.x - prevQuadC.x, y: 2 * pos.y - prevQuadC.y }
						: { ...pos };
					const end = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					push({ type: 'Q', c, end });
					nextQuad = c;
					break;
				}
				case 'A': {
					const rx = num();
					const ry = num();
					const rot = num();
					const largeArc = num();
					const sweep = num();
					const end = { x: num() + (rel ? pos.x : 0), y: num() + (rel ? pos.y : 0) };
					push({ type: 'A', rx, ry, rot, largeArc, sweep, end });
					break;
				}
				case 'Z': {
					if (current) current.closed = true;
					pos = startPos;
					break;
				}
			}
			prevCubicC2 = nextCubic;
			prevQuadC = nextQuad;
		} while (type !== 'M' && type !== 'Z' && moreNumbers());
	}
	return subpaths;
};

const reverseSubpath = (subpath: Subpath): string => {
	const segments = [...subpath.segments];
	// a Z closes with an implicit line — make it explicit so it reverses too
	const last = segments.length > 0 ? segments[segments.length - 1].end : subpath.start;
	if (subpath.closed && (last.x !== subpath.start.x || last.y !== subpath.start.y)) {
		segments.push({ type: 'L', end: { x: subpath.start.x, y: subpath.start.y } });
	}
	if (segments.length === 0) return `M${fmt(subpath.start.x)} ${fmt(subpath.start.y)}`;

	const pointBefore = (index: number): Point =>
		index === 0 ? subpath.start : segments[index - 1].end;

	let d = `M${fmt(segments[segments.length - 1].end.x)} ${fmt(segments[segments.length - 1].end.y)}`;
	for (let i = segments.length - 1; i >= 0; i--) {
		const segment = segments[i];
		const to = pointBefore(i);
		switch (segment.type) {
			case 'L':
				d += `L${fmt(to.x)} ${fmt(to.y)}`;
				break;
			case 'C':
				d += `C${fmt(segment.c2.x)} ${fmt(segment.c2.y)} ${fmt(segment.c1.x)} ${fmt(segment.c1.y)} ${fmt(to.x)} ${fmt(to.y)}`;
				break;
			case 'Q':
				d += `Q${fmt(segment.c.x)} ${fmt(segment.c.y)} ${fmt(to.x)} ${fmt(to.y)}`;
				break;
			case 'A':
				d += `A${fmt(segment.rx)} ${fmt(segment.ry)} ${fmt(segment.rot)} ${segment.largeArc} ${segment.sweep ? 0 : 1} ${fmt(to.x)} ${fmt(to.y)}`;
				break;
		}
	}
	if (subpath.closed) d += 'Z';
	return d;
};

/**
 * Reverse the drawing direction of a path: every subpath runs back to front
 * (curves keep their exact shape, arcs flip their sweep) and the subpaths
 * themselves swap order too.
 */
export const reversePathData = (d: string): string =>
	parsePath(d).reverse().map(reverseSubpath).join('');

/** reverse a polyline/polygon points list */
export const reversePoints = (points: string): string => {
	const numbers = points
		.trim()
		.split(/[\s,]+/)
		.filter((token) => token !== '')
		.map(Number);
	const pairs: string[] = [];
	// odd trailing value is dropped, matching how renderers treat it
	for (let i = 0; i + 1 < numbers.length; i += 2) {
		pairs.push(`${fmt(numbers[i])},${fmt(numbers[i + 1])}`);
	}
	return pairs.reverse().join(' ');
};

// ─── DOM helpers (browser only) ──────────────────────────────────────────────

const INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';

/** reverse every drawable inside `el` (including el itself), in place */
export const reverseElementGeometry = (el: Element): void => {
	const tag = el.localName;
	if (tag === 'path') {
		const d = el.getAttribute('d');
		if (d) el.setAttribute('d', reversePathData(d));
	} else if (tag === 'line') {
		const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((a) => el.getAttribute(a));
		if (x2 !== null) el.setAttribute('x1', x2);
		else el.removeAttribute('x1');
		if (y2 !== null) el.setAttribute('y1', y2);
		else el.removeAttribute('y1');
		if (x1 !== null) el.setAttribute('x2', x1);
		else el.removeAttribute('x2');
		if (y1 !== null) el.setAttribute('y2', y1);
		else el.removeAttribute('y2');
	} else if (tag === 'polyline' || tag === 'polygon') {
		const points = el.getAttribute('points');
		if (points) el.setAttribute('points', reversePoints(points));
	} else if (tag === 'g' || tag === 'svg' || tag === 'a') {
		// reverse the plot order of the children along with their directions
		const children = Array.from(el.children);
		for (const child of children) reverseElementGeometry(child);
		for (const child of children.reverse()) el.appendChild(child);
	}
	// circles / rects / ellipses / text keep their direction — plotting them
	// twice still doubles the ink, which is the point
};

const layerLabel = (el: Element, fallback: string): string =>
	el.getAttribute('inkscape:label') ||
	el.getAttributeNS(INKSCAPE_NS, 'label') ||
	el.getAttribute('id') ||
	fallback;

const isLayerGroup = (el: Element): boolean =>
	el.localName === 'g' &&
	(el.getAttribute('inkscape:groupmode') === 'layer' ||
		el.getAttributeNS(INKSCAPE_NS, 'groupmode') === 'layer');

const NON_DRAWABLE = new Set(['defs', 'metadata', 'title', 'desc', 'style', 'namedview', 'script']);

/**
 * Duplicate each top-level layer of `root` (an <svg> element) as a
 * "<name>-reversed" layer whose geometry runs in the opposite direction, so
 * every line gets plotted twice — once in each direction. SVGs without layer
 * groups get all their drawable content mirrored into a single
 * "artwork-reversed" layer. Returns the number of layers added.
 */
export const addReversedLayers = (root: Element): number => {
	const doc = root.ownerDocument;
	if (!doc) return 0;
	const children = Array.from(root.children);
	let layers = children.filter(isLayerGroup);
	if (layers.length === 0) layers = children.filter((el) => el.localName === 'g');

	const finishClone = (clone: Element, label: string, after: Element): void => {
		clone.setAttributeNS(INKSCAPE_NS, 'inkscape:label', `${label}-reversed`);
		clone.setAttributeNS(INKSCAPE_NS, 'inkscape:groupmode', 'layer');
		if (clone.getAttribute('id')) clone.setAttribute('id', `${clone.getAttribute('id')}-reversed`);
		// duplicate ids inside the copy would be invalid; references (defs,
		// clip paths) keep pointing at the original elements
		for (const descendant of Array.from(clone.querySelectorAll('[id]'))) {
			descendant.removeAttribute('id');
		}
		reverseElementGeometry(clone);
		after.insertAdjacentElement('afterend', clone);
	};

	if (layers.length === 0) {
		const drawables = children.filter((el) => !NON_DRAWABLE.has(el.localName));
		if (drawables.length === 0) return 0;
		const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
		for (const el of drawables) group.appendChild(el.cloneNode(true));
		finishClone(group, 'artwork', drawables[drawables.length - 1]);
		return 1;
	}

	for (const [index, layer] of layers.entries()) {
		finishClone(layer.cloneNode(true) as Element, layerLabel(layer, `layer-${index + 1}`), layer);
	}
	return layers.length;
};
