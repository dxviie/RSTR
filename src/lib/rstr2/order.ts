// Ordering a physical plot of the current design.
//
// Pure logic only: which designs are physically plottable (pens I own, paper
// the machine takes), what a plot costs, and the metadata payloads handed to
// the order form and the inquiry form. The UI wiring (button, dialogs, Tally
// embed) lives with the pages; keeping this file DOM-free makes the rules
// unit-testable.

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
// base(tier) + extra pens + plot time above the tier's included window,
// everything clamped by the tier cap, with the tier's shipping folded in so
// the shop can say "shipping included". Base, included minutes, shipping and
// cap all scale with the sheet: an A6 is a postcard (cheap to plot AND to
// ship), an A3 hogs the machine for hours and ships tracked in a flat-pack.
export const PRICING = {
	/** per-tier: base (first pen + the included plot window), included plot
	 *  minutes, shipping folded into the advertised total, and the all-in cap */
	tiers: {
		A6: { base: 15, includedPlotMin: 20, shippingEur: 4, cap: 45 },
		A5: { base: 24, includedPlotMin: 40, shippingEur: 6, cap: 75 },
		A4: { base: 36, includedPlotMin: 60, shippingEur: 9, cap: 130 },
		A3: { base: 55, includedPlotMin: 90, shippingEur: 15, cap: 280 }
	} as Record<
		OrderTier,
		{ base: number; includedPlotMin: number; shippingEur: number; cap: number }
	>,
	/** every pen after the first: swap, registration, cleaning */
	extraPenEur: 10,
	/** per minute beyond the included window — unbounded, the tier cap clamps */
	plotMinEur: 0.5
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
	const { base, includedPlotMin, shippingEur, cap } = PRICING.tiers[check.tier];
	const penFeeEur = PRICING.extraPenEur * Math.max(0, check.pens.length - 1);
	const billableMin = Math.max(0, plotSeconds / 60 - includedPlotMin);
	const timeFeeEur = Math.round(billableMin * PRICING.plotMinEur);
	const raw = Math.ceil(base + penFeeEur + timeFeeEur + shippingEur);
	const totalEur = Math.min(raw, cap);
	return {
		tier: check.tier,
		baseEur: base,
		penFeeEur,
		timeFeeEur,
		shippingEur,
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
 * v2: per-tier included minutes/shipping/caps, gentler ramp (A6 from €19).
 */
export const ORDER_PAYLOAD_VERSION = '2';

export interface OrderContext {
	plotSeconds: number;
	lineCount: number;
	/** current source file name (image or video), '' when none */
	sourceName: string;
	/** selected preset name, '' when none */
	presetName: string;
	/** fingerprint of the exact SVG that was downloaded */
	designHash: string;
	/** the SVG reached the plot queue — the form skips its attach step */
	uploaded: boolean;
}

/** The drawn extent as both forms show it, e.g. "200x150mm". */
const sizeLabel = (check: OrderCheck): string =>
	`${Math.round(check.widthMm)}x${Math.round(check.heightMm)}mm`;

/**
 * A pen as both forms list it: its shelf name, or for an ink I don't stock,
 * the layer name plus its hex, so I can see exactly what was asked for.
 */
const inkLabel = (pen: OrderPenCheck): string =>
	`${pen.pen ? pen.pen.name : `${pen.layerName} ${pen.color}`} ${pen.widthMm}mm`;

/** Empty values would still show up as `key=` in the URL, so drop them. */
const withoutEmpty = (fields: Record<string, string>): Record<string, string> =>
	Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== ''));

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
): Record<string, string> =>
	withoutEmpty({
		price: String(quote.totalEur),
		tier: quote.tier,
		size: sizeLabel(check),
		pens: String(check.pens.length),
		inks: check.pens.map(inkLabel).join(', '),
		plotmin: String(Math.ceil(context.plotSeconds / 60)),
		lines: String(context.lineCount),
		image: fileSlug(context.sourceName),
		design: context.designHash,
		preset: context.presetName,
		// exactly 'ok' switches the form to its nothing-to-attach face
		upload: context.uploaded ? 'ok' : '',
		v: ORDER_PAYLOAD_VERSION
	});

//***************************************************************
// 										INQUIRY FORM HANDOFF
//***************************************************************

/**
 * Version marker for the inquiry payload. It is kept apart from the order's,
 * so each form's submissions stay readable as the other one changes.
 */
export const INQUIRY_PAYLOAD_VERSION = '1';

/** Something that keeps a design from going straight to an order. */
export type OrderIssue = 'inks' | 'size' | 'layers';

/** What stands between a design and an instant order. Empty when orderable. */
export const orderIssues = (check: OrderCheck): OrderIssue[] => {
	const issues: OrderIssue[] = [];
	if (check.pens.some((pen) => pen.pen === null)) issues.push('inks');
	if (check.tier === null) issues.push('size');
	if (check.pens.length === 0) issues.push('layers');
	return issues;
};

/**
 * The hidden-field payload for the inquiry form when a chat starts from a
 * studio design, orderable or not. It uses the order's vocabulary where it
 * applies, adds what keeps the design from an instant order (issue), and
 * what an instant order would cost when nothing does (price). designHash is
 * '' when the customer kept the plot file to themselves.
 */
export const inquiryHiddenFields = (
	check: OrderCheck,
	quote: OrderQuote | null,
	context: Omit<OrderContext, 'lineCount'>
): Record<string, string> =>
	withoutEmpty({
		// exactly 'studio' shows the form's design summary line
		from: 'studio',
		issue: orderIssues(check).join(','),
		size: sizeLabel(check),
		tier: check.tier ?? '',
		pens: String(check.pens.length),
		inks: check.pens.map(inkLabel).join(', '),
		plotmin: String(Math.ceil(context.plotSeconds / 60)),
		price: quote ? String(quote.totalEur) : '',
		preset: context.presetName,
		image: fileSlug(context.sourceName),
		design: context.designHash,
		// exactly 'ok' tells the form (and me) the plot file came along
		upload: context.uploaded ? 'ok' : '',
		v: INQUIRY_PAYLOAD_VERSION
	});

/** The inquiry payload from the landing page: no design yet, only the source. */
export const landingInquiryFields = (): Record<string, string> => ({
	from: 'landing',
	v: INQUIRY_PAYLOAD_VERSION
});

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
