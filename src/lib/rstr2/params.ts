// Global (non-layer) parameters of the RSTR v2 pipeline, with defaults and
// localStorage persistence. Layers have their own config in layers.ts;
// per-layer overrides fall back to these globals.

export type SegmentationAlgorithm = 'watershed' | 'posterize' | 'kmeans';
export type SpacingCurveName = 'coverage' | 'gamma' | 'log' | 'linear';

export interface Rstr2Params {
	// image
	imageOpacity: number;
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
	// display
	showShapes: boolean;
	shapeOpacity: number;
	showHatching: boolean;
	hatchingOpacity: number;
	// lines (layer overrides inherit from these)
	penWidthMm: number;
	spacingMinMm: number;
	spacingMaxMm: number;
	hatchThreshold: number;
	spacingCurve: SpacingCurveName;
	hatchGamma: number;
	inkBoost: number;
	// export
	outputWidthMm: number;
	// debug
	debug: boolean;
}

export const defaultParams = (): Rstr2Params => ({
	imageOpacity: 0.2,
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
	showShapes: true,
	shapeOpacity: 0.9,
	showHatching: true,
	hatchingOpacity: 0.9,
	penWidthMm: 0.4,
	spacingMinMm: 0.5,
	spacingMaxMm: 4,
	hatchThreshold: 0.1,
	spacingCurve: 'coverage',
	hatchGamma: 1.8,
	inkBoost: 1,
	outputWidthMm: 200,
	debug: false
});

export const PARAMS_STORAGE_KEY = 'rstr:v2:params';

/**
 * Merge stored values over the defaults, keeping only keys that exist in the
 * defaults with a matching type — unknown or stale keys are dropped silently.
 */
export const parseStoredParams = (json: string | null): Rstr2Params => {
	const params = defaultParams();
	if (!json) return params;
	try {
		const parsed = JSON.parse(json);
		if (typeof parsed !== 'object' || parsed === null) return params;
		for (const key of Object.keys(params) as (keyof Rstr2Params)[]) {
			const value = (parsed as Record<string, unknown>)[key];
			if (typeof value === typeof params[key]) {
				(params as unknown as Record<string, unknown>)[key] = value;
			}
		}
	} catch {
		// corrupted storage falls back to defaults
	}
	return params;
};
