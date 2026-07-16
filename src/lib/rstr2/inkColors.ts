// Curated plotter-ink palette + colour harmonies for the dice.
//
// The random roll no longer invents colours in HSL space; it draws from real
// inks. Every colour below is one shade from a drawing/plotter ink we can
// actually buy:
//   - De Atramentis Artist Ink   https://www.de-atramentis.com/en/Artist-ink-/
//   - Octopus Fluids Write & Draw https://www.octopus-fluids.de/en/write-draw-inks
//   - Rohrer & Klingner Zeichentusche https://www.rohrer-klingner.de/en/calligraphy-ink/
//   - Rohrer & Klingner Sketch INK    https://www.rohrer-klingner.de/en/sketchink-2/
//   - Diamine Forever (pigment)  https://www.diamineinks.co.uk/collections/diamine-50ml-forever-ink
// The manufacturers don't publish hex values (their own charts are offset
// prints, "therefore not totally precise"), so each `hex` is a hand-tuned
// approximation of the bottled colour — good enough to preview and export
// with, tweak by eye. (The Diamine hexes were sampled from the dense end of
// the official swatch photos, then rounded by eye.)
//
// Colours are grouped into hue `family`s, and HARMONY_SETS lists the family
// combinations that reliably look good together (complementary pairs, triads,
// analogous runs, neutral-anchored duotones). A roll picks ONE harmony set for
// the whole stack, then draws a distinct ink per layer from its families — so a
// multi-pen plot is guaranteed a deliberate scheme instead of a random clash.
//
// The vivid Diamine Forever shades are the accent shelf: tagged `accent`, they
// sit out of the regular family draw, and ACCENT_RATE (75%) of rolls instead
// reserve one layer for one of them — drawn from the roll's harmony families —
// so most stacks get exactly one deliberate vibrant pop. The muted Forever
// shades (Raven, Blue Indigo, …) join the regular pool like any other ink.
//
// This is the tuning table for colour: add inks, retune a hex, or add/weight a
// harmony set here and the dice picks it up.

export type InkFamily =
	'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'brown' | 'neutral';

export interface InkColor {
	/** ink name as sold, prefixed with the brand */
	name: string;
	/** hand-tuned approximation of the bottled colour (#RRGGBB, uppercase) */
	hex: string;
	family: InkFamily;
	/** false for near-white inks: real on dark paper, but invisible in the roll */
	plottable?: boolean;
	/**
	 * true for the vibrant accent shelf: excluded from the regular family draw,
	 * these only enter a roll through its dedicated accent layer (see
	 * ACCENT_RATE / pickInkScheme)
	 */
	accent?: boolean;
}

// ─── the inks ────────────────────────────────────────────────────────────────

