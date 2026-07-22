// Pen-plotter time estimation.
//
// The motion math is a duration-only port of saxi's constant-acceleration
// planner (https://github.com/nornagon/saxi, src/planning.ts), which in turn
// cribs from fogleman/axi. Same model: per-segment cornering velocities, then
// triangular/trapezoidal velocity profiles per segment, plus pen lift/drop
// pauses and pen-up travel between paths. saxi plans in motor steps but every
// profile value scales linearly with steps/mm, so planning directly in mm
// yields identical durations.
//
// The estimate matches what saxi reports for the exported SVG as long as the
// plotter profile below mirrors the options saxi is configured with.

import type { HatchSegments } from './hatchTools';

const EPSILON = 1e-9;

//***************************************************************
//                    PLOTTER PROFILE (persisted)
//***************************************************************

/** Motion parameters mirroring saxi's PlanOptions, in mm / seconds. */
export interface PlotterConfig {
	/** pen-down acceleration (mm/s²) */
	penDownAcceleration: number;
	/** pen-down max velocity (mm/s) */
	penDownMaxVelocity: number;
	/** cornering factor — higher takes corners faster (saxi: 0.127) */
	penDownCorneringFactor: number;
	/** pen-up (travel) acceleration (mm/s²) */
	penUpAcceleration: number;
	/** pen-up (travel) max velocity (mm/s) */
	penUpMaxVelocity: number;
	/** pause to drop the pen (s) */
	penDropDuration: number;
	/** pause to lift the pen (s) */
	penLiftDuration: number;
	/** consecutive lines closer than this are drawn without lifting (mm) */
	pathJoinRadiusMm: number;
}

/** saxi's defaultPlanOptions for an AxiDraw v3. */
export const defaultPlotterConfig = (): PlotterConfig => ({
	penDownAcceleration: 2000,
	penDownMaxVelocity: 10,
	penDownCorneringFactor: 0.127,
	penUpAcceleration: 400,
	penUpMaxVelocity: 200,
	penDropDuration: 0.12,
	penLiftDuration: 0.12,
	pathJoinRadiusMm: 0
});

export const PLOTTER_STORAGE_KEY = 'rstr:v2:plotter';

/** Merge a parsed value over the defaults, keeping only known finite numbers. */
export const sanitizePlotterConfig = (parsed: unknown): PlotterConfig => {
	const config = defaultPlotterConfig();
	if (typeof parsed !== 'object' || parsed === null) return config;
	for (const key of Object.keys(config) as (keyof PlotterConfig)[]) {
		const value = (parsed as Record<string, unknown>)[key];
		if (typeof value === 'number' && isFinite(value) && value >= 0) {
			config[key] = value;
		}
	}
	return config;
};

export const parseStoredPlotterConfig = (json: string | null): PlotterConfig => {
	if (!json) return defaultPlotterConfig();
	try {
		return sanitizePlotterConfig(JSON.parse(json));
	} catch {
		// corrupted storage falls back to defaults
		return defaultPlotterConfig();
	}
};

//***************************************************************
//                    MOTION MATH (port of saxi)
//***************************************************************

interface Vec2 {
	x: number;
	y: number;
}

const vsub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const vlen = (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y);
const vdot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

interface AccelProfile {
	acceleration: number;
	maximumVelocity: number;
	corneringFactor: number;
}

interface PlanSegment {
	p1: Vec2;
	p2: Vec2;
	length: number;
	direction: Vec2;
	maxEntryVelocity: number;
	entryVelocity: number;
	duration: number;
}

const makeSegment = (p1: Vec2, p2: Vec2): PlanSegment => {
	const d = vsub(p2, p1);
	const length = vlen(d);
	const direction = length > EPSILON ? { x: d.x / length, y: d.y / length } : { x: 0, y: 0 };
	return { p1, p2, length, direction, maxEntryVelocity: 0, entryVelocity: 0, duration: 0 };
};

// https://onehossshay.wordpress.com/2011/09/24/improving_grbl_cornering_algorithm/
const cornerVelocity = (
	seg1: PlanSegment,
	seg2: PlanSegment,
	vMax: number,
	accel: number,
	cornerFactor: number
): number => {
	const cosine = -vdot(seg1.direction, seg2.direction);
	if (Math.abs(cosine - 1) < EPSILON) return 0;
	const sine = Math.sqrt((1 - cosine) / 2);
	if (Math.abs(sine - 1) < EPSILON) return vMax;
	const v = Math.sqrt((accel * cornerFactor * sine) / (1 - sine));
	return Math.min(v, vMax);
};

/**
 * Time to traverse a polyline with a constant-acceleration profile, starting
 * and ending at rest. Mirrors saxi's constantAccelerationPlan, keeping only
 * the block durations.
 */
