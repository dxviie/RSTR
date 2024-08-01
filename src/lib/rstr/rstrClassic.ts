import type { RstrFillingAlgo, RstrGroup, RstrGroupingAlgo, RstrPixel } from '$lib/rstr/rstr.ts';
import paper from 'paper';
import type { RstrConfig } from '$lib/rstr/config.svelte.ts';

/***************************************
 						GROUPING
 ***************************************/

function findNeighboringGroups(group: RstrGroup, groups: RstrGroup[], maxPixelCount: number = Number.MAX_VALUE): RstrGroup[] {
	const neighbors = [];

	const verticalSliceCount = Math.ceil(Math.sqrt(groups.length));
	const startIndex = Math.max(0, groups.indexOf(group)) + 1;
	const endIndex = Math.min(groups.length, startIndex + (verticalSliceCount * maxPixelCount * 2));

	for (let index = startIndex; index < endIndex; index++) {
		const neighbor = groups[index];
		if (neighbor === group) continue;
		if (neighbor.pixels.length > maxPixelCount) continue;
		if (neighbor.timesVisited > group.timesVisited) continue;
		if (!neighbors.includes(neighbor) && neighbor.pixels.some(p => group.pixels.some(gp => gp.isNeighbor(p, false)))) {
			neighbors.push(neighbor);
		}
	}
	return neighbors;
}

const groupColors = ['darkorange', 'red', 'purple', 'blue', 'black'];

export class RstrClassicGrouping implements RstrGroupingAlgo, RstrFillingAlgo {

	doGroupingStep(groups: RstrGroup[], config: RstrConfig): RstrGroup[] {
		let iters = this.iterationsFinished(groups);
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];
			if (group.timesVisited <= iters) {
				const neighbors = findNeighboringGroups(group, groups, Math.pow(2, iters + 1));
				const neighborDiffs = neighbors.map((n) => {
					return Math.abs(group.getAverageLightness() - n.getAverageLightness());
				});
				// find the index in neighborDiffs of the smallest element
				const minIndex = neighborDiffs.indexOf(Math.min(...neighborDiffs));
				if (minIndex >= 0) {
					const neighbor = neighbors[minIndex];
					const diff = neighborDiffs[minIndex];
					if (diff < config.tolerance) {
						neighbor.timesVisited++;
						// merge the two groups
						const temp = group.shape;
						group.pixels = group.pixels.concat(neighbor.pixels);
						group.shape = group.shape.unite(neighbor.shape);
						temp.remove();
						group.shape.opacity = 1;
						neighbor.shape.remove();
						// remove the neighbor from the groups list
						groups.splice(groups.indexOf(neighbor), 1);
					}
				}
				group.shape.strokeColor = new paper.Color(groupColors[group.timesVisited % groupColors.length]);
				group.timesVisited++;
				return groups;
			}
		}
		return groups;
	}

	initGroups(grid: RstrPixel[][], layer: paper.Layer, config: RstrConfig): RstrGroup[] {
		const groups: RstrGroup[] = [];
		for (let i = 0; i < grid.length; i++) {
			for (let j = 0; j < grid[i].length; j++) {
				const pixel = grid[i][j];
				let group = new RstrClassicGroup(pixel, config);
				pixel.group = group;
				group.shape.opacity = 0;
				group.shape.addTo(layer);
				groups.push(group);
			}
		}
		return groups;
	}

	iterationsFinished(groups: RstrGroup[]): number {
		return Math.min(...groups.map(g => g.timesVisited));
	}

	/***************************************
 						HATCHING
	 ***************************************/

	fillGroup(group: RstrGroup, layer: paper.Layer, config: RstrConfig): void {
		if (group.isFilled) return;
		group.isFilled = true;
		const box = group.getBoundingBox();

		// get the average color for each quadrant of the block
		const corners = group.getCornerPixels();
		const diffDesc = Math.abs(corners.topLeft.getAverageColorValue() - corners.bottomRight.getAverageColorValue());
		const diffAsc = Math.abs(corners.topRight.getAverageColorValue() - corners.bottomLeft.getAverageColorValue());
		let start, end;
		let pattern = 2;
		if (diffAsc < diffDesc) {
			// descending
			if (config.halves && diffDesc > config.tolerance / 2) {
				pattern = corners.topLeft.getAverageColorValue() > corners.bottomRight.getAverageColorValue() ? 1 : 0;
			}
			start = new paper.Point(box.bounds.x, box.bounds.y);
			end = new paper.Point(
				box.bounds.x + box.bounds.width,
				box.bounds.y + box.bounds.height
			);
		} else {
			// ascending
			if (config.halves && diffAsc > config.tolerance / 2) {
				pattern = corners.topRight.getAverageColorValue() > corners.bottomLeft.getAverageColorValue() ? 1 : 0;
			}
			start = new paper.Point(box.bounds.x, box.bounds.y + box.bounds.height);
			end = new paper.Point(box.bounds.x + box.bounds.width, box.bounds.y);
		}
		// map average color to linecount
		const lineCount = (config.density * box.bounds.width) * (1 - group.getAverageLightness());
		// function hatchFillRectangle(debug, start, end, rectangle, lineCount, pattern) {
		hatchFillRectangle(false, start, end, box, group.shape, lineCount, pattern, layer, group);
		if (box) box.remove();
	}
}

