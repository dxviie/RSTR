import { describe, it, expect } from 'vitest';
import {
	defaultRngProfile,
	DEFAULT_RNG_PROFILE_ID,
	RANDOM_CURVES,
	randomizeSettings,
	type RngProfile
} from './randomize';
import {
	CURVE_META,
	defaultRngDebugSetup,
	parseRngProfileFile,
	parseStoredRngSetup,
	RNG_CURVE_KEYS,
	rngProfileToCode,
	sanitizeRngProfile,
	serializeRngProfile
} from './rngProfiles';
import { builtinRngProfiles, isBuiltinRngProfileId } from './rngBuiltinProfiles';
import { ACCENT_RATE, HARMONY_SETS, INK_COLORS } from './inkColors';
import { mulberry32 } from './rngSources';
import { defaultParams } from './params';
import { CHANNEL_AXES, defaultCmyLayers, type LayerChannel, type LayerConfig } from './layers';

const currentSettings = () => ({ params: defaultParams(), layers: defaultCmyLayers() });

// layer ids are freshly generated on every roll — normalize them to compare
const stripLayerIds = (settings: ReturnType<typeof randomizeSettings>) => ({
	params: settings.params,
	layers: settings.layers.map((layer) => ({ ...layer, id: '' }))
});

describe('defaultRngProfile', () => {
	it('mirrors the shipped curve tables as gaussians', () => {
		const profile = defaultRngProfile();
		for (const key of RNG_CURVE_KEYS) {
			expect(profile.curves[key]).toEqual({ kind: 'gaussian', ...RANDOM_CURVES[key] });
		}
	});

	it('rolls exactly like the profile-less dice', () => {
		const withProfile = randomizeSettings(
			currentSettings(),
			false,
			mulberry32(42),
			defaultRngProfile()
		);
		const without = randomizeSettings(currentSettings(), false, mulberry32(42));
		expect(stripLayerIds(withProfile)).toEqual(stripLayerIds(without));
	});

	it('has editor metadata wide enough for every shipped curve', () => {
		for (const key of RNG_CURVE_KEYS) {
			expect(CURVE_META[key].hardMin).toBeLessThanOrEqual(RANDOM_CURVES[key].min);
			expect(CURVE_META[key].hardMax).toBeGreaterThanOrEqual(RANDOM_CURVES[key].max);
		}
	});
});

describe('custom profiles drive the roll', () => {
	it('constant curves pin their parameters', () => {
		const profile = defaultRngProfile();
		profile.id = 'test';
		profile.curves.resolution = { kind: 'constant', value: 300, min: 32, max: 512, step: 1 };
		profile.curves.layerCount = { kind: 'constant', value: 2, min: 1, max: 5, step: 1 };
		for (let seed = 0; seed < 10; seed++) {
			const { params, layers } = randomizeSettings(
				currentSettings(),
				false,
				mulberry32(seed),
				profile
			);
			expect(params.resolution).toBe(300);
			expect(layers).toHaveLength(2);
		}
	});

	it('algorithm weights are respected', () => {
		const profile = defaultRngProfile();
		profile.algorithmWeights = [
			{ value: 'watershed', weight: 0 },
			{ value: 'slic', weight: 1 },
			{ value: 'kmeans', weight: 0 },
			{ value: 'posterize', weight: 0 }
		];
		for (let seed = 0; seed < 10; seed++) {
			const { params } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
			expect(params.algorithm).toBe('slic');
		}
	});
});

