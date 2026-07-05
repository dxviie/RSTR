// Configurable output layers.
//
// A layer is data: an input channel extracted from the image plus a mapping
// config (color, hatch angle range, pen width, spacing range, ink threshold).
// Each layer corresponds to one physical pen on the plotter. CMY is just the
// default stack.

export type LayerChannel = 'c' | 'm' | 'y' | 'k' | 'r' | 'g' | 'b' | 'luma' | 'luma-inv';

export interface LayerConfig {
	id: string;
	name: string;
	/** which image channel drives this layer's ink amount (0..1) */
	channel: LayerChannel;
	/** display + export stroke color */
	color: string;
	/** hatch direction range in degrees — each region picks an angle in
	 *  [angleMin, angleMax] based on its own shape */
	angleMin: number;
	angleMax: number;
	// The hatch settings below are per-layer OVERRIDES: null inherits the
	// global value from the parameter panel.
	/** physical line width of the output (mm) */
	penWidthMm: number | null;
	/** densest allowed hatch spacing (mm) */
	spacingMinMm: number | null;
	/** sparsest hatch spacing before a region is left empty-ish (mm) */
	spacingMaxMm: number | null;
	/** regions with mean ink below this are not hatched (0..1) */
	threshold: number | null;
	/** perceptual weight on ink intensity before spacing */
	inkGamma: number | null;
	/** coverage multiplier — >1 pushes dark regions into overlapping lines */
	inkBoost: number | null;
	enabled: boolean;
}

export const CHANNEL_LABELS: Record<LayerChannel, string> = {
	c: 'Cyan (1-R)',
	m: 'Magenta (1-G)',
	y: 'Yellow (1-B)',
	k: 'Key / darkness',
	r: 'Red',
	g: 'Green',
	b: 'Blue',
	luma: 'Luminance',
	'luma-inv': 'Inv. luminance'
};

let layerCounter = 0;
export const nextLayerId = (): string => `layer-${Date.now().toString(36)}-${layerCounter++}`;

const inheritedHatchSettings = () => ({
	penWidthMm: null,
	spacingMinMm: null,
	spacingMaxMm: null,
	threshold: null,
	inkGamma: null,
	inkBoost: null
});

export const defaultCmyLayers = (): LayerConfig[] => [
	// Default pen colors are the d17e.dev brand accents.
	{
		id: 'cyan',
		name: 'Cyan',
		channel: 'c',
		color: '#00BFE8',
		angleMin: 15,
		angleMax: 105,
		...inheritedHatchSettings(),
		enabled: true
	},
	{
		id: 'magenta',
		name: 'Magenta',
		channel: 'm',
		color: '#FF2AA6',
		angleMin: 75,
		angleMax: 165,
		...inheritedHatchSettings(),
		enabled: true
	},
	{
		id: 'yellow',
		name: 'Yellow',
		channel: 'y',
		color: '#FFB000',
		angleMin: 135,
		angleMax: 225,
		...inheritedHatchSettings(),
		enabled: true
	}
];

// The RSTR v1 look: a single black pen driven by darkness, hatched in one
// direction — the classic Vera Molnár-inspired line raster.
export const defaultClassicLayers = (): LayerConfig[] => [
	{
		id: 'black',
		name: 'Black',
		channel: 'luma-inv',
		color: '#1A1A1A',
		angleMin: 0,
		angleMax: 0,
		...inheritedHatchSettings(),
		enabled: true
	}
];

export const createLayer = (): LayerConfig => ({
	id: nextLayerId(),
	name: 'New layer',
	channel: 'k',
	color: '#1A1A1A',
	angleMin: 45,
	angleMax: 135,
	...inheritedHatchSettings(),
	enabled: true
});

/**
 * Extract the per-cell ink amount (0..1) for a channel from per-cell RGB
 * arrays (each 0..1).
 */
export const extractChannel = (
	r: Float32Array,
	g: Float32Array,
	b: Float32Array,
	channel: LayerChannel
): Float32Array => {
	const n = r.length;
	const values = new Float32Array(n);
	switch (channel) {
		case 'c':
			for (let i = 0; i < n; i++) values[i] = 1 - r[i];
			break;
		case 'm':
			for (let i = 0; i < n; i++) values[i] = 1 - g[i];
			break;
		case 'y':
			for (let i = 0; i < n; i++) values[i] = 1 - b[i];
			break;
		case 'k':
			for (let i = 0; i < n; i++) values[i] = 1 - Math.max(r[i], g[i], b[i]);
			break;
		case 'r':
			values.set(r);
			break;
		case 'g':
			values.set(g);
			break;
		case 'b':
			values.set(b);
			break;
		case 'luma':
			for (let i = 0; i < n; i++) values[i] = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i];
			break;
		case 'luma-inv':
			for (let i = 0; i < n; i++) values[i] = 1 - (0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i]);
			break;
	}
	return values;
};

const OVERRIDE_FIELDS = [
	'penWidthMm',
	'spacingMinMm',
	'spacingMaxMm',
	'threshold',
	'inkGamma',
	'inkBoost'
] as const;

const isValidLayer = (layer: unknown): layer is LayerConfig => {
	if (typeof layer !== 'object' || layer === null) return false;
	const l = layer as Record<string, unknown>;
	return (
		typeof l.id === 'string' &&
		typeof l.name === 'string' &&
		typeof l.channel === 'string' &&
		l.channel in CHANNEL_LABELS &&
		typeof l.color === 'string' &&
		typeof l.angleMin === 'number' &&
		typeof l.angleMax === 'number' &&
		OVERRIDE_FIELDS.every((f) => l[f] === null || typeof l[f] === 'number') &&
		typeof l.enabled === 'boolean'
	);
};

// Old versions stored these as concrete per-layer values with these defaults;
// a stored value equal to the old default becomes "inherit" on migration.
const LEGACY_DEFAULTS: Record<string, number> = {
	penWidthMm: 0.4,
	spacingMinMm: 0.5,
	spacingMaxMm: 4,
	threshold: 0.1
};

/** Upgrade layers stored by earlier versions. */
const migrateLayer = (layer: unknown): unknown => {
	if (typeof layer !== 'object' || layer === null) return layer;
	const l = layer as Record<string, unknown>;
	// single `angle` -> angle range
	if (typeof l.angle === 'number' && l.angleMin === undefined) {
		l.angleMin = l.angle;
		l.angleMax = l.angle;
		delete l.angle;
	}
	// concrete hatch values -> nullable overrides
	for (const field of OVERRIDE_FIELDS) {
		if (l[field] === undefined || l[field] === LEGACY_DEFAULTS[field]) {
			l[field] = null;
		}
	}
	return l;
};

/**
 * Validate (and migrate) a parsed layer stack. Used for both localStorage and
 * imported settings files.
 */
export const sanitizeLayers = (parsed: unknown): LayerConfig[] | null => {
	if (!Array.isArray(parsed) || parsed.length === 0) return null;
	const migrated = parsed.map(migrateLayer);
	return migrated.every(isValidLayer) ? migrated : null;
};

export const parseStoredLayers = (json: string | null): LayerConfig[] | null => {
	if (!json) return null;
	try {
		return sanitizeLayers(JSON.parse(json));
	} catch {
		return null;
	}
};