const cyan = new paper.Color('cyan');
const magenta = new paper.Color('magenta');
const yellow = new paper.Color('yellow');
const black = new paper.Color('black');

function hatchFillRectangle(debug, start, end, rectangle, shape, lineCount, pattern, layer, group) {
	let direction = new paper.Path.Line(start, end);
	let actualLineCount = lineCount;
	if (pattern === 0) {
		direction = new paper.Path.Line(start, direction.getPointAt(direction.length / 2));
		actualLineCount = lineCount / 2;
	} else if (pattern === 1) {
		direction = new paper.Path.Line(direction.getPointAt(direction.length / 2), end);
		actualLineCount = lineCount / 2;
	}
	if (debug) {
		direction.strokeColor = 'red';
	}
	for (let i = 0; i < actualLineCount; i++) {
		let linePoint = direction.getPointAt((i * direction.length) / (actualLineCount - 1));
		if (!linePoint) {
			continue;
		}
		// draw a line perpendicular to direction through linePoint
		const perpendicular = direction.getNormalAt((i * direction.length) / (actualLineCount - 1));
		const lineStart = linePoint.subtract(perpendicular.multiply(direction.length * 2));
		const lineEnd = linePoint.add(perpendicular.multiply(direction.length * 2));
		const line = new paper.Path.Line(lineStart, lineEnd);
		const hrs = line.getIntersections(shape);
		if (hrs && hrs.length > 0 && hrs.length % 2 === 0) {
			const lines = Math.ceil(hrs.length / 2);
			for (let i = 0; i < lines; i++) {
				const l = new paper.Path.Line(hrs[i * 2].point, hrs[(i * 2) + 1].point);
				l.strokeColor = black;
				l.blendMode = 'multiply';
				group.fills.push(l);
				l.addTo(layer);
			}
		} else if (hrs.length === 3) {
			const l = new paper.Path.Line(hrs[0].point, hrs[2].point);
			l.strokeColor = black;
			l.blendMode = 'multiply';
			group.fills.push(l);
			l.addTo(layer);
		} else if (hrs.length === 0 || hrs.length === 1) {
			console.debug('ignoring 0/1 intersections.');
		} else {
			console.warn('not sure what to do with', hrs.length, 'intersections', hrs);
		}
		line.remove();
	}
}

class RstrClassicGroup implements RstrGroup {
	pixels: RstrPixel[];
	shape: paper.Path;
	timesVisited: number;
	isFilled: boolean;
	fills: paper.Path[] = [];

	constructor(pixel: RstrPixel, config: RstrConfig) {
		this.pixels = [pixel];
		const fillAlpha = pixel.color.lightness ? pixel.color.lightness : 0;
		let fill = new paper.Color('white');
		fill.alpha = fillAlpha;
		this.shape = new paper.Path.Rectangle({
			from: [pixel.x, pixel.y],
			to: [pixel.x + pixel.rect.bounds.width, pixel.y + pixel.rect.bounds.height],
			fillColor: fill,
			strokeColor: 'darkorange',
			strokeWidth: 1
		});
		this.timesVisited = 0;
		this.isFilled = false;
	}

	getAverageColor(): paper.Color {
		return this.pixels.reduce((acc, p) => acc.add(p.color), new paper.Color('white')).divide(this.pixels.length);
	}

	getAverageLightness(): number {
		return this.pixels.reduce((acc, p) => acc + p.getAverageColorValue(), 0) / this.pixels.length;
	}

	getBoundingBox(): paper.Rectangle {
		const rectangles = this.pixels.map(p => p.rect);
		if (rectangles.length === 0) {
			console.error('No rectangles found in group. Returning empty bounding box.');
			return new paper.Path.Rectangle([0, 0], [0, 0]);
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		rectangles.forEach(rect => {
			minX = Math.min(minX, rect.bounds.left);
			minY = Math.min(minY, rect.bounds.top);
			maxX = Math.max(maxX, rect.bounds.right);
			maxY = Math.max(maxY, rect.bounds.bottom);
		});

		// Create a new rectangle using the calculated bounds
		return new paper.Path.Rectangle({
			point: [minX, minY],
			size: [maxX - minX, maxY - minY]
		});
	}

	getCornerPixels(): { topLeft: RstrPixel; topRight: RstrPixel; bottomLeft: RstrPixel; bottomRight: RstrPixel } {
		if (this.pixels.length === 0) {
			throw new Error('Pixel group is empty');
		}

		let topLeft = this.pixels[0];
		let topRight = this.pixels[0];
		let bottomLeft = this.pixels[0];
		let bottomRight = this.pixels[0];

		this.pixels.forEach(pixel => {
			if (pixel.x <= topLeft.x && pixel.y <= topLeft.y) {
				topLeft = pixel;
			}
			if (pixel.x >= topRight.x && pixel.y <= topRight.y) {
				topRight = pixel;
			}
			if (pixel.x <= bottomLeft.x && pixel.y >= bottomLeft.y) {
				bottomLeft = pixel;
			}
			if (pixel.x >= bottomRight.x && pixel.y >= bottomRight.y) {
				bottomRight = pixel;
			}
		});

		return { topLeft, topRight, bottomLeft, bottomRight };
	}
}
