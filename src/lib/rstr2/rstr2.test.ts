import { describe, it, expect } from 'vitest';
import { computeCellGrid } from './grid';
import { segmentGrid } from './segmentation';
import { buildRegionGeometries } from './regionTools';
import { hatchPolygon, spacingForInk, segmentsToSvgPath } from './hatchTools';
import { adjustColors, isNeutralAdjustment } from './imageAdjust';
import {
	extractChannel,
	defaultCmyLayers,
	defaultClassicLayers,
	parseStoredLayers
} from './layers';
import { defaultParams, parseStoredParams } from './params';
import {
	builtinPresets,
	parseSettingsFile,
	parseStoredPresets,
	serializeSettings
} from './presets';
import { buildSvgDocument } from './svgExport';
import {
	defaultVideoConfig,
	exportFrameRange,
	frameTime,
	parseStoredVideoConfig,
	sanitizeVideoConfig,
	totalFrameCount
} from './video';
import { buildZip, crc32 } from './zip';

const neutral = { brightness: 0, contrast: 0, gamma: 1, saturation: 1, vibrance: 0 };

describe('computeCellGrid', () => {
	it('averages pixels into cells', () => {
		// 2x2 image: white, black / black, white -> single 50% grey cell
		const px = new Uint8ClampedArray([
			255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255
		]);
		const grid = computeCellGrid(px, 2, 2, 1);
		expect(grid.cols).toBe(1);
		expect(grid.rows).toBe(1);
		expect(grid.r[0]).toBeCloseTo(0.5);
		expect(grid.g[0]).toBeCloseTo(0.5);
		expect(grid.b[0]).toBeCloseTo(0.5);
	});

	it('keeps cells square-ish for non-square images', () => {
		const px = new Uint8ClampedArray(8 * 4 * 4).fill(128);
		const grid = computeCellGrid(px, 8, 4, 4);
		expect(grid.cols).toBe(4);
		expect(grid.rows).toBe(2);
		expect(grid.cellW).toBeCloseTo(grid.cellH);
	});
});

describe('segmentGrid', () => {
	const twoHalves = (w: number, h: number): Float32Array => {
		const values = new Float32Array(w * h);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				values[y * w + x] = x < w / 2 ? 0.1 : 0.9;
			}
		}
		return values;
	};

	it.each(['watershed', 'posterize', 'kmeans', 'slic'] as const)(
		'%s splits a two-tone grid into two regions',
		(algorithm) => {
			const w = 16;
			const h = 16;
			const seg = segmentGrid(twoHalves(w, h), w, h, {
				algorithm,
				tolerance: 0.2,
				smoothing: 0,
				minRegionSize: 1
			});
			expect(seg.regionCount).toBe(2);
			const means = Array.from(seg.regionMean).sort((a, b) => a - b);
			expect(means[0]).toBeLessThan(0.3);
			expect(means[1]).toBeGreaterThan(0.7);
			// every cell is labeled and sizes add up
			const total = Array.from(seg.regionSize).reduce((a, b) => a + b, 0);
			expect(total).toBe(w * h);
		}
	);

	it('merges everything on a flat grid', () => {
		const values = new Float32Array(64).fill(0.5);
		const seg = segmentGrid(values, 8, 8, {
			algorithm: 'watershed',
			tolerance: 0.1,
			smoothing: 0,
			minRegionSize: 1
		});
		expect(seg.regionCount).toBe(1);
		expect(seg.regionMean[0]).toBeCloseTo(0.5);
	});

	it('slic tiles a gradient into roughly cell-size superpixels', () => {
		const w = 32;
		const h = 32;
		const values = new Float32Array(w * h);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				values[y * w + x] = (x + y) / (w + h - 2);
			}
		}
		const seg = segmentGrid(values, w, h, {
			algorithm: 'slic',
			tolerance: 0,
			smoothing: 0,
			minRegionSize: 1,
			slicCellSize: 8,
			slicCompactness: 0.9
		});
		// a 32x32 grid at cell size 8 seeds a 4x4 superpixel lattice
		expect(seg.regionCount).toBeGreaterThanOrEqual(12);
		expect(seg.regionCount).toBeLessThanOrEqual(24);
		const total = Array.from(seg.regionSize).reduce((a, b) => a + b, 0);
		expect(total).toBe(w * h);
	});

	it('slic cell size controls the superpixel count', () => {
		const w = 32;
		const h = 32;
		const values = new Float32Array(w * h);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				values[y * w + x] = (x + y) / (w + h - 2);
			}
		}
		const options = {
			algorithm: 'slic' as const,
			tolerance: 0,
			smoothing: 0,
			minRegionSize: 1,
			slicCompactness: 0.9
		};
		const fine = segmentGrid(values, w, h, { ...options, slicCellSize: 4 });
		const coarse = segmentGrid(values, w, h, { ...options, slicCellSize: 16 });
		expect(fine.regionCount).toBeGreaterThan(coarse.regionCount);
	});

	it('absorbs regions below the minimum size', () => {
		// single bright cell in a dark field, zero tolerance so it survives
		// merging but falls to minRegionSize
		const values = new Float32Array(64).fill(0.1);
		values[27] = 0.9;
		const seg = segmentGrid(values, 8, 8, {
			algorithm: 'posterize',
			tolerance: 0.3,
			smoothing: 0,
			minRegionSize: 4
		});
		expect(seg.regionCount).toBe(1);
	});
});

