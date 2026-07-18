// Storage + editor metadata for RNG profiles — named, editable versions of
// the dice (per-parameter distributions plus algorithm/channel weights, see
// randomize.ts). The built-in profile always mirrors the shipped RANDOM_CURVES;
// extra profiles are a dev feature, authored in the studio's rng debug panel,
// kept in localStorage under a dev key that end users never write. The active
// profile is what the user-facing randomize button rolls along.

import {
	ALGORITHM_WEIGHTS,
	CHANNEL_WEIGHTS,
	defaultRngProfile,
	DEFAULT_RNG_PROFILE_ID,
	RANDOM_CURVES,
	type RandomCurveKey,
	type RngProfile,
	type WeightedOption
} from './randomize';
import { sanitizeDistribution, type Distribution } from './distributions';
import { RNG_SOURCE_KINDS, type RngSourceConfig, type RngSourceKind } from './rngSources';

export const RNG_CURVE_KEYS = Object.keys(RANDOM_CURVES) as RandomCurveKey[];

export type CurveGroup = 'segmentation' | 'lines' | 'layers';

export interface CurveMeta {
	label: string;
	group: CurveGroup;
	/** absolute edges of the curve editor — bounds can be dragged this far */
	hardMin: number;
	hardMax: number;
	unit?: string;
}

// The editor's coordinate system per parameter. hardMin/hardMax are UI-only:
// they cap how far the min/max bounds can be dragged, wider than the shipped
// curves so a profile can explore, but never into nonsense (negative sizes,
// zero-width pens).
export const CURVE_META: Record<RandomCurveKey, CurveMeta> = {
	resolution: { label: 'resolution', group: 'segmentation', hardMin: 8, hardMax: 1024 },
	smoothing: { label: 'smoothing', group: 'segmentation', hardMin: 0, hardMax: 6 },
	tolerance: { label: 'tolerance', group: 'segmentation', hardMin: 0, hardMax: 0.5 },
	minRegionSize: { label: 'min region size', group: 'segmentation', hardMin: 1, hardMax: 64 },
	slicCellSize: { label: 'slic cell size', group: 'segmentation', hardMin: 1, hardMax: 48 },
	slicCompactness: { label: 'slic compactness', group: 'segmentation', hardMin: 0, hardMax: 1 },
	penWidthMm: { label: 'pen width', group: 'lines', hardMin: 0.1, hardMax: 2.5, unit: 'mm' },
	spacingMinMm: { label: 'spacing min', group: 'lines', hardMin: 0.05, hardMax: 3, unit: 'mm' },
	spacingMaxMm: { label: 'spacing max', group: 'lines', hardMin: 0.5, hardMax: 12, unit: 'mm' },
	hatchThreshold: { label: 'hatch threshold', group: 'lines', hardMin: 0, hardMax: 0.6 },
	hatchGamma: { label: 'hatch gamma', group: 'lines', hardMin: 0.3, hardMax: 4 },
	inkBoost: { label: 'ink boost', group: 'lines', hardMin: 0.3, hardMax: 3.5 },
	layerCount: { label: 'layer count', group: 'layers', hardMin: 1, hardMax: 8 },
	angleStart: { label: 'angle start', group: 'layers', hardMin: -180, hardMax: 360, unit: '°' },
	angleSpread: { label: 'angle spread', group: 'layers', hardMin: 0, hardMax: 360, unit: '°' }
};

export const CURVE_GROUPS: CurveGroup[] = ['segmentation', 'lines', 'layers'];

// ─── profile ids & sanitizing ────────────────────────────────────────────────

let profileCounter = 0;
export const nextProfileId = (): string => `profile-${Date.now().toString(36)}-${profileCounter++}`;

const sanitizeWeights = <T extends string>(
	value: unknown,
	defaults: WeightedOption<T>[]
): WeightedOption<T>[] => {
	const known = new Map(defaults.map((option) => [option.value, option.weight]));
	const seen = new Map<T, number>();
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (typeof entry !== 'object' || entry === null) continue;
			const { value: v, weight } = entry as Record<string, unknown>;
			if (typeof v !== 'string' || !known.has(v as T)) continue;
			if (typeof weight !== 'number' || !Number.isFinite(weight)) continue;
			if (!seen.has(v as T)) seen.set(v as T, Math.max(0, weight));
		}
	}
	// every known value exactly once, in the shipped order; missing ones keep
	// their shipped weight so an older stored profile survives new options
	return defaults.map((option) => ({
		value: option.value,
		weight: seen.get(option.value) ?? option.weight
	}));
};

/**
 * Validate a parsed profile. Curves fall back distribution-by-distribution to
 * the built-in ones; a value without a usable id/name is dropped entirely.
 */
