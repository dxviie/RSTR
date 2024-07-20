// onMount(() => {
// 	paper.setup(canvas);
// 	project = paper.project;
//
// 	project.view.onFrame = (event: { time: number; delta: number; count: number }) => {
// 		console.log('rendering', 'time', event.time, 'delta', event.delta, 'count', event.count);
// if (!paper || !paper.project || !paper.project.activeLayer) {
// 	return;
// }
// paper.project.activeLayer.removeChildren();
//
// const bounds = paper.view.bounds.scale(0.9);
// const offset = bounds.width * 0.05;
// const width = bounds.width / config.resolution;
// const height = bounds.height / config.resolution;
// const size = new paper.Size(width, height);
//
// new paper.Path.Rectangle({
// 	point: bounds.topLeft,
// 	size: bounds.size,
// 	fillColor: 'white'
// });
//
// let info = new paper.PointText({
// 	point: [20 / getPixelRatio(), paper.view.center.y - (fontSize / getPixelRatio()) * 3],
// 	content: `initial resolution: ${config.resolution}x${config.resolution}\ngrouping iterations: ${config.iterations}\nsimilarity tolerance: ${config.tolerance}\nmax. lines per area: ${config.blockLineCount}\n\nDepending on the numbers above,\nand your device,\nthis might take a while.`,
// 	fillColor: 'black',
// 	fontSize: fontSize / getPixelRatio(),
// 	fontFamily: 'courier new'
// });
//
// let blocks = [];
//
// // build base raster
// for (let i = 0; i < config.resolution; i++) {
// 	let x = offset + width * i;
// 	for (let j = 0; j < config.resolution; j++) {
// 		let y = offset + height * j;
// 		let block = new paper.Path.Rectangle({
// 			point: [x, y],
// 			size: size
// 		});
// 		block.gridX = i;
// 		block.gridY = j;
// 		block.xSpan = 1;
// 		block.ySpan = 1;
// 		block.used = false;
// 		blocks.push(block);
// 		if (debug) {
// 			block.strokeColor = 'red';
// 			block.strokeWidth = 1;
// 		}
// 	}
// }
//
// let vera = new paper.Raster(img || selectedPic);
// vera.opacity = 0;
// vera.onLoad = () => {
// 	console.log('loaded image');
// 	if (debug) {
// 		vera.opacity = 0.1;
// 		vera.blendMode = 'multiply';
// 	}
// 	info.remove();
// 	vera.fitBounds(bounds);
//
// 	if (rstrState.status !== 'render') {
// 		console.log('not rendering');
// 		vera.opacity = 1;
// 		return;
// 	}
// 	console.log('rendering');
//


import type { RstrFillingAlgo, RstrGroup, RstrGroupingAlgo, RstrPixel } from '$lib/rstr/rstr.ts';
import paper from 'paper';
import type { RstrConfig } from '$lib/rstr/config.svelte.ts';
import { hatchShape } from '$lib/ccp/PaperTools.ts';

/***************************************
 						GROUPING
 ***************************************/

function findNeighboringGroups(group: RstrGroup, groups: RstrGroup[], maxPixelCount: number = Number.MAX_VALUE): RstrGroup[] {
	const neighbors = [];
	for (let i = 0; i < groups.length; i++) {
		const neighbor = groups[i];
		if (neighbor === group) continue;
		if (neighbor.pixels.length > maxPixelCount) continue;
		if ((neighbor.shape.strokeBounds.intersects(group.shape.strokeBounds) ||
				neighbor.shape.strokeBounds.contains(group.shape.strokeBounds)) &&
			!neighbors.includes(neighbor)) {
			// check if any of the neighbor's pixels is right next to any of our pixels
			// if so, add the neighbor to the neighbors list
			if (neighbor.pixels.some(p => group.pixels.some(gp => gp.isNeighbor(p, false)))) {
				neighbors.push(neighbor);
			}
		}
	}
	return neighbors;
}

export class RstrClassicGrouping implements RstrGroupingAlgo, RstrFillingAlgo {