describe('buildRegionGeometries', () => {
	it('traces a full-grid region as one rectangle loop', () => {
		const labels = new Int32Array(12).fill(0);
		const [geometry] = buildRegionGeometries(labels, 1, 4, 3, 10, 10);
		expect(geometry.loops).toHaveLength(1);
		expect(geometry.loops[0]).toHaveLength(8); // 4 corners
		expect(geometry.minX).toBe(0);
		expect(geometry.minY).toBe(0);
		expect(geometry.maxX).toBe(40);
		expect(geometry.maxY).toBe(30);
		expect(geometry.d.startsWith('M')).toBe(true);
		expect(geometry.d.endsWith('Z')).toBe(true);
	});

	it('emits a hole loop for an enclosed region', () => {
		// 3x3 grid, center cell is region 1, ring is region 0
		const labels = new Int32Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
		const geometries = buildRegionGeometries(labels, 2, 3, 3, 1, 1);
		const ring = geometries[0];
		expect(ring.loops).toHaveLength(2); // outer boundary + hole
	});
});

describe('hatchPolygon', () => {
	const square = [new Float64Array([0, 0, 100, 0, 100, 100, 0, 100])];

	it('fills a square with horizontal lines at the requested spacing', () => {
		const segments = hatchPolygon(square, 0, 10, 0);
		expect(segments.length / 4).toBe(10);
		for (let k = 0; k < segments.length; k += 4) {
			// horizontal: y1 === y2, spanning the full width
			expect(segments[k + 1]).toBeCloseTo(segments[k + 3]);
			expect(Math.abs(segments[k + 2] - segments[k])).toBeCloseTo(100);
		}
	});

	it('keeps segments inside the polygon bounds for angled hatching', () => {
		const segments = hatchPolygon(square, 37, 8, 1);
		expect(segments.length).toBeGreaterThan(0);
		for (let k = 0; k < segments.length; k += 2) {
			expect(segments[k]).toBeGreaterThanOrEqual(-1e-6);
			expect(segments[k]).toBeLessThanOrEqual(100 + 1e-6);
		}
	});

	it('returns nothing for degenerate input', () => {
		expect(hatchPolygon([], 0, 10, 0)).toHaveLength(0);
		expect(hatchPolygon(square, 0, 0, 0)).toHaveLength(0);
	});
});

describe('spacingForInk', () => {
	const options = { curve: 'coverage' as const, gamma: 1, inkBoost: 1 };

	it('matches coverage: spacing = penWidth / ink', () => {
		expect(spacingForInk(0.5, 2, 0.1, 100, options)).toBeCloseTo(4);
	});

	it('clamps to the nominal bounds', () => {
		expect(spacingForInk(1, 2, 3, 10, options)).toBe(3);
		expect(spacingForInk(0.001, 2, 3, 10, options)).toBe(10);
	});

	it('interpolates the linear curve between max and min', () => {
		const linear = { curve: 'linear' as const, gamma: 1, inkBoost: 1 };
		expect(spacingForInk(0, 1, 2, 10, linear)).toBeCloseTo(10);
		expect(spacingForInk(1, 1, 2, 10, linear)).toBeCloseTo(2);
		expect(spacingForInk(0.5, 1, 2, 10, linear)).toBeCloseTo(6);
	});
});

