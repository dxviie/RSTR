// The shipped rng profiles — the registry the studio dice and the rng debug
// panel read. The default profile (RANDOM_CURVES wrapped) is always first and
// always what a fresh session rolls; everything else here is selectable in
// the debug panel but read-only, exactly like the default.
//
// ── Shipping a profile tuned in the debug panel ──────────────────────────────
// 1. In the panel (dev build or ?rngdebug), get the profile how you want it.
// 2. Hit "⌗ copy as code" — the clipboard now holds a typed `RngProfile`
//    literal with a slugged, stable id.
// 3. Paste the constant into this file and add it to the list returned by
//    builtinRngProfiles() below.
// 4. `npm test` — rngProfiles.test.ts checks every shipped profile has a
//    unique id and rolls entirely inside its own curve bounds.
// Full workflow, schema and tuning notes: docs/rng-profiles.md.
//
// Ids must be unique and stable (they key localStorage's active-profile pick
// and lock the profile read-only in the panel). Stored dev profiles that
// collide with a shipped id are ignored on load, so shipping can never be
// shadowed by stale browser state.

import { defaultRngProfile, type RandomCurveKey, type RngProfile } from './randomize';
import type { Distribution } from './distributions';

/**
 * 'uniform sweep' — every curve flattened to a uniform draw over the same
 * min/max. No taste, maximum coverage: it visits the weird corners of the
 * parameter space far more often than the gaussian default, which makes it
 * the profile to roll when hunting for settings combinations that break or
 * surprise. Also the resident example of authoring a profile in code rather
 * than pasting a generated literal.
 */
const uniformSweepProfile = (): RngProfile => {
	const base = defaultRngProfile();
	return {
		...base,
		id: 'uniform-sweep',
		name: 'uniform sweep',
		curves: Object.fromEntries(
			Object.entries(base.curves).map(([key, curve]) => [
				key,
				{ kind: 'uniform', min: curve.min, max: curve.max, step: curve.step }
			])
		) as Record<RandomCurveKey, Distribution>
	};
};

/** All shipped profiles, the default first. Fresh objects on every call. */
export const builtinRngProfiles = (): RngProfile[] => [defaultRngProfile(), uniformSweepProfile()];

export const isBuiltinRngProfileId = (id: string): boolean =>
	builtinRngProfiles().some((profile) => profile.id === id);