export const INK_COLORS: InkColor[] = [
	// De Atramentis Artist Ink — the primary, mixable, lightfast range.
	{ name: 'De Atramentis Red', hex: '#D22730', family: 'red' },
	{ name: 'De Atramentis Yellow', hex: '#F5C518', family: 'yellow' },
	{ name: 'De Atramentis Green', hex: '#2E7D4F', family: 'green' },
	{ name: 'De Atramentis Blue', hex: '#1F5FA8', family: 'blue' },
	{ name: 'De Atramentis Dark Blue', hex: '#16345F', family: 'blue' },
	{ name: 'De Atramentis Brown', hex: '#6B3F22', family: 'brown' },
	{ name: 'De Atramentis Black', hex: '#1A1A1A', family: 'neutral' },
	{ name: 'De Atramentis White', hex: '#FAFAF5', family: 'neutral', plottable: false },

	// Octopus Fluids Write & Draw — 38 kooky-named shades, waterproof & lightfast.
	// Reds
	{ name: 'Octopus Red Koala', hex: '#C62828', family: 'red' },
	{ name: 'Octopus Red Duck', hex: '#A11B2E', family: 'red' },
	{ name: 'Octopus Red Turtle', hex: '#C13B24', family: 'red' },
	// Oranges
	{ name: 'Octopus Orange Monkey', hex: '#E86A1C', family: 'orange' },
	{ name: 'Octopus Orange Skunk', hex: '#C4521B', family: 'orange' },
	{ name: 'Octopus Orange Bunny', hex: '#F0913C', family: 'orange' },
	// Yellows
	{ name: 'Octopus Yellow Zebra', hex: '#F2C21E', family: 'yellow' },
	{ name: 'Octopus Yellow Wolf', hex: '#E0A81E', family: 'yellow' },
	// Greens
	{ name: 'Octopus Green Tiger', hex: '#1F6B3A', family: 'green' },
	{ name: 'Octopus Green Eagle', hex: '#6F9A2E', family: 'green' },
	{ name: 'Octopus Green Panda', hex: '#3E8E4F', family: 'green' },
	{ name: 'Octopus Green Crane', hex: '#7FA86B', family: 'green' },
	{ name: 'Octopus Green Squirrel', hex: '#5A6B32', family: 'green' },
	// Petrols / teals
	{ name: 'Octopus Green Ostrich', hex: '#2E8B6B', family: 'teal' },
	{ name: 'Octopus Petrol Buffalo', hex: '#0E5A63', family: 'teal' },
	{ name: 'Octopus Petrol Deer', hex: '#1B7A82', family: 'teal' },
	{ name: 'Octopus Petrol Axolotl', hex: '#17A2A8', family: 'teal' },
	// Blues
	{ name: 'Octopus Blue Koi', hex: '#1B4F9C', family: 'blue' },
	{ name: 'Octopus Blue Chameleon', hex: '#2A6BB0', family: 'blue' },
	{ name: 'Octopus Blue Sloth', hex: '#3A5A8C', family: 'blue' },
	{ name: 'Octopus Blue Lynx', hex: '#2456C8', family: 'blue' },
	// Violets / purples
	{ name: 'Octopus Violet Raccoon', hex: '#5B2A83', family: 'purple' },
	{ name: 'Octopus Violet Bee', hex: '#4B3B9C', family: 'purple' },
	{ name: 'Octopus Violet Lion', hex: '#7B3B8C', family: 'purple' },
	{ name: 'Octopus Violet Giraffe', hex: '#9B7BC4', family: 'purple' },
	// Pinks
	{ name: 'Octopus Pink Gazelle', hex: '#E23E7A', family: 'pink' },
	{ name: 'Octopus Pink Rhino', hex: '#D6266E', family: 'pink' },
	{ name: 'Octopus Pink Owl', hex: '#E88AA8', family: 'pink' },
	{ name: 'Octopus Pink Alpaca', hex: '#F0A6C0', family: 'pink' },
	// Browns
	{ name: 'Octopus Brown Seahorse', hex: '#7A4A2B', family: 'brown' },
	{ name: 'Octopus Brown Penguin', hex: '#4A2E20', family: 'brown' },
	{ name: 'Octopus Brown Colibri', hex: '#8A5330', family: 'brown' },
	// Greys / neutrals
	{ name: 'Octopus Grey Fox', hex: '#4A4A4A', family: 'neutral' },
	{ name: 'Octopus Grey Frog', hex: '#6E6E6E', family: 'neutral' },
	{ name: 'Octopus Kangaroo Grey', hex: '#6B7480', family: 'neutral' },
	{ name: 'Octopus Grey Merkat', hex: '#8A8078', family: 'neutral' },
	{ name: 'Octopus Black Elephant', hex: '#14120F', family: 'neutral' },
	{ name: 'Octopus White Polar Bear', hex: '#F5F2EA', family: 'neutral', plottable: false },

	// Rohrer & Klingner Zeichentusche (drawing ink) — read off the R&K colour card.
	{ name: 'R&K 710 Weiß', hex: '#FCFCFA', family: 'neutral', plottable: false },
	{ name: 'R&K 701 Gelb', hex: '#FBE200', family: 'yellow' },
	{ name: 'R&K 720 Goldgelb', hex: '#FAB916', family: 'yellow' },
	{ name: 'R&K 721 Orange', hex: '#F0841F', family: 'orange' },
	{ name: 'R&K 730 Scharlach', hex: '#F0492A', family: 'red' },
	{ name: 'R&K 731 Karmin', hex: '#B01A44', family: 'red' },
	{ name: 'R&K 702 Magenta', hex: '#C41A80', family: 'pink' },
	{ name: 'R&K 738 Purpurviolett', hex: '#8C3A96', family: 'purple' },
	{ name: 'R&K 740 Violett', hex: '#3C2E86', family: 'purple' },
	{ name: 'R&K 741 Phthaloblau', hex: '#16294C', family: 'blue' },
	{ name: 'R&K 742 Indigo', hex: '#172038', family: 'blue' },
	{ name: 'R&K 743 Türkis', hex: '#0E857E', family: 'teal' },
	{ name: 'R&K 703 Cyanblau', hex: '#0A62A8', family: 'blue' },
	{ name: 'R&K 750 Phthalogrün', hex: '#009C78', family: 'teal' },
	{ name: 'R&K 751 Saftgrün', hex: '#1E8A4C', family: 'green' },
	{ name: 'R&K 753 Gelbgrün', hex: '#72B64E', family: 'green' },
	{ name: 'R&K 754 Alt-Goldgrün', hex: '#7C7A2C', family: 'green' },
	{ name: 'R&K 762 Ocker', hex: '#E8951F', family: 'orange' },
	{ name: 'R&K 763 Siena gebrannt', hex: '#B0402A', family: 'brown' },
	{ name: 'R&K 760 Umbra', hex: '#4C2E1C', family: 'brown' },
	{ name: 'R&K 761 Sepia', hex: '#34281F', family: 'brown' },
	{ name: 'R&K 770 Schwarz', hex: '#191512', family: 'neutral' },
	{ name: 'R&K 801 Silber', hex: '#AAAEB2', family: 'neutral' },
	{ name: 'R&K 802 Gold', hex: '#B08A2E', family: 'yellow' },

	// Rohrer & Klingner Sketch INK — read off the "Sketch INK" character card.
	{ name: 'R&K Sketch 42200 Carmen', hex: '#F07C1E', family: 'orange' },
	{ name: 'R&K Sketch 42300 Nour', hex: '#D01A80', family: 'pink' },
	{ name: 'R&K Sketch 42400 Marianne', hex: '#2A7AC0', family: 'blue' },
	{ name: 'R&K Sketch 42500 Klara', hex: '#14A46C', family: 'green' },
	{ name: 'R&K Sketch 42540 Emma', hex: '#7C7C32', family: 'green' },
	{ name: 'R&K Sketch 42600 Lilly', hex: '#6C5A46', family: 'brown' },
	{ name: 'R&K Sketch 42700 Lotte', hex: '#161616', family: 'neutral' },
	{ name: 'R&K Sketch 42710 Thea', hex: '#7C776C', family: 'neutral' },
	{ name: 'R&K Sketch 42730 Frieda', hex: '#1E3C5A', family: 'blue' },
	{ name: 'R&K Sketch 42750 June', hex: '#7C2A3E', family: 'red' },

	// Diamine Forever (50 ml) — waterproof & lightfast pigment inks. The vivid
	// shades are the `accent` shelf that gives most rolls their pop layer.
	{ name: 'Diamine Forever Cherry Red', hex: '#C6414F', family: 'red', accent: true },
	{ name: 'Diamine Forever Coral Blaze', hex: '#F95F4C', family: 'red', accent: true },
	{ name: 'Diamine Forever Tiger Lily', hex: '#E64C2B', family: 'orange', accent: true },
	{ name: 'Diamine Forever Honey Pot', hex: '#EC8C07', family: 'orange', accent: true },
	{ name: 'Diamine Forever Solar Yellow', hex: '#FBCA08', family: 'yellow', accent: true },
	{ name: 'Diamine Forever Hyper Green', hex: '#6CA209', family: 'green', accent: true },
	{ name: 'Diamine Forever Amazonia', hex: '#0B6935', family: 'green', accent: true },
	{ name: 'Diamine Forever Aqua Surf', hex: '#239495', family: 'teal', accent: true },
	{ name: 'Diamine Forever Skyline', hex: '#0571AC', family: 'blue', accent: true },
	{ name: 'Diamine Forever Passion Flower', hex: '#8661AB', family: 'purple', accent: true },
	{ name: 'Diamine Forever Hot Magenta', hex: '#CF2364', family: 'pink', accent: true },
	// muted Forever shades — regular palette members, not accents
	{ name: 'Diamine Forever Blue Indigo', hex: '#2A4E70', family: 'blue' },
	{ name: 'Diamine Forever Smoky Mauve', hex: '#7B6167', family: 'purple' },
	{ name: 'Diamine Forever Butterscotch', hex: '#A05915', family: 'brown' },
	{ name: 'Diamine Forever Red Ochre', hex: '#8A4236', family: 'brown' },
	{ name: 'Diamine Forever Raven', hex: '#22211C', family: 'neutral' }
];

