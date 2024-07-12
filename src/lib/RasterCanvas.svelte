<script lang="ts">
	import paper from 'paper';
	import { onMount } from 'svelte';
	import { config } from '$lib/config.svelte.ts';
	import {
		exported,
		exporting,
		imageLoaded,
		renderingFinished,
		rstrState
	} from './fsm.svelte';
	import Button from './components/ui/button/button.svelte';

	const pics = ['brasa.png', 'kelb.png', 'knest.png'];
	let selectedPic = $state('');
	let spinner: HTMLDivElement | null = null;
	let imageFile = config.file;
	let img: HTMLImageElement | null = null;

	$effect(() => {
		selectedPic = pics[Math.floor(Math.random() * pics.length)];
	});

	$effect(() => {
		console.debug('canvas status update: ', rstrState.status);
		if (rstrState.status && project && (rstrState.status === 'render' || rstrState.status === 'config')) {
			console.debug('---- rendering ----');
			project.view.play();
		}
	});

	$effect(() => {
		if (config.file && project) {
			console.debug('image selected', config.file);
			imageFile = config.file;
			const reader = new FileReader();
			reader.onload = (event) => {
				console.debug('image file reader ready');
				if (event.target) {
					img = new Image();
					img.src = event.target.result as string;
					img.onload = () => {
						console.log('image loaded');
						imageLoaded.action();
						project.view.play();
					};
				}
			};
			reader.readAsDataURL(imageFile);
		}
	});

	/** Genuary constants **/
	// let resolution = 81;
	// let iterations = 3;
	let debugColors = ['yellow', 'orange', 'orangered', 'red', 'darkred'];
	// let tolerance = 0.8;
	// let blockLineCount = 9;
	let fontSize = 30;

	let debug = false;

	/** QR constants **/
	let canvas: HTMLCanvasElement;
	let project: paper.Project;
	const PAPERJS_MM_TO_PT = 3.775;

	function hatchFillRectangle(paper, debug, start, end, rectangle, lineCount, pattern) {
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

	function findValidNeighbors(blocks, block) {
		let neighbors = [];
		let x = block.gridX;
		let y = block.gridY;
		let xSpan = block.xSpan;
		let ySpan = block.ySpan;
		for (let i = 0; i < blocks.length; i++) {
			let neighbor = blocks[i];
			if (neighbor.gridX === x && neighbor.gridY === y) {
				continue;
			}
			if (
				(neighbor.gridX === x &&
					neighbor.gridY >= y &&
					neighbor.gridY <= y + ySpan &&
					neighbor.xSpan === xSpan) ||
				(neighbor.gridY === y &&
					neighbor.gridX >= x &&
					neighbor.gridX <= x + xSpan &&
					neighbor.ySpan === ySpan)
			) {
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
			console.log('rendering', 'time', event.time, 'delta', event.delta, 'count', event.count);
			if (!paper || !paper.project || !paper.project.activeLayer) {
				return;
			}
			paper.project.activeLayer.removeChildren();

			const bounds = paper.view.bounds.scale(0.9);
			const offset = bounds.width * 0.05;
			const width = bounds.width / config.resolution;
			const height = bounds.height / config.resolution;
			const size = new paper.Size(width, height);

			new paper.Path.Rectangle({
				point: bounds.topLeft,
				size: bounds.size,
				fillColor: 'white'
			});

			let info = new paper.PointText({
				point: [20 / getPixelRatio(), paper.view.center.y - (fontSize / getPixelRatio()) * 3],
				content: `initial resolution: ${config.resolution}x${config.resolution}\ngrouping iterations: ${config.iterations}\nsimilarity tolerance: ${config.tolerance}\nmax. lines per area: ${config.blockLineCount}\n\nDepending on the numbers above,\nand your device,\nthis might take a while.`,
				fillColor: 'black',
				fontSize: fontSize / getPixelRatio(),
				fontFamily: 'courier new'
			});

			let blocks = [];

			// build base raster
			for (let i = 0; i < config.resolution; i++) {
				let x = offset + width * i;
				for (let j = 0; j < config.resolution; j++) {
					let y = offset + height * j;
					let block = new paper.Path.Rectangle({
						point: [x, y],
						size: size
					});
					block.gridX = i;
					block.gridY = j;
					block.xSpan = 1;
					block.ySpan = 1;
					block.used = false;
					blocks.push(block);
					if (debug) {
						block.strokeColor = 'red';
						block.strokeWidth = 1;
					}
				}
			}

			// image found & edited from https://www.holo.mg/encounters/vera-molnar/
			let vera = new paper.Raster(img || selectedPic);
			vera.opacity = 0;
			vera.onLoad = () => {
				console.log('loaded image');
				if (debug) {
					vera.opacity = 0.1;
					vera.blendMode = 'multiply';
				}
				info.remove();
				vera.fitBounds(bounds);

				if (rstrState.status !== 'render') {
					console.log('not rendering');
					vera.opacity = 1;
					return;
				}
				console.log('rendering');

				// group blocks in iterations
				for (let i = 0; i < config.iterations; i++) {
					console.log('grouping iteration', i);
					let toRemove = [];
					let toAdd = [];
					for (let b = 0; b < blocks.length; b++) {
						let block = blocks[b];
						if (block.used) {
							continue;
						}
						let blockColor = vera.getAverageColor(block.bounds);
						if (!blockColor) continue;
						let neighbors = findValidNeighbors(blocks, block);
						let neighborDiffs = neighbors.map((n) => {
							let neighborColor = vera.getAverageColor(n.bounds);
							if (!neighborColor) return 0;
							return Math.abs(blockColor.gray - neighborColor.gray);
						});
						// find the index in neighborDiffs of the smallest element
						let minIndex = neighborDiffs.indexOf(Math.min(...neighborDiffs));
						if (minIndex >= 0) {
							let neighbor = neighbors[minIndex];
							let neighborColor = vera.getAverageColor(neighbor.bounds);
							if (
								blockColor &&
								neighborColor &&
								Math.abs(blockColor.gray - neighborColor.gray) < config.tolerance
							) {
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
								newBlock.xSpan =
									block.gridY === neighbor.gridY ? block.xSpan + neighbor.xSpan : block.xSpan;
								newBlock.ySpan =
									block.gridX === neighbor.gridX ? block.ySpan + neighbor.ySpan : block.ySpan;
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
					let topLeft = vera.getAverageColor(
						new paper.Rectangle(block.bounds.x, block.bounds.y, halfwit, halfhit)
					);
					let topRight = vera.getAverageColor(
						new paper.Rectangle(block.bounds.x + halfwit, block.bounds.y, halfwit, halfhit)
					);
					let bottomLeft = vera.getAverageColor(
						new paper.Rectangle(block.bounds.x, block.bounds.y + halfhit, halfwit, halfhit)
					);
					let bottomRight = vera.getAverageColor(
						new paper.Rectangle(
							block.bounds.x + halfwit,
							block.bounds.y + halfhit,
							halfwit,
							halfhit
						)
					);
					if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
						continue;
					}
					let diffDesc = Math.abs(topLeft.gray - bottomRight.gray);
					let diffAsc = Math.abs(topRight.gray - bottomLeft.gray);
					let start, end;
					let pattern = 2;
					if (diffAsc < diffDesc) {
						// descending
						if (diffDesc > config.tolerance / 2) {
							pattern = topLeft.gray > bottomRight.gray ? 1 : 0;
						}
						start = new paper.Point(block.bounds.x, block.bounds.y);
						end = new paper.Point(
							block.bounds.x + block.bounds.width,
							block.bounds.y + block.bounds.height
						);
					} else {
						// ascending
						if (diffAsc > config.tolerance / 2) {
							pattern = topRight.gray > bottomLeft.gray ? 1 : 0;
						}
						start = new paper.Point(block.bounds.x, block.bounds.y + block.bounds.height);
						end = new paper.Point(block.bounds.x + block.bounds.width, block.bounds.y);
					}
					let averageColor = vera.getAverageColor(block.bounds);
					// map average color to linecount
					let lineCount = Math.floor((1 - averageColor.gray) * config.blockLineCount);
					hatchFillRectangle(paper, debug, start, end, block, lineCount, pattern);
				}

				if (!debug) {
					vera.remove();
					blocks.forEach((b) => b.remove());
				}
				console.log('done');
				renderingFinished.action();
			};
			project.view.pause();
		};
	});

	const handleExportSVG = () => {
		console.debug('exporting svg');
		exporting.action();
		if (spinner) spinner.style.display = 'block';
		setTimeout(() => {
			const svg = project.exportSVG({ asString: true }) as string;
			const blob = new Blob([svg], { type: 'image/svg+xml' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = getFrameFileName('svg');
			a.click();
			URL.revokeObjectURL(url);
			exported.action();
			if (spinner) spinner.style.display = 'none';
			console.debug('exported svg');
		}, 100);
	};

	const handleSaveImage = () => {
		console.debug('saving image');
		exporting.action();
		if (spinner) spinner.style.display = 'block';
		setTimeout(() => {
			downloadFrame();
			exported.action();
			if (spinner) spinner.style.display = 'none';
			console.debug('saved image');
		}, 100);
	};

	export function downloadFrame() {
		if (!canvas) {
			return;
		}
		var tempCanvas = document.createElement('canvas');
		tempCanvas.width = canvas.width;
		tempCanvas.height = canvas.height;

		const ctx = tempCanvas.getContext('2d');
		if (!ctx) {
			console.warn('Could not get 2d context');
			return;
		}

		// Fill the temp canvas with white background
		ctx.fillStyle = '#ffffff'; // Set color to white
		ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

		// Draw the original canvas onto the temp canvas
		ctx.drawImage(canvas, 0, 0);

		// Load and draw the watermark
		var watermark = new Image();
		watermark.src = 'watermark.png'; // Path to your watermark image
		watermark.onload = function () {
			// Set the desired width and height for the watermark
			var scale = 0.5; // Example scale factor (50%)
			var watermarkWidth = watermark.width * scale;
			var watermarkHeight = watermark.height * scale;

			// Position the watermark at the bottom right corner, adjust as needed
			var x = tempCanvas.width - watermarkWidth - 10; // 10px padding from right
			var y = tempCanvas.height - watermarkHeight - 10; // 10px padding from bottom

			ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);

			// Convert the canvas to a Blob
			tempCanvas.toBlob(function (blob) {
				// Create an object URL for the blob
				var url = URL.createObjectURL(blob);

				// Create a temporary link to trigger the download
				var downloadLink = document.createElement('a');
				downloadLink.download = getFrameFileName('png');
				downloadLink.href = url;
				downloadLink.target = '_blank';
				downloadLink.click();
				downloadLink.remove();
			});
		};
	}

	const getFrameFileName = (ext: string) => {
		const now = new Date();
		const timestamp = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}-${now.getHours()}${now.getMinutes()}`;
		return `rstr.d17e.dev-${timestamp}.${ext}`;
	};
</script>

<div class="canvas-container">
	<div id="spinner" class="spinner" style="display: none;" bind:this={spinner}></div>
	<canvas id="raster-canvas" bind:this={canvas} data-paper-hidpi="off"></canvas>

	<div class="button-container">
		{#if rstrState.status === 'done'}
			<Button class="font-bold" on:click={handleExportSVG}>EXPORT SVG</Button>
			<Button class="font-bold" on:click={handleSaveImage}>SAVE IMAGE</Button>
		{/if}
	</div>
</div>

<style>
	.button-container {
		margin-top: 1rem;
		height: 3rem;
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	.canvas-container {
		display: flex;
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

	@media (max-width: 768px) {
		#raster-canvas {
			width: 100%;
			height: 100%;
		}
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 5px solid #f3f3f3;
		border-top: 5px solid darkorange;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
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
