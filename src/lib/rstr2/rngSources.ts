// Pluggable random sources for the dice. An `Rng` is all the samplers see:
// () => number in [0, 1). Math.random stays the production default; the
// seeded generators exist so a roll — or a whole tuning session in the
// studio's rng debug panel — can be replayed exactly.

export type Rng = () => number;

export type RngSourceKind = 'math-random' | 'mulberry32' | 'sfc32' | 'xoshiro128ss';

export interface RngSourceConfig {
	kind: RngSourceKind;
	/** 32-bit seed; ignored by math-random */
	seed: number;
}

export const RNG_SOURCE_LABELS: Record<RngSourceKind, string> = {
	'math-random': 'Math.random · unseeded',
	mulberry32: 'mulberry32 · seeded',
	sfc32: 'sfc32 · seeded',
	xoshiro128ss: 'xoshiro128** · seeded'
};

export const RNG_SOURCE_KINDS = Object.keys(RNG_SOURCE_LABELS) as RngSourceKind[];

export const isSeeded = (kind: RngSourceKind): boolean => kind !== 'math-random';

/** splitmix32 — expands one 32-bit seed into well-mixed state words */
const splitmix32 = (seed: number): (() => number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x9e3779b9) | 0;
		let t = a ^ (a >>> 16);
		t = Math.imul(t, 0x21f0aaad);
		t = t ^ (t >>> 15);
		t = Math.imul(t, 0x735a2d97);
		return (t ^ (t >>> 15)) >>> 0;
	};
};

export const mulberry32 = (seed: number): Rng => {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

export const sfc32 = (seed: number): Rng => {
	const mix = splitmix32(seed);
	let a = mix();
	let b = mix();
	let c = mix();
	let d = mix();
	return () => {
		a >>>= 0;
		b >>>= 0;
		c >>>= 0;
		d >>>= 0;
		let t = (a + b) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		d = (d + 1) | 0;
		t = (t + d) | 0;
		c = (c + t) | 0;
		return (t >>> 0) / 4294967296;
	};
};

export const xoshiro128ss = (seed: number): Rng => {
	const mix = splitmix32(seed);
	let a = mix();
	let b = mix();
	let c = mix();
	let d = mix();
	// the all-zero state is a fixed point of xoshiro — nudge out of it
	if ((a | b | c | d) === 0) d = 1;
	return () => {
		let r = Math.imul(b, 5);
		r = Math.imul((r << 7) | (r >>> 25), 9);
		const t = b << 9;
		c ^= a;
		d ^= b;
		b ^= c;
		a ^= d;
		c ^= t;
		d = (d << 11) | (d >>> 21);
		return (r >>> 0) / 4294967296;
	};
};

export const createRng = (config: RngSourceConfig): Rng => {
	switch (config.kind) {
		case 'mulberry32':
			return mulberry32(config.seed);
		case 'sfc32':
			return sfc32(config.seed);
		case 'xoshiro128ss':
			return xoshiro128ss(config.seed);
		case 'math-random':
			return Math.random;
	}
};

/** a fresh 32-bit seed to offer in the debug panel */
export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff) >>> 0;
