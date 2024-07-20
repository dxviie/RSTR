import paper from 'paper';
import { getTranslationVector } from '$lib/ccp/SketchTools.ts';
import type { Pen } from '$lib/ccp/sketchTypes';

export function hatchShape(
	shape: paper.PathItem,
	box: paper.Path.Rectangle,
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
		'shape',
		shape,
		'rect',
		box,
		'angle',
		angle,
		'spacing',
		spacing,
		'translation',
		translation
	);
	const h = new paper.Path.Line({
		from: [box.bounds.x, box.bounds.y - box.bounds.height * 4],
		to: [box.bounds.x, box.bounds.y + box.bounds.height * 4],
		strokeWidth: 1,
		strokeColor: 'red'
	});
	h.rotate(angle, [box.bounds.x, box.bounds.y + box.bounds.height / 2]);
	console.debug('finding start position');
	while (h.intersects(shape.getItem({ class: paper.Path.Rectangle }))) {
		h.translate(inverse);
		console.debug('translating', h.bounds);
	}
	console.debug('start position', h.bounds);

	do {
		h.translate(translation);
		const intersections = shape.getIntersections(h);
		if (intersections.length === 2) {
			const from = intersections[0].point;
			const to = intersections[1].point;
			const l = new paper.Path.Line({ from: from, to: to });
			l.strokeWidth = 1;
			l.strokeColor = new paper.Color('black');
			if (pen) {
				l.strokeWidth = pen.strokeWidth;
				l.strokeColor = new paper.Color(pen.strokeColor);
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
	} while (shape.getIntersections(h).length > 0);

	h.remove();
}
