<script lang="ts">
	import paper from 'paper';
	import { config } from '$lib/rstr/config.svelte.ts';
	import {
		exported,
		exporting, rstrState
	} from '../fsm.svelte.js';
	import { Rstr } from '$lib/rstr/rstr.ts';
	import RasterActions from '$lib/components/RasterActions.svelte';

	let canvas: HTMLCanvasElement | null = $state(null);
	let canvasWrapper: HTMLDivElement | null = $state(null);
	let img: HTMLImageElement | null = $state(null);
	let imageFile = config.file;
	let rstr: Rstr | null = $state(null);
	let renderInfo = $state('');
	let animationFrameRequest = 0;

	const pics = ['bbrasa-imp.png', 'knest-imp.png'];
	let selectedPic = $state('');

	function getPixelRatio() {
		return typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio) : 1;
	}

	$effect(() => {
		selectedPic = pics[Math.floor(Math.random() * pics.length)];
	});

	$effect(() => {
		if (config.file) {
			console.debug('Image selected', config.file);
			imageFile = config.file;
			const reader = new FileReader();
			reader.onload = (event) => {
				console.debug('image file reader ready');
				if (event.target) {
					const newImg = new Image();
					newImg.src = event.target.result as string;
					newImg.onload = () => {
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
			setTimeout(() => {
				console.info('Image loaded', img, selectedPic);
				if (!canvas) {
					console.warn('no canvas');
					return;
				}
				if (rstr) {
					rstr.reset();
				}
				if (img) {
					const imgWidth = img.naturalWidth;
					const imgHeight = img.naturalHeight;
					if (canvas && canvasWrapper) {
						const ratio = (canvasWrapper.clientWidth) / imgWidth;
						const canvasWidth = canvasWrapper.clientWidth;
						const canvasHeight = imgHeight * ratio;
						canvas.style.width = `${canvasWidth}px`;
						canvas.style.height = `${canvasHeight}px`;
						canvas.width = canvasWidth * getPixelRatio();
						canvas.height = canvasHeight * getPixelRatio();
					}
				}
				setTimeout(() => {
					paper.setup(canvas);
					rstr = new Rstr(paper);
					rstr.loadImage(img || selectedPic);
					debouncedGridUpdate();
				}, 10);
			}, 10);
		}
	});

	$effect(() => {
		if (rstrState.status === 'render') {
			if (rstr) rstr.cleanup();
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
			renderInfo = rstr.render(config);
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

<!--=======================================================================================-->

<div class="canvas-container">
	{#if rstrState.status === 'render'}
		<div class="render-info">{renderInfo}</div>
	{/if}
	<div class="canvas-wrapper" bind:this={canvasWrapper}>
		<canvas id="raster-canvas" bind:this={canvas} data-paper-hidpi="on" width="1080px" height="1080px"></canvas>
	</div>

	<RasterActions {canvas} {rstr} />
</div>

<!--=======================================================================================-->

<style>

    .canvas-container {
        position: relative;
        display: flex;
        gap: .5rem;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 60vw;
    }

    @media (max-width: 850px) {
        .canvas-container {
            width: 100%;
            /*    max-width: 90vw;*/
        }
    }

    .canvas-wrapper {
        width: 100%;
        position: relative;
        overflow: hidden;
    }

    #raster-canvas {
        width: 100%;
        /*height: 100%;*/
        object-fit: contain;
        border-color: black;
        border-style: dashed;
        border-width: 1px;
    }

    .render-info {
        background-color: rgba(255, 255, 255, 0.8);
        position: absolute;
        top: 0;
        left: 0;
        opacity: 0.8;
        font-family: "Courier New", monospace;
        font-size: small;
        font-weight: bold;
        z-index: 10;
        color: black;
        padding: 0 .5rem;
        margin: .5rem;
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
