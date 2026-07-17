import { describe, it, expect } from 'vitest';
import {
	allowedPens,
	checkOrder,
	designFingerprint,
	orderHiddenFields,
	quoteOrder,
	tierFor,
	ORDER_MARGIN_MM,
	PRICING
} from './order';
import { builtinPresets } from './presets';
import type { Rstr2Settings } from './presets';

/** deep copy of a built-in preset's settings, safe to mutate in a test */
const presetSettings = (name: string): Rstr2Settings => {
	const preset = builtinPresets().find((entry) => entry.name === name);
	if (!preset) throw new Error(`no built-in preset named ${name}`);
	return JSON.parse(JSON.stringify(preset.settings));
};

describe('allowedPens', () => {
	it('derives every ink + width combination from the built-in presets', () => {
		const pens = allowedPens();
		const keys = pens.map((pen) => `${pen.color}@${pen.widthMm}`);
		// CMY exists at 0.4 (classic) and 0.5 (space), black at 0.4 and 0.2
		expect(keys).toContain('#00bfe8@0.4');
		expect(keys).toContain('#00bfe8@0.5');
		expect(keys).toContain('#ff2aa6@0.4');
		expect(keys).toContain('#ffb000@0.5');
		expect(keys).toContain('#000000@0.4');
		expect(keys).toContain('#000000@0.2');
		expect(pens).toHaveLength(8);
	});
});

describe('tierFor', () => {
	it('picks the smallest page the design fits with the order margin', () => {
		// A6 portrait is 105×148 — with the margin 85×128 still fits
		expect(tierFor(85, 128)).toBe('A6');
		// one mm over the A6 opening in both orientations -> A5
		expect(tierFor(86, 129)).toBe('A5');
	});

	it('uses either page orientation', () => {
		// wider than tall: only fits A4 turned landscape (277×190 available)
		expect(tierFor(250, 180)).toBe('A4');
	});

	it('returns null beyond A3', () => {
		expect(tierFor(420, 420)).toBeNull();
		// A3 landscape opening is 400×277
		expect(tierFor(400 - ORDER_MARGIN_MM, 250)).toBe('A3');
	});
});

describe('checkOrder', () => {
	it('accepts a built-in preset as-is', () => {
		const { params, layers } = presetSettings('CMY classic');
		const check = checkOrder(params, layers, 0.75); // 200×150mm
		expect(check.supported).toBe(true);
		expect(check.tier).toBe('A4');
		expect(check.pens).toHaveLength(3);
		expect(check.pens.every((pen) => pen.pen !== null)).toBe(true);
	});

	it('rejects an ink color I do not have', () => {
		const { params, layers } = presetSettings('CMY classic');
		layers[1].color = '#123456';
		const check = checkOrder(params, layers, 0.75);
		expect(check.supported).toBe(false);
		expect(check.pens.filter((pen) => pen.pen === null)).toHaveLength(1);
	});

	it('rejects a pen width that does not exist for the ink', () => {
		const { params, layers } = presetSettings('Black classic');
		layers[0].penWidthMm = 0.7; // black exists at 0.2 and 0.4 only
		const check = checkOrder(params, layers, 1);
		expect(check.supported).toBe(false);
	});

	it('matches per-layer width overrides against the pen shelf', () => {
		const { params, layers } = presetSettings('CMY classic');
		layers[0].penWidthMm = 0.5; // cyan also exists at 0.5 (CMY space)
		const check = checkOrder(params, layers, 0.75);
		expect(check.supported).toBe(true);
	});

	it('ignores disabled layers but requires at least one enabled', () => {
		const { params, layers } = presetSettings('CMY classic');
		layers[1].color = '#123456';
		layers[1].enabled = false;
		expect(checkOrder(params, layers, 0.75).supported).toBe(true);
		for (const layer of layers) layer.enabled = false;
		expect(checkOrder(params, layers, 0.75).supported).toBe(false);
	});

	it('rejects designs larger than A3 minus the margin', () => {
		const { params, layers } = presetSettings('CMY classic');
		params.outputWidthMm = 420;
		const check = checkOrder(params, layers, 1);
		expect(check.tier).toBeNull();
		expect(check.supported).toBe(false);
	});
});

