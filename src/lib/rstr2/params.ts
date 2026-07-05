// Global (non-layer) parameters of the RSTR v2 pipeline, with defaults and
// localStorage persistence. Layers have their own config in layers.ts;
// per-layer overrides fall back to these globals.

export type SegmentationAlgorithm = 'watershed' | 'posterize' | 'kmeans';

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
	// lines (layer overrides inherit from these)
	penWidthMm: number;
	spacingMinMm: number;
	spacingMaxMm: number;
	hatchThreshold: number;
	hatchGamma: number;
	inkBoost: number;
	// export
	outputWidthMm: number;
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
	penWidthMm: 0.4,
	spacingMinMm: 0.5,
	spacingMaxMm: 4,
	hatchThreshold: 0.1,
	hatchGamma: 1.8,
	inkBoost: 1,
	outputWidthMm: 200
});

export const PARAMS_STORAGE_KEY = 'rstr:v2:params';

const ALGORITHMS: SegmentationAlgorithm[] = ['watershed', 'posterize', 'kmeans'];

/**
 * Merge a parsed value over the defaults, keeping only keys that exist in the
 * defaults with a matching type — unknown or stale keys are dropped silently.
 * Used for both localStorage and imported settings files.
 */
export const sanitizeParams = (parsed: unknown): Rstr2Params => {
	const params = defaultParams();
	if (typeof parsed !== 'object' || parsed === null) return params;
	for (const key of Object.keys(params) as (keyof Rstr2Params)[]) {
		const value = (parsed as Record<string, unknown>)[key];
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
