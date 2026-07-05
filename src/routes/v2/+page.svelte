<script lang="ts">
	import DualRangeInput from '@stanko/dual-range-input';
	import '@stanko/dual-range-input/dist/index.css';
	import { computeCellGrid, type CellGrid } from '$lib/rstr2/grid';
	import { adjustColors, isNeutralAdjustment } from '$lib/rstr2/imageAdjust';
	import {
		CHANNEL_LABELS,
		createLayer,
		defaultCmyLayers,
		extractChannel,
		parseStoredLayers,
		type LayerConfig
	} from '$lib/rstr2/layers';
	import {
		defaultParams,
		parseStoredParams,
		PARAMS_STORAGE_KEY,
		type Rstr2Params
	} from '$lib/rstr2/params';
	import {
		builtinPresets,
		parseSettingsFile,
		parseStoredPresets,
		PRESETS_STORAGE_KEY,
		serializeSettings,
		type Rstr2Settings,
		type SettingsPreset
	} from '$lib/rstr2/presets';
	import { segmentGrid } from '$lib/rstr2/segmentation';
	import { buildRegionGeometries } from '$lib/rstr2/regionTools';
	import { hatchPolygon, spacingForInk, type HatchSegments } from '$lib/rstr2/hatchTools';
	import { buildSvgDocument } from '$lib/rstr2/svgExport';

	//***************************************************************
	// 														STATE
	//***************************************************************

	const LAYER_STORAGE_KEY = 'rstr:v2:layers';
	const SAMPLE_IMAGES = ['/bbrasa-imp.png', '/knest-imp.png'];
	/** cap on the adjust-preview resolution — display only, keeps sliders fluid */
	const PREVIEW_MAX_PX = 1024;

	interface RenderRegion {
		loops: Float64Array[];
		/** mean channel intensity, 0..1 */
		ink: number;
		/** bounding box dimensions in px, drives the per-region hatch angle */
		boundsW: number;
		boundsH: number;
		hatchSegments?: HatchSegments;
	}

	interface LayerResult {
		layerId: string;
		regions: RenderRegion[];
	}

	interface PreviewBase {
		w: number;
		h: number;
		r: Float32Array;
		g: Float32Array;
		b: Float32Array;
	}

	const loadParams = (): Rstr2Params => {
		if (typeof localStorage === 'undefined') return defaultParams();
		return parseStoredParams(localStorage.getItem(PARAMS_STORAGE_KEY));
	};

	const loadLayers = (): LayerConfig[] => {
		if (typeof localStorage === 'undefined') return defaultCmyLayers();
		return parseStoredLayers(localStorage.getItem(LAYER_STORAGE_KEY)) ?? defaultCmyLayers();
	};

	const params: Rstr2Params = $state(loadParams());
	let layers: LayerConfig[] = $state(loadLayers());

	let inputImage = $state('');
	let imgWidth = $state(0);
	let imgHeight = $state(0);
	// Grids hold typed arrays, which Svelte leaves unproxied — plain $state
	// only tracks the reassignment of these variables, which is what we want.
	let pixels: Uint8ClampedArray | null = $state(null);
	let cellGrid: CellGrid | null = $state(null);
	let adjustedGrid: CellGrid | null = $state(null);
	let layerResults: LayerResult[] = $state([]);
	let previewBase: PreviewBase | null = $state(null);

	let hatchCanvas: HTMLCanvasElement | undefined = $state();
	let adjustCanvas: HTMLCanvasElement | undefined = $state();
	let hatchReady = $state(false);

	let fileInput: HTMLInputElement | undefined = $state();
	let dragActive = $state(false);

	// While the user works the adjust sliders we show the (adjusted) input
	// image instead of the hatch render, so the effect of the sliders on the
	// source is visible; shortly after the last interaction we flip back.
	let adjustActive = $state(false);
	let adjustTimer: ReturnType<typeof setTimeout> | undefined;
	const noteAdjust = () => {
		adjustActive = true;
		clearTimeout(adjustTimer);
		adjustTimer = setTimeout(() => (adjustActive = false), 900);
	};

	const status = $state({ busy: false, segMs: 0, hatchMs: 0, regions: 0, lines: 0 });

	const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

	// persist settings (JSON.stringify also registers deep dependencies)
	$effect(() => {
		const json = JSON.stringify(params);
		if (typeof localStorage !== 'undefined') localStorage.setItem(PARAMS_STORAGE_KEY, json);
	});
	$effect(() => {
		const json = JSON.stringify(layers);
		if (typeof localStorage !== 'undefined') localStorage.setItem(LAYER_STORAGE_KEY, json);
	});

	//***************************************************************
	// 														IMAGE INPUT
	//***************************************************************

	// start with a random sample so there is something to play with right away
	$effect(() => {
		if (!inputImage) {
			inputImage = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
		}
	});

	const openFile = (files: FileList | null | undefined) => {
		const file = files?.[0];
		if (!file || !file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => {
			inputImage = reader.result as string;
		};
		reader.readAsDataURL(file);
	};

	const onDrop = (event: DragEvent) => {
		event.preventDefault();
		dragActive = false;
		openFile(event.dataTransfer?.files);
	};

	//***************************************************************
	// 														PIPELINE
	//***************************************************************

	// 1. image -> pixels (+ downscaled float copy for the adjust preview)
	$effect(() => {
		const src = inputImage;
		if (!src || typeof window === 'undefined') return;
		hatchReady = false;
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.drawImage(img, 0, 0);
			imgWidth = img.width;
			imgHeight = img.height;
			pixels = ctx.getImageData(0, 0, img.width, img.height).data;
			previewBase = buildPreviewBase(img);
		};
		img.src = src;
	});

	const buildPreviewBase = (img: HTMLImageElement): PreviewBase | null => {
		const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(img.width, img.height));
		const w = Math.max(1, Math.round(img.width * scale));
		const h = Math.max(1, Math.round(img.height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(img, 0, 0, w, h);
		const data = ctx.getImageData(0, 0, w, h).data;
		const n = w * h;
		const r = new Float32Array(n);
		const g = new Float32Array(n);
		const b = new Float32Array(n);
		for (let i = 0, p = 0; i < n; i++, p += 4) {
			r[i] = data[p] / 255;
			g[i] = data[p + 1] / 255;
			b[i] = data[p + 2] / 255;
		}
		return { w, h, r, g, b };
	};

	// 1b. adjust preview: draw the adjusted source while sliders are active
	$effect(() => {
		const adjustments = {
			brightness: params.brightness,
			contrast: params.contrast,
			gamma: params.imageGamma,
			saturation: params.saturation,
			vibrance: params.vibrance
		};
		const base = previewBase;
		const canvas = adjustCanvas;
		if (!adjustActive || !base || !canvas) return;
		const { r, g, b } = isNeutralAdjustment(adjustments)
			? base
			: adjustColors(base.r, base.g, base.b, adjustments);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const imageData = ctx.createImageData(base.w, base.h);
		const data = imageData.data;
		for (let i = 0, p = 0; i < base.w * base.h; i++, p += 4) {
			data[p] = r[i] * 255;
			data[p + 1] = g[i] * 255;
			data[p + 2] = b[i] * 255;
			data[p + 3] = 255;
		}
		ctx.putImageData(imageData, 0, 0);
	});

	// 2. pixels + resolution -> cell grid (single pass over the pixel buffer)
	$effect(() => {
		const px = pixels;
		const resolution = params.resolution;
		if (!px || !imgWidth || !imgHeight || !resolution) return;
		cellGrid = computeCellGrid(px, imgWidth, imgHeight, resolution);
	});

	// 2b. cell grid + adjustments -> adjusted grid (cheap, O(cells))
	$effect(() => {
		const grid = cellGrid;
		const adjustments = {
			brightness: params.brightness,
			contrast: params.contrast,
			gamma: params.imageGamma,
			saturation: params.saturation,
			vibrance: params.vibrance
		};
		if (!grid) {
			adjustedGrid = null;
			return;
		}
		if (isNeutralAdjustment(adjustments)) {
			adjustedGrid = grid;
			return;
		}
		const { r, g, b } = adjustColors(grid.r, grid.g, grid.b, adjustments);
		adjustedGrid = { ...grid, r, g, b };
	});

	// Segmentation only depends on channels/enabled flags, not on mapping
	// tweaks like pen width or color — keep the keys separate so slider moves
	// don't retrigger the watershed.
	const segLayersKey = $derived(
		JSON.stringify(layers.map((l) => ({ id: l.id, channel: l.channel, enabled: l.enabled })))
	);
	const hatchLayersKey = $derived(
		JSON.stringify(
			layers.map((l) => [
				l.id,
				l.enabled,
				l.angleMin,
				l.angleMax,
				l.penWidthMm,
				l.spacingMinMm,
				l.spacingMaxMm,
				l.threshold,
				l.inkGamma,
				l.inkBoost,
				l.color
			])
		)
	);

	// Per-layer overrides fall back to the global parameters
	const effectiveHatch = (layer: LayerConfig) => ({
		penWidthMm: layer.penWidthMm ?? params.penWidthMm,
		spacingMinMm: layer.spacingMinMm ?? params.spacingMinMm,
		spacingMaxMm: layer.spacingMaxMm ?? params.spacingMaxMm,
		threshold: layer.threshold ?? params.hatchThreshold,
		gamma: layer.inkGamma ?? params.hatchGamma,
		inkBoost: layer.inkBoost ?? params.inkBoost
	});

	// 3. adjusted grid + layers -> segmentation per layer
	let segGeneration = 0;
	$effect(() => {
		// reactive dependencies
		void segLayersKey;
		void params.algorithm;
		void params.tolerance;
		void params.smoothing;
		void params.minRegionSize;
		const grid = adjustedGrid;
		if (!grid) return;
		recomputeSegmentation(grid);
	});

	const recomputeSegmentation = async (grid: CellGrid) => {
		const generation = ++segGeneration;
		status.busy = true;
		const t0 = performance.now();
		const results: LayerResult[] = [];
		let totalRegions = 0;

		for (const layer of layers) {
			if (!layer.enabled) continue;
			const values = extractChannel(grid.r, grid.g, grid.b, layer.channel);
			const seg = segmentGrid(values, grid.cols, grid.rows, {
				algorithm: params.algorithm,
				tolerance: params.tolerance,
				smoothing: params.smoothing,
				minRegionSize: params.minRegionSize
			});
			const geometries = buildRegionGeometries(
				seg.labels,
				seg.regionCount,
				grid.cols,
				grid.rows,
				grid.cellW,
				grid.cellH
			);
			results.push({
				layerId: layer.id,
				regions: geometries.map((geometry) => ({
					loops: geometry.loops,
					ink: seg.regionMean[geometry.id],
					boundsW: geometry.maxX - geometry.minX,
					boundsH: geometry.maxY - geometry.minY
				}))
			});
			totalRegions += seg.regionCount;
			// yield between layers so the UI stays responsive; bail if stale
			await nextFrame();
			if (generation !== segGeneration) return;
		}

		layerResults = results;
		status.segMs = performance.now() - t0;
		status.regions = totalRegions;
		status.busy = false;
	};

	// 4. segmentation + mapping config -> hatch lines on the visible canvas
	let hatchGeneration = 0;
	$effect(() => {
		void hatchLayersKey;
		void params.outputWidthMm;
		void params.penWidthMm;
		void params.spacingMinMm;
		void params.spacingMaxMm;
		void params.hatchThreshold;
		void params.hatchGamma;
		void params.inkBoost;
		const results = layerResults;
		if (results.length === 0 || !imgWidth || !hatchCanvas) return;
		recomputeHatching(results);
	});

	// Pick a hatch angle within the layer's range based on the region's own
	// shape (bbox diagonal): wide regions and tall regions get different
	// directions within the same layer.
	const angleForRegion = (layer: LayerConfig, region: RenderRegion): number => {
		const base = Math.atan2(region.boundsH, region.boundsW) * (180 / Math.PI); // 0..90
		return layer.angleMin + (base / 90) * (layer.angleMax - layer.angleMin);
	};

	const recomputeHatching = async (results: LayerResult[]) => {
		const generation = ++hatchGeneration;
		const canvas = hatchCanvas;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		const t0 = performance.now();

		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#FFFEF7'; // warm paper white
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.lineCap = 'round';
		ctx.globalCompositeOperation = 'multiply';
		ctx.globalAlpha = 0.85; // translucent-ink simulation

		const pxPerMm = imgWidth / params.outputWidthMm;
		let totalLines = 0;

		for (const layer of layers) {
			if (!layer.enabled) continue;
			const result = results.find((res) => res.layerId === layer.id);
			if (!result) continue;

			const hatch = effectiveHatch(layer);
			// 'coverage' recreates the true tone: inked fraction matches the
			// perceptually weighted channel value
			const spacingOptions = {
				curve: 'coverage' as const,
				gamma: hatch.gamma,
				inkBoost: hatch.inkBoost
			};
			const penWidthPx = hatch.penWidthMm * pxPerMm;
			// Nominal spacing bounds: a minimum below the pen width is allowed
			// and produces overlapping lines on purpose.
			const minSpacingPx = Math.max(hatch.spacingMinMm * pxPerMm, 0.1);
			const maxSpacingPx = Math.max(hatch.spacingMaxMm * pxPerMm, minSpacingPx);

			ctx.strokeStyle = layer.color;
			ctx.lineWidth = penWidthPx;
			ctx.beginPath();
			for (const region of result.regions) {
				region.hatchSegments = undefined;
				if (region.ink < hatch.threshold) continue;
				const spacing = spacingForInk(
					region.ink,
					penWidthPx,
					minSpacingPx,
					maxSpacingPx,
					spacingOptions
				);
				const segments = hatchPolygon(
					region.loops,
					angleForRegion(layer, region),
					spacing,
					penWidthPx
				);
				region.hatchSegments = segments;
				totalLines += segments.length / 4;
				for (let k = 0; k < segments.length; k += 4) {
					ctx.moveTo(segments[k], segments[k + 1]);
					ctx.lineTo(segments[k + 2], segments[k + 3]);
				}
			}
			ctx.stroke();
			await nextFrame();
			if (generation !== hatchGeneration) return;
		}

		hatchReady = true;
		status.hatchMs = performance.now() - t0;
		status.lines = totalLines;
	};

	//***************************************************************
	// 														LAYERS
	//***************************************************************

	const addLayer = () => {
		layers.push(createLayer());
	};

	const removeLayer = (id: string) => {
		layers = layers.filter((layer) => layer.id !== id);
	};

	const moveLayer = (id: string, delta: number) => {
		const index = layers.findIndex((layer) => layer.id === id);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= layers.length) return;
		const [layer] = layers.splice(index, 1);
		layers.splice(target, 0, layer);
	};

	const OVERRIDE_FIELDS = [
		'penWidthMm',
		'spacingMinMm',
		'spacingMaxMm',
		'threshold',
		'inkGamma',
		'inkBoost'
	] as const;

	const overrideCount = (layer: LayerConfig): number =>
		OVERRIDE_FIELDS.filter((field) => layer[field] !== null).length;

	const clearOverrides = (layer: LayerConfig): void => {
		for (const field of OVERRIDE_FIELDS) {
			layer[field] = null;
		}
	};

	//***************************************************************
	// 												PRESETS & SETTINGS
	//***************************************************************

	const BUILTIN_PRESETS = builtinPresets();

	const loadUserPresets = (): SettingsPreset[] => {
		if (typeof localStorage === 'undefined') return [];
		return parseStoredPresets(localStorage.getItem(PRESETS_STORAGE_KEY));
	};

	let userPresets: SettingsPreset[] = $state(loadUserPresets());
	let selectedPreset = $state('');
	let presetName = $state('');
	let settingsFileInput: HTMLInputElement | undefined = $state();
	let settingsNotice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const json = JSON.stringify(userPresets);
		if (typeof localStorage !== 'undefined') localStorage.setItem(PRESETS_STORAGE_KEY, json);
	});

	const notice = (message: string) => {
		settingsNotice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (settingsNotice = ''), 4000);
	};

	/** plain deep copy of the live (proxied) state, ready to store or export */
	const currentSettings = (): Rstr2Settings => JSON.parse(JSON.stringify({ params, layers }));

	// Deep-clone on apply so later edits never mutate the stored preset. JSON
	// round-trip rather than structuredClone: user presets are $state proxies,
	// which structuredClone refuses to touch.
	const applySettings = (settings: Rstr2Settings) => {
		const clone: Rstr2Settings = JSON.parse(JSON.stringify(settings));
		Object.assign(params, clone.params);
		layers = clone.layers;
	};

	const isUserPreset = $derived(userPresets.some((preset) => preset.name === selectedPreset));

	const applySelectedPreset = () => {
		const preset =
			BUILTIN_PRESETS.find((entry) => entry.name === selectedPreset) ??
			userPresets.find((entry) => entry.name === selectedPreset);
		if (preset) applySettings(preset.settings);
	};

	const savePreset = () => {
		const name = presetName.trim();
		if (!name) return;
		if (BUILTIN_PRESETS.some((preset) => preset.name.toLowerCase() === name.toLowerCase())) {
			notice(`"${name}" is a built-in preset — pick another name`);
			return;
		}
		const preset: SettingsPreset = { name, settings: currentSettings() };
		const index = userPresets.findIndex((entry) => entry.name === name);
		if (index >= 0) userPresets[index] = preset;
		else userPresets.push(preset);
		selectedPreset = name;
		presetName = '';
		notice(index >= 0 ? `updated preset "${name}"` : `saved preset "${name}"`);
	};

	const deleteSelectedPreset = () => {
		if (!isUserPreset) return;
		userPresets = userPresets.filter((preset) => preset.name !== selectedPreset);
		notice(`deleted preset "${selectedPreset}"`);
		selectedPreset = '';
	};

	const exportSettings = () => {
		const json = serializeSettings(currentSettings());
		downloadBlob(new Blob([json], { type: 'application/json' }), `rstr-settings-${stamp()}.json`);
	};

	const importSettings = (files: FileList | null | undefined) => {
		const file = files?.[0];
		if (!file) return;
		file.text().then((text) => {
			const settings = parseSettingsFile(text);
			if (!settings) {
				notice(`could not read ${file.name} — not an RSTR settings file?`);
				return;
			}
			applySettings(settings);
			selectedPreset = '';
			notice(`imported ${file.name}`);
		});
	};

	//***************************************************************
	// 														EXPORT
	//***************************************************************

	const downloadBlob = (blob: Blob, filename: string) => {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	};

	const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

	const downloadSvg = () => {
		if (!imgWidth) return;
		const pxPerMm = imgWidth / params.outputWidthMm;
		const exportLayers = layers
			.filter((layer) => layer.enabled)
			.map((layer) => {
				const result = layerResults.find((res) => res.layerId === layer.id);
				return {
					layer,
					penWidthPx: effectiveHatch(layer).penWidthMm * pxPerMm,
					segments: result?.regions.map((region) => region.hatchSegments ?? []) ?? []
				};
			});
		const svg = buildSvgDocument(exportLayers, imgWidth, imgHeight, params.outputWidthMm);
		downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `rstr-${stamp()}.svg`);
	};

	const downloadPng = () => {
		hatchCanvas?.toBlob((blob) => {
			if (blob) downloadBlob(blob, `rstr-${stamp()}.png`);
		});
	};

	//***************************************************************
	// 														CONTROLS
	//***************************************************************

	type NumericKey = {
		[K in keyof Rstr2Params]: Rstr2Params[K] extends number ? K : never;
	}[keyof Rstr2Params];

	interface SliderDef {
		id: NumericKey;
		label: string;
		min: number;
		max: number;
		step: number;
		/** tooltip explaining what the control does */
		tip: string;
	}

	const ADJUST_SLIDERS: SliderDef[] = [
		{
			id: 'brightness',
			label: 'brightness',
			min: -0.5,
			max: 0.5,
			step: 0.01,
			tip: 'brighten (+) or darken (-) before segmentation'
		},
		{
			id: 'contrast',
			label: 'contrast',
			min: -1,
			max: 1,
			step: 0.02,
			tip: 'contrast around mid grey'
		},
		{
			id: 'imageGamma',
			label: 'gamma / key',
			min: 0.25,
			max: 3,
			step: 0.05,
			tip: 'midtone curve — above 1 lifts, below 1 keys down'
		},
		{
			id: 'saturation',
			label: 'saturation',
			min: 0,
			max: 2,
			step: 0.05,
			tip: 'uniform color saturation, 0 = greyscale'
		},
		{
			id: 'vibrance',
			label: 'vibrance',
			min: -1,
			max: 1,
			step: 0.02,
			tip: 'saturation boost weighted towards muted colors'
		}
	];

	const SEGMENTATION_SLIDERS: SliderDef[] = [
		{
			id: 'resolution',
			label: 'resolution',
			min: 8,
			max: 512,
			step: 1,
			tip: 'grid resolution (cells across) — more cells, more detail, slower'
		},
		{
			id: 'smoothing',
			label: 'smoothing',
			min: 0,
			max: 4,
			step: 1,
			tip: 'blur passes before segmentation — higher = fewer, larger regions'
		},
		{
			id: 'tolerance',
			label: 'tolerance',
			min: 0,
			max: 0.5,
			step: 0.01,
			tip: 'max intensity difference for merging adjacent regions'
		},
		{
			id: 'minRegionSize',
			label: 'min region size',
			min: 1,
			max: 128,
			step: 1,
			tip: 'regions with fewer cells get absorbed into a neighbour'
		}
	];

	const LINE_SLIDERS: SliderDef[] = [
		{
			id: 'penWidthMm',
			label: 'pen width (mm)',
			min: 0.05,
			max: 5,
			step: 0.05,
			tip: 'physical line width — layers can override'
		},
		{
			id: 'hatchThreshold',
			label: 'ink threshold',
			min: 0,
			max: 1,
			step: 0.05,
			tip: 'regions with less ink are left empty — layers can override'
		},
		{
			id: 'hatchGamma',
			label: 'ink gamma',
			min: 0.5,
			max: 4,
			step: 0.05,
			tip: 'perceptual weight on ink intensity before spacing'
		},
		{
			id: 'inkBoost',
			label: 'ink boost',
			min: 0.25,
			max: 4,
			step: 0.05,
			tip: 'coverage multiplier — above 1 pushes dark regions into overlapping lines'
		}
	];

	const SPACING_TIP =
		'nominal min/max line spacing — each region lands in this range based on its ink; layers can override';

	// Dual-range slider for the spacing bounds
	let spacingMinEl: HTMLInputElement | undefined = $state();
	let spacingMaxEl: HTMLInputElement | undefined = $state();
	let spacingDri: DualRangeInput | undefined;

	$effect(() => {
		if (!spacingMinEl || !spacingMaxEl) return;
		spacingDri = new DualRangeInput(spacingMinEl, spacingMaxEl);
		return () => {
			spacingDri?.destroy();
			spacingDri = undefined;
		};
	});

	// keep the track fill in sync when the values change from the number inputs
	$effect(() => {
		void params.spacingMinMm;
		void params.spacingMaxMm;
		spacingDri?.update();
	});
