import { describe, it, expect } from 'vitest';
import {
	buildPenPaths,
	defaultPlotterConfig,
	estimateLayerPlotTime,
	formatPlotTime,
	parseStoredPlotterConfig,
	pathDuration,
	sanitizePlotterConfig
} from './plotTime';

const penDown = { acceleration: 200, maximumVelocity: 50, corneringFactor: 0.127 };

describe('pathDuration', () => {
	it('matches the analytic trapezoid for a long straight line', () => {
		// 100mm at a=200mm/s², vmax=50mm/s: accelerate 0.25s over 6.25mm,
		// cruise 87.5mm at 50mm/s (1.75s), decelerate 0.25s -> 2.25s
		const t = pathDuration(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 }
			],
			penDown
		);
		expect(t).toBeCloseTo(2.25, 6);
	});

	it('matches the analytic triangle for a short line', () => {
		// too short to reach vmax: t = 2 * sqrt(d / a)
		const t = pathDuration(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 0 }
			],
			penDown
		);
		expect(t).toBeCloseTo(2 * Math.sqrt(10 / 200), 6);
	});

	it('slows down for corners', () => {
		const straight = pathDuration(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 }
			],
			penDown
		);
		const cornered = pathDuration(
			[
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 50, y: 50 }
			],
			penDown
		);
		expect(cornered).toBeGreaterThan(straight);
	});

	it('handles duplicate and single points', () => {
		expect(
			pathDuration(
				[
					{ x: 3, y: 4 },
					{ x: 3, y: 4 }
				],
				penDown
			)
		).toBe(0);
		expect(pathDuration([{ x: 3, y: 4 }], penDown)).toBe(0);
	});
});

describe('buildPenPaths', () => {
	it('chains segments whose endpoints touch within the join radius', () => {
		// two collinear 10mm strokes with a 0.2mm gap, at 1px = 1mm
		const segments = [0, 0, 10, 0, 10.2, 0, 20, 0];
		expect(buildPenPaths([segments], 1, 0.5)).toHaveLength(1);
		expect(buildPenPaths([segments], 1, 0.1)).toHaveLength(2);
	});

	it('reverses a segment when its far end is the nearby one', () => {
		// second stroke stored end-first: 20,0 -> 10.2,0
		const segments = [0, 0, 10, 0, 20, 0, 10.2, 0];
		const paths = buildPenPaths([segments], 1, 0.5);
		expect(paths).toHaveLength(1);
		expect(paths[0][paths[0].length - 1]).toEqual({ x: 20, y: 0 });
	});

	it('converts px to mm', () => {
		const paths = buildPenPaths([[0, 0, 10, 0]], 2, 0);
		expect(paths[0][1]).toEqual({ x: 5, y: 0 });
	});
});

describe('estimateLayerPlotTime', () => {
	const config = defaultPlotterConfig();

	it('is zero for an empty layer', () => {
		const { seconds, penPaths } = estimateLayerPlotTime([], 1, config);
		expect(seconds).toBe(0);
		expect(penPaths).toBe(0);
	});

	it('joining nearby lines saves pen lifts and time', () => {
		// parallel hatch lines 0.4mm apart, drawn boustrophedon
		const segments: number[] = [];
		for (let i = 0; i < 50; i++) {
			const y = i * 0.4;
			if (i % 2 === 0) segments.push(0, y, 30, y);
			else segments.push(30, y, 0, y);
		}
		const joined = estimateLayerPlotTime([segments], 1, config);
		const lifted = estimateLayerPlotTime([segments], 1, { ...config, pathJoinRadiusMm: 0 });
		expect(joined.penPaths).toBe(1);
		expect(lifted.penPaths).toBe(50);
		expect(joined.seconds).toBeLessThan(lifted.seconds);
		// each avoided lift saves at least the drop+lift pause
		expect(lifted.seconds - joined.seconds).toBeGreaterThan(
			49 * (config.penDropDuration + config.penLiftDuration)
		);
	});

	it('scales with output size', () => {
		const segments = [0, 0, 100, 0, 100, 10, 0, 10];
		const small = estimateLayerPlotTime([segments], 2, config); // 2 px/mm
		const large = estimateLayerPlotTime([segments], 1, config); // 1 px/mm
		expect(large.seconds).toBeGreaterThan(small.seconds);
	});
});

describe('plotter config persistence', () => {
	it('falls back to defaults for garbage', () => {
		expect(parseStoredPlotterConfig(null)).toEqual(defaultPlotterConfig());
		expect(parseStoredPlotterConfig('{oops')).toEqual(defaultPlotterConfig());
	});

	it('keeps known finite values and drops the rest', () => {
		const config = sanitizePlotterConfig({
			penDownMaxVelocity: 25,
			penUpMaxVelocity: -10,
			penDropDuration: 'fast',
			bogus: 1
		});
		expect(config.penDownMaxVelocity).toBe(25);
		expect(config.penUpMaxVelocity).toBe(defaultPlotterConfig().penUpMaxVelocity);
		expect(config.penDropDuration).toBe(defaultPlotterConfig().penDropDuration);
		expect('bogus' in config).toBe(false);
	});

	it('round-trips through JSON', () => {
		const config = { ...defaultPlotterConfig(), penDownMaxVelocity: 35 };
		expect(parseStoredPlotterConfig(JSON.stringify(config))).toEqual(config);
	});
});

describe('formatPlotTime', () => {
	it('formats seconds, minutes and hours', () => {
		expect(formatPlotTime(9.4)).toBe('9s');
		expect(formatPlotTime(65)).toBe('1m 05s');
		expect(formatPlotTime(3600 + 240)).toBe('1h 04m');
		expect(formatPlotTime(NaN)).toBe('—');
	});
});