export const pathDuration = (points: Vec2[], profile: AccelProfile): number => {
	// drop consecutive duplicate points
	const pts: Vec2[] = [points[0]];
	for (const p of points.slice(1)) {
		if (vlen(vsub(p, pts[pts.length - 1])) > EPSILON) pts.push(p);
	}
	if (pts.length < 2) return 0;

	const segments = pts.slice(1).map((p, i) => makeSegment(pts[i], p));
	const accel = profile.acceleration;
	const vMax = profile.maximumVelocity;
	const cornerFactor = profile.corneringFactor;

	for (let i = 1; i < segments.length; i++) {
		segments[i].maxEntryVelocity = cornerVelocity(
			segments[i - 1],
			segments[i],
			vMax,
			accel,
			cornerFactor
		);
	}
	// sentinel forcing the velocity to zero at the end of the path
	const last = pts[pts.length - 1];
	segments.push(makeSegment(last, last));

	let i = 0;
	while (i < segments.length - 1) {
		const segment = segments[i];
		const nextSegment = segments[i + 1];
		const distance = segment.length;
		const vInitial = segment.entryVelocity;
		const vExit = nextSegment.maxEntryVelocity;

		// triangular profile: how far do we accelerate before decelerating?
		const acceleratingDistance =
			(2 * accel * distance + vExit * vExit - vInitial * vInitial) / (4 * accel);
		const deceleratingDistance = distance - acceleratingDistance;
		const vPeak = Math.sqrt(vInitial * vInitial + 2 * accel * acceleratingDistance);

		if (acceleratingDistance < -EPSILON) {
			// entering too fast to slow down to vExit within this segment —
			// lower this segment's entry velocity and revisit the previous one
			segment.maxEntryVelocity = Math.sqrt(vExit * vExit + 2 * accel * distance);
			i -= 1;
		} else if (deceleratingDistance <= 0) {
			// pure acceleration
			const vFinal = Math.sqrt(vInitial * vInitial + 2 * accel * distance);
			segment.duration = (vFinal - vInitial) / accel;
			nextSegment.entryVelocity = vFinal;
			i += 1;
		} else if (vPeak > vMax) {
			// trapezoid: accelerate to vMax, cruise, decelerate to vExit
			const t1 = (vMax - vInitial) / accel;
			const s1 = ((vMax + vInitial) / 2) * t1;
			const t3 = (vExit - vMax) / -accel;
			const s3 = ((vExit + vMax) / 2) * t3;
			const t2 = (distance - s1 - s3) / vMax;
			segment.duration = t1 + t2 + t3;
			nextSegment.entryVelocity = vExit;
			i += 1;
		} else {
			// triangle: accelerate to vPeak, decelerate to vExit
			const t1 = (vPeak - vInitial) / accel;
			const t2 = (vExit - vPeak) / -accel;
			segment.duration = t1 + t2;
			nextSegment.entryVelocity = vExit;
			i += 1;
		}
	}

	let total = 0;
	for (const segment of segments) total += segment.duration;
	return total;
};

//***************************************************************
//                    SEGMENTS -> PEN PATHS -> TIME
//***************************************************************

/**
 * Chain hatch segments into pen-down paths: while the next segment starts (or
 * ends — lines may be drawn in either direction) within the join radius of
 * the current pen position, keep the pen on the paper, mirroring saxi's
 * "join nearby paths" option. Input px, output mm.
 */
export const buildPenPaths = (
	segmentLists: HatchSegments[],
	pxPerMm: number,
	joinRadiusMm: number
): Vec2[][] => {
	const paths: Vec2[][] = [];
	let current: Vec2[] | null = null;
	for (const segments of segmentLists) {
		for (let k = 0; k + 3 < segments.length; k += 4) {
			let a: Vec2 = { x: segments[k] / pxPerMm, y: segments[k + 1] / pxPerMm };
			let b: Vec2 = { x: segments[k + 2] / pxPerMm, y: segments[k + 3] / pxPerMm };
			if (current) {
				const tail = current[current.length - 1];
				const dA = vlen(vsub(a, tail));
				const dB = vlen(vsub(b, tail));
				if (dB < dA) [a, b] = [b, a];
				if (Math.min(dA, dB) <= joinRadiusMm) {
					current.push(a, b);
					continue;
				}
				paths.push(current);
			}
			current = [a, b];
		}
	}
	if (current) paths.push(current);
	return paths;
};

export interface LayerPlotTime {
	/** total machine time for the layer (s) */
	seconds: number;
	/** number of pen-down paths after joining (= pen lifts) */
	penPaths: number;
}

/**
 * Estimated machine time for one layer: pen-up travel from home through every
 * path and back, pen drop/lift pauses, and pen-down drawing time.
 */
export const estimateLayerPlotTime = (
	segmentLists: HatchSegments[],
	pxPerMm: number,
	config: PlotterConfig
): LayerPlotTime => {
	const penDown: AccelProfile = {
		acceleration: config.penDownAcceleration,
		maximumVelocity: config.penDownMaxVelocity,
		corneringFactor: config.penDownCorneringFactor
	};
	const penUp: AccelProfile = {
		acceleration: config.penUpAcceleration,
		maximumVelocity: config.penUpMaxVelocity,
		corneringFactor: 0
	};

	const paths = buildPenPaths(segmentLists, pxPerMm, config.pathJoinRadiusMm);
	const home: Vec2 = { x: 0, y: 0 };
	let seconds = 0;
	let position = home;
	for (const path of paths) {
		seconds += pathDuration([position, path[0]], penUp);
		seconds += config.penDropDuration;
		seconds += pathDuration(path, penDown);
		seconds += config.penLiftDuration;
		position = path[path.length - 1];
	}
	seconds += pathDuration([position, home], penUp);
	return { seconds, penPaths: paths.length };
};

/** "42s", "12m 05s", "1h 24m" — compact, human-readable duration. */
export const formatPlotTime = (seconds: number): string => {
	if (!isFinite(seconds) || seconds < 0) return '—';
	const total = Math.round(seconds);
	if (total < 60) return `${total}s`;
	const minutes = Math.floor(total / 60);
	if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
};
