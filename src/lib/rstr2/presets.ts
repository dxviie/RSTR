// Settings presets: a snapshot of the whole app configuration — the global
// parameters plus the layer stack. A snapshot can be applied to the app,
// saved as a named preset in the browser, or exchanged as a JSON file.

import { defaultParams, sanitizeParams, type Rstr2Params } from './params';
import { defaultClassicLayers, defaultCmyLayers, sanitizeLayers, type LayerConfig } from './layers';

export interface Rstr2Settings {
	params: Rstr2Params;
	layers: LayerConfig[];
}

export interface SettingsPreset {
	name: string;
	settings: Rstr2Settings;
}

export const PRESETS_STORAGE_KEY = 'rstr:v2:presets';

// Format marker + version written into exported files. Ignored on import for
// now, but lets future versions migrate old exports.
const FILE_FORMAT = 'rstr-settings';
const FILE_VERSION = 1;

/** The presets the app ships with. Callers get fresh objects on every call. */
export const builtinPresets = (): SettingsPreset[] => [
	{
		name: 'CMY classic',
		settings: {
			params: {
				...defaultParams(),
				algorithm: 'watershed',
				resolution: 128,
				smoothing: 0,
				tolerance: 0.06,
				minRegionSize: 1,
				slicCellSize: 2,
				slicCompactness: 0,
				penWidthMm: 0.4,
				spacingMinMm: 0.05,
				spacingMaxMm: 4.15,
				hatchThreshold: 0.1,
				hatchGamma: 1.8,
				inkBoost: 1.5,
				outputWidthMm: 200
			},
			layers: defaultCmyLayers()
		}
	},
	{
		name: 'CMY space',
		settings: {
			params: {
				...defaultParams(),
				algorithm: 'slic',
				resolution: 512,
				smoothing: 0,
				tolerance: 0.07,
				minRegionSize: 1,
				slicCellSize: 8,
				slicCompactness: 0.1,
				penWidthMm: 0.5,
				spacingMinMm: 0.05,
				spacingMaxMm: 4.15,
				hatchThreshold: 0.1,
				hatchGamma: 1.8,
				inkBoost: 1.7,
				outputWidthMm: 200
			},
			layers: defaultCmyLayers()
		}
	},
	{
		name: 'Black classic',
		settings: {
			params: {
				...defaultParams(),
				algorithm: 'watershed',
				resolution: 256,
				smoothing: 0,
				tolerance: 0.1,
				minRegionSize: 1,
				slicCellSize: 6,
				slicCompactness: 0.18,
				penWidthMm: 0.4,
				spacingMinMm: 0.05,
				spacingMaxMm: 3.4,
				hatchThreshold: 0.2,
				hatchGamma: 1.5,
				inkBoost: 1,
				outputWidthMm: 200
			},
			layers: defaultClassicLayers()
		}
	},
	{
		name: 'Black thin',
		settings: {
			params: {
				...defaultParams(),
				algorithm: 'slic',
				resolution: 64,
				smoothing: 0,
				tolerance: 0.05,
				minRegionSize: 1,
				slicCellSize: 6,
				slicCompactness: 0,
				penWidthMm: 0.2,
				spacingMinMm: 0.05,
				spacingMaxMm: 3.4,
				hatchThreshold: 0.15,
				hatchGamma: 1.5,
				inkBoost: 1.1,
				outputWidthMm: 200
			},
			layers: defaultClassicLayers()
		}
	}
];

export const serializeSettings = (settings: Rstr2Settings): string =>
	JSON.stringify(
		{
			format: FILE_FORMAT,
			version: FILE_VERSION,
			params: settings.params,
			layers: settings.layers
		},
		null,
		2
	);

/**
 * Validate a parsed settings snapshot. The layer stack decides whether the
 * value is usable at all; params always fall back field-by-field to defaults.
 */
export const sanitizeSettings = (value: unknown): Rstr2Settings | null => {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	const layers = sanitizeLayers(record.layers);
	if (!layers) return null;
	return { params: sanitizeParams(record.params), layers };
};

/** Parse an imported settings file. Returns null when the file is not usable. */
export const parseSettingsFile = (json: string): Rstr2Settings | null => {
	try {
		return sanitizeSettings(JSON.parse(json));
	} catch {
		return null;
	}
};

/** Parse the user's saved presets from storage, dropping any broken entries. */
export const parseStoredPresets = (json: string | null): SettingsPreset[] => {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		const presets: SettingsPreset[] = [];
		for (const entry of parsed) {
			if (typeof entry !== 'object' || entry === null) continue;
			const { name, settings } = entry as Record<string, unknown>;
			if (typeof name !== 'string' || name.trim() === '') continue;
			const sanitized = sanitizeSettings(settings);
			if (sanitized) presets.push({ name, settings: sanitized });
		}
		return presets;
	} catch {
		return [];
	}
};
