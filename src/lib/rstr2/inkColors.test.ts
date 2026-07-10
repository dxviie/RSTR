import { describe, it, expect } from 'vitest';
import { INK_COLORS, HARMONY_SETS, familyInks, pickInkScheme, type Rng } from './inkColors';

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
		const plottable = new Set(
			INK_COLORS.filter((ink) => ink.plottable !== false).map((ink) => ink.hex)
		);
		for (let count = 1; count <= 5; count++) {
			for (let seed = 0; seed < 30; seed++) {
				for (const hex of pickInkScheme(count, seededRng(seed))) {
					expect(hex).toMatch(/^#[0-9A-F]{6}$/);
					expect(plottable.has(hex)).toBe(true);
				}
			}
		}
	});

	it('gives every layer a distinct colour (up to the whole palette)', () => {
		const plottableCount = INK_COLORS.filter((ink) => ink.plottable !== false).length;
		for (let count = 1; count <= 5; count++) {
			for (let seed = 0; seed < 30; seed++) {
				const colors = pickInkScheme(count, seededRng(seed));
				const expected = Math.min(count, plottableCount);
				expect(new Set(colors).size).toBe(expected);
			}
		}
	});
});
