<script lang="ts">
	import paper from 'paper';
	import { config } from '$lib/config.svelte.ts';
	import {
		exported,
		exporting
	} from './fsm.svelte';
	import { Rstr } from '$lib/rstr.svelte.ts';
	import RasterActions from '$lib/RasterActions.svelte';

	let canvas: HTMLCanvasElement | null = $state(null);
	let img: HTMLImageElement | null = $state(null);
	let imageFile = config.file;
	let canvasWidth = $state(1280);
	let canvasHeight = $state(1280);
	let rstr: Rstr | null = $state(null);

	// TODO ---> set back
	const pics = ['test-rstr.png'];// ['brasa.png', 'kelb.png', 'knest.png'];
	let selectedPic = $state('');

	$effect(() => {
		selectedPic = pics[Math.floor(Math.random() * pics.length)];
	});

	$effect(() => {
		if (config.file) {
			console.debug('image selected', config.file);
			imageFile = config.file;
			const reader = new FileReader();
			reader.onload = (event) => {
				console.debug('image file reader ready');
				if (event.target) {
					const newImg = new Image();
					newImg.src = event.target.result as string;
					newImg.onload = () => {
						canvasWidth = newImg.naturalWidth;
						canvasHeight = newImg.naturalHeight;
						img = newImg;
					};
				}
			};
			reader.readAsDataURL(imageFile);
		}
	});

	function debounce(func, delay) {
		let timeoutId;
		return (...args) => {
			console.debug('debouncing', func, delay, args);
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func(...args), delay);
		};
	}

	const debouncedGridUpdate = debounce(() => {
		if (rstr) {
			exporting.action();
			setTimeout(() => {
				rstr.updateGrid(config.resolution);
				exported.action();
				console.debug('exported svg');
			}, 100);
		}
	}, 500);

	$effect(() => {
		if (config.resolution && rstr) {
			debouncedGridUpdate();
		}
	});

	$effect(() => {
		if (img || selectedPic) {
			console.info('image loaded >> render?!!', img, selectedPic);
			if (!canvas) {
				console.warn('no canvas');
				return;
			}
			setTimeout(() => {
				if (rstr) {
					rstr.cleanup();
				}
				paper.setup(canvas);
				console.log('project setup', canvasWidth, canvasHeight, canvas.width, canvas.height, paper.view.bounds);
				rstr = new Rstr(paper);
				rstr.loadImage(img || selectedPic);
				debouncedGridUpdate();
			}, 10);

		}
	});

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
	//
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
</script>

<div class="canvas-container">

	<canvas id="raster-canvas" bind:this={canvas} data-paper-hidpi="off" width={canvasWidth} height={canvasHeight}></canvas>
	<RasterActions {canvas} {rstr} />
</div>

<style>

    .canvas-container {
        display: flex;
        gap: 1rem;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    #raster-canvas {
        display: block;
        max-height: calc(100vh - 10rem);
        width: calc(100vw - 40rem);
        aspect-ratio: 1;
        background-color: white;
        border-radius: 0.5rem;
    }

    @media (max-width: 850px) {
        #raster-canvas {
            width: 100%;
            height: 100%;
        }
    }

    @keyframes spin {
        0% {
            transform: translate(-50%, -50%) rotate(0deg);
        }
        100% {
            transform: translate(-50%, -50%) rotate(360deg);
        }
    }
</style>