</script>

<svelte:head>
	<title>RSTR — raster images to plottable SVG</title>
</svelte:head>

<div class="app">
	<!-------------------------------------------------------------
		TOP BAR
	-------------------------------------------------------------->
	<header class="topbar">
		<a class="logo-link" href="https://d17e.dev" title="d17e.dev">
			<svg
				class="logo"
				role="img"
				aria-label="D17E logo"
				viewBox="0 0 1046 447"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g transform="matrix(1.2778,0,0,0.628916,-169.768,-154.959)">
					<path
						d="M930.998,957.001L930.998,957.183L132.86,957.183L132.86,246.391L930.998,246.391L930.998,246.802L951.958,246.802L951.958,957.001L930.998,957.001ZM399.748,807.315L517.675,807.315L517.675,734.622L477.603,734.622L477.603,400.234L441.538,400.234L441.538,417.68C441.538,444.431 436.099,452.573 422.647,452.573L401.18,452.573L401.18,522.358L441.252,522.358L441.252,734.622L399.748,734.622L399.748,807.315ZM586.656,807.315L627.3,807.315L706.3,475.253L706.3,400.234L566.047,400.234L566.047,472.345L665.655,472.345L586.656,801.499L586.656,807.315ZM208.261,807.315L268.083,807.315C326.76,807.315 354.238,728.806 354.238,627.036L354.238,580.513C354.238,478.742 326.76,400.234 268.083,400.234L208.261,400.234L208.261,807.315ZM245.471,734.622L245.471,472.927L268.083,472.927C306.438,472.927 317.028,516.543 317.028,580.513L317.028,627.036C317.028,691.006 306.438,734.622 268.083,734.622L245.471,734.622ZM750.665,807.315L876.606,807.315L876.606,735.785L787.875,735.785L787.875,632.852L867.733,632.852L867.733,561.903L787.875,561.903L787.875,471.764L876.606,471.764L876.606,400.234L750.665,400.234L750.665,807.315Z"
						fill="currentColor"
					/>
				</g>
			</svg>
		</a>
		<span class="wordmark">RSTR</span>
		<span class="tagline">raster images to plottable svg</span>
		<div class="spacer"></div>
		<a class="top-link" href="/about" title="about RSTR">?</a>
	</header>

	<div class="workspace">
		<!-------------------------------------------------------------
			LEFT PANE — image + adjust, segmentation, lines
		-------------------------------------------------------------->
		<aside class="pane left">
			<section class="panel-group">
				<div class="group-title">image</div>
				<div class="image-picker">
					<button
						class="thumb current"
						onclick={() => fileInput?.click()}
						title="browse for an image"
					>
						{#if inputImage}
							<img src={inputImage} alt="current input" />
						{:else}
							+
						{/if}
					</button>
					<button
						class="browse-btn"
						onclick={() => fileInput?.click()}
						title="pick an image from your device — it never leaves the browser"
					>
						browse an image<span class="browse-sub">or drop one on the render</span>
					</button>
				</div>
				{#each ADJUST_SLIDERS as slider (slider.id)}
					<label class="slider-row" title={slider.tip}>
						<span>{slider.label}</span>
						<input
							type="range"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={params[slider.id]}
							onpointerdown={noteAdjust}
							oninput={noteAdjust}
						/>
						<input
							type="number"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={params[slider.id]}
							oninput={noteAdjust}
						/>
					</label>
				{/each}
			</section>

			<section class="panel-group">
				<div class="group-title">segmentation</div>
				<label
					class="select-row"
					title="segmentation strategy — watershed follows tonal basins, posterize bands intensities, k-means clusters them"
				>
					<span>algorithm</span>
					<select bind:value={params.algorithm}>
						<option value="watershed">Watershed</option>
						<option value="posterize">Posterize</option>
						<option value="kmeans">K-means</option>
					</select>
				</label>
				{#each SEGMENTATION_SLIDERS as slider (slider.id)}
					<label class="slider-row" title={slider.tip}>
						<span>{slider.label}</span>
						<input
							type="range"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={params[slider.id]}
						/>
						<input
							type="number"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={params[slider.id]}
						/>
					</label>
				{/each}
			</section>

			<section class="panel-group">
				<div class="group-title">lines</div>
				{#each LINE_SLIDERS as slider (slider.id)}
					<label class="slider-row" title={slider.tip}>
						<span>{slider.label}</span>
						<input
							type="range"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={params[slider.id]}
						/>
						<input
							type="number"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={params[slider.id]}
						/>
					</label>
				{/each}
				<div class="spacing-control" title={SPACING_TIP}>
					<div class="spacing-head">
						<span>spacing (mm)</span>
						<input
							type="number"
							min="0.05"
							max="10"
							step="0.05"
							bind:value={params.spacingMinMm}
							title="densest allowed line spacing (mm)"
						/>
						<span class="spacing-dash">–</span>
						<input
							type="number"
							min="0.05"
							max="10"
							step="0.05"
							bind:value={params.spacingMaxMm}
							title="sparsest line spacing before a region stays empty-ish (mm)"
						/>
					</div>
					<div class="dual-range-input">
						<input
							bind:this={spacingMinEl}
							type="range"
							min="0.05"
							max="10"
							step="0.05"
							bind:value={params.spacingMinMm}
						/>
						<input
							bind:this={spacingMaxEl}
							type="range"
							min="0.05"
							max="10"
							step="0.05"
							bind:value={params.spacingMaxMm}
						/>
					</div>
				</div>
			</section>
		</aside>

		<!-------------------------------------------------------------
			STAGE — the render is the centerpiece
		-------------------------------------------------------------->
		<main
			class="stage"
			class:drag-active={dragActive}
			ondragover={(event) => {
				event.preventDefault();
				dragActive = true;
			}}
			ondragleave={() => (dragActive = false)}
			ondrop={onDrop}
		>
			<canvas
				bind:this={hatchCanvas}
				class="render"
				class:hidden={!hatchReady || adjustActive}
				width={imgWidth}
				height={imgHeight}
			></canvas>
			<canvas
				bind:this={adjustCanvas}
				class="render"
				class:hidden={!adjustActive || !previewBase}
				width={previewBase?.w ?? 0}
				height={previewBase?.h ?? 0}
			></canvas>
			{#if !adjustActive && !hatchReady}
				{#if inputImage}
					<img class="render placeholder" src={inputImage} alt="input" />
				{:else}
					<div class="dropzone-hint">
						<p class="hint-title">drop an image here</p>
						<p class="hint-sub">everything stays in your browser</p>
					</div>
				{/if}
			{/if}
		</main>

		<!-------------------------------------------------------------
			RIGHT PANE — layers + export
		-------------------------------------------------------------->
		<aside class="pane right">
			<section class="panel-group">
				<div class="group-title">layers · one per pen</div>
				{#each layers as layer, index (layer.id)}
					<div class="layer-card" class:disabled={!layer.enabled}>
						<div class="layer-row">
							<input
								type="checkbox"
								bind:checked={layer.enabled}
								title="include this layer in the render and export"
							/>
							<input
								class="layer-color"
								type="color"
								bind:value={layer.color}
								title="pen color, used in the render and the exported SVG"
							/>
							<input
								class="layer-name"
								type="text"
								bind:value={layer.name}
								title="layer name — becomes the layer label in the exported SVG"
							/>
							<button
								class="icon-btn"
								onclick={() => moveLayer(layer.id, -1)}
								disabled={index === 0}
								title="move up — layers draw top to bottom">▲</button
							>
							<button
								class="icon-btn"
								onclick={() => moveLayer(layer.id, 1)}
								disabled={index === layers.length - 1}
								title="move down — layers draw top to bottom">▼</button
							>
							<button
								class="icon-btn remove"
								onclick={() => removeLayer(layer.id)}
								disabled={layers.length <= 1}
								title="remove layer">✕</button
							>
						</div>
						<details class="layer-settings">
							<summary title="channel, hatch angles and per-layer overrides">
								settings
								{#if overrideCount(layer) > 0}
									<span class="override-count"
										>{overrideCount(layer)} override{overrideCount(layer) > 1 ? 's' : ''}</span
									>
								{/if}
							</summary>
							<div class="layer-row">
								<label title="which image channel drives this layer's ink amount">
									channel
									<select bind:value={layer.channel}>
										{#each Object.entries(CHANNEL_LABELS) as [value, label]}
											<option {value}>{label}</option>
										{/each}
									</select>
								</label>
							</div>
							<div
								class="layer-row"
								title="hatch direction range — each region picks an angle in this range based on its own shape"
							>
								<label>
									angle min°
									<input type="number" bind:value={layer.angleMin} min="-360" max="360" step="5" />
								</label>
								<label>
									angle max°
									<input type="number" bind:value={layer.angleMax} min="-360" max="360" step="5" />
								</label>
							</div>
							<div class="override-hint">
								below: empty = inherits the global lines value (<em>grey italic</em>)
							</div>
							<div class="layer-row">
								<label title="physical line width for this pen — empty inherits the global value">
									pen (mm)
									<input
										type="number"
										class:overridden={layer.penWidthMm !== null}
										bind:value={layer.penWidthMm}
										placeholder={String(params.penWidthMm)}
										min="0.05"
										max="5"
										step="0.05"
									/>
								</label>
								<label
									title="regions with less ink are left empty — empty inherits the global value"
								>
									threshold
									<input
										type="number"
										class:overridden={layer.threshold !== null}
										bind:value={layer.threshold}
										placeholder={String(params.hatchThreshold)}
										min="0"
										max="1"
										step="0.05"
									/>
								</label>
							</div>
							<div class="layer-row">
								<label title="densest allowed line spacing — empty inherits the global value">
									spacing min
									<input
										type="number"
										class:overridden={layer.spacingMinMm !== null}
										bind:value={layer.spacingMinMm}
										placeholder={String(params.spacingMinMm)}
										min="0.05"
										max="20"
										step="0.05"
									/>
								</label>
								<label title="sparsest line spacing — empty inherits the global value">
									spacing max
									<input
										type="number"
										class:overridden={layer.spacingMaxMm !== null}
										bind:value={layer.spacingMaxMm}
										placeholder={String(params.spacingMaxMm)}
										min="0.05"
										max="20"
										step="0.05"
									/>
								</label>
							</div>
							<div class="layer-row">
								<label
									title="perceptual weight on ink intensity before spacing — empty inherits the global value"
								>
									ink gamma
									<input
										type="number"
										class:overridden={layer.inkGamma !== null}
										bind:value={layer.inkGamma}
										placeholder={String(params.hatchGamma)}
										min="0.5"
										max="4"
										step="0.05"
									/>
								</label>
								<label
									title="coverage multiplier — above 1 pushes dark regions into overlapping lines; empty inherits the global value"
								>
									ink boost
									<input
										type="number"
										class:overridden={layer.inkBoost !== null}
										bind:value={layer.inkBoost}
										placeholder={String(params.inkBoost)}
										min="0.25"
										max="4"
										step="0.05"
									/>
								</label>
							</div>
							{#if overrideCount(layer) > 0}
								<button
									class="clear-overrides"
									onclick={() => clearOverrides(layer)}
									title="clear all overrides — every value inherits the global lines settings again"
								>
									↺ clear overrides
								</button>
							{/if}
						</details>
					</div>
				{/each}
				<div class="layers-actions">
					<button onclick={addLayer} title="add a new pen layer">+ add layer</button>
				</div>
			</section>

			<section class="panel-group">
				<div class="group-title">presets</div>
				<div class="preset-row">
					<select
						bind:value={selectedPreset}
						onchange={applySelectedPreset}
						title="apply a preset — replaces all settings and layers"
					>
						<option value="" disabled>apply a preset…</option>
						<optgroup label="built-in">
							{#each BUILTIN_PRESETS as preset (preset.name)}
								<option value={preset.name}>{preset.name}</option>
							{/each}
						</optgroup>
						{#if userPresets.length > 0}
							<optgroup label="saved in this browser">
								{#each userPresets as preset (preset.name)}
									<option value={preset.name}>{preset.name}</option>
								{/each}
							</optgroup>
						{/if}
					</select>
					<button
						class="icon-btn remove"
						onclick={deleteSelectedPreset}
						disabled={!isUserPreset}
						title="delete the selected preset from this browser">✕</button
					>
				</div>
				<div class="preset-row">
					<input
						type="text"
						class="preset-name"
						placeholder="preset name"
						bind:value={presetName}
						onkeydown={(event) => event.key === 'Enter' && savePreset()}
						title="name for the current settings — saved in this browser"
					/>
					<button
						class="preset-save"
						onclick={savePreset}
						disabled={!presetName.trim()}
						title="save the current settings and layers as a preset in this browser">save</button
					>
				</div>
				<div class="settings-io">
					<button
						onclick={exportSettings}
						title="download all current settings and layers as a JSON file">↓ settings .json</button
					>
					<button
						onclick={() => settingsFileInput?.click()}
						title="load settings and layers from a previously exported JSON file"
						>↑ import .json</button
					>
				</div>
				{#if settingsNotice}
					<div class="settings-notice">{settingsNotice}</div>
				{/if}
			</section>

			<section class="panel-group">
				<div class="group-title">export</div>
				<label
					class="slider-row"
					title="target output width in millimeters — the height follows the image aspect"
				>
					<span>width (mm)</span>
					<input type="range" min="10" max="1000" step="1" bind:value={params.outputWidthMm} />
					<input type="number" min="10" max="1000" step="1" bind:value={params.outputWidthMm} />
				</label>
				<div class="export-actions">
					<button
						class="primary-btn"
						onclick={downloadSvg}
						disabled={!hatchReady || status.busy}
						title="download a plottable SVG — one layer group per pen"
					>
						↓ SVG
					</button>
					<button
						class="primary-btn"
						onclick={downloadPng}
						disabled={!hatchReady || status.busy}
						title="download the current render as a PNG"
					>
						↓ PNG
					</button>
				</div>
				<div class="blip" title="grid size · regions found · hatch lines drawn · compute time">
					{#if status.busy}
						<span class="busy-dot"></span> computing…
					{:else if cellGrid}
						{cellGrid.cols}×{cellGrid.rows} cells · {status.regions} regions · {status.lines} lines ·
						{(status.segMs + status.hatchMs).toFixed(0)}ms
					{:else}
						waiting for an image
					{/if}
				</div>
			</section>

			<div class="spacer"></div>
			<a class="credit" href="https://d17e.dev" target="_blank" rel="noopener">
				made with 🧡 by d17e.dev
			</a>
		</aside>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		style="display: none;"
		onchange={(event) => openFile(event.currentTarget.files)}
	/>

	<input
		bind:this={settingsFileInput}
		type="file"
		accept="application/json,.json"
		style="display: none;"
		onchange={(event) => {
			importSettings(event.currentTarget.files);
			event.currentTarget.value = '';
		}}
	/>
</div>

<style>
	@font-face {
		font-family: 'nudica_monobold';
		src: url('/fonts/nudicamono-bold-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'nudica_monolight';
		src: url('/fonts/nudicamono-light-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'argesta_regular';
		src: url('/fonts/argestatext-regular-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	/* Full-viewport app shell in the d17e.dev brand — deliberately covers the
	   site chrome of the root layout without touching any other page. The UI
	   itself stays neutral (inks and greys) so the art can shine; the brand
	   CMY lives in the artwork and the default pens. */
	.app {
		/* d17e.dev palette */
		--ink: #1a202c;
		--ink-soft: #2d3748;
		--bg: #fdfaff;
		--border: #e1e4e8;
		--muted: #60739f;
		--muted-light: #eef1f6;

		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.8rem;
	}

	/* neutralize the root layout's global link/button styling inside the app */
	.app a {
		border: none;
		color: var(--ink);
	}

	.app button {
		font-family: 'nudica_monobold', monospace !important;
		font-size: 0.75rem !important;
		transition: all 0.1s ease;
	}

	.app button:hover:not(:disabled) {
		background-color: var(--muted-light) !important;
	}

	.app button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.app :focus-visible {
		outline: var(--muted) dashed 1px;
	}

	/* neutral thumbs for all single-value sliders and checkboxes */
	.app input[type='range'],
	.app input[type='checkbox'] {
		accent-color: var(--ink);
	}

	/* ------------------------------------------------- top bar */

	.topbar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 1rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.logo-link {
		display: flex;
		align-items: center;
	}

	.logo {
		height: 26px;
		width: auto;
		color: var(--ink);
	}

	.logo-link:hover .logo {
		opacity: 0.7;
	}

	.wordmark {
		font-family: 'nudica_monobold', monospace;
		font-size: 1.15rem;
		letter-spacing: 0.08em;
	}

	.tagline {
		font-family: 'argesta_regular', serif;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.spacer {
		flex: 1;
	}

	.top-link {
		font-family: 'nudica_monobold', monospace;
		padding: 0.1rem 0.55rem;
		border: 1px solid var(--border) !important;
		border-radius: 999px;
	}

	.top-link:hover {
		border-color: var(--ink) !important;
	}

	/* ------------------------------------------------- workspace */

	.workspace {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.pane {
		width: 272px;
		flex-shrink: 0;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.pane.left {
		border-right: 1px solid var(--border);
	}

	.pane.right {
		border-left: 1px solid var(--border);
	}

	.panel-group {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.panel-group + .panel-group {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
	}

	.group-title {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.credit {
		font-family: 'argesta_regular', serif;
		font-size: 0.72rem;
		color: var(--muted);
		text-align: center;
		padding-bottom: 0.25rem;
	}

	.credit:hover {
		color: var(--ink);
	}

	/* ------------------------------------------------- stage */

	.stage {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		overflow: hidden;
	}

	.stage.drag-active {
		outline: 2px dashed var(--muted);
		outline-offset: -6px;
	}

	.render {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		background: #fffef7;
		box-shadow:
			0 2px 6px rgba(96, 115, 159, 0.25),
			0 8px 24px rgba(96, 115, 159, 0.2);
	}

	.render.hidden {
		display: none;
	}

	.render.placeholder {
		border-radius: 0;
		opacity: 0.9;
	}

	.dropzone-hint {
		text-align: center;
		color: var(--muted);
		padding: 4rem 2rem;
		border: 2px dashed var(--border);
		border-radius: 8px;
	}

	.hint-title {
		font-family: 'nudica_monobold', monospace;
		font-size: 1.3rem;
		margin: 0;
	}

	.hint-sub {
		font-family: 'argesta_regular', serif;
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}

	/* ------------------------------------------------- image picker */

	.image-picker {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.thumb {
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		overflow: hidden;
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem !important;
		color: var(--muted);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 0;
	}

	.browse-btn {
		flex: 1;
		min-width: 0;
		border: 1px dashed var(--border);
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		color: var(--ink);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		padding: 0.4rem;
	}

	.browse-btn:hover {
		border-color: var(--muted);
	}

	.browse-sub {
		font-family: 'argesta_regular', serif;
		font-size: 0.66rem;
		color: var(--muted);
		font-weight: normal;
	}

	/* ------------------------------------------------- controls */

	.slider-row {
		display: grid;
		grid-template-columns: 6rem 1fr 3.2rem;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
	}

	.slider-row > span {
		font-size: 0.68rem;
	}

	.slider-row input[type='range'] {
		width: 100%;
		min-width: 0;
	}

	.slider-row input[type='number'] {
		width: 100%;
		box-sizing: border-box;
		padding: 0.1rem 0.2rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.68rem;
	}

	.select-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
	}

	.select-row > span {
		font-size: 0.68rem;
		width: 6rem;
		flex-shrink: 0;
	}

	.select-row select {
		flex: 1;
		min-width: 0;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: inherit;
		font-size: 0.72rem;
	}

	/* ------------------------------------------------- spacing dual range */

	.spacing-control {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		color: var(--muted);
	}

	.spacing-head {
		display: grid;
		grid-template-columns: 1fr 3.2rem auto 3.2rem;
		align-items: center;
		gap: 0.25rem;
	}

	.spacing-head > span:first-child {
		font-size: 0.68rem;
	}

	.spacing-dash {
		text-align: center;
	}

	.spacing-head input[type='number'] {
		width: 100%;
		box-sizing: border-box;
		padding: 0.1rem 0.2rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.68rem;
	}

	/* neutral theme for @stanko/dual-range-input */
	.app :global(.dual-range-input) {
		--dri-height: 1.3rem;
		--dri-thumb-width: 0.85rem;
		--dri-thumb-height: 0.85rem;
		--dri-thumb-color: var(--ink);
		--dri-thumb-hover-color: var(--ink-soft);
		--dri-thumb-active-color: var(--ink-soft);
		--dri-thumb-border-color: transparent;
		--dri-thumb-border-radius: 999px;
		--dri-track-height: 0.2rem;
		--dri-track-color: #ccc;
		--dri-track-filled-color: var(--ink);
	}

	/* ------------------------------------------------- presets */

	.preset-row {
		display: flex;
		gap: 0.3rem;
		align-items: stretch;
	}

	.preset-row select {
		flex: 1;
		min-width: 0;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: inherit;
		font-size: 0.72rem;
	}

	.preset-name {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.72rem;
	}

	.preset-save {
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		padding: 0.1rem 0.6rem;
		color: var(--ink);
	}

	.preset-save:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.settings-io {
		display: flex;
		gap: 0.4rem;
	}

	.settings-io button {
		flex: 1;
		padding: 0.3rem;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: var(--ink);
	}

	.settings-notice {
		font-family: 'argesta_regular', serif;
		font-size: 0.68rem;
		color: var(--muted);
		text-align: center;
	}

	/* ------------------------------------------------- layer cards */

	.layer-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		background: #fff;
	}

	.layer-card.disabled {
		opacity: 0.55;
	}

	.layer-row {
		display: flex;
		gap: 0.3rem;
		align-items: center;
	}

	details.layer-settings {
		border-top: 1px dashed var(--border);
		padding-top: 0.25rem;
	}

	details.layer-settings summary {
		cursor: pointer;
		font-size: 0.66rem;
		color: var(--muted);
		user-select: none;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	details.layer-settings summary::before {
		content: '▸';
		font-size: 0.6rem;
	}

	details.layer-settings[open] summary::before {
		content: '▾';
	}

	details.layer-settings summary::-webkit-details-marker {
		display: none;
	}

	details.layer-settings summary::marker {
		content: '';
	}

	details.layer-settings > .layer-row {
		margin-top: 0.3rem;
	}

	.override-count {
		background: var(--muted-light);
		color: var(--ink);
		border-radius: 999px;
		padding: 0 0.4rem;
		font-size: 0.6rem;
		font-family: 'nudica_monobold', monospace;
	}

	.override-hint {
		font-family: 'argesta_regular', serif;
		font-size: 0.62rem;
		color: var(--muted);
		margin: 0.3rem 0 0;
	}

	/* inherited (placeholder) values read clearly as "not set here" */
	details.layer-settings input::placeholder {
		color: #c3c9d4;
		font-style: italic;
	}

	/* an active override stands out from inherited fields */
	details.layer-settings input.overridden {
		border-color: var(--ink);
		background: var(--muted-light);
	}

	.clear-overrides {
		margin-top: 0.3rem;
		width: 100%;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		padding: 0.2rem;
		color: var(--muted);
	}

	.layer-row label {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex: 1;
		color: var(--muted);
		font-size: 0.66rem;
	}

	.layer-row input[type='number'],
	.layer-row input[type='text'],
	.layer-row select {
		width: 100%;
		box-sizing: border-box;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.72rem;
	}

	.layer-name {
		flex: 1;
		min-width: 0;
	}

	.layer-color {
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.icon-btn {
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		padding: 0.1rem 0.3rem;
		color: var(--ink);
	}

	.icon-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.icon-btn.remove:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.layers-actions {
		display: flex;
		gap: 0.4rem;
	}

	.layers-actions button {
		flex: 1;
		padding: 0.3rem;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: var(--ink);
	}

	/* ------------------------------------------------- export */

	.export-actions {
		display: flex;
		gap: 0.4rem;
	}

	.primary-btn {
		flex: 1;
		padding: 0.45rem;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--bg);
		border-radius: 8px;
		cursor: pointer;
	}

	.primary-btn:hover:not(:disabled) {
		background: var(--ink-soft) !important;
		border-color: var(--ink-soft);
		color: #fff;
	}

	.primary-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.blip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: #fff;
		color: var(--muted);
		font-size: 0.65rem;
		justify-content: center;
		text-align: center;
	}

	.busy-dot {
		width: 0.5rem;
		height: 0.5rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--muted);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 900px) {
		.workspace {
			flex-direction: column;
			overflow-y: auto;
		}

		.pane {
			width: auto;
			overflow-y: visible;
		}

		.pane.left {
			border-right: none;
			border-top: 1px solid var(--border);
			order: 2;
		}

		.stage {
			min-height: 55vh;
			order: 1;
			flex-shrink: 0;
		}

		.pane.right {
			border-left: none;
			border-top: 1px solid var(--border);
			order: 3;
		}
	}
</style>