// ─── colour harmonies ────────────────────────────────────────────────────────

/**
 * Family combinations that reliably read as a deliberate scheme. A roll picks
 * one set, shuffles its families, and hands one distinct ink per layer. Order
 * inside a set doesn't matter (it's shuffled); weight biases how often the set
 * comes up — higher for the safe, high-contrast classics.
 */
export interface HarmonySet {
	name: string;
	families: InkFamily[];
	weight: number;
}

export const HARMONY_SETS: HarmonySet[] = [
	// complementary pairs — maximum contrast, hard to get wrong
	{ name: 'blue / orange', families: ['blue', 'orange'], weight: 5 },
	{ name: 'teal / red', families: ['teal', 'red'], weight: 4 },
	{ name: 'purple / yellow', families: ['purple', 'yellow'], weight: 3 },
	{ name: 'green / pink', families: ['green', 'pink'], weight: 3 },
	{ name: 'blue / brown', families: ['blue', 'brown'], weight: 3 },
	{ name: 'red / green', families: ['red', 'green'], weight: 2 },
	// triads & split-complementary — three balanced hues
	{ name: 'primary triad', families: ['red', 'yellow', 'blue'], weight: 3 },
	{ name: 'secondary triad', families: ['orange', 'green', 'purple'], weight: 2 },
	{ name: 'blue split', families: ['blue', 'orange', 'red'], weight: 2 },
	{ name: 'teal split', families: ['teal', 'red', 'yellow'], weight: 2 },
	{ name: 'purple split', families: ['purple', 'yellow', 'green'], weight: 2 },
	{ name: 'pink / teal / yellow', families: ['pink', 'teal', 'yellow'], weight: 2 },
	// analogous runs — neighbours on the wheel, quietly cohesive
	{ name: 'cool analogous', families: ['blue', 'teal', 'green', 'purple'], weight: 2 },
	{ name: 'warm analogous', families: ['red', 'orange', 'yellow', 'brown'], weight: 2 },
	{ name: 'berry analogous', families: ['pink', 'purple', 'blue', 'teal'], weight: 2 },
	// neutral-anchored — one strong colour against ink black / grey
	{ name: 'neutral + red', families: ['neutral', 'red'], weight: 2 },
	{ name: 'neutral + blue', families: ['neutral', 'blue'], weight: 2 },
	{ name: 'neutral + teal + orange', families: ['neutral', 'teal', 'orange'], weight: 2 }
];

