<script lang="ts">

  import paper from "paper";
  import {onMount} from "svelte";

	/** Genuary constants **/
	const MIN_RESOLUTION = 3;
	const MAX_RESOLUTION = 81 / getPixelRatio();
	const MAX_ITERATIONS = 10;
	const MIN_LINE_COUNT = 5;
	const MAX_LINE_COUNT = 27;
	let resolution = 27;
	let iterations = 3;
	let debugColors = ["yellow", "orange", "orangered", "red", "darkred"];
	let tolerance = 0.8;
	let blockLineCount = 9;
	let fontSize = 30;

	let debug = true;

	/** QR constants **/
  let canvas: HTMLCanvasElement;
  let project: paper.Project;
  let zoom = 1;
  const PAPERJS_MM_TO_PT = 3.775;
  const HOR_COLOR = 'orange';
  const VERT_COLOR = 'green';

  function hasBlockAt(blocks: paper.Path.Rectangle[], point: paper.PointLike): boolean {
    return blocks.some((block) => block.contains(point));
  }

	function hatchFillRectangle(paper, debug, start, end, rectangle, lineCount, pattern) {
		let direction = new paper.Path.Line(start, end);
		if (pattern === 0) {
			direction = new paper.Path.Line(start, direction.getPointAt(direction.length / 2));
		}
		else if (pattern === 1) {
			direction = new paper.Path.Line(direction.getPointAt(direction.length / 2), end);
		}
		if (debug) {
			direction.strokeColor = "red";
		}
		for (var i = 0; i < lineCount; i++) {
			let linePoint = direction.getPointAt(i * direction.length / (lineCount-1));
			if (!linePoint) {
				continue;
			}
			if (debug) {
				let circle = new paper.Path.Circle(linePoint, 2);
				circle.fillColor = "red";
			}
			// draw a line perpendicular to direction through linePoint
			let perpendicular = direction.getNormalAt(i * direction.length / (lineCount-1));
			let lineStart = linePoint.subtract(perpendicular.multiply(direction.length));
			let lineEnd = linePoint.add(perpendicular.multiply(direction.length));

			let line = new paper.Path.Line(lineStart, lineEnd);
			let hrs = rectangle.getIntersections(line);
			if (hrs && hrs.length > 0) {
				line.remove();
				line = new paper.Path.Line(hrs[0].point, hrs[hrs.length-1].point);
			}
			line.strokeColor = "black";

		}
	}

	function findValidNeighbors(blocks, block) {
		let neighbors = [];
		let x = block.gridX;
		let y = block.gridY;
		let xSpan = block.xSpan;
		let ySpan = block.ySpan;
		for (let i = 0; i < blocks.length; i++) {
			let neighbor = blocks[i];
			if (neighbor.gridX === x && neighbor.gridY === y) { continue; }
			if ((neighbor.gridX === x && neighbor.gridY >= y && neighbor.gridY <= y + ySpan && neighbor.xSpan === xSpan)
				|| (neighbor.gridY === y && neighbor.gridX >= x && neighbor.gridX <= x + xSpan && neighbor.ySpan === ySpan)) {
				if (!neighbor.used) {
					neighbors.push(neighbor);
				}
			}
		}
		return neighbors;
	}

	function getPixelRatio() {
		return typeof window !== 'undefined' ? window.devicePixelRatio : 1;
	}

  onMount(() => {
    paper.setup(canvas);
    project = paper.project;

    project.view.onFrame = (event: { time: number; delta: number; count: number }) => {
			if (!paper || !paper.project || !paper.project.activeLayer) {
				return;
			}
			paper.project.activeLayer.removeChildren();

			const bounds = paper.view.bounds.scale(0.9);
			const offset = bounds.width * 0.05;
			const width = bounds.width / resolution;
			const height = bounds.height / resolution;
			const size = new paper.Size(width, height);

			let info = new paper.PointText({
				point: [20 / getPixelRatio(), paper.view.center.y - (fontSize/getPixelRatio()*3)],
				content: `initial resolution: ${resolution}x${resolution}\ngrouping iterations: ${iterations}\nsimilarity tolerance: ${tolerance}\nmax. lines per area: ${blockLineCount}\n\nDepending on the numbers above,\nand your device,\nthis might take a while.`,
				fillColor: 'black',
				fontSize: fontSize / getPixelRatio(),
				fontFamily: 'courier new'
			});

			let blocks = [];

			// build base raster
			for (let i = 0; i < resolution; i++) {
				let x = offset + width * i;
				for (let j = 0; j < resolution; j++) {
					let y = offset + height * j;
					let block = new paper.Path.Rectangle({
						point:  [x, y],
						size: size
					});
					block.gridX = i;
					block.gridY = j;
					block.xSpan = 1;
					block.ySpan = 1;
					block.used = false;
					blocks.push(block);
					if (debug) {
						block.strokeColor = "red";
						block.strokeWidth = 1;
					}
				}
			}



			// image found & edited from https://www.holo.mg/encounters/vera-molnar/
			let vera = new paper.Raster("/vera.png");
			vera.opacity = 0;
			vera.onLoad = () => {
				console.log("loaded image")
				if (debug) {
					vera.opacity = 0.1;
					vera.blendMode = 'multiply';
				}
				info.remove();
				vera.fitBounds(bounds);

				// group blocks in iterations
				for (let i = 0; i < iterations; i++) {
					console.log("grouping iteration", i)
					let toRemove = [];
					let toAdd = [];
					for (let b = 0; b < blocks.length; b++) {
						let block = blocks[b];
						if (block.used) {
							continue;
						}
						let blockColor = vera.getAverageColor(block.bounds);
						let neighbors = findValidNeighbors(blocks, block);
						let neighborDiffs = neighbors.map(n => {
							let neighborColor = vera.getAverageColor(n.bounds);
							return Math.abs(blockColor.gray - neighborColor.gray);
						});
						// find the index in neighborDiffs of the smallest element
						let minIndex = neighborDiffs.indexOf(Math.min(...neighborDiffs));
						if (minIndex >= 0) {
							let neighbor = neighbors[minIndex];
							let neighborColor = vera.getAverageColor(neighbor.bounds);
							if (blockColor && neighborColor && Math.abs(blockColor.gray - neighborColor.gray) < tolerance) {
								toRemove.push(block);
								toRemove.push(neighbor);
								block.used = true;
								neighbor.used = true;
								let newBlock = block.unite(neighbor);
								if (debug) {
									let color = new paper.Color(debugColors[i % debugColors.length]);
									color.alpha = 0.5;
									newBlock.fillColor = color;
								}
								newBlock.gridX = Math.min(block.gridX, neighbor.gridX);
								newBlock.gridY = Math.min(block.gridY, neighbor.gridY);
								newBlock.xSpan = block.gridY === neighbor.gridY ? block.xSpan + neighbor.xSpan : block.xSpan;
								newBlock.ySpan = block.gridX === neighbor.gridX ? block.ySpan + neighbor.ySpan : block.ySpan;
								newBlock.used = false;
								toAdd.push(newBlock);
							}
						}
					}

					for (let r = 0; r < toRemove.length; r++) {
						let index = blocks.indexOf(toRemove[r]);
						if (index >= 0) {
							blocks.splice(index, 1);
						}
						toRemove[r].remove();
					}
					for (let a = 0; a < toAdd.length; a++) {
						blocks.push(toAdd[a]);
					}
				}

				// hatch fill remaining blocks
				for (let i = 0; i < blocks.length; i++) {
					let block = blocks[i];
					// get the average color for each quadrant of the block
					let halfwit = block.bounds.width / 2;
					let halfhit = block.bounds.height / 2;
					let topLeft = vera.getAverageColor(new paper.Rectangle(block.bounds.x, block.bounds.y, halfwit, halfhit));
					let topRight = vera.getAverageColor(new paper.Rectangle(block.bounds.x + halfwit, block.bounds.y, halfwit, halfhit));
					let bottomLeft = vera.getAverageColor(new paper.Rectangle(block.bounds.x, block.bounds.y + halfhit, halfwit, halfhit));
					let bottomRight = vera.getAverageColor(new paper.Rectangle(block.bounds.x + halfwit, block.bounds.y + halfhit, halfwit, halfhit));
					if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
						continue;
					}
					let diffDesc = Math.abs(topLeft.gray - bottomRight.gray);
					let diffAsc = Math.abs(topRight.gray - bottomLeft.gray);
					let start, end;
					let pattern = 2;
					if (diffAsc < diffDesc) {
						// descending
						if (diffDesc > tolerance/2) {
							pattern = topLeft.gray > bottomRight.gray ? 0 : 1;
						}
						start = new paper.Point(block.bounds.x, block.bounds.y);
						end = new paper.Point(block.bounds.x + block.bounds.width, block.bounds.y + block.bounds.height);
					}
					else {
						// ascending
						if (diffAsc > tolerance/2) {
							pattern = topRight.gray > bottomLeft.gray ? 0 : 1;
						}
						start = new paper.Point(block.bounds.x, block.bounds.y + block.bounds.height);
						end = new paper.Point(block.bounds.x + block.bounds.width, block.bounds.y);
					}
					let averageColor = vera.getAverageColor(block.bounds);
					// map average color to linecount
					let lineCount = Math.floor((1- averageColor.gray) * blockLineCount);
					hatchFillRectangle(paper, debug, start, end,  block, lineCount, pattern);
				}

				if (!debug) {
					vera.remove();
					blocks.forEach(b => b.remove());
				}
				paper.view.pause();
				console.log('done')
			}
    };
  });


</script>

<canvas id="raster-canvas" bind:this={canvas} data-paper-hidpi="off"></canvas>

<style>
    #raster-canvas {
        display: block;
        width: calc(100vw - 42rem);
        aspect-ratio: 1;
        background-color: white;
        border-radius: .5rem;
    }
</style>