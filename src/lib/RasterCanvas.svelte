<script lang="ts">
	import paper from 'paper';
	import { config } from '$lib/config.svelte.ts';
	import {
		exported,
		exporting, rstrState
	} from './fsm.svelte';
	import { Rstr } from '$lib/rstr.svelte.ts';
	import RasterActions from '$lib/RasterActions.svelte';

	let canvas: HTMLCanvasElement | null = $state(null);
	let img: HTMLImageElement | null = $state(null);
	let imageFile = config.file;
	let canvasWidth = $state(1280);
	let canvasHeight = $state(1280);
	let rstr: Rstr | null = $state(null);
	let renderInfo = $state('');
	let animationFrameRequest = 0;

	// TODO ---> set back
	// const pics = ['test-rstr.png'];
	const pics = ['brasa.png', 'kelb.png', 'knest.png'];
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

	$effect(() => {
		if (rstrState.status === 'render') {
			animationFrameRequest = requestAnimationFrame(frame);
		} else {
			cancelAnimationFrame(animationFrameRequest);
		}
	});

	function frame() {
		if (!rstr) {
			console.error('no rstr on frame!?');
			return;
		}
		const budget = 10; // ms
		const start = performance.now();
		while (rstrState.status === 'render' && performance.now() - start < budget) {
			renderInfo = rstr.render();
		}
		if (rstrState.status === 'render') {
			animationFrameRequest = requestAnimationFrame(frame);
		} else {
			cancelAnimationFrame(animationFrameRequest);
		}
	}

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
</script>

<div class="canvas-container">
	<div class="render-info">{renderInfo}</div>
	<div class="canvas-wrapper">
		<canvas id="raster-canvas" bind:this={canvas} data-paper-hidpi="on" width={canvasWidth} height={canvasHeight}></canvas>
	</div>

	<RasterActions {canvas} {rstr} />
</div>

<style>

    .canvas-container {
        position: relative;
        display: flex;
        gap: .5rem;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 60vw;
        max-width: 1280px;
        height: 80vh;
        max-height: 1280px;
    }

    @media (max-width: 850px) {
        .canvas-container {
            width: 100%;
            height: 50vh
        }
    }

    .canvas-wrapper {
        width: 100%; /* or any desired width */
        height: 100%; /* maintain aspect ratio */
        position: relative;
        overflow: hidden;
    }

    #raster-canvas {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-color: black;
        border-style: dashed;
        border-width: 1px;
    }

    @media (max-width: 850px) {
        #raster-canvas {
            width: 100%;
            height: 100%;
        }
    }

    .render-info {
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0.8;
        font-family: "Courier New", monospace;
        font-size: small;
        font-weight: bold;
        z-index: 10;
        color: black;
        padding: 1rem;
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
