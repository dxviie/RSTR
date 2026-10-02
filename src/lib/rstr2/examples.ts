// Examples the landing page can open in the studio, at /studio?example=<id>:
// a source image and the exact settings behind the drawing shown there.
// The sources are lossless, so the studio reproduces the landing page's
// numbers to the line (a lossy copy shifts the cell averages enough to
// change the regions).

import { defaultClassicLayers } from './layers';
import { defaultParams } from './params';
import type { Rstr2Settings } from './presets';

export interface StudioExample {
	/** the source image, lossless */
	src: string;
	/** the file name exports are named after */
	name: string;
	settings: Rstr2Settings;
}

export const EXAMPLES: Record<string, StudioExample> = {
	// Vermeer's Milkmaid in one black pen: the "how it works" drawing on the
	// landing page (278 regions, 3,831 lines at the default 200 mm width)
	milkmaid: {
		src: '/how/milkmaid-source.webp',
		name: 'milkmaid',
		settings: {
			params: {
				...defaultParams(),
				imageGamma: 1.3,
				resolution: 256,
				tolerance: 0.05,
				minRegionSize: 1,
				penWidthMm: 0.5,
				spacingMinMm: 0.6,
				spacingMaxMm: 4,
				hatchGamma: 2.6,
				inkBoost: 1.6
			},
			layers: defaultClassicLayers()
		}
	}
};

/** the example behind a ?example= value, or null for anything unknown */
export const exampleById = (id: string | null | undefined): StudioExample | null =>
	id && Object.hasOwn(EXAMPLES, id) ? EXAMPLES[id] : null;