export const sanitizeRngProfile = (value: unknown): RngProfile | null => {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	if (typeof record.id !== 'string' || record.id.trim() === '') return null;
	if (typeof record.name !== 'string' || record.name.trim() === '') return null;
	const base = defaultRngProfile();
	const storedCurves = (
		typeof record.curves === 'object' && record.curves !== null ? record.curves : {}
	) as Record<string, unknown>;
	const curves = Object.fromEntries(
		RNG_CURVE_KEYS.map((key) => [key, sanitizeDistribution(storedCurves[key], base.curves[key])])
	) as Record<RandomCurveKey, Distribution>;
	return {
		id: record.id,
		name: record.name,
		curves,
		algorithmWeights: sanitizeWeights(record.algorithmWeights, ALGORITHM_WEIGHTS),
		channelWeights: sanitizeWeights(record.channelWeights, CHANNEL_WEIGHTS)
	};
};

// ─── debug setup storage ─────────────────────────────────────────────────────

/** everything the rng debug panel persists, as one blob */
export interface RngDebugSetup {
	activeProfileId: string;
	/** all profiles, the pristine built-in first — only custom ones are stored */
	profiles: RngProfile[];
	source: RngSourceConfig;
}

export const RNG_DEBUG_STORAGE_KEY = 'rstr:dev:rng';

export const defaultRngDebugSetup = (): RngDebugSetup => ({
	activeProfileId: DEFAULT_RNG_PROFILE_ID,
	profiles: [defaultRngProfile()],
	source: { kind: 'math-random', seed: 1 }
});

const sanitizeSource = (value: unknown): RngSourceConfig => {
	const fallback: RngSourceConfig = { kind: 'math-random', seed: 1 };
	if (typeof value !== 'object' || value === null) return fallback;
	const { kind, seed } = value as Record<string, unknown>;
	if (typeof kind !== 'string' || !RNG_SOURCE_KINDS.includes(kind as RngSourceKind)) {
		return fallback;
	}
	return {
		kind: kind as RngSourceKind,
		seed: typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : 1
	};
};

export const parseStoredRngSetup = (json: string | null): RngDebugSetup => {
	const setup = defaultRngDebugSetup();
	if (!json) return setup;
	try {
		const parsed = JSON.parse(json);
		if (typeof parsed !== 'object' || parsed === null) return setup;
		const record = parsed as Record<string, unknown>;
		if (Array.isArray(record.profiles)) {
			for (const entry of record.profiles) {
				const profile = sanitizeRngProfile(entry);
				// the built-in is never stored — and never overridden by storage
				if (profile && profile.id !== DEFAULT_RNG_PROFILE_ID) setup.profiles.push(profile);
			}
		}
		if (
			typeof record.activeProfileId === 'string' &&
			setup.profiles.some((profile) => profile.id === record.activeProfileId)
		) {
			setup.activeProfileId = record.activeProfileId;
		}
		setup.source = sanitizeSource(record.source);
		return setup;
	} catch {
		// corrupted storage falls back to defaults
		return setup;
	}
};

export const loadRngDebugSetup = (): RngDebugSetup => {
	if (typeof localStorage === 'undefined') return defaultRngDebugSetup();
	return parseStoredRngSetup(localStorage.getItem(RNG_DEBUG_STORAGE_KEY));
};

export const saveRngDebugSetup = (setup: RngDebugSetup): void => {
	if (typeof localStorage === 'undefined') return;
	const stored = {
		activeProfileId: setup.activeProfileId,
		profiles: setup.profiles.filter((profile) => profile.id !== DEFAULT_RNG_PROFILE_ID),
		source: setup.source
	};
	localStorage.setItem(RNG_DEBUG_STORAGE_KEY, JSON.stringify(stored));
};

// ─── profile files & code-gen ────────────────────────────────────────────────

// Format marker + version written into exported files, mirroring presets.ts.
const FILE_FORMAT = 'rstr-rng-profile';
const FILE_VERSION = 1;

export const serializeRngProfile = (profile: RngProfile): string =>
	JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, profile }, null, 2);

/** Parse an exported profile file. Returns null when the file is not usable. */
export const parseRngProfileFile = (json: string): RngProfile | null => {
	try {
		const parsed = JSON.parse(json);
		if (typeof parsed !== 'object' || parsed === null) return null;
		return sanitizeRngProfile((parsed as Record<string, unknown>).profile);
	} catch {
		return null;
	}
};

const constName = (name: string): string => {
	const snake = name
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toUpperCase();
	return snake ? `${snake}_RNG_PROFILE` : 'CUSTOM_RNG_PROFILE';
};

/**
 * Render a profile as a TypeScript literal, ready to paste next to
 * RANDOM_CURVES — the graduation path from "tuned in the debug panel" to
 * "shipped as a built-in".
 */
export const rngProfileToCode = (profile: RngProfile): string => {
	const body = JSON.stringify(profile, null, '\t')
		.replace(/"([A-Za-z_$][\w$]*)":/g, '$1:')
		.replace(/"/g, "'");
	return [
		`// RNG profile '${profile.name}' — generated by the studio rng debug panel.`,
		`// Paste into randomize.ts (or a profiles module) and wire it up as a built-in.`,
		`export const ${constName(profile.name)}: RngProfile = ${body};`,
		``
	].join('\n');
};