// ─── picking ─────────────────────────────────────────────────────────────────

export type Rng = () => number;

const shuffle = <T>(items: T[], rng: Rng): T[] => {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

const weightedIndex = (weights: number[], rng: Rng): number => {
	const total = weights.reduce((sum, w) => sum + w, 0);
	let roll = rng() * total;
	for (let i = 0; i < weights.length; i++) {
		roll -= weights[i];
		if (roll <= 0) return i;
	}
	return weights.length - 1;
};

/**
 * How often a roll reserves one layer for a vibrant accent ink — the Diamine
 * Forever shelf exists for this: 75% of rolls get exactly one such pop layer.
 */
export const ACCENT_RATE = 0.75;

/** the vibrant accent-shelf inks (see `InkColor.accent`) */
export const accentInks = (): InkColor[] =>
	INK_COLORS.filter((ink) => ink.accent === true && ink.plottable !== false);

/** the plottable inks in a family (near-whites and the accent shelf are skipped) */
export const familyInks = (family: InkFamily): InkColor[] =>
	INK_COLORS.filter(
		(ink) => ink.family === family && ink.plottable !== false && ink.accent !== true
	);

/** an unused plottable ink from `family`, or null if the family is exhausted */
const pickFromFamily = (family: InkFamily, used: Set<string>, rng: Rng): InkColor | null => {
	const free = familyInks(family).filter((ink) => !used.has(ink.hex));
	if (free.length === 0) return null;
	return free[Math.floor(rng() * free.length)];
};

/**
 * Pick `count` distinct inks that form a deliberate scheme. One harmony set is
 * chosen for the whole stack; each layer draws from a different family in that
 * set (wrapping to a second shade of a family when a plot has more layers than
 * the set has families). ACCENT_RATE of rolls also reserve one layer for a
 * vibrant accent-shelf ink drawn from the set's families, so most stacks get
 * exactly one pop of colour. Returns the chosen inks in layer order — the
 * caller takes `hex` for the colour and `name` for the layer label.
 */
export const pickInkScheme = (count: number, rng: Rng): InkColor[] => {
	const set =
		HARMONY_SETS[
			weightedIndex(
				HARMONY_SETS.map((s) => s.weight),
				rng
			)
		];
	const families = shuffle(set.families, rng);
	const used = new Set<string>();
	const picks: (InkColor | null)[] = Array.from({ length: count }, () => null);

	// the vibrant accent layer — an accent ink from the set's own families keeps
	// the scheme deliberate; only a set with no accent-covered family (none
	// today) falls back to the whole shelf
	if (count > 0 && rng() < ACCENT_RATE) {
		const shelf = accentInks();
		const inSet = shelf.filter((ink) => set.families.includes(ink.family));
		const pool = inSet.length > 0 ? inSet : shelf;
		if (pool.length > 0) {
			const accent = pool[Math.floor(rng() * pool.length)];
			picks[Math.floor(rng() * count)] = accent;
			used.add(accent.hex);
		}
	}

	for (let i = 0; i < count; i++) {
		if (picks[i] !== null) continue;
		// prefer this layer's family; fall back to any set family with a free
		// shade, then (only if the whole set is drained) allow any ink at all
		let ink =
			pickFromFamily(families[i % families.length], used, rng) ??
			families.map((f) => pickFromFamily(f, used, rng)).find(Boolean) ??
			null;
		if (!ink) {
			const free = INK_COLORS.filter((c) => c.plottable !== false && !used.has(c.hex));
			ink = (free.length > 0 ? free : INK_COLORS)[0];
		}
		used.add(ink.hex);
		picks[i] = ink;
	}
	return picks as InkColor[];
};
