// Pre-segmentation color adjustments.
//
// Applied to the downsampled cell grid (not the raw pixels), so a full
// adjustment pass costs O(cells) and re-runs instantly when a slider moves.

export interface ImageAdjustments {
	/** -0.5..0.5 — additive brightness ("darkness" is the negative range) */
	brightness: number;
	/** -1..1 — scale around mid grey */
	contrast: number;
	/** 0.25..3 — midtone curve; >1 brightens, <1 darkens/keys down */
	gamma: number;
	/** 0..2 — uniform saturation, 1 = unchanged, 0 = greyscale */
	saturation: number;
	/** -1..1 — saturation boost weighted towards muted colors */
	vibrance: number;
}

export const isNeutralAdjustment = (adjustments: ImageAdjustments): boolean =>
	adjustments.brightness === 0 &&
	adjustments.contrast === 0 &&
	adjustments.gamma === 1 &&
	adjustments.saturation === 1 &&
	adjustments.vibrance === 0;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Apply the adjustment chain (brightness -> contrast -> gamma -> saturation
 * -> vibrance) to per-cell RGB arrays (0..1). Returns new arrays.
 */
export const adjustColors = (
	r: Float32Array,
	g: Float32Array,
	b: Float32Array,
	adjustments: ImageAdjustments
): { r: Float32Array; g: Float32Array; b: Float32Array } => {
	const n = r.length;
	const outR = new Float32Array(n);
	const outG = new Float32Array(n);
	const outB = new Float32Array(n);

	const brightness = adjustments.brightness;
	// -1..0 fades to flat grey, 0..1 steepens up to 3x
	const contrastFactor =
		adjustments.contrast >= 0 ? 1 + adjustments.contrast * 2 : 1 + adjustments.contrast;
	const invGamma = 1 / Math.max(0.01, adjustments.gamma);
	const saturation = adjustments.saturation;
	const vibrance = adjustments.vibrance;

	for (let i = 0; i < n; i++) {
		let cr = r[i] + brightness;
		let cg = g[i] + brightness;
		let cb = b[i] + brightness;

		cr = (cr - 0.5) * contrastFactor + 0.5;
		cg = (cg - 0.5) * contrastFactor + 0.5;
		cb = (cb - 0.5) * contrastFactor + 0.5;

		cr = Math.pow(clamp01(cr), invGamma);
		cg = Math.pow(clamp01(cg), invGamma);
		cb = Math.pow(clamp01(cb), invGamma);

		if (saturation !== 1 || vibrance !== 0) {
			const luma = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
			// muted colors get the full vibrance boost, saturated ones little
			const satAmount = Math.max(cr, cg, cb) - Math.min(cr, cg, cb);
			const scale = saturation * (1 + vibrance * (1 - Math.min(1, satAmount * 2)));
			cr = luma + (cr - luma) * scale;
			cg = luma + (cg - luma) * scale;
			cb = luma + (cb - luma) * scale;
		}

		outR[i] = clamp01(cr);
		outG[i] = clamp01(cg);
		outB[i] = clamp01(cb);
	}

	return { r: outR, g: outG, b: outB };
};