describe('segmentsToSvgPath', () => {
	it('emits one M/L pair per segment', () => {
		expect(segmentsToSvgPath([0, 1, 2, 3, 4, 5, 6, 7])).toBe('M0 1L2 3M4 5L6 7');
	});
});

describe('adjustColors', () => {
	it('neutral adjustment is detected and preserves values', () => {
		expect(isNeutralAdjustment(neutral)).toBe(true);
		const r = new Float32Array([0.25, 0.5]);
		const g = new Float32Array([0.5, 0.75]);
		const b = new Float32Array([0.75, 1]);
		const out = adjustColors(r, g, b, neutral);
		expect(Array.from(out.r)).toEqual(Array.from(r));
		expect(Array.from(out.g)).toEqual(Array.from(g));
		expect(Array.from(out.b)).toEqual(Array.from(b));
	});

	it('brightness shifts and clamps', () => {
		const out = adjustColors(
			new Float32Array([0.5, 0.9]),
			new Float32Array([0.5, 0.9]),
			new Float32Array([0.5, 0.9]),
			{ ...neutral, brightness: 0.2 }
		);
		expect(out.r[0]).toBeCloseTo(0.7);
		expect(out.r[1]).toBeCloseTo(1);
	});

	it('saturation 0 collapses to greyscale', () => {
		const out = adjustColors(new Float32Array([1]), new Float32Array([0]), new Float32Array([0]), {
			...neutral,
			saturation: 0
		});
		expect(out.r[0]).toBeCloseTo(out.g[0]);
		expect(out.g[0]).toBeCloseTo(out.b[0]);
	});
});

describe('extractChannel', () => {
	const r = new Float32Array([1, 0]);
	const g = new Float32Array([0.5, 0.5]);
	const b = new Float32Array([0, 1]);

	it('derives CMY as complements of RGB', () => {
		expect(Array.from(extractChannel(r, g, b, 'c'))).toEqual([0, 1]);
		expect(Array.from(extractChannel(r, g, b, 'm'))).toEqual([0.5, 0.5]);
		expect(Array.from(extractChannel(r, g, b, 'y'))).toEqual([1, 0]);
	});

	it('key is darkness of the brightest component', () => {
		expect(Array.from(extractChannel(r, g, b, 'k'))).toEqual([0, 0]);
		const dark = extractChannel(
			new Float32Array([0.2]),
			new Float32Array([0.1]),
			new Float32Array([0]),
			'k'
		);
		expect(dark[0]).toBeCloseTo(0.8);
	});
});

describe('layer persistence', () => {
	it('round-trips the default CMY stack', () => {
		const layers = defaultCmyLayers();
		expect(parseStoredLayers(JSON.stringify(layers))).toEqual(layers);
	});

	it('rejects garbage', () => {
		expect(parseStoredLayers(null)).toBeNull();
		expect(parseStoredLayers('not json')).toBeNull();
		expect(parseStoredLayers('[]')).toBeNull();
		expect(parseStoredLayers('[{"id": 1}]')).toBeNull();
	});

	it('migrates a legacy single angle to a range', () => {
		const legacy = defaultCmyLayers().map((layer) => {
			const l: Record<string, unknown> = { ...layer, angle: 45 };
			delete l.angleMin;
			delete l.angleMax;
			return l;
		});
		const parsed = parseStoredLayers(JSON.stringify(legacy));
		expect(parsed).not.toBeNull();
		expect(parsed![0].angleMin).toBe(45);
		expect(parsed![0].angleMax).toBe(45);
	});
});

