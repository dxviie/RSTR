import { describe, it, expect } from 'vitest';
import {
	INK_COLORS,
	HARMONY_SETS,
	familyInks,
	accentInks,
	pickInkScheme,
	defaultColorOptions,
	harmonySetSwatches,
	ACCENT_RATE,
	type Rng
} from './inkColors';

/** deterministic rng (mulberry32) so the roll can be tested */
const seededRng = (seed: number): Rng => {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

describe('INK_COLORS', () => {
	it('are all valid uppercase #RRGGBB hex', () => {
		for (const ink of INK_COLORS) {
			expect(ink.hex).toMatch(/^#[0-9A-F]{6}$/);
		}
	});

	it('have unique hex values', () => {
		const hexes = INK_COLORS.map((ink) => ink.hex);
		expect(new Set(hexes).size).toBe(hexes.length);
	});

	it('cover every family referenced by a harmony set with a plottable ink', () => {
		const families = new Set(HARMONY_SETS.flatMap((set) => set.families));
		for (const family of families) {
			expect(familyInks(family).length).toBeGreaterThan(0);
		}
	});
});

describe('accentInks', () => {
	it('the accent shelf exists and is plottable', () => {
		expect(accentInks().length).toBeGreaterThan(0);
		for (const ink of accentInks()) {
			expect(ink.plottable).not.toBe(false);
		}
	});

	it('every harmony set covers at least one accent family', () => {
		const accentFamilies = new Set(accentInks().map((ink) => ink.family));
		for (const set of HARMONY_SETS) {
			expect(set.families.some((family) => accentFamilies.has(family))).toBe(true);
		}
	});

	it('accent inks stay out of the regular family draw', () => {
		const families = new Set(INK_COLORS.map((ink) => ink.family));
		for (const family of families) {
			for (const ink of familyInks(family)) {
				expect(ink.accent).not.toBe(true);
			}
		}
	});
});

describe('pickInkScheme', () => {
	it('is deterministic for a given rng', () => {
		expect(pickInkScheme(4, seededRng(42))).toEqual(pickInkScheme(4, seededRng(42)));
	});

	it('returns the requested number of colours', () => {
		for (let count = 1; count <= 5; count++) {
			for (let seed = 0; seed < 20; seed++) {
				expect(pickInkScheme(count, seededRng(seed))).toHaveLength(count);
			}
		}
	});

	it('only picks plottable inks and never a near-white', () => {
		const plottable = new Set(INK_COLORS.filter((ink) => ink.plottable !== false));
		for (let count = 1; count <= 5; count++) {
			for (let seed = 0; seed < 30; seed++) {
				for (const ink of pickInkScheme(count, seededRng(seed))) {
					expect(ink.hex).toMatch(/^#[0-9A-F]{6}$/);
					expect(plottable.has(ink)).toBe(true);
				}
			}
		}
	});

	it('gives every layer a distinct colour (up to the whole palette)', () => {
		const plottableCount = INK_COLORS.filter((ink) => ink.plottable !== false).length;
		for (let count = 1; count <= 5; count++) {
			for (let seed = 0; seed < 30; seed++) {
				const inks = pickInkScheme(count, seededRng(seed));
				const expected = Math.min(count, plottableCount);
				expect(new Set(inks.map((ink) => ink.hex)).size).toBe(expected);
			}
		}
	});

	it('reserves a vibrant accent layer in ~ACCENT_RATE of rolls', () => {
		const shelf = new Set(accentInks());
		const rolls = 2000;
		let hits = 0;
		for (let seed = 0; seed < rolls; seed++) {
			if (pickInkScheme(3, seededRng(seed)).some((ink) => shelf.has(ink))) hits++;
		}
		expect(hits / rolls).toBeGreaterThan(ACCENT_RATE - 0.05);
		expect(hits / rolls).toBeLessThan(ACCENT_RATE + 0.05);
	});

	it('never stacks more than one accent ink in a roll', () => {
		const shelf = new Set(accentInks());
		for (let count = 1; count <= 5; count++) {
			for (let seed = 0; seed < 200; seed++) {
				const accents = pickInkScheme(count, seededRng(seed)).filter((ink) => shelf.has(ink));
				expect(accents.length).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe('pickInkScheme with colour options (rng profiles)', () => {
	it('default-valued options roll exactly like no options', () => {
		for (let seed = 0; seed < 50; seed++) {
			expect(pickInkScheme(3, seededRng(seed), defaultColorOptions())).toEqual(
				pickInkScheme(3, seededRng(seed))
			);
		}
	});

	it('accent rate 0 never touches the accent shelf, 1 always does', () => {
		const shelf = new Set(accentInks());
		const off = { ...defaultColorOptions(), accentRate: 0 };
		const on = { ...defaultColorOptions(), accentRate: 1 };
		for (let seed = 0; seed < 200; seed++) {
			expect(pickInkScheme(3, seededRng(seed), off).some((ink) => shelf.has(ink))).toBe(false);
			expect(pickInkScheme(3, seededRng(seed), on).filter((ink) => shelf.has(ink))).toHaveLength(1);
		}
	});

	it('harmony weights pin the whole stack to the chosen set', () => {
		const options = {
			accentRate: 0,
			harmonyWeights: HARMONY_SETS.map((set) => ({
				value: set.name,
				weight: set.name === 'purple / yellow' ? 3 : 0
			}))
		};
		for (let seed = 0; seed < 100; seed++) {
			for (const ink of pickInkScheme(2, seededRng(seed), options)) {
				expect(['purple', 'yellow']).toContain(ink.family);
			}
		}
	});

	it('unknown harmony names are ignored, missing ones keep shipped weights', () => {
		const options = {
			accentRate: 0,
			harmonyWeights: [{ value: 'not a set', weight: 999 }]
		};
		// must not throw, and still pick a valid scheme from the shipped sets
		for (let seed = 0; seed < 20; seed++) {
			expect(pickInkScheme(3, seededRng(seed), options)).toHaveLength(3);
		}
	});

	it('harmonySetSwatches yields one plottable swatch per family', () => {
		for (const set of HARMONY_SETS) {
			const swatches = harmonySetSwatches(set.name);
			expect(swatches).toHaveLength(set.families.length);
			for (const hex of swatches) expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
		}
		expect(harmonySetSwatches('not a set')).toEqual([]);
	});
});

describe('family coverage guarantee', () => {
	// pin the roll to one harmony set so the expected family count is known
	const pinSet = (name: string, accentRate: number) => ({
		accentRate,
		harmonyWeights: HARMONY_SETS.map((set) => ({
			value: set.name,
			weight: set.name === name ? 1 : 0
		}))
	});

	const familiesOf = (inks: ReturnType<typeof pickInkScheme>) =>
		new Set(inks.map((ink) => ink.family));

	it('a multi-layer stack never collapses onto a single family', () => {
		// every harmony set has ≥ 2 families, so 2+ layers must span ≥ 2 —
		// the old layer-index rotation let an accent eat a family's only turn
		for (let count = 2; count <= 5; count++) {
			for (let seed = 0; seed < 400; seed++) {
				expect(familiesOf(pickInkScheme(count, seededRng(seed))).size).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it('a stack spans min(count, set families) distinct families', () => {
		for (let seed = 0; seed < 300; seed++) {
			// 2-family set, 3 layers, accent forced — both families, always
			// (the exact scenario of the pink/pink/pink collapse)
			expect(familiesOf(pickInkScheme(3, seededRng(seed), pinSet('green / pink', 1)))).toEqual(
				new Set(['green', 'pink'])
			);
			// 3-family set, 3 layers, accent forced — all three families
			expect(
				familiesOf(pickInkScheme(3, seededRng(seed), pinSet('pink / teal / yellow', 1))).size
			).toBe(3);
			// 4-family set, 3 layers, accent forced — three distinct families
			expect(familiesOf(pickInkScheme(3, seededRng(seed), pinSet('berry analogous', 1))).size).toBe(
				3
			);
		}
	});

	it('without an accent the wrap still covers every family first', () => {
		for (let seed = 0; seed < 300; seed++) {
			expect(familiesOf(pickInkScheme(3, seededRng(seed), pinSet('green / pink', 0)))).toEqual(
				new Set(['green', 'pink'])
			);
		}
	});
});
