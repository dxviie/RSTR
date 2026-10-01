// Plot photography for the landing page. Every shot lives in static/gallery
// as pre-sized -400w / -800w / -1920w webp renditions.

export interface Plot {
	name: string;
	alt: string;
}

export const PLOT_WIDTHS = [400, 800, 1920] as const;

export const plotSrc = (name: string, width: number) => `/gallery/${name}-${width}w.webp`;
export const plotSrcset = (name: string) =>
	PLOT_WIDTHS.map((w) => `${plotSrc(name, w)} ${w}w`).join(', ');

// gallery order: full pieces and detail shots interleaved
export const GALLERY_PLOTS: Plot[] = [
	{
		name: 'space-1-1',
		alt: 'plot of the Cosmic Cliffs of the Carina Nebula in layered colored pens'
	},
	{
		name: 'lia-1',
		alt: 'a child standing in a field of red poppies, rebuilt in dense multicolor hatching'
	},
	{
		name: 'pearl-1',
		alt: 'Girl with a Pearl Earring rebuilt from blocks of directional hatching'
	},
	{ name: 'street-1', alt: 'a canal bridge and townscape plotted in layered colour hatching' },
	{ name: 'mona-1', alt: 'figure and its long shadow on a path, in dense multicolor crosshatch' },
	{ name: 'path-1', alt: 'two figures by a mountain lake, rebuilt from fine pen hatching' },
	{ name: 'melkmeisje', alt: "Vermeer's Milkmaid plotted in single-pen black hatching" },
	{ name: 'webb-1', alt: 'a nebula plotted in bands of purple, gold and red with bright stars' },
	{
		name: 'puma-1',
		alt: "a puma's face rebuilt in dense multicolor pen hatching, with bright yellow eyes"
	},
	{
		name: 'siesta-1',
		alt: 'a dog resting in a sunlit garden, rebuilt in warm multicolor hatching'
	},
	{
		name: 'weave-1',
		alt: 'a portrait of a bearded man rebuilt in woven blocks of colored pen hatching'
	},
	{
		name: 'broken-gradient-2',
		alt: 'abstract gradient study, a dark monolith over a teal-to-magenta field'
	},
	{ name: 'metro-1', alt: 'a child in a red hat on the metro, in warm hatched colour' },
	{ name: 'mona-2', alt: 'close-up of the crosshatched pen strokes' },
	{ name: 'lines-1', alt: 'an abstract portrait plotted in dense single-pen directional lines' },
	{ name: 'space-2-1', alt: 'plot of a nebula in reds and oranges on a dark starfield' },
	{ name: 'street-2', alt: 'detail of the townscape plot, blue sky over hatched rooftops' },
	{ name: 'pearl-2', alt: 'detail of the hatched blocks in the Pearl Earring plot' },
	{ name: 'hatch-1', alt: 'close-up of vivid magenta, blue and yellow pen strokes' },
	{ name: 'melkmeisje-2', alt: 'the Milkmaid plot in progress on the AxiDraw' },
	{ name: 'space-1-2', alt: 'detail of the Carina Nebula plot, thousands of tiny pen strokes' },
	{ name: 'broken-gradient-2-2', alt: 'detail of the woven hatch texture in the gradient study' },
	{ name: 'space-2-2', alt: 'detail of the red nebula plot with sparkling star highlights' }
];

// the finished pieces (detail shots stay in the gallery)
const HERO_NAMES = new Set([
	'space-1-1',
	'lia-1',
	'pearl-1',
	'street-1',
	'mona-1',
	'path-1',
	'melkmeisje',
	'webb-1',
	'puma-1',
	'siesta-1',
	'weave-1',
	'metro-1',
	'lines-1',
	'space-2-1',
	'melkmeisje-2'
]);

export const HERO_PLOTS: Plot[] = GALLERY_PLOTS.filter((plot) => HERO_NAMES.has(plot.name));

/**
 * Fisher-Yates shuffle that leaves the first `keep` entries in place. The
 * landing page shuffles on the client only, and keeping the server-rendered
 * first slide where it is means hydration never swaps the picture already
 * on screen.
 */
export const shuffleTail = <T>(items: readonly T[], keep = 1): T[] => {
	const out = items.slice();
	for (let i = out.length - 1; i > keep; i--) {
		const j = keep + Math.floor(Math.random() * (i - keep + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};
