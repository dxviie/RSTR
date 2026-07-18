// Shared runtime state for the rng debug tool. The studio dice and the debug
// panel both roll through here, so panel edits are exactly what the dice
// rolls and every roll lands in the same log. Nothing persists unless the
// panel saves — a session that never opens the panel rolls the shipped
// defaults through Math.random, byte-for-byte the old behavior.

import { defaultRngProfile, randomizeSettings, type RngProfile } from './randomize';
import {
	defaultRngDebugSetup,
	loadRngDebugSetup,
	saveRngDebugSetup,
	type RngDebugSetup
} from './rngProfiles';
import { createRng, isSeeded, type Rng } from './rngSources';
import type { Rstr2Settings } from './presets';

export interface RollLogEntry {
	id: number;
	/** wall-clock label, hh:mm:ss */
	at: string;
	profileName: string;
	sourceLabel: string;
	stickToPresets: boolean;
	settings: Rstr2Settings;
}

interface RngDebugState {
	setup: RngDebugSetup;
	log: RollLogEntry[];
}

export const rngDebug: RngDebugState = $state({
	setup: defaultRngDebugSetup(),
	log: []
});

let hydrated = false;

/** load the persisted setup once — safe to call from anywhere, any time */
export const hydrateRngDebug = (): void => {
	if (hydrated || typeof localStorage === 'undefined') return;
	hydrated = true;
	rngDebug.setup = loadRngDebugSetup();
};

export const persistRngDebug = (): void => {
	saveRngDebugSetup(rngDebug.setup);
};

export const activeRngProfile = (): RngProfile =>
	rngDebug.setup.profiles.find((profile) => profile.id === rngDebug.setup.activeProfileId) ??
	rngDebug.setup.profiles[0] ??
	defaultRngProfile();

// The active source advances across rolls (a seeded sequence would otherwise
// restart — and repeat — on every click); it is rebuilt whenever the panel
// changes kind or seed, or asks for an explicit sequence restart.
let cachedRng: Rng | null = null;
let cachedSourceKey = '';

const sourceKey = (): string => {
	const { kind, seed } = rngDebug.setup.source;
	return isSeeded(kind) ? `${kind}:${seed}` : kind;
};

export const activeRng = (): Rng => {
	const key = sourceKey();
	if (!cachedRng || cachedSourceKey !== key) {
		cachedRng = createRng(rngDebug.setup.source);
		cachedSourceKey = key;
	}
	return cachedRng;
};

/** restart the seeded sequence from its seed (no-op for Math.random) */
export const restartRngSequence = (): void => {
	cachedRng = null;
	cachedSourceKey = '';
};

const sourceLabel = (): string => {
	const { kind, seed } = rngDebug.setup.source;
	return isSeeded(kind) ? `${kind} #${seed}` : 'Math.random';
};

let rollCounter = 0;
const LOG_LIMIT = 30;

// hh:mm:ss for the log rows (Intl over a timestamp — a Date instance here
// would trip svelte/prefer-svelte-reactivity, and nothing needs reactivity)
const timeFormat = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false
});

/**
 * The dice: roll new settings along the active profile and source, and note
 * the outcome in the debug log. This is what the studio randomize button
 * calls — with the debug tool untouched it reduces to the plain shipped roll.
 */
export const rollRandomSettings = (
	current: Rstr2Settings,
	stickToPresets: boolean
): Rstr2Settings => {
	hydrateRngDebug();
	const profile = activeRngProfile();
	const settings = randomizeSettings(current, stickToPresets, activeRng(), profile);
	rngDebug.log.unshift({
		id: ++rollCounter,
		at: timeFormat.format(Date.now()),
		profileName: profile.name,
		sourceLabel: sourceLabel(),
		stickToPresets,
		settings: JSON.parse(JSON.stringify(settings))
	});
	if (rngDebug.log.length > LOG_LIMIT) rngDebug.log.length = LOG_LIMIT;
	return settings;
};
