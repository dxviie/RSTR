import { describe, it, expect } from 'vitest';
import { createRng, randomSeed, RNG_SOURCE_KINDS, type RngSourceKind } from './rngSources';

const SEEDED = RNG_SOURCE_KINDS.filter((kind) => kind !== 'math-random');

describe('createRng', () => {
	it('every source stays in [0, 1)', () => {
		for (const kind of RNG_SOURCE_KINDS) {
			const rng = createRng({ kind, seed: 42 });
			for (let i = 0; i < 1000; i++) {
				const value = rng();
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThan(1);
			}
		}
	});

	it('seeded sources replay exactly for the same seed', () => {
		for (const kind of SEEDED) {
			const a = createRng({ kind, seed: 123 });
			const b = createRng({ kind, seed: 123 });
			for (let i = 0; i < 50; i++) expect(a()).toBe(b());
		}
	});

	it('seeded sources differ between seeds', () => {
		for (const kind of SEEDED) {
			const a = createRng({ kind, seed: 1 });
			const b = createRng({ kind, seed: 2 });
			const runA = Array.from({ length: 10 }, () => a());
			const runB = Array.from({ length: 10 }, () => b());
			expect(runA).not.toEqual(runB);
		}
	});

	it('seeded sources are roughly uniform', () => {
		for (const kind of SEEDED as RngSourceKind[]) {
			const rng = createRng({ kind, seed: 7 });
			const samples = Array.from({ length: 4000 }, () => rng());
			const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
			expect(mean).toBeGreaterThan(0.45);
			expect(mean).toBeLessThan(0.55);
		}
	});
});

describe('randomSeed', () => {
	it('yields a 32-bit unsigned integer', () => {
		for (let i = 0; i < 20; i++) {
			const seed = randomSeed();
			expect(Number.isInteger(seed)).toBe(true);
			expect(seed).toBeGreaterThanOrEqual(0);
			expect(seed).toBeLessThanOrEqual(0xffffffff);
		}
	});
});