describe('sanitizeRngProfile', () => {
	it('round-trips a valid profile', () => {
		const profile = defaultRngProfile();
		profile.id = 'custom-1';
		profile.name = 'wild';
		profile.curves.penWidthMm = { kind: 'uniform', min: 0.2, max: 1, step: 0.05 };
		expect(sanitizeRngProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
	});

	it('repairs broken curves to the shipped ones and rejects nameless blobs', () => {
		const repaired = sanitizeRngProfile({
			id: 'x',
			name: 'x',
			curves: { resolution: { kind: 'gaussian', mean: 'NaN' } }
		});
		expect(repaired?.curves.resolution).toEqual({ kind: 'gaussian', ...RANDOM_CURVES.resolution });
		expect(sanitizeRngProfile({ id: '', name: 'x' })).toBeNull();
		expect(sanitizeRngProfile(null)).toBeNull();
	});

	it('keeps every weight option exactly once, dropping unknown values', () => {
		const profile = sanitizeRngProfile({
			id: 'x',
			name: 'x',
			algorithmWeights: [
				{ value: 'slic', weight: 9 },
				{ value: 'slic', weight: 5 },
				{ value: 'bogus', weight: 3 }
			]
		});
		expect(profile?.algorithmWeights.map((o) => o.value).sort()).toEqual(
			['kmeans', 'posterize', 'slic', 'watershed'].sort()
		);
		expect(profile?.algorithmWeights.find((o) => o.value === 'slic')?.weight).toBe(9);
	});
});

describe('rng setup storage', () => {
	const builtinIds = builtinRngProfiles().map((profile) => profile.id);

	it('parses garbage to the default setup (all shipped profiles present)', () => {
		for (const json of [null, '', 'nope', '[]', '{"profiles": 3}']) {
			const setup = parseStoredRngSetup(json);
			expect(setup.activeProfileId).toBe(DEFAULT_RNG_PROFILE_ID);
			expect(setup.profiles.map((profile) => profile.id)).toEqual(builtinIds);
			expect(setup.source.kind).toBe('math-random');
		}
	});

	it('restores custom profiles and the active pick, keeping the shipped ones first', () => {
		const custom = defaultRngProfile();
		custom.id = 'custom-9';
		custom.name = 'mine';
		const stored = JSON.stringify({
			activeProfileId: 'custom-9',
			profiles: [
				custom,
				{ id: DEFAULT_RNG_PROFILE_ID, name: 'evil override' },
				{ id: 'uniform-sweep', name: 'evil sweep override' }
			],
			source: { kind: 'mulberry32', seed: 7 }
		});
		const setup = parseStoredRngSetup(stored);
		expect(setup.profiles.map((profile) => profile.id)).toEqual([...builtinIds, 'custom-9']);
		// the shipped profiles load pristine — storage can never shadow them
		expect(setup.profiles[0].name).toBe('built-in');
		expect(setup.profiles[1].name).toBe('uniform sweep');
		expect(setup.activeProfileId).toBe('custom-9');
		expect(setup.source).toEqual({ kind: 'mulberry32', seed: 7 });
	});

	it('never points the active id at a missing profile', () => {
		const setup = parseStoredRngSetup(JSON.stringify({ activeProfileId: 'ghost', profiles: [] }));
		expect(setup.activeProfileId).toBe(DEFAULT_RNG_PROFILE_ID);
	});

	it('a stored active pick of a shipped profile is kept', () => {
		const setup = parseStoredRngSetup(
			JSON.stringify({ activeProfileId: 'uniform-sweep', profiles: [] })
		);
		expect(setup.activeProfileId).toBe('uniform-sweep');
	});

	it('default setup starts on the built-in profile', () => {
		const setup = defaultRngDebugSetup();
		expect(setup.profiles[0].id).toBe(DEFAULT_RNG_PROFILE_ID);
	});
});

describe('builtinRngProfiles', () => {
	it('ships unique, stable ids with the default first', () => {
		const profiles = builtinRngProfiles();
		expect(profiles[0].id).toBe(DEFAULT_RNG_PROFILE_ID);
		const ids = profiles.map((profile) => profile.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const profile of profiles) expect(isBuiltinRngProfileId(profile.id)).toBe(true);
		expect(isBuiltinRngProfileId('profile-abc-1')).toBe(false);
	});

	it('every shipped profile survives its own sanitizer unchanged', () => {
		for (const profile of builtinRngProfiles()) {
			expect(sanitizeRngProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
		}
	});

	it('every shipped profile rolls inside its own curve bounds', () => {
		for (const profile of builtinRngProfiles()) {
			for (let seed = 0; seed < 10; seed++) {
				const { params } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
				expect(params.resolution).toBeGreaterThanOrEqual(profile.curves.resolution.min);
				expect(params.resolution).toBeLessThanOrEqual(profile.curves.resolution.max);
				expect(params.penWidthMm).toBeGreaterThanOrEqual(profile.curves.penWidthMm.min);
				expect(params.penWidthMm).toBeLessThanOrEqual(profile.curves.penWidthMm.max);
			}
		}
	});

	it('the uniform sweep keeps the shipped bounds but flattens the shape', () => {
		const sweep = builtinRngProfiles().find((profile) => profile.id === 'uniform-sweep');
		expect(sweep).toBeDefined();
		for (const key of RNG_CURVE_KEYS) {
			expect(sweep?.curves[key]).toEqual({
				kind: 'uniform',
				min: RANDOM_CURVES[key].min,
				max: RANDOM_CURVES[key].max,
				step: RANDOM_CURVES[key].step
			});
		}
	});
});

describe('profile colors', () => {
	it('the default profile mirrors the shipped colour tables', () => {
		const { colors } = defaultRngProfile();
		expect(colors.accentRate).toBe(ACCENT_RATE);
		expect(colors.harmonyWeights).toEqual(
			HARMONY_SETS.map((set) => ({ value: set.name, weight: set.weight }))
		);
	});

	it('sanitize clamps the accent rate and repairs harmony weights', () => {
		const profile = sanitizeRngProfile({
			id: 'x',
			name: 'x',
			colors: {
				accentRate: 7,
				harmonyWeights: [
					{ value: 'blue / orange', weight: 9 },
					{ value: 'not a set', weight: 5 }
				]
			}
		});
		expect(profile?.colors.accentRate).toBe(1);
		expect(profile?.colors.harmonyWeights).toHaveLength(HARMONY_SETS.length);
		expect(
			profile?.colors.harmonyWeights.find((option) => option.value === 'blue / orange')?.weight
		).toBe(9);
		const missing = sanitizeRngProfile({ id: 'y', name: 'y' });
		expect(missing?.colors).toEqual(defaultRngProfile().colors);
	});

	it('accent rate 0 rolls schemes without accent inks', () => {
		const accents = new Set(INK_COLORS.filter((ink) => ink.accent === true).map((ink) => ink.hex));
		const profile = defaultRngProfile();
		profile.colors.accentRate = 0;
		for (let seed = 0; seed < 25; seed++) {
			const { layers } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
			for (const layer of layers) expect(accents.has(layer.color)).toBe(false);
		}
	});

	it('harmony weights steer the whole stack into the chosen families', () => {
		const profile = defaultRngProfile();
		profile.colors.accentRate = 0;
		profile.colors.harmonyWeights = profile.colors.harmonyWeights.map((option) => ({
			value: option.value,
			weight: option.value === 'neutral + red' ? 1 : 0
		}));
		const allowed = new Set(
			INK_COLORS.filter((ink) => ink.family === 'neutral' || ink.family === 'red').map(
				(ink) => ink.hex
			)
		);
		for (let seed = 0; seed < 25; seed++) {
			const { layers } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
			for (const layer of layers) expect(allowed.has(layer.color)).toBe(true);
		}
	});
});

describe('channel axis coverage', () => {
	it('2–4 layer stacks read one channel per information axis', () => {
		for (const count of [2, 3, 4]) {
			const profile = defaultRngProfile();
			profile.curves.layerCount = { kind: 'constant', value: count, min: 1, max: 8, step: 1 };
			for (let seed = 0; seed < 200; seed++) {
				const { layers } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
				const axes = new Set(layers.map((layer) => CHANNEL_AXES[layer.channel]));
				expect(axes.size).toBe(count);
			}
		}
	});

	it('5 layers span all four axes and never a channel with its exact negative', () => {
		const INVERSE_PAIRS: [LayerChannel, LayerChannel][] = [
			['c', 'r'],
			['m', 'g'],
			['y', 'b'],
			['luma', 'luma-inv']
		];
		const hasInversePair = (layers: LayerConfig[]) => {
			const channels = new Set(layers.map((layer) => layer.channel));
			return INVERSE_PAIRS.some(([a, b]) => channels.has(a) && channels.has(b));
		};
		const profile = defaultRngProfile();
		profile.curves.layerCount = { kind: 'constant', value: 5, min: 1, max: 8, step: 1 };
		for (let seed = 0; seed < 200; seed++) {
			const { layers } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
			const channels = layers.map((layer) => layer.channel);
			expect(new Set(channels).size).toBe(channels.length);
			expect(new Set(channels.map((channel) => CHANNEL_AXES[channel])).size).toBe(4);
			expect(hasInversePair(layers)).toBe(false);
		}
	});

	it('weight 0 still keeps channels out even when their axis is the only fresh one', () => {
		const profile = defaultRngProfile();
		profile.curves.layerCount = { kind: 'constant', value: 4, min: 1, max: 8, step: 1 };
		for (const option of profile.channelWeights) {
			if (CHANNEL_AXES[option.value] === 'lightness') option.weight = 0;
		}
		for (let seed = 0; seed < 200; seed++) {
			const { layers } = randomizeSettings(currentSettings(), false, mulberry32(seed), profile);
			const channels = layers.map((layer) => layer.channel);
			// zeroed lightness channels never appear; the roll degrades to
			// distinct channels on the three remaining axes instead
			for (const channel of channels) expect(CHANNEL_AXES[channel]).not.toBe('lightness');
			expect(new Set(channels).size).toBe(4);
			expect(new Set(channels.map((channel) => CHANNEL_AXES[channel])).size).toBe(3);
		}
	});
});

describe('profile files & code-gen', () => {
	it('serialize/parse round-trips', () => {
		const profile = defaultRngProfile();
		profile.id = 'file-1';
		profile.name = 'shared';
		expect(parseRngProfileFile(serializeRngProfile(profile))).toEqual(profile);
		expect(parseRngProfileFile('not json')).toBeNull();
		expect(parseRngProfileFile('{"format":"rstr-rng-profile"}')).toBeNull();
	});

	it('renders a pasteable TS constant with a stable slugged id', () => {
		const profile: RngProfile = {
			...defaultRngProfile(),
			id: 'profile-xyz-3',
			name: 'safe & wild'
		};
		const code = rngProfileToCode(profile);
		expect(code).toContain('export const SAFE_WILD_RNG_PROFILE: RngProfile =');
		expect(code).toContain("id: 'safe-wild'");
		expect(code).toContain('rngBuiltinProfiles.ts');
		expect(code).toContain("kind: 'gaussian'");
		expect(code).toContain('accentRate:');
	});
});
