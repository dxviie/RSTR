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
		expect(keys).toContain('#1d8cba@0.4');
		expect(keys).toContain('#1d8cba@0.5');
		expect(keys).toContain('#ff2aa6@0.4');
		expect(keys).toContain('#f5c518@0.5');
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
			PRICING.tiers.A4.base + 2 * PRICING.extraPenEur + PRICING.tiers.A4.shippingEur
		);
		expect(quote!.capped).toBe(false);
	});

	it('bills plot time beyond the included window', () => {
		const billableMin = 42; // arbitrary overtime, derived from the constants
		const quote = quoteOrder(
			supportedCheck(),
			(PRICING.tiers.A4.includedPlotMin + billableMin) * 60
		);
		expect(quote!.timeFeeEur).toBe(Math.round(billableMin * PRICING.plotMinEur));
	});

	it('starts a one-pen A6 inside its plot window at €19', () => {
		const { params, layers } = presetSettings('Black classic');
		params.outputWidthMm = 80;
		const check = checkOrder(params, layers, 1); // 80×80 -> A6
		const quote = quoteOrder(check, PRICING.tiers.A6.includedPlotMin * 60)!;
		expect(quote.tier).toBe('A6');
		expect(quote.penFeeEur).toBe(0);
		expect(quote.timeFeeEur).toBe(0);
		expect(quote.totalEur).toBe(19);
	});

	it('scales the included plot window with the sheet', () => {
		// the same 50-minute plot is free time on A4 but 30' of overtime on A6
		expect(quoteOrder(supportedCheck(), 50 * 60)!.timeFeeEur).toBe(0);
		expect(quoteOrder(supportedCheck(80, 1), 50 * 60)!.timeFeeEur).toBe(
			Math.round((50 - PRICING.tiers.A6.includedPlotMin) * PRICING.plotMinEur)
		);
	});

	it('ramps the starting price gradually across the tiers', () => {
		const { params, layers } = presetSettings('Black classic');
		const startingPrice = (widthMm: number) => {
			params.outputWidthMm = widthMm;
			return quoteOrder(checkOrder(params, layers, 1), 0)!;
		};
		// square designs sized so each lands on the next sheet up
		const quotes = [80, 120, 180, 260].map(startingPrice);
		expect(quotes.map((quote) => quote.tier)).toEqual(['A6', 'A5', 'A4', 'A3']);
		expect(quotes.map((quote) => quote.totalEur)).toEqual([19, 30, 45, 70]);
	});

	it('clamps the total at the tier cap', () => {
		// small sheet, three pens, absurd plot time -> the A6 cap wins
		const quote = quoteOrder(supportedCheck(80, 1), 100 * 60 * 60);
		expect(quote!.tier).toBe('A6');
		expect(quote!.totalEur).toBe(PRICING.tiers.A6.cap);
		expect(quote!.capped).toBe(true);
	});

	it('lets a marathon A3 run up to its cap instead of a flat time ceiling', () => {
		// 12h+ plots used to flatten out at a global time-fee cap; now only the
		// tier cap bounds them, so the longest A3s got a bit more expensive
		const quote = quoteOrder(supportedCheck(260, 1), 12 * 60 * 60)!;
		expect(quote.tier).toBe('A3');
		expect(quote.totalEur).toBe(PRICING.tiers.A3.cap);
		expect(quote.capped).toBe(true);
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
			designHash: 'abc123def456',
			uploaded: false
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
		expect(fields.v).toBe('2');
		expect('preset' in fields).toBe(false);
		// no confirmed upload -> no upload field, the form keeps its attach step
		expect('upload' in fields).toBe(false);
	});

	it("marks a design that reached the plot queue with upload: 'ok'", () => {
		const { params, layers } = presetSettings('CMY classic');
		const check = checkOrder(params, layers, 0.75);
		const quote = quoteOrder(check, 45 * 60)!;
		const fields = orderHiddenFields(check, quote, {
			plotSeconds: 45 * 60,
			lineCount: 12345,
			sourceName: '/bbrasa-imp.png',
			presetName: '',
			designHash: 'abc123def456',
			uploaded: true
		});
		expect(fields.upload).toBe('ok');
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
