import { describe, it, expect } from 'vitest';
import { cellPosition, commonBase, compareFrameNames, frameLabel, gridLayout } from './multi';
import { hersheyPathData } from './hershey';
import { outlineMarks } from './outline';
import { readZip, zipSvgEntries } from './zipRead';
import { buildZip } from '../rstr2/zip';

describe('gridLayout', () => {
	it('fits as many cells as gap and edge clearance allow', () => {
		// A3 landscape, 100+10 cells, 5 gap, 10 edge: 400/115 → 3, 277/115 → 2
		const layout = gridLayout({ pageW: 420, pageH: 297, cellW: 110, cellH: 110, gap: 5, edge: 10 });
		expect(layout.cols).toBe(3);
		expect(layout.rows).toBe(2);
		expect(layout.perPage).toBe(6);
		expect(layout.fits).toBe(true);
	});

	it('centers the grid block on the page', () => {
		const layout = gridLayout({ pageW: 420, pageH: 297, cellW: 110, cellH: 110, gap: 5, edge: 10 });
		// grid = 3×110 + 2×5 = 340 wide, 2×110 + 5 = 225 tall
		expect(layout.x0).toBeCloseTo((420 - 340) / 2);
		expect(layout.y0).toBeCloseTo((297 - 225) / 2);
	});

	it('counts an exact fit without losing a cell to float noise', () => {
		// 3 cells + 2 gaps exactly fill the usable width
		const layout = gridLayout({ pageW: 320, pageH: 200, cellW: 100, cellH: 100, gap: 0, edge: 10 });
		expect(layout.cols).toBe(3);
	});

	it('cells never overlap: pitch covers cell plus gap', () => {
		const layout = gridLayout({ pageW: 420, pageH: 297, cellW: 90, cellH: 60, gap: 4, edge: 8 });
		const a = cellPosition(layout, 0);
		const b = cellPosition(layout, 1);
		const below = cellPosition(layout, layout.cols);
		expect(b.x - a.x).toBeCloseTo(94);
		expect(below.y - a.y).toBeCloseTo(64);
	});

	it('keeps at least one (flagged) cell when a frame overflows the page', () => {
		const layout = gridLayout({ pageW: 210, pageH: 148, cellW: 300, cellH: 300, gap: 5, edge: 10 });
		expect(layout.cols).toBe(1);
		expect(layout.rows).toBe(1);
		expect(layout.fits).toBe(false);
	});

	it('respects the edge clearance', () => {
		const layout = gridLayout({ pageW: 420, pageH: 297, cellW: 110, cellH: 110, gap: 5, edge: 20 });
		expect(layout.x0).toBeGreaterThanOrEqual(20);
		const last = cellPosition(layout, layout.perPage - 1);
		expect(last.x + layout.cellW).toBeLessThanOrEqual(420 - 20 + 1e-6);
		expect(last.y + layout.cellH).toBeLessThanOrEqual(297 - 20 + 1e-6);
	});
});

describe('frame names', () => {
	it('sorts frames naturally', () => {
		const names = ['frame-10.svg', 'frame-2.svg', 'frame-1.svg'];
		expect([...names].sort(compareFrameNames)).toEqual([
			'frame-1.svg',
			'frame-2.svg',
			'frame-10.svg'
		]);
	});

	it('reads the frame number from the filename', () => {
		expect(frameLabel('frame-00042.svg', 7)).toBe('42');
		expect(frameLabel('shot12-frame-3.svg', 0)).toBe('3');
	});

	it('falls back to the 1-based position without a number', () => {
		expect(frameLabel('untitled.svg', 4)).toBe('5');
	});

	it('derives a common base name, trimming counters', () => {
		expect(commonBase(['frame-00001.svg', 'frame-00002.svg'])).toBe('frame');
		expect(commonBase(['a.svg', 'b.svg'])).toBe('frames');
		expect(commonBase([])).toBe('frames');
	});
});

describe('hersheyPathData', () => {
	it('renders digits as single-stroke paths at the requested height', () => {
		const { d, width } = hersheyPathData('42', 3);
		expect(d.startsWith('M')).toBe(true);
		expect(width).toBeCloseTo(2 * 20 * (3 / 21));
		// all y coordinates sit on or above the baseline (SVG y-down: ≤ 0)
		const ys = [...d.matchAll(/[ML][\d.-]+ (-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
		expect(ys.length).toBeGreaterThan(4);
		expect(Math.max(...ys)).toBeLessThanOrEqual(0);
		expect(Math.min(...ys)).toBeGreaterThanOrEqual(-3.001);
	});

	it('skips characters without a glyph', () => {
		expect(hersheyPathData('x', 3).d).toBe('');
		expect(hersheyPathData('x7', 3).width).toBeCloseTo(20 * (3 / 21));
	});
});

describe('outlineMarks', () => {
	const attrs = 'stroke="black"';

	it('full style is the classic rectangle', () => {
		const svg = outlineMarks(10, 20, 100, 50, 'full', attrs);
		expect(svg).toContain('<rect');
		expect(svg).toContain('x="10"');
		expect(svg).toContain('width="100"');
	});

	it('corners style draws two arms per corner, along the edges', () => {
		const svg = outlineMarks(0, 0, 100, 50, 'corners', attrs);
		expect(svg.match(/<line/g)).toHaveLength(8);
		// arms stay inside the rectangle
		const coords = [...svg.matchAll(/x2="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
		expect(Math.min(...coords)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...coords)).toBeLessThanOrEqual(100);
	});

	it('crosses style centers a cross on each corner', () => {
		const svg = outlineMarks(0, 0, 100, 50, 'crosses', attrs);
		expect(svg.match(/<line/g)).toHaveLength(8);
		// crosses reach outside the rectangle
		const xs = [...svg.matchAll(/x1="(-?[\d.]+)"/g)].map((m) => parseFloat(m[1]));
		expect(Math.min(...xs)).toBeLessThan(0);
	});
});

describe('readZip', () => {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	it('round-trips the studio zip writer', async () => {
		const zip = buildZip([
			{ name: 'svg/frame-00001.svg', data: encoder.encode('<svg>1</svg>') },
			{ name: 'svg/frame-00002.svg', data: encoder.encode('<svg>2</svg>') }
		]);
		const entries = await readZip(zip);
		expect(entries.map((entry) => entry.name)).toEqual([
			'svg/frame-00001.svg',
			'svg/frame-00002.svg'
		]);
		expect(decoder.decode(entries[1].data)).toBe('<svg>2</svg>');
	});

	it('rejects non-zip data', async () => {
		await expect(readZip(encoder.encode('not a zip at all'))).rejects.toThrow();
	});

	it('zipSvgEntries keeps root and svg/ entries, drops the rest', () => {
		const entry = (name: string) => ({ name, data: new Uint8Array() });
		const kept = zipSvgEntries([
			entry('frame-1.svg'),
			entry('svg/frame-2.svg'),
			entry('SVG/frame-3.svg'),
			entry('png/frame-1.png'),
			entry('nested/deeper/frame-4.svg'),
			entry('other/frame-5.svg'),
			entry('__MACOSX/._frame-1.svg'),
			entry('.hidden.svg')
		]);
		expect(kept.map((e) => e.name)).toEqual(['frame-1.svg', 'svg/frame-2.svg', 'SVG/frame-3.svg']);
	});
});
