// "How it works" material: one painting taken through the real RSTR
// pipeline. Vermeer's Milkmaid went through the rstr2 engine (the same
// code the studio runs) and every stage was saved as a pixel-aligned
// image in static/how/, at 600w and 1200w. The last stage is the real
// thing: photos of the Milkmaid plot in the gallery.

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

/** single black pen, transparent background */
export const HOW_LINES = stage(
	'milkmaid-lines',
	'the painting redrawn as black hatch lines, dense in the shadows, sparse in the light wall'
);

/** the same lines on paper white */
export const HOW_LINES_PAPER = stage(
	'milkmaid-lines-paper',
	'the painting redrawn as black hatch lines on white paper'
);

/** cyan, magenta and yellow pens combined, on paper white */
export const HOW_CMY = stage(
	'milkmaid-cmy',
	'the painting redrawn with three pens, cyan, magenta and yellow hatching layered on top of each other'
);

/** one image per pen, transparent backgrounds, in stacking order */
export const HOW_PENS = [
	stage('milkmaid-pen-c', 'the cyan pen layer on its own'),
	stage('milkmaid-pen-m', 'the magenta pen layer on its own'),
	stage('milkmaid-pen-y', 'the yellow pen layer on its own')
];

/**
 * A coarser single-pen render as one SVG path in plotting order, for
 * stroke-dashoffset "the plotter is drawing" animations. Same viewBox as
 * the stage images (HOW_WIDTH × HOW_HEIGHT).
 */
export const HOW_COARSE_SVG = '/how/milkmaid-lines-coarse.svg';

/** the real plot: a photo of the plotted Milkmaid, and one on the AxiDraw */
export const HOW_PLOT = {
	src: plotSrc('melkmeisje', 800),
	srcset: plotSrcset('melkmeisje'),
	alt: 'the real plot: the Milkmaid drawn in black pen on white paper',
	name: 'melkmeisje'
};
export const HOW_PLOT_ON_MACHINE = {
	src: plotSrc('melkmeisje-2', 800),
	srcset: plotSrcset('melkmeisje-2'),
	alt: 'the Milkmaid plot on the AxiDraw, the pen still in its holder above the paper',
	name: 'melkmeisje-2'
};

/** the studio with the Milkmaid loaded and the "Black classic" preset */
export const HOW_STUDIO = {
	src: '/how/studio-720w.webp',
	srcset: '/how/studio-720w.webp 720w, /how/studio-1440w.webp 1440w',
	alt: 'the RSTR studio: image and line settings on the left, the hatched Milkmaid in the middle, pens, export buttons and the plot time estimate on the right',
	width: 1440,
	height: 900
};

/** what the engine reported for these renders (filled in from the generator) */
export const HOW_STATS = {
	regions: 0,
	lines: 0,
	plotTime: '',
	pens: 3
};

export const MILKMAID_CREDIT =
	'The Milkmaid by Johannes Vermeer, about 1660, Rijksmuseum Amsterdam. Public domain.';