describe('quoteOrder', () => {
	const supportedCheck = (widthMm = 200, aspect = 0.75) => {
		const { params, layers } = presetSettings('CMY classic');
		params.outputWidthMm = widthMm;
		return checkOrder(params, layers, aspect);
	};

	it('prices base + extra pens + shipping inside the included time', () => {
		const quote = quoteOrder(supportedCheck(), 20 * 60);
		expect(quote).not.toBeNull();
		expect(quote!.tier).toBe('A4');
		expect(quote!.penFeeEur).toBe(2 * PRICING.extraPenEur);
		expect(quote!.timeFeeEur).toBe(0);
		expect(quote!.totalEur).toBe(
			PRICING.tiers.A4.base + 2 * PRICING.extraPenEur + PRICING.shippingEur
		);
		expect(quote!.capped).toBe(false);
	});

	it('bills plot time beyond the included window', () => {
		const billableMin = 42; // arbitrary overtime, derived from the constants
		const quote = quoteOrder(supportedCheck(), (PRICING.includedPlotMin + billableMin) * 60);
		expect(quote!.timeFeeEur).toBe(Math.round(billableMin * PRICING.plotMinEur));
	});

	it('caps the time fee', () => {
		const quote = quoteOrder(supportedCheck(), 100 * 60 * 60);
		expect(quote!.timeFeeEur).toBe(PRICING.plotTimeFeeCapEur);
	});

	it('clamps the total at the tier cap', () => {
		// small sheet, three pens, absurd plot time -> the A6 cap wins
		const quote = quoteOrder(supportedCheck(80, 1), 100 * 60 * 60);
		expect(quote!.tier).toBe('A6');
		expect(quote!.totalEur).toBe(PRICING.tiers.A6.cap);
		expect(quote!.capped).toBe(true);
	});

	it('returns null for unsupported designs', () => {
		const { params, layers } = presetSettings('CMY classic');
		params.outputWidthMm = 500;
		expect(quoteOrder(checkOrder(params, layers, 1), 60)).toBeNull();
	});
});

describe('orderHiddenFields', () => {
	it('assembles the payload and drops empty values', () => {
		const { params, layers } = presetSettings('CMY classic');
		const check = checkOrder(params, layers, 0.75);
		const quote = quoteOrder(check, 45 * 60)!;
		const fields = orderHiddenFields(check, quote, {
			plotSeconds: 45 * 60,
			lineCount: 12345,
			sourceName: '/bbrasa-imp.png',
			presetName: '',
			designHash: 'abc123def456'
		});
		expect(fields.price).toBe(String(quote.totalEur));
		expect(fields.tier).toBe('A4');
		expect(fields.size).toBe('200x150mm');
		expect(fields.pens).toBe('3');
		expect(fields.inks).toContain('Octopus Blue Sloth 0.4mm');
		expect(fields.plotmin).toBe('45');
		expect(fields.lines).toBe('12345');
		expect(fields.image).toBe('bbrasa-imp');
		expect(fields.design).toBe('abc123def456');
		expect(fields.v).toBe('1');
		expect('preset' in fields).toBe(false);
	});
});

describe('designFingerprint', () => {
	it('is a short stable hex fingerprint', async () => {
		const a1 = await designFingerprint('<svg>a</svg>');
		const a2 = await designFingerprint('<svg>a</svg>');
		const b = await designFingerprint('<svg>b</svg>');
		expect(a1).toMatch(/^[0-9a-f]{12}$/);
		expect(a1).toBe(a2);
		expect(a1).not.toBe(b);
	});
});
