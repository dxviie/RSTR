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


import type { RstrGroup, RstrGroupingAlgo, RstrPixel } from '$lib/rstr/rstr.ts';
import paper from 'paper';
import type { RstrConfig } from '$lib/rstr/config.svelte.ts';

/***************************************
 						GROUPING
 ***************************************/

function findNeighboringGroups(group: RstrGroup, groups: RstrGroup[]): RstrGroup[] {
	const neighbors = [];
	for (let i = 0; i < groups.length; i++) {
		const neighbor = groups[i];
		if (neighbor === group) continue;
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

export class RstrClassicGrouping implements RstrGroupingAlgo {

	doGroupingStep(groups: RstrGroup[], config: RstrConfig): RstrGroup[] {
		let iters = this.iterationsFinished(groups);
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i];
			if (group.timesVisited <= iters) {
				const neighbors = findNeighboringGroups(group, groups);
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
						group.pixels = group.pixels.concat(neighbor.pixels);
						group.shape = group.shape.unite(neighbor.shape);
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
				group.shape.addTo(layer);
				groups.push(group);
			}
		}
		return groups;
	}

	iterationsFinished(groups: RstrGroup[]): number {
		return Math.min(...groups.map(g => g.timesVisited));
	}
}

class RstrClassicGroup implements RstrGroup {
	pixels: RstrPixel[];
	shape: paper.Path;
	timesVisited: number;

	constructor(pixel: RstrPixel, config: RstrConfig) {
		this.pixels = [pixel];
		this.shape = new paper.Path.Rectangle({
			from: [pixel.x, pixel.y],
			to: [pixel.x + pixel.rect.bounds.width, pixel.y + pixel.rect.bounds.height],
			fillColor: pixel.color.lightness ? new paper.Color(pixel.color.lightness) : 'white',
			strokeColor: 'black',
			strokeWidth: 1
		});
		this.timesVisited = 0;
	}

	getAverageLightness(): number {
		return this.pixels.reduce((acc, p) => acc + p.color.lightness, 0) / this.pixels.length;
	}
}

// 	// group blocks in iterations
// 	for (let i = 0; i < config.iterations; i++) {
// 		console.log('grouping iteration', i);
// 		let toRemove = [];
// 		let toAdd = [];
// 		for (let b = 0; b < blocks.length; b++) {
// 			let block = blocks[b];
// 			if (block.used) {
// 				continue;
// 			}
// 			let blockColor = vera.getAverageColor(block.bounds);
// 			if (!blockColor) continue;
// 			let neighbors = findValidNeighbors(blocks, block);
// 			let neighborDiffs = neighbors.map((n) => {
// 				let neighborColor = vera.getAverageColor(n.bounds);
// 				if (!neighborColor) return 0;
// 				return Math.abs(blockColor.gray - neighborColor.gray);
// 			});
// 			// find the index in neighborDiffs of the smallest element
// 			let minIndex = neighborDiffs.indexOf(Math.min(...neighborDiffs));
// 			if (minIndex >= 0) {
// 				let neighbor = neighbors[minIndex];
// 				let neighborColor = vera.getAverageColor(neighbor.bounds);
// 				if (
// 					blockColor &&
// 					neighborColor &&
// 					Math.abs(blockColor.gray - neighborColor.gray) < config.tolerance
// 				) {
// 					toRemove.push(block);
// 					toRemove.push(neighbor);
// 					block.used = true;
// 					neighbor.used = true;
// 					let newBlock = block.unite(neighbor);
// 					if (debug) {
// 						let color = new paper.Color(debugColors[i % debugColors.length]);
// 						color.alpha = 0.5;
// 						newBlock.fillColor = color;
// 					}
// 					newBlock.gridX = Math.min(block.gridX, neighbor.gridX);
// 					newBlock.gridY = Math.min(block.gridY, neighbor.gridY);
// 					newBlock.xSpan =
// 						block.gridY === neighbor.gridY ? block.xSpan + neighbor.xSpan : block.xSpan;
// 					newBlock.ySpan =
// 						block.gridX === neighbor.gridX ? block.ySpan + neighbor.ySpan : block.ySpan;
// 					newBlock.used = false;
// 					toAdd.push(newBlock);
// 				}
// 			}
// 		}
//
// 		for (let r = 0; r < toRemove.length; r++) {
// 			let index = blocks.indexOf(toRemove[r]);
// 			if (index >= 0) {
// 				blocks.splice(index, 1);
// 			}
// 			toRemove[r].remove();
// 		}
// 		for (let a = 0; a < toAdd.length; a++) {
// 			blocks.push(toAdd[a]);
// 		}
// 	}

/***************************************
 						HATCHING
 ***************************************/

// 	// hatch fill remaining blocks
// 	for (let i = 0; i < blocks.length; i++) {
// 		let block = blocks[i];
// 		// get the average color for each quadrant of the block
// 		let halfwit = block.bounds.width / 2;
// 		let halfhit = block.bounds.height / 2;
// 		let topLeft = vera.getAverageColor(
// 			new paper.Rectangle(block.bounds.x, block.bounds.y, halfwit, halfhit)
// 		);
// 		let topRight = vera.getAverageColor(
// 			new paper.Rectangle(block.bounds.x + halfwit, block.bounds.y, halfwit, halfhit)
// 		);
// 		let bottomLeft = vera.getAverageColor(
// 			new paper.Rectangle(block.bounds.x, block.bounds.y + halfhit, halfwit, halfhit)
// 		);
// 		let bottomRight = vera.getAverageColor(
// 			new paper.Rectangle(
// 				block.bounds.x + halfwit,
// 				block.bounds.y + halfhit,
// 				halfwit,
// 				halfhit
// 			)
// 		);
// 		if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
// 			continue;
// 		}
// 		let diffDesc = Math.abs(topLeft.gray - bottomRight.gray);
// 		let diffAsc = Math.abs(topRight.gray - bottomLeft.gray);
// 		let start, end;
// 		let pattern = 2;
// 		if (diffAsc < diffDesc) {
// 			// descending
// 			if (diffDesc > config.tolerance / 2) {
// 				pattern = topLeft.gray > bottomRight.gray ? 1 : 0;
// 			}
// 			start = new paper.Point(block.bounds.x, block.bounds.y);
// 			end = new paper.Point(
// 				block.bounds.x + block.bounds.width,
// 				block.bounds.y + block.bounds.height
// 			);
// 		} else {
// 			// ascending
// 			if (diffAsc > config.tolerance / 2) {
// 				pattern = topRight.gray > bottomLeft.gray ? 1 : 0;
// 			}
// 			start = new paper.Point(block.bounds.x, block.bounds.y + block.bounds.height);
// 			end = new paper.Point(block.bounds.x + block.bounds.width, block.bounds.y);
// 		}
// 		let averageColor = vera.getAverageColor(block.bounds);
// 		// map average color to linecount
// 		let lineCount = Math.floor((1 - averageColor.gray) * config.blockLineCount);
// 		// calculate the angle between start and end
// 		let angle = start.subtract(end).angle;
// 		let spacing = config.blockLineCount / lineCount;
// 		hatchRectangle(paper, block, 45, 10);
// 	}
//
// 	if (!debug) {
// 		vera.remove();
// 		blocks.forEach((b) => b.remove());
// 	}
// 	console.log('done');
// 	renderingFinished.action();
// };
// project.view.pause();
// 	};
// });