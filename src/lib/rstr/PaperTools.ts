import paper from 'paper';
import { getTranslationVector } from '$lib/rstr/SketchTools';
import type { Pen } from '$lib/rstr/sketchTypes';

export function hatchRectangle(
	p: paper.PaperScope,
	rect: paper.Path.Rectangle,
	angle: number,
	spacing: number,
	layer: paper.Layer | null = null,
	pen: Pen | null = null
) {
	const translation = getTranslationVector(angle, spacing);
	if (translation.x < 0) {
		translation.x *= -1;
		translation.y *= -1;
	}
	const inverse = { x: -translation.x, y: -translation.y };
	console.debug(
		'hatchRectangle',
		'rect',
		rect.bounds,
		'angle',
		angle,
		'spacing',
		spacing,
		'translation',
		translation
	);
	const h = new p.Path.Line({
		from: [rect.bounds.x, rect.bounds.y - rect.bounds.height * 4],
		to: [rect.bounds.x, rect.bounds.y + rect.bounds.height * 4],
		strokeWidth: 1,
		strokeColor: 'red'
	});
	h.rotate(angle, [rect.bounds.x, rect.bounds.y + rect.bounds.height / 2]);
	console.debug('finding start position');
	while (h.intersects(rect.getItem({ class: p.Path.Rectangle }))) {
		h.translate(inverse);
		console.debug('translating', h.bounds);
	}
	console.debug('start position', h.bounds);

	do {
		h.translate(translation);
		const intersections = rect.getIntersections(h);
		if (intersections.length === 2) {
			const from = intersections[0].point;
			const to = intersections[1].point;
			const l = new p.Path.Line({ from: from, to: to });
			l.strokeWidth = 1;
			l.strokeColor = new p.Color('black');
			if (pen) {
				l.strokeWidth = pen.strokeWidth;
				l.strokeColor = new p.Color(pen.strokeColor);
				if (pen.opacity) l.opacity = pen.opacity;
				if (pen.angle) {
					const radians = (angle - pen.angle) * (Math.PI / 180);
					l.strokeWidth = pen.strokeWidth * Math.max(0.1, Math.abs(Math.sin(radians)));
				}
			}
			// console.debug('adding line', l.bounds);
			if (layer) {
				layer.addChild(l);
			}
		} else if (intersections.length > 0) {
			console.warn('unhandled intersections', intersections.length);
		}
	} while (rect.getIntersections(h).length > 0);

	h.remove();
}
