// Standalone SVG document assembly for plotter export.
//
// One <g> per layer (= one physical pen), hatch lines as compact paths.
// Physical size comes from the requested output width; height follows the
// image aspect. The multiply blend + opacity make the browser preview of the
// exported file resemble overlapping transparent inks; plotter tools only
// read the paths.

import type { LayerConfig } from './layers';
import { segmentsToSvgPath, type HatchSegments } from './hatchTools';

export interface ExportLayer {
	layer: LayerConfig;
	/** resolved stroke width in pixel space (per-layer override or global) */
	penWidthPx: number;
	/** hatch segment lists of the layer's regions (empty ones are skipped) */
	segments: HatchSegments[];
}

const escapeAttr = (value: string): string =>
	value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

export const layerGroupSvg = (exportLayer: ExportLayer): string => {
	const { layer, penWidthPx, segments } = exportLayer;
	let svg = `<g id="hatch-${escapeAttr(layer.id)}" inkscape:groupmode="layer" inkscape:label="${escapeAttr(layer.name)}" stroke="${escapeAttr(layer.color)}" stroke-width="${penWidthPx.toFixed(3)}" fill="none" stroke-linecap="round" opacity="0.85" style="mix-blend-mode: multiply;">\n`;
	for (const segmentList of segments) {
		if (segmentList.length === 0) continue;
		svg += `<path d="${segmentsToSvgPath(segmentList)}" />\n`;
	}
	svg += '</g>\n';
	return svg;
};

/**
 * Build a complete SVG document for the given layers.
 *
 * @param widthPx  source image width — defines the coordinate space
 * @param heightPx source image height
 * @param outputWidthMm physical output width; height keeps the aspect ratio
 */
export const buildSvgDocument = (
	layers: ExportLayer[],
	widthPx: number,
	heightPx: number,
	outputWidthMm: number
): string => {
	const outputHeightMm = (outputWidthMm * heightPx) / widthPx;
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${outputWidthMm.toFixed(2)}mm" height="${outputHeightMm.toFixed(2)}mm" viewBox="0 0 ${widthPx} ${heightPx}">\n`;
	for (const layer of layers) {
		svg += layerGroupSvg(layer);
	}
	svg += '</svg>\n';
	return svg;
};