	doGroupingStep(groups: RstrGroup[], config: RstrConfig): RstrGroup[] {
		let iters = this.iterationsFinished(groups);
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];
			if (group.timesVisited <= iters) {
				const neighbors = findNeighboringGroups(group, groups, iters + 1);
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
		const box = calculateBoundingBox(group.pixels.map(p => p.rect));

		// get the average color for each quadrant of the block
		let corners = findCornerPixels(group.pixels);

		let diffDesc = Math.abs(corners.topLeft.gray - corners.bottomRight.gray);
		let diffAsc = Math.abs(corners.topRight.gray - corners.bottomLeft.gray);
		let start, end;
		let pattern = 2;
		if (diffAsc < diffDesc) {
			// descending
			if (diffDesc > config.tolerance / 2) {
				pattern = corners.topLeft.color.gray > corners.bottomRight.color.gray ? 1 : 0;
			}
			start = new paper.Point(box.bounds.x, box.bounds.y);
			end = new paper.Point(
				box.bounds.x + box.bounds.width,
				box.bounds.y + box.bounds.height
			);
		} else {
			// ascending
			if (diffAsc > config.tolerance / 2) {
				pattern = corners.topRight.color.gray > corners.bottomLeft.color.gray ? 1 : 0;
			}
			start = new paper.Point(box.bounds.x, box.bounds.y + box.bounds.height);
			end = new paper.Point(box.bounds.x + box.bounds.width, box.bounds.y);
		}
		let averageColor = group.getAverageColor();
		// map average color to linecount
		let lineCount = ((1.5 - averageColor.lightness) * config.blockLineCount);

		// function hatchFillRectangle(debug, start, end, rectangle, lineCount, pattern) {
		hatchFillRectangle(false, start, end, box, lineCount, pattern);
	}
}

function hatchFillRectangle(debug, start, end, rectangle, lineCount, pattern) {
	let direction = new paper.Path.Line(start, end);
	if (pattern === 0) {
		direction = new paper.Path.Line(start, direction.getPointAt(direction.length / 2));
	} else if (pattern === 1) {
		direction = new paper.Path.Line(direction.getPointAt(direction.length / 2), end);
	}
	if (debug) {
		direction.strokeColor = 'red';
	}
	for (var i = 0; i < lineCount; i++) {
		let linePoint = direction.getPointAt((i * direction.length) / (lineCount - 1));
		if (!linePoint) {
			continue;
		}
		if (debug) {
			let circle = new paper.Path.Circle(linePoint, 2);
			circle.fillColor = 'red';
		}
		// draw a line perpendicular to direction through linePoint
		let perpendicular = direction.getNormalAt((i * direction.length) / (lineCount - 1));
		let lineStart = linePoint.subtract(perpendicular.multiply(direction.length));
		let lineEnd = linePoint.add(perpendicular.multiply(direction.length));

		let line = new paper.Path.Line(lineStart, lineEnd);
		let hrs = rectangle.getIntersections(line);
		if (hrs && hrs.length > 0) {
			line.remove();
			line = new paper.Path.Line(hrs[0].point, hrs[hrs.length - 1].point);
		}
		line.strokeColor = 'black';
	}
}

function findCornerPixels(pixels: RstrPixel[]): { topLeft: RstrPixel, topRight: RstrPixel, bottomLeft: RstrPixel, bottomRight: RstrPixel } {
	if (pixels.length === 0) {
		throw new Error('Pixel group is empty');
	}

	let topLeft = pixels[0];
	let topRight = pixels[0];
	let bottomLeft = pixels[0];
	let bottomRight = pixels[0];

	pixels.forEach(pixel => {
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

function calculateBoundingBox(rectangles): paper.Path.Rectangle {
	if (rectangles.length === 0) {
		return null; // Return null if the array is empty
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

class RstrClassicGroup implements RstrGroup {
	pixels: RstrPixel[];
	shape: paper.Path;
	timesVisited: number;
	isFilled: boolean;

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
		return this.pixels.reduce((acc, p) => acc + p.color.lightness, 0) / this.pixels.length;
	}
}


// Original hatching implementation from the genuary project :
