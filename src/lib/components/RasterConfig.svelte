<script lang="ts">
	// @ts-nocheck — /classic legacy code — kept for nostalgia, intentionally left as-is and not type-checked.
	import { Pane } from 'tweakpane';
	import { config, configActions } from '$lib/rstr/config.svelte.ts';
	import { rstrState } from '$lib/fsm.svelte.js';
	import type { RstrColor } from '$lib/rstr/rstr.ts';

	let container: HTMLDivElement;
	let pane: Pane | null = null;
	const colorBindings = [];
	const paneConfig = {
		...config
	};
	let configEnabled = $state(true);

	/****************************
	 * Config enabling
	 ****************************/

	$effect(() => {
		if (rstrState.status) {
			setTimeout(() => {
				configEnabled = rstrState.status === 'config' || rstrState.status === 'done';
				if (pane) {
					pane.disabled = !configEnabled;
				}
				console.debug('updating config', configEnabled);
			}, 10);
		}
	});

	/****************************
	 * Color generation code
	 ****************************/

	function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function generateHarmonicColors(baseHue, numberOfColors, hueShift): RstrColor[] {
		const colors = [];
		const palette = generateLCHPalette(numberOfColors, baseHue, hueShift);
		for (let i = 0; i < numberOfColors; i++) {
			const c = palette[i];
			colors.push(lchToHex(c.l, c.c, c.h));
		}
		return colors;
	}

	function generateLCHPalette(count, hue, shift = 0) {
		// Ensure count is at least 1
		count = Math.max(1, count);

		// Normalize hue to 0-360 range
		hue = ((hue % 360) + 360) % 360;

		const palette = [];

		for (let i = 0; i < count; i++) {
			// Calculate lightness: distribute evenly from 20 to 80
			const l = 20 + (60 * i) / (count - 1);

			// Calculate chroma: higher for midtones, lower for extremes
			const cMax = 100 - Math.abs(l - 50) * 1.5;
			const c = Math.min(80, cMax);

			// Calculate hue: apply shift
			const h = (hue + shift * i) % 360;

			palette.push({ l, c, h });
		}

		return palette;
	}

	function lchToHex(l, c, h) {
		// LCH to Lab
		const a = c * Math.cos((h * Math.PI) / 180);
		const b = c * Math.sin((h * Math.PI) / 180);

		// Lab to XYZ
		let y = (l + 16) / 116;
		let x = a / 500 + y;
		let z = y - b / 200;

		x = 0.95047 * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
		y = 1.0 * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
		z = 1.08883 * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);

		// XYZ to sRGB
		let red = x * 3.2406 + y * -1.5372 + z * -0.4986;
		let green = x * -0.9689 + y * 1.8758 + z * 0.0415;
		let blue = x * 0.0557 + y * -0.204 + z * 1.057;

		red = red > 0.0031308 ? 1.055 * Math.pow(red, 1 / 2.4) - 0.055 : 12.92 * red;
		green = green > 0.0031308 ? 1.055 * Math.pow(green, 1 / 2.4) - 0.055 : 12.92 * green;
		blue = blue > 0.0031308 ? 1.055 * Math.pow(blue, 1 / 2.4) - 0.055 : 12.92 * blue;

		// Clip values
		red = Math.max(0, Math.min(1, red));
		green = Math.max(0, Math.min(1, green));
		blue = Math.max(0, Math.min(1, blue));

		// sRGB to Hex
		const toHex = (x) => {
			const hex = Math.round(x * 255).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};

		return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
	}

	function getRandomColors(count: number) {
		let hue = getRandomInt(0, 360);
		let shift = getRandomInt(1, 180);
		return generateHarmonicColors(hue, count, shift);
	}

	/*************************************
	 * Pane setup & interactivity
	 ************************************/

	const metroGifColors = [
		'#34431C',
		'#517800',
		'#8ADD52',
		'#46CBFF',
		'#594550',
		'#F40043',
		'#000000'
	];
	const microns = [
		{ color: '#4ED94D', name: 'Bright Green' },
		{ color: '#33A381', name: 'Teal' },
		{ color: '#2B4440', name: 'Dark Green' },
		{ color: '#242B46', name: 'Navy Blue' },
		{ color: '#F30015', name: 'Red' }
	];

	const xmasColors = ['#000000', '#505050', '#ACACAC', '#EE64FB', '#805825', '#0B1250'];

	//--- BLUES ---
	// paneConfig.colors = [
	// 	'#005959',
	// 	'#6D9BBC',
	// 	'#A5CEE5',
	// 	'#0095C7',
	// 	'#7DCDC6'
	// ];
	// 	[
	// 	{ color: '#005959', name: 'BG09 (Blue Green)' },
	// 	{ color: '#6D9BBC', name: 'B45 (Smoky Blue)' },
	// 	{ color: '#A5CEE5', name: 'B41 (Powder Blue)' },
	// 	{ color: '#0095C7', name: 'B16 (Cyanine Blue)' },
	// 	{ color: '#7DCDC6', name: 'BG05 (Holiday Blue)' }
	// ];

	$effect(() => {
		pane = new Pane({ container: container });
		paneConfig.colors = getRandomColors(getRandomInt(2, 5));

		setTimeout(() => configActions.update(paneConfig), 10);

		const baseFolder = pane.addFolder({ title: 'IMAGE' });
		baseFolder.addBinding(paneConfig, 'resolution', { min: 10, max: 144, step: 1 });

		const groupingFolder = pane.addFolder({ title: 'GROUPING' });
		groupingFolder.addBinding(paneConfig, 'iterations', { min: 1, max: 10, step: 1 });
		groupingFolder.addBinding(paneConfig, 'tolerance', { min: 0.01, max: 1, step: 0.01 });

		const hatchingFolder = pane.addFolder({ title: 'FILL' });
		hatchingFolder.addBinding(paneConfig, 'halves');
		hatchingFolder.addBinding(paneConfig, 'density', { min: 0, max: 1, step: 0.01 });
		const wrapperArray = paneConfig.colors.map((color) => {
			return { color: color };
		});
		wrapperArray.forEach((color, index) => {
			const binding = hatchingFolder.addBinding(color, 'color', { label: `Color ${index + 1}` });
			colorBindings.push(binding);
		});

		const addColorBtn = pane.addButton({
			title: '+'
		});
		addColorBtn.on('click', () => {
			const cfg = { ...paneConfig };
			const newPalette = getRandomColors(10);
			const newColor = { color: newPalette[getRandomInt(0, 9)] };
			wrapperArray.push(newColor);
			const binding = hatchingFolder.addBinding(newColor, 'color', {
				label: `Color ${wrapperArray.length}`
			});
			colorBindings.push(binding);
			cfg.colors = wrapperArray.map((wrapper) => wrapper.color);
			configActions.update(cfg);
		});
		pane
			.addButton({
				title: '-'
			})
			.on('click', () => {
				const cfg = { ...paneConfig };
				wrapperArray.pop();
				const binding = colorBindings.pop();
				if (binding) {
					hatchingFolder.remove(binding);
					binding.dispose();
				}
				cfg.colors = wrapperArray.map((wrapper) => wrapper.color);
				configActions.update(cfg);
			});
		pane
			.addButton({
				title: 'Randomize'
			})
			.on('click', () => {
				const cfg = { ...paneConfig };
				let popped = wrapperArray.pop();
				while (popped) {
					popped = wrapperArray.pop();
				}
				let poppedBinding = colorBindings.pop();
				while (poppedBinding) {
					hatchingFolder.remove(poppedBinding);
					poppedBinding.dispose();
					poppedBinding = colorBindings.pop();
				}
				const newPalette = getRandomColors(getRandomInt(2, 5));
				for (let i = 0; i < newPalette.length; i++) {
					const newColor = { color: newPalette[i] };
					wrapperArray.push(newColor);
					const binding = hatchingFolder.addBinding(newColor, 'color', { label: `Color ${i + 1}` });
					colorBindings.push(binding);
				}
				cfg.colors = wrapperArray.map((wrapper) => wrapper.color);
				configActions.update(cfg);
			});

		// Listen for changes and emit the updated config
		pane.on('change', () => {
			const cfg = { ...paneConfig };
			cfg.colors = wrapperArray.map((wrapper) => wrapper.color);
			configActions.update(cfg);
		});

		return () => {
			if (pane) pane.dispose();
		};
	});
