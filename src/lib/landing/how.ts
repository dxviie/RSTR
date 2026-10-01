// "How it works" material: one painting taken through the real RSTR
// pipeline. Vermeer's Milkmaid went through the rstr2 engine (the same
// code the studio runs) and every stage was saved as a pixel-aligned
// image in static/how/, at 600w and 1200w. The last stage is the real
// thing: a photo of the Milkmaid plot from the gallery.

import { plotSrc, plotSrcset } from './plots';

export interface HowImage {
	src: string;
	srcset: string;
	alt: string;
	width: number;
	height: number;
}

/** every stage image shares the painting's framing and size */
export const HOW_WIDTH = 1200;
export const HOW_HEIGHT = 1345;

const stage = (name: string, alt: string): HowImage => ({
	src: `/how/${name}-600w.webp`,
	srcset: `/how/${name}-600w.webp 600w, /how/${name}-1200w.webp 1200w`,
	alt,
	width: HOW_WIDTH,
	height: HOW_HEIGHT
});

export const HOW_PHOTO = stage(
	'milkmaid-photo',
	"Vermeer's painting The Milkmaid: a woman in a yellow bodice and blue apron pours milk at a table by a window"
);

export const HOW_REGIONS = stage(
	'milkmaid-regions',
	'the same painting carved into flat regions of similar tone, like a paint-by-numbers'
);

/** the single black pen's lines on paper white */
export const HOW_LINES_PAPER = stage(
	'milkmaid-lines-paper',
	'the painting redrawn as black hatch lines on white paper'
);

/** cyan, magenta and yellow pens combined, on paper white */
export const HOW_CMY = stage(
	'milkmaid-cmy',
	'the painting redrawn with three pens, cyan, magenta and yellow hatching layered on top of each other'
);

/**
 * One image per pen, transparent backgrounds, in plotting order: yellow
 * goes down first, then magenta, then cyan. Each pen is drawn at the
 * studio's 0.85 alpha, so stacking them with mix-blend-mode: multiply over
 * paper white (#fffef7) gives HOW_CMY (multiply doesn't care about order).
 */
export const HOW_PENS = [
	{ ...stage('milkmaid-pen-y', 'the yellow pen layer on its own'), pen: 'Y', ink: '#ffb000' },
	{ ...stage('milkmaid-pen-m', 'the magenta pen layer on its own'), pen: 'M', ink: '#ff2aa6' },
	{ ...stage('milkmaid-pen-c', 'the cyan pen layer on its own'), pen: 'C', ink: '#00bfe8' }
];

/** the real plot: a photo of the plotted Milkmaid */
export const HOW_PLOT = {
	src: plotSrc('melkmeisje', 800),
	srcset: plotSrcset('melkmeisje'),
	alt: 'the real plot: the Milkmaid drawn in black pen on white paper',
	name: 'melkmeisje'
};

/**
 * The studio with the Milkmaid loaded and the same settings as the stage
 * renders, so its stats panel shows exactly the HOW_STATS numbers.
 */
export const HOW_STUDIO = {
	src: '/how/studio-720w.webp',
	srcset: '/how/studio-720w.webp 720w, /how/studio-1440w.webp 1440w',
	alt: 'the RSTR studio: image and line settings on the left, the hatched Milkmaid in the middle, the pen, export buttons and the stats on the right: 278 regions, 3,831 lines, about 1h 37m of plotting',
	width: 1440,
	height: 900
};

/**
 * What the engine reported for these renders (watershed, output 200 mm
 * wide; plot times from the studio's saxi-style estimate with its default
 * plotter profile, formatted the way the studio formats them).
 */
export const HOW_STATS = {
	/** the single black pen behind HOW_LINES */
	regions: 278,
	lines: 3831,
	lengthM: 38,
	plotTime: '1h 37m',
	/** the three pens behind HOW_CMY / HOW_PENS */
	cmy: {
		pens: 3,
		lines: 9633,
		lengthM: 105,
		plotTime: '4h 18m'
	},
	widthMm: 200,
	heightMm: 224
};

export const MILKMAID_CREDIT =
	'The Milkmaid by Johannes Vermeer, about 1660, Rijksmuseum Amsterdam. Public domain.';
