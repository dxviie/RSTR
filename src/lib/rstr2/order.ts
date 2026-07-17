// Ordering a physical plot of the current design.
//
// Pure logic only: which designs are physically plottable (pens I own, paper
// the machine takes), what a plot costs, and the metadata payload handed to
// the order form. The UI wiring (button, dialogs, Tally popup) lives with the
// studio page; keeping this file DOM-free makes the rules unit-testable.

import { PAGES, type PageId } from '../prep/pages';
import { builtinPresets } from './presets';
import type { LayerConfig } from './layers';
import type { Rstr2Params } from './params';
import { fileSlug } from './exportName';

//***************************************************************
// 												WHAT I CAN PLOT
//***************************************************************

// Clearance kept on every edge of the sheet — the machine needs room for
// clips and registration, independent of the user's aesthetic fit margin.
export const ORDER_MARGIN_MM = 10;

/** Paper sizes offered for orders, smallest first. A3 is the machine's max. */
export const ORDER_TIERS = ['A6', 'A5', 'A4', 'A3'] as const;
export type OrderTier = (typeof ORDER_TIERS)[number];

/** A physical pen: an ink that exists on my shelf in a specific width. */
export interface PlotPen {
	/** pen name as shipped in the built-in presets */
	name: string;
	/** lowercase hex color */
	color: string;
	widthMm: number;
}

// Pen widths land on 0.05mm UI steps; matching tighter than that is noise.
const WIDTH_EPS = 0.001;

const penKey = (color: string, widthMm: number): string =>
	`${color.toLowerCase()}@${widthMm.toFixed(2)}`;

/**
 * The pens orders are limited to: every ink + width combination that appears
 * in a built-in preset (per-layer width, or the preset's global fallback).
 * Derived, not hardcoded — new presets extend the orderable set by themselves.
 */
export const allowedPens = (): PlotPen[] => {
	const pens = new Map<string, PlotPen>();
	for (const preset of builtinPresets()) {
		for (const layer of preset.settings.layers) {
			const widthMm = layer.penWidthMm ?? preset.settings.params.penWidthMm;
			const key = penKey(layer.color, widthMm);
			if (!pens.has(key)) {
				pens.set(key, { name: layer.name, color: layer.color.toLowerCase(), widthMm });
			}
		}
	}
	return [...pens.values()];
};

/** The width a layer actually draws with (its override or the global). */
export const effectivePenWidthMm = (layer: LayerConfig, params: Rstr2Params): number =>
	layer.penWidthMm ?? params.penWidthMm;

const matchPen = (color: string, widthMm: number): PlotPen | null =>
	allowedPens().find(
		(pen) => pen.color === color.toLowerCase() && Math.abs(pen.widthMm - widthMm) < WIDTH_EPS
	) ?? null;

//***************************************************************
// 												FEASIBILITY CHECK
//***************************************************************

export interface OrderPenCheck {
	/** the user's layer name (they may have renamed it) */
	layerName: string;
	color: string;
	widthMm: number;
	/** the matching physical pen, or null when I don't own that combination */
	pen: PlotPen | null;
}

export interface OrderCheck {
	/** design dimensions at the current output width */
	widthMm: number;
	heightMm: number;
	/** enabled layers annotated with their physical-pen match */
	pens: OrderPenCheck[];
	/** smallest order tier the design fits (with margin), null = beyond A3 */
	tier: OrderTier | null;
	/** every enabled pen exists AND the design fits a tier */
	supported: boolean;
}

/** Does w×h fit on the page (either orientation) with the order margin? */
const fitsPage = (widthMm: number, heightMm: number, page: PageId): boolean => {
	const [pw, ph] = PAGES[page];
	const availW = pw - 2 * ORDER_MARGIN_MM;
	const availH = ph - 2 * ORDER_MARGIN_MM;
	return (widthMm <= availW && heightMm <= availH) || (widthMm <= availH && heightMm <= availW);
};

/** The smallest tier a design fits on, or null when it exceeds A3. */
export const tierFor = (widthMm: number, heightMm: number): OrderTier | null =>
	ORDER_TIERS.find((tier) => fitsPage(widthMm, heightMm, tier)) ?? null;

/**
 * Check the current design against what I can physically plot.
 * @param aspect image height / width — the export height follows it
 */
export const checkOrder = (
	params: Rstr2Params,
	layers: LayerConfig[],
	aspect: number
): OrderCheck => {
	const widthMm = params.outputWidthMm;
	const heightMm = widthMm * aspect;
	const pens = layers
		.filter((layer) => layer.enabled)
		.map((layer) => {
			const widthMm = effectivePenWidthMm(layer, params);
			return {
				layerName: layer.name,
				color: layer.color.toLowerCase(),
				widthMm,
				pen: matchPen(layer.color, widthMm)
			};
		});
	const tier = tierFor(widthMm, heightMm);
	const supported = pens.length > 0 && pens.every((pen) => pen.pen !== null) && tier !== null;
	return { widthMm, heightMm, pens, tier, supported };
};