describe('param persistence', () => {
	it('merges stored values over defaults and drops junk', () => {
		const params = parseStoredParams(
			JSON.stringify({ resolution: 128, algorithm: 'kmeans', bogus: true, tolerance: 'high' })
		);
		expect(params.resolution).toBe(128);
		expect(params.algorithm).toBe('kmeans');
		expect(params.tolerance).toBe(defaultParams().tolerance);
		expect('bogus' in params).toBe(false);
	});

	it('accepts slic and its parameters', () => {
		const params = parseStoredParams(
			JSON.stringify({ algorithm: 'slic', slicCellSize: 12, slicCompactness: 0.25 })
		);
		expect(params.algorithm).toBe('slic');
		expect(params.slicCellSize).toBe(12);
		expect(params.slicCompactness).toBe(0.25);
		// settings saved before slic existed fall back to the defaults
		const legacy = parseStoredParams(JSON.stringify({ algorithm: 'watershed' }));
		expect(legacy.slicCellSize).toBe(defaultParams().slicCellSize);
		expect(legacy.slicCompactness).toBe(defaultParams().slicCompactness);
	});

	it('falls back to defaults on corrupt storage', () => {
		expect(parseStoredParams('{{{')).toEqual(defaultParams());
		expect(parseStoredParams(null)).toEqual(defaultParams());
	});
});

describe('settings presets', () => {
	it('ships the four built-in presets', () => {
		const names = builtinPresets().map((preset) => preset.name);
		expect(names).toEqual(['CMY classic', 'CMY space', 'Black classic', 'Black thin']);
		const black = builtinPresets().find((preset) => preset.name === 'Black classic')!.settings;
		expect(black.layers).toEqual(defaultClassicLayers());
		expect(black.layers).toHaveLength(1);
		expect(black.layers[0].channel).toBe('luma-inv');
		const cmy = builtinPresets().find((preset) => preset.name === 'CMY space')!.settings;
		expect(cmy.layers).toEqual(defaultCmyLayers());
	});

	it('round-trips settings through the JSON file format', () => {
		const settings = {
			params: { ...defaultParams(), resolution: 128 },
			layers: defaultCmyLayers()
		};
		const parsed = parseSettingsFile(serializeSettings(settings));
		expect(parsed).toEqual(settings);
	});

	it('rejects files without a usable layer stack', () => {
		expect(parseSettingsFile('not json')).toBeNull();
		expect(parseSettingsFile('{}')).toBeNull();
		expect(parseSettingsFile(JSON.stringify({ params: defaultParams(), layers: [] }))).toBeNull();
		expect(parseSettingsFile(JSON.stringify({ layers: [{ id: 1 }] }))).toBeNull();
	});

	it('fills missing or junk params with defaults', () => {
		const parsed = parseSettingsFile(
			JSON.stringify({ params: { resolution: 64, algorithm: 'bogus' }, layers: defaultCmyLayers() })
		);
		expect(parsed).not.toBeNull();
		expect(parsed!.params.resolution).toBe(64);
		expect(parsed!.params.algorithm).toBe(defaultParams().algorithm);
		expect(parsed!.params.penWidthMm).toBe(defaultParams().penWidthMm);
	});

	it('parses stored user presets and drops broken entries', () => {
		const good = { name: 'my preset', settings: builtinPresets()[0].settings };
		const stored = JSON.stringify([
			good,
			{ name: '', settings: good.settings },
			{ name: 'broken', settings: { params: {}, layers: 'nope' } },
			'garbage'
		]);
		expect(parseStoredPresets(stored)).toEqual([good]);
		expect(parseStoredPresets(null)).toEqual([]);
		expect(parseStoredPresets('{{{')).toEqual([]);
	});
});

describe('buildSvgDocument', () => {
	it('produces a standalone document with one group per layer', () => {
		const [cyan, magenta] = defaultCmyLayers();
		const svg = buildSvgDocument(
			[
				{ layer: cyan, penWidthPx: 2, segments: [[0, 0, 10, 10]] },
				{ layer: magenta, penWidthPx: 2, segments: [] }
			],
			1000,
			500,
			200
		);
		expect(svg).toContain('width="200.00mm"');
		expect(svg).toContain('height="100.00mm"');
		expect(svg).toContain('viewBox="0 0 1000 500"');
		expect(svg).toContain('id="hatch-cyan"');
		expect(svg).toContain('id="hatch-magenta"');
		expect(svg).toContain('<path d="M0 0L10 10" />');
		expect(svg).toContain(`stroke="${cyan.color}"`);
	});
});