</script>

<!--=======================================================================================-->

<div class="config-container">
	<div id="tweakpane-container" class="tweakpane-container" bind:this={container}></div>
</div>

<!--=======================================================================================-->

<style>
	.config-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.tweakpane-container div) {
		font-size: 1.1rem !important;
		line-height: 1.25rem;
		font-weight: 700;
	}

	/* Target the main Tweakpane container */
	:global(#tweakpane-container .tp-dfwv) {
		font-family: 'mono-bold', monospace;
		font-size: 0.875rem;
		line-height: 1.25rem;
		font-weight: 700;
	}

	:global(*) {
		--bld-br: 5px;
	}

	/* Target input elements */
	:global(#tweakpane-container .tp-txtv_i) {
		font-family: 'mono-bold', monospace;
		font-size: 12px;
	}

	/* Target labels */
	:global(#tweakpane-container .tp-lblv_l) {
		font-family: 'serif-text', serif;
		font-size: 0.95rem !important;
		font-weight: 100;
	}

	/* Target folder buttons */
	:global(#tweakpane-container .tp-fldv_b) {
		height: 2.2rem;
		border-radius: 10px 10px 0 0;
	}

	/* Target folder titles */
	:global(#tweakpane-container .tp-fldv_t) {
		font-family: 'mono-bold', monospace;
		font-size: 0.875rem !important; /* Slightly larger for titles */
		font-weight: bold;
		text-align: center;
	}

	/* Target Tweakpane buttons */
	:global(#tweakpane-container .tp-btnv_b) {
		font-family: 'mono-bold', monospace;
		/* Add any other button-specific styles you want */
		font-weight: bold;
		/* You might also want to adjust padding or other properties */
		padding: 6px 8px;
	}

	/* If you want to style the button text specifically */
	:global(#tweakpane-container .tp-btnv_t) {
		font-family: 'mono-bold', monospace;
		font-size: 1rem;
		line-height: 1.5;
		height: 2rem;
	}

	/* Increase height for all main control containers */
	:global(#tweakpane-container .tp-rotv_c) {
		--tp-base-height: 400px !important; /* Adjust this value as needed */
	}

	/* Adjust input fields */
	:global(#tweakpane-container .tp-txtv_i) {
		height: 30px !important; /* Adjust as needed */
	}

	/* Adjust sliders */
	:global(#tweakpane-container .tp-sldv_i) {
		height: 30px !important; /* Adjust as needed */
	}

	/* Adjust buttons */
	:global(#tweakpane-container .tp-btnv_b) {
		height: 40px !important; /* Adjust as needed */
		line-height: 40px !important; /* To vertically center text */
	}

	/* Adjust dropdown menus */
	:global(#tweakpane-container .tp-lstv_s) {
		height: 30px !important; /* Adjust as needed */
	}

	/* Adjust checkbox size */
	:global(#tweakpane-container .tp-ckbv_i) {
		width: 20px !important; /* Adjust as needed */
		height: 20px !important; /* Adjust as needed */
	}

	/* Adjust the vertical spacing between controls if needed */
	:global(#tweakpane-container .tp-rotv_c > *:not(:first-child)) {
		margin-top: 8px !important; /* Adjust as needed */
	}

	@media screen and (max-width: 480px) {
		.tweakpane-container {
			font-size: medium !important; /* Smaller font size for mobile */
		}

		:global(#tweakpane-container .tp-dfwv),
		:global(#tweakpane-container .tp-txtv_i),
		:global(#tweakpane-container .tp-btnv_b),
		:global(#tweakpane-container .tp-btnv_t) {
			font-size: 12px; /* Smaller font size for mobile */
		}

		:global(#tweakpane-container .tp-lblv_l) {
			font-size: 0.9rem; /* Adjusted for mobile */
		}

		:global(#tweakpane-container .tp-fldv_t) {
			font-size: 1rem; /* Adjusted for mobile */
		}
	}
</style>
