// Standalone SVG document assembly for plotter export.
//
// One <g> per layer (= one physical pen), hatch lines as compact paths.
// Physical size comes from the requested output width; height follows the
// image aspect. The multiply blend + opacity make the browser preview of the
// exported file resemble overlapping transparent inks; plotter tools only
// read the paths.

import { CHANNEL_LABELS, type LayerConfig } from './layers';
import { segmentsToSvgPath, type HatchSegments } from './hatchTools';
import type { Rstr2Settings } from './presets';

export interface ExportLayer {
	layer: LayerConfig;
	/** resolved stroke width in pixel space (per-layer override or global) */
	penWidthPx: number;
	/** hatch segment lists of the layer's regions (empty ones are skipped) */
	segments: HatchSegments[];
}

const escapeAttr = (value: string): string =>
	value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** XML comments must not contain "--" — break any run of hyphens apart. */
const commentSafe = (text: string): string => text.replace(/-(?=-)/g, '- ');

/**
 * The full app configuration as a human-readable XML comment, so an exported
 * file documents how to recreate itself. Sits at the very top of the
 * document, before the <svg> element.
 */
export const settingsComment = (settings: Rstr2Settings): string => {
	const { params, layers } = settings;
	const lines: string[] = [];
	const line = (label: string, value: string | number | null) => {
		if (value === null) return;
		// 20 keeps at least two spaces after the widest label (ink threshold high)
		lines.push(`    ${label.padEnd(20)}${value}`);
	};
	const mm = (value: number | null) => (value === null ? null : `${value} mm`);

	lines.push('  made with RSTR studio');
	lines.push('  https://rstr.d17e.dev');
	lines.push('');
	lines.push('  image');
	line('brightness', params.brightness);
	line('contrast', params.contrast);
	line('gamma / key', params.imageGamma);
	line('saturation', params.saturation);
	line('vibrance', params.vibrance);
	lines.push('');
	lines.push('  segmentation');
	line('algorithm', params.algorithm);
	line('resolution', params.resolution);
	line('smoothing', params.smoothing);
	if (params.algorithm === 'slic') {
		line('superpixel size', params.slicCellSize);
		line('compactness', params.slicCompactness);
	}
	line('tolerance', params.tolerance);
	line('min region size', params.minRegionSize);
	lines.push('');
	lines.push('  lines');
	line('pen width', mm(params.penWidthMm));
	line('spacing', `${params.spacingMinMm} to ${params.spacingMaxMm} mm`);
	line('ink threshold', `${params.hatchThresholdLow} to ${params.hatchThresholdHigh}`);
	line('ink gamma', params.hatchGamma);
	line('ink boost', params.inkBoost);
	lines.push('');
	lines.push('  export');
	line('output width', mm(params.outputWidthMm));
	line('fit margin', mm(params.fitMarginMm));
	layers.forEach((layer, index) => {
		lines.push('');
		lines.push(`  layer ${index + 1}: ${layer.name}${layer.enabled ? '' : ' (disabled)'}`);
		line('channel', CHANNEL_LABELS[layer.channel]);
		line('color', layer.color);
		line('angle', `${layer.angleMin} to ${layer.angleMax} deg`);
		// per-layer overrides — a missing line inherits the global value above
		line('pen width', mm(layer.penWidthMm));
		line('spacing min', mm(layer.spacingMinMm));
		line('spacing max', mm(layer.spacingMaxMm));
		line('ink threshold low', layer.thresholdLow);
		line('ink threshold high', layer.thresholdHigh);
		line('ink gamma', layer.inkGamma);
		line('ink boost', layer.inkBoost);
	});

	return `<!--\n${commentSafe(lines.join('\n'))}\n-->\n`;
};

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
 * @param settings when given, embedded as a human-readable comment at the top
 */
export const buildSvgDocument = (
	layers: ExportLayer[],
	widthPx: number,
	heightPx: number,
	outputWidthMm: number,
	settings?: Rstr2Settings
): string => {
	const outputHeightMm = (outputWidthMm * heightPx) / widthPx;
	let svg = settings ? settingsComment(settings) : '';
	svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${outputWidthMm.toFixed(2)}mm" height="${outputHeightMm.toFixed(2)}mm" viewBox="0 0 ${widthPx} ${heightPx}">\n`;
	for (const layer of layers) {
		svg += layerGroupSvg(layer);
	}
	svg += '</svg>\n';
	return svg;
};
