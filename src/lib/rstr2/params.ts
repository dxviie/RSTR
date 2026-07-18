// Global (non-layer) parameters of the RSTR v2 pipeline, with defaults and
// localStorage persistence. Layers have their own config in layers.ts;
// per-layer overrides fall back to these globals.

export type SegmentationAlgorithm = 'watershed' | 'posterize' | 'kmeans' | 'slic';

export interface Rstr2Params {
	// adjust (pre-segmentation color pipeline)
	brightness: number;
	contrast: number;
	imageGamma: number;
	saturation: number;
	vibrance: number;
	// segmentation
	algorithm: SegmentationAlgorithm;
	resolution: number;
	smoothing: number;
	tolerance: number;
	minRegionSize: number;
	slicCellSize: number;
	slicCompactness: number;
	// lines (layer overrides inherit from these)
	penWidthMm: number;
	spacingMinMm: number;
	spacingMaxMm: number;
	/** ink band that gets hatched: regions below the low bound (high-pass) or
	 *  above the high bound (low-pass) are left empty (0..1) */
	hatchThresholdLow: number;
	hatchThresholdHigh: number;
	hatchGamma: number;
	inkBoost: number;
	// export
	outputWidthMm: number;
	// margin (mm) kept clear around the art when fitting it to a paper size
	fitMarginMm: number;
}

export const defaultParams = (): Rstr2Params => ({
	brightness: 0,
	contrast: 0,
	imageGamma: 1,
	saturation: 1,
	vibrance: 0,
	algorithm: 'watershed',
	resolution: 96,
	smoothing: 1,
	tolerance: 0.08,
	minRegionSize: 4,
	slicCellSize: 8,
	slicCompactness: 0.5,
	penWidthMm: 0.4,
	spacingMinMm: 0.5,
	spacingMaxMm: 4,
	hatchThresholdLow: 0.1,
	hatchThresholdHigh: 1,
	hatchGamma: 1.8,
	inkBoost: 1,
	outputWidthMm: 200,
	fitMarginMm: 10
});

export const PARAMS_STORAGE_KEY = 'rstr:v2:params';

const ALGORITHMS: SegmentationAlgorithm[] = ['watershed', 'posterize', 'kmeans', 'slic'];

/**
 * Merge a parsed value over the defaults, keeping only keys that exist in the
 * defaults with a matching type — unknown or stale keys are dropped silently.
 * Used for both localStorage and imported settings files.
 */
export const sanitizeParams = (parsed: unknown): Rstr2Params => {
	const params = defaultParams();
	if (typeof parsed !== 'object' || parsed === null) return params;
	const record: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
	// migrate: older versions stored a single low-side cutoff as hatchThreshold —
	// it becomes the band's low bound (the high bound defaults to 1 = no cut)
	if (typeof record.hatchThreshold === 'number' && typeof record.hatchThresholdLow !== 'number') {
		record.hatchThresholdLow = record.hatchThreshold;
	}
	for (const key of Object.keys(params) as (keyof Rstr2Params)[]) {
		const value = record[key];
		if (typeof value === typeof params[key]) {
			(params as unknown as Record<string, unknown>)[key] = value;
		}
	}
	if (!ALGORITHMS.includes(params.algorithm)) params.algorithm = defaultParams().algorithm;
	return params;
};

export const parseStoredParams = (json: string | null): Rstr2Params => {
	if (!json) return defaultParams();
	try {
		return sanitizeParams(JSON.parse(json));
	} catch {
		// corrupted storage falls back to defaults
		return defaultParams();
	}
};
