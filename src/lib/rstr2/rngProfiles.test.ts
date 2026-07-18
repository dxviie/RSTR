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
import { mulberry32 } from './rngSources';
import { defaultParams } from './params';
import { defaultCmyLayers } from './layers';

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
	it('parses garbage to the default setup', () => {
		for (const json of [null, '', 'nope', '[]', '{"profiles": 3}']) {
			const setup = parseStoredRngSetup(json);
			expect(setup.activeProfileId).toBe(DEFAULT_RNG_PROFILE_ID);
			expect(setup.profiles).toHaveLength(1);
			expect(setup.source.kind).toBe('math-random');
		}
	});

	it('restores custom profiles and the active pick, keeping the built-in first', () => {
		const custom = defaultRngProfile();
		custom.id = 'custom-9';
		custom.name = 'mine';
		const stored = JSON.stringify({
			activeProfileId: 'custom-9',
			profiles: [custom, { id: DEFAULT_RNG_PROFILE_ID, name: 'evil override' }],
			source: { kind: 'mulberry32', seed: 7 }
		});
		const setup = parseStoredRngSetup(stored);
		expect(setup.profiles.map((profile) => profile.id)).toEqual([
			DEFAULT_RNG_PROFILE_ID,
			'custom-9'
		]);
		expect(setup.profiles[0].name).toBe('built-in');
		expect(setup.activeProfileId).toBe('custom-9');
		expect(setup.source).toEqual({ kind: 'mulberry32', seed: 7 });
	});

	it('never points the active id at a missing profile', () => {
		const setup = parseStoredRngSetup(JSON.stringify({ activeProfileId: 'ghost', profiles: [] }));
		expect(setup.activeProfileId).toBe(DEFAULT_RNG_PROFILE_ID);
	});

	it('default setup starts on the built-in profile', () => {
		const setup = defaultRngDebugSetup();
		expect(setup.profiles[0].id).toBe(DEFAULT_RNG_PROFILE_ID);
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

	it('renders a pasteable TS constant', () => {
		const profile: RngProfile = { ...defaultRngProfile(), name: 'safe & wild' };
		const code = rngProfileToCode(profile);
		expect(code).toContain('export const SAFE_WILD_RNG_PROFILE: RngProfile =');
		expect(code).toContain("kind: 'gaussian'");
		expect(code).toContain('resolution:');
	});
});