describe('video frame math', () => {
	it('counts output frames from duration and fps', () => {
		expect(totalFrameCount(10, 12)).toBe(120);
		expect(totalFrameCount(0.02, 12)).toBe(1); // shorter than one slot still yields a frame
		expect(totalFrameCount(0, 12)).toBe(0);
		expect(totalFrameCount(NaN, 12)).toBe(0);
	});

	it('samples frames at slot midpoints, clamped inside the video', () => {
		expect(frameTime(0, 10, 5)).toBeCloseTo(0.05);
		expect(frameTime(9, 10, 5)).toBeCloseTo(0.95);
		// last frame of a 1s/1fps video would land at 0.5 — inside the video
		expect(frameTime(0, 1, 1)).toBeCloseTo(0.5);
		// a frame index past the end clamps just before the duration
		expect(frameTime(999, 10, 5)).toBeCloseTo(4.999);
	});

	it('resolves the export range against the actual duration', () => {
		const config = { ...defaultVideoConfig(), fps: 10, startFrame: 20, maxFrames: 50 };
		expect(exportFrameRange(10, config)).toEqual({ start: 20, count: 50, total: 100 });
		// cap larger than what is left after the offset
		expect(exportFrameRange(4, config)).toEqual({ start: 20, count: 20, total: 40 });
		// offset beyond the video clamps to the last frame
		expect(exportFrameRange(1.5, config)).toEqual({ start: 14, count: 1, total: 15 });
		expect(exportFrameRange(0, config)).toEqual({ start: 0, count: 0, total: 0 });
	});

	it('sanitizes stored config and falls back on garbage', () => {
		const stored = JSON.stringify({
			fps: 24,
			startFrame: -5,
			maxFrames: 1e9,
			rasterFormat: 'gif',
			rasterQuality: 7,
			exportRaster: true
		});
		const config = parseStoredVideoConfig(stored);
		expect(config.fps).toBe(24);
		expect(config.startFrame).toBe(0);
		expect(config.maxFrames).toBe(2000);
		expect(config.rasterFormat).toBe('png');
		expect(config.rasterQuality).toBe(1);
		expect(config.exportRaster).toBe(true);
		expect(config.exportSvg).toBe(defaultVideoConfig().exportSvg);
		expect(parseStoredVideoConfig(null)).toEqual(defaultVideoConfig());
		expect(parseStoredVideoConfig('{{{')).toEqual(defaultVideoConfig());
		expect(sanitizeVideoConfig(42)).toEqual(defaultVideoConfig());
	});
});

describe('zip writer', () => {
	it('computes the reference CRC-32 of "123456789"', () => {
		const data = new TextEncoder().encode('123456789');
		expect(crc32(data)).toBe(0xcbf43926);
	});

	it('assembles a well-formed stored archive', () => {
		const a = new TextEncoder().encode('hello');
		const b = new Uint8Array([1, 2, 3, 4]);
		const zip = buildZip(
			[
				{ name: 'svg/a.svg', data: a },
				{ name: 'png/b.png', data: b }
			],
			new Date(2026, 0, 2, 3, 4, 6)
		);
		const view = new DataView(zip.buffer);
		// local header of the first entry
		expect(view.getUint32(0, true)).toBe(0x04034b50);
		expect(view.getUint16(8, true)).toBe(0); // stored
		expect(view.getUint32(18, true)).toBe(a.length);
		expect(new TextDecoder().decode(zip.slice(30, 30 + 9))).toBe('svg/a.svg');
		// end of central directory record sits at the very end
		const eocd = zip.length - 22;
		expect(view.getUint32(eocd, true)).toBe(0x06054b50);
		expect(view.getUint16(eocd + 10, true)).toBe(2); // entry count
		const centralSize = view.getUint32(eocd + 12, true);
		const centralOffset = view.getUint32(eocd + 16, true);
		expect(centralOffset + centralSize).toBe(eocd);
		// central directory points back at both local headers
		expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
		expect(view.getUint32(centralOffset + 42, true)).toBe(0);
		const second = centralOffset + 46 + 9;
		expect(view.getUint32(second, true)).toBe(0x02014b50);
		expect(view.getUint32(second + 42, true)).toBe(30 + 9 + a.length);
	});
});