//***************************************************************
// 														PRICING
//***************************************************************

// All prices in whole euros. Tune freely — the shape of the formula is
// base(tier) + extra pens + plot time above the included window, everything
// clamped by the tier cap, with flat shipping folded in so the shop can say
// "shipping included".
export const PRICING = {
	/** per-tier base (first pen + included plot time) and total cap */
	tiers: {
		A6: { base: 19, cap: 49 },
		A5: { base: 29, cap: 69 },
		A4: { base: 49, cap: 109 },
		A3: { base: 79, cap: 169 }
	} as Record<OrderTier, { base: number; cap: number }>,
	/** every pen after the first: swap, registration, cleaning */
	extraPenEur: 4,
	/** plot minutes covered by the base price */
	includedPlotMin: 30,
	/** per minute beyond the included window */
	plotMinEur: 0.25,
	/** the time component stops growing here */
	plotTimeFeeCapEur: 40,
	/** flat-pack tracked shipping, folded into the advertised total */
	shippingEur: 9
} as const;

export interface OrderQuote {
	tier: OrderTier;
	baseEur: number;
	penFeeEur: number;
	timeFeeEur: number;
	shippingEur: number;
	/** whole euros, capped by the tier cap */
	totalEur: number;
	/** true when the tier cap kicked in */
	capped: boolean;
}

/** Price a supported design. Returns null when the check is unsupported. */
export const quoteOrder = (check: OrderCheck, plotSeconds: number): OrderQuote | null => {
	if (!check.supported || check.tier === null) return null;
	const { base, cap } = PRICING.tiers[check.tier];
	const penFeeEur = PRICING.extraPenEur * Math.max(0, check.pens.length - 1);
	const billableMin = Math.max(0, plotSeconds / 60 - PRICING.includedPlotMin);
	const timeFeeEur = Math.min(
		Math.round(billableMin * PRICING.plotMinEur),
		PRICING.plotTimeFeeCapEur
	);
	const raw = Math.ceil(base + penFeeEur + timeFeeEur + PRICING.shippingEur);
	const totalEur = Math.min(raw, cap);
	return {
		tier: check.tier,
		baseEur: base,
		penFeeEur,
		timeFeeEur,
		shippingEur: PRICING.shippingEur,
		totalEur,
		capped: raw > cap
	};
};

//***************************************************************
// 										ORDER FORM HANDOFF
//***************************************************************

/**
 * Version marker sent with every order payload, so submissions remain
 * interpretable when the pricing model changes later.
 */
export const ORDER_PAYLOAD_VERSION = '1';

export interface OrderContext {
	plotSeconds: number;
	lineCount: number;
	/** current source file name (image or video), '' when none */
	sourceName: string;
	/** selected preset name, '' when none */
	presetName: string;
	/** fingerprint of the exact SVG that was downloaded */
	designHash: string;
}

/**
 * The hidden-field payload for the Tally order form. Everything the form (and
 * my inbox) needs to make sense of the attached SVG: what it costs, how big
 * it is, which pens it needs, and a fingerprint to match file to order.
 * Values ride the popup URL as query params, so they stay short.
 */
export const orderHiddenFields = (
	check: OrderCheck,
	quote: OrderQuote,
	context: OrderContext
): Record<string, string> => {
	const fields: Record<string, string> = {
		price: String(quote.totalEur),
		tier: quote.tier,
		size: `${Math.round(check.widthMm)}x${Math.round(check.heightMm)}mm`,
		pens: String(check.pens.length),
		inks: check.pens.map((pen) => `${pen.pen?.name ?? pen.layerName} ${pen.widthMm}mm`).join(', '),
		plotmin: String(Math.ceil(context.plotSeconds / 60)),
		lines: String(context.lineCount),
		image: fileSlug(context.sourceName),
		design: context.designHash,
		preset: context.presetName,
		v: ORDER_PAYLOAD_VERSION
	};
	// empty values would still show up as `key=` in the URL — drop them
	for (const [key, value] of Object.entries(fields)) {
		if (value === '') delete fields[key];
	}
	return fields;
};

/**
 * A short fingerprint of the exported SVG text. Sent as a hidden field so an
 * uploaded file can be matched to the design the price was quoted for.
 */
export const designFingerprint = async (svg: string): Promise<string> => {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(svg));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 12);
};
