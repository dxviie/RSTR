<script lang="ts">
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
	import { segmentGrid } from '$lib/rstr2/segmentation';
	import { buildRegionGeometries } from '$lib/rstr2/regionTools';
	import {
		hatchPolygon,
		spacingForInk,
		type HatchSegments,
		type SpacingCurve
	} from '$lib/rstr2/hatchTools';
	import { buildSvgDocument } from '$lib/rstr2/svgExport';

	//***************************************************************
	// 														STATE
	//***************************************************************

	const LAYER_STORAGE_KEY = 'rstr:v2:layers';

	interface RenderRegion {
		d: string;
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

	let hatchCanvas: HTMLCanvasElement | undefined = $state();
	let hatchDataURL = $state('');

	let fileInput: HTMLInputElement | undefined = $state();
	let dragActive = $state(false);

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

	// 1. image -> pixels
	$effect(() => {
		const src = inputImage;
		if (!src || typeof window === 'undefined') return;
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
		};
		img.src = src;
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
					d: geometry.d,
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

	// 4. segmentation + mapping config -> hatch lines (canvas preview)
	let hatchGeneration = 0;
	$effect(() => {
		void hatchLayersKey;
		void params.showHatching;
		void params.outputWidthMm;
		void params.penWidthMm;
		void params.spacingMinMm;
		void params.spacingMaxMm;
		void params.hatchThreshold;
		void params.spacingCurve;
		void params.hatchGamma;
		void params.inkBoost;
		const results = layerResults;
		if (!params.showHatching || results.length === 0 || !imgWidth || !hatchCanvas) {
			hatchDataURL = '';
			return;
		}
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

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#FFFEF7'; // warm paper white
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.lineCap = 'round';
		ctx.globalCompositeOperation = 'multiply';
		ctx.globalAlpha = 0.85;

		const pxPerMm = imgWidth / params.outputWidthMm;
		const curve = params.spacingCurve as SpacingCurve;
		let totalLines = 0;

		for (const layer of layers) {
			if (!layer.enabled) continue;
			const result = results.find((res) => res.layerId === layer.id);
			if (!result) continue;

			const hatch = effectiveHatch(layer);
			const spacingOptions = { curve, gamma: hatch.gamma, inkBoost: hatch.inkBoost };
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

		hatchDataURL = canvas.toDataURL('image/png');
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

	const resetLayers = () => {
		layers = defaultCmyLayers();
	};

	const layerById = (id: string): LayerConfig | undefined =>
		layers.find((layer) => layer.id === id);

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
	}

	const ADJUST_SLIDERS: SliderDef[] = [
		{ id: 'brightness', label: 'brightness', min: -0.5, max: 0.5, step: 0.01 },
		{ id: 'contrast', label: 'contrast', min: -1, max: 1, step: 0.02 },
		{ id: 'imageGamma', label: 'gamma / key', min: 0.25, max: 3, step: 0.05 },
		{ id: 'saturation', label: 'saturation', min: 0, max: 2, step: 0.05 },
		{ id: 'vibrance', label: 'vibrance', min: -1, max: 1, step: 0.02 }
	];

	const SEGMENTATION_SLIDERS: SliderDef[] = [
		{ id: 'resolution', label: 'resolution', min: 8, max: 512, step: 1 },
		{ id: 'smoothing', label: 'smoothing', min: 0, max: 4, step: 1 },
		{ id: 'tolerance', label: 'tolerance', min: 0, max: 0.5, step: 0.01 },
		{ id: 'minRegionSize', label: 'min region size', min: 1, max: 128, step: 1 }
	];

	const LINE_SLIDERS: SliderDef[] = [
		{ id: 'penWidthMm', label: 'pen width (mm)', min: 0.05, max: 5, step: 0.05 },
		{ id: 'spacingMinMm', label: 'spacing min (mm)', min: 0.05, max: 10, step: 0.05 },
		{ id: 'spacingMaxMm', label: 'spacing max (mm)', min: 0.05, max: 10, step: 0.05 },
		{ id: 'hatchThreshold', label: 'ink threshold', min: 0, max: 1, step: 0.05 },
		{ id: 'hatchGamma', label: 'ink gamma', min: 0.5, max: 4, step: 0.05 },
		{ id: 'inkBoost', label: 'ink boost', min: 0.25, max: 4, step: 0.05 }
	];
</script>

<svelte:head>
	<title>RSTR v2 — raster to plottable SVG</title>
</svelte:head>

<div class="tool">
	<!-------------------------------------------------------------
		CANVAS AREA
	-------------------------------------------------------------->
	<div
		class="canvas-area"
		class:drag-active={dragActive}
		role="button"
		tabindex="0"
		ondragover={(event) => {
			event.preventDefault();
			dragActive = true;
		}}
		ondragleave={() => (dragActive = false)}
		ondrop={onDrop}
		onclick={() => {
			if (!inputImage) fileInput?.click();
		}}
		onkeydown={(event) => {
			if (!inputImage && (event.key === 'Enter' || event.key === ' ')) fileInput?.click();
		}}
	>
		{#if inputImage}
			<svg
				width={imgWidth}
				height={imgHeight}
				viewBox={`0 0 ${imgWidth} ${imgHeight}`}
				class="preview-svg"
			>
				<!--	INPUT IMAGE AS BG -->
				<image
					href={inputImage}
					x="0"
					y="0"
					width={imgWidth}
					height={imgHeight}
					opacity={params.imageOpacity}
				/>

				<!--	REGION SHAPES -->
				{#if params.showShapes}
					{#each layerResults as result (result.layerId)}
						{@const layer = layerById(result.layerId)}
						{#if layer?.enabled}
							<g id="shapes-{layer.id}" style="mix-blend-mode: multiply;">
								{#each result.regions as region}
									<path
										d={region.d}
										fill={layer.color}
										fill-opacity={region.ink * params.shapeOpacity}
										stroke={params.debug ? '#FF00FF' : 'none'}
										stroke-width={params.debug ? 1 : 0}
									/>
								{/each}
							</g>
						{/if}
					{/each}
				{/if}

				<!--	HATCHING PREVIEW (canvas render embedded as image) -->
				{#if params.showHatching && hatchDataURL}
					<image
						href={hatchDataURL}
						x="0"
						y="0"
						width={imgWidth}
						height={imgHeight}
						style={`pointer-events: none; ${params.showShapes ? 'mix-blend-mode: multiply;' : ''}`}
						opacity={params.hatchingOpacity}
					/>
				{/if}
			</svg>
		{:else}
			<div class="dropzone-hint">
				<p class="hint-title">drop an image here</p>
				<p class="hint-sub">or click to browse — everything stays in your browser</p>
			</div>
		{/if}

		<!--	STATUS BAR -->
		<div class="status-bar">
			{#if status.busy}
				<span class="busy-dot"></span> computing…
			{:else if cellGrid}
				{cellGrid.cols}×{cellGrid.rows} cells · {status.regions} regions · {status.lines} lines
				{#if params.debug}
					· seg {status.segMs.toFixed(0)}ms · hatch {status.hatchMs.toFixed(0)}ms
				{/if}
			{:else}
				select an image to start
			{/if}
		</div>
	</div>

	<!-- Hidden canvas for the hatching preview -->
	<canvas
		bind:this={hatchCanvas}
		width={imgWidth}
		height={imgHeight}
		style="position: absolute; pointer-events: none; visibility: hidden;"
	></canvas>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		style="display: none;"
		onchange={(event) => openFile(event.currentTarget.files)}
	/>

	<!-------------------------------------------------------------
		CONTROL PANEL
	-------------------------------------------------------------->
	<aside class="panel">
		<section class="panel-group">
			<div class="group-title">image</div>
			<button class="wide-btn" onclick={() => fileInput?.click()}>
				{inputImage ? 'replace image' : 'choose image'}
			</button>
			<label class="slider-row">
				<span>image opacity</span>
				<input type="range" min="0" max="1" step="0.05" bind:value={params.imageOpacity} />
				<input type="number" min="0" max="1" step="0.05" bind:value={params.imageOpacity} />
			</label>
		</section>

		<!--	LAYER STACK -->
		<section class="panel-group">
			<div class="group-title">layers · one per pen</div>
			{#each layers as layer, index (layer.id)}
				<div class="layer-card" class:disabled={!layer.enabled}>
					<div class="layer-row">
						<input type="checkbox" bind:checked={layer.enabled} title="Enable layer" />
						<input class="layer-color" type="color" bind:value={layer.color} title="Layer color" />
						<input class="layer-name" type="text" bind:value={layer.name} />
						<button
							class="icon-btn"
							onclick={() => moveLayer(layer.id, -1)}
							disabled={index === 0}
							title="Move up">▲</button
						>
						<button
							class="icon-btn"
							onclick={() => moveLayer(layer.id, 1)}
							disabled={index === layers.length - 1}
							title="Move down">▼</button
						>
						<button
							class="icon-btn remove"
							onclick={() => removeLayer(layer.id)}
							disabled={layers.length <= 1}
							title="Remove layer">✕</button
						>
					</div>
					<div class="layer-row">
						<label>
							channel
							<select bind:value={layer.channel}>
								{#each Object.entries(CHANNEL_LABELS) as [value, label]}
									<option {value}>{label}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="layer-row">
						<label>
							angle min°
							<input type="number" bind:value={layer.angleMin} min="-360" max="360" step="5" />
						</label>
						<label>
							angle max°
							<input type="number" bind:value={layer.angleMax} min="-360" max="360" step="5" />
						</label>
					</div>
					<details class="overrides">
						<summary>
							overrides
							{#if overrideCount(layer) > 0}
								<span class="override-count">{overrideCount(layer)} active</span>
							{:else}
								<span class="override-none">all inherited</span>
							{/if}
						</summary>
						<div class="override-hint">
							empty = inherits the global Lines value (shown in <em>grey italic</em>)
						</div>
						<div class="layer-row">
							<label>
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
							<label>
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
							<label>
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
							<label>
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
							<label>
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
							<label>
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
							<button class="clear-overrides" onclick={() => clearOverrides(layer)}>
								↺ clear overrides
							</button>
						{/if}
					</details>
				</div>
			{/each}
			<div class="layers-actions">
				<button onclick={addLayer}>+ Add layer</button>
				<button onclick={resetLayers}>Reset to CMY</button>
			</div>
		</section>

		<details class="panel-group collapsible" open>
			<summary class="group-title">lines</summary>
			{#each LINE_SLIDERS as slider (slider.id)}
				<label class="slider-row">
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
			<label class="select-row">
				<span>spacing curve</span>
				<select bind:value={params.spacingCurve}>
					<option value="coverage">Coverage (true tone)</option>
					<option value="gamma">Gamma</option>
					<option value="log">Log</option>
					<option value="linear">Linear</option>
				</select>
			</label>
		</details>

		<details class="panel-group collapsible">
			<summary class="group-title">segmentation</summary>
			<label class="select-row">
				<span>algorithm</span>
				<select bind:value={params.algorithm}>
					<option value="watershed">Watershed</option>
					<option value="posterize">Posterize</option>
					<option value="kmeans">K-means</option>
				</select>
			</label>
			{#each SEGMENTATION_SLIDERS as slider (slider.id)}
				<label class="slider-row">
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
		</details>

		<details class="panel-group collapsible">
			<summary class="group-title">adjust</summary>
			{#each ADJUST_SLIDERS as slider (slider.id)}
				<label class="slider-row">
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
		</details>

		<details class="panel-group collapsible">
			<summary class="group-title">display</summary>
			<label class="check-row">
				<input type="checkbox" bind:checked={params.showShapes} /> show shapes
			</label>
			<label class="slider-row">
				<span>shape opacity</span>
				<input type="range" min="0" max="1" step="0.05" bind:value={params.shapeOpacity} />
				<input type="number" min="0" max="1" step="0.05" bind:value={params.shapeOpacity} />
			</label>
			<label class="check-row">
				<input type="checkbox" bind:checked={params.showHatching} /> show hatching
			</label>
			<label class="slider-row">
				<span>hatching opacity</span>
				<input type="range" min="0" max="1" step="0.05" bind:value={params.hatchingOpacity} />
				<input type="number" min="0" max="1" step="0.05" bind:value={params.hatchingOpacity} />
			</label>
			<label class="check-row">
				<input type="checkbox" bind:checked={params.debug} /> debug
			</label>
		</details>

		<section class="panel-group">
			<div class="group-title">export</div>
			<label class="slider-row">
				<span>output width (mm)</span>
				<input type="range" min="10" max="1000" step="1" bind:value={params.outputWidthMm} />
				<input type="number" min="10" max="1000" step="1" bind:value={params.outputWidthMm} />
			</label>
			<div class="export-actions">
				<button class="wide-btn" onclick={downloadSvg} disabled={!imgWidth || status.busy}>
					↓ SVG
				</button>
				<button class="wide-btn" onclick={downloadPng} disabled={!hatchDataURL || status.busy}>
					↓ PNG
				</button>
			</div>
		</section>
	</aside>
</div>

<style>
	.tool {
		display: flex;
		flex-direction: row;
		gap: 1rem;
		width: 100%;
		align-items: flex-start;
		padding: 0 1rem;
	}

	/* ------------------------------------------------- canvas area */

	.canvas-area {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 24rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed transparent;
		border-radius: 0.5rem;
	}

	.canvas-area.drag-active {
		border-color: darkorange;
		background: rgba(255, 140, 0, 0.05);
	}

	.preview-svg {
		max-width: 100%;
		max-height: 80vh;
		width: auto;
		height: auto;
		box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
		background: #fffef7;
	}

	.dropzone-hint {
		text-align: center;
		color: #6b7280;
		cursor: pointer;
		padding: 4rem 2rem;
		border: 2px dashed #e2e8f0;
		border-radius: 0.75rem;
	}

	.dropzone-hint:hover {
		border-color: darkorange;
	}

	.hint-title {
		font-family: Bitter, serif;
		font-size: 1.4rem;
		font-weight: bold;
	}

	.hint-sub {
		font-size: 0.8rem;
		margin-top: 0.5rem;
	}

	.status-bar {
		position: absolute;
		bottom: 0.5rem;
		left: 0.5rem;
		padding: 0.25rem 0.6rem;
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid #e2e8f0;
		border-radius: 0.375rem;
		font-size: 0.7rem;
		color: #6b7280;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		pointer-events: none;
	}

	.busy-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: darkorange;
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

	/* ------------------------------------------------- control panel */

	.panel {
		width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		font-size: 0.75rem;
		max-height: 85vh;
		overflow-y: auto;
		padding-bottom: 2rem;
	}

	.panel-group {
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		padding: 0.6rem;
		background: rgba(255, 255, 255, 0.92);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.group-title {
		font-family: Bitter, serif;
		font-weight: bold;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #374151;
	}

	details.collapsible summary.group-title {
		cursor: pointer;
		user-select: none;
	}

	.slider-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.1rem;
		color: #6b7280;
	}

	.slider-row > span {
		font-size: 0.65rem;
	}

	.slider-row {
		grid-template-columns: 5.5rem 1fr 3.4rem;
		align-items: center;
		gap: 0.35rem;
	}

	.slider-row input[type='range'] {
		width: 100%;
		accent-color: darkorange;
		min-width: 0;
	}

	.slider-row input[type='number'] {
		width: 100%;
		box-sizing: border-box;
		padding: 0.1rem 0.2rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.25rem;
		font-size: 0.65rem;
	}

	.select-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: #6b7280;
	}

	.select-row > span {
		font-size: 0.65rem;
		width: 5.5rem;
		flex-shrink: 0;
	}

	.select-row select {
		flex: 1;
		padding: 0.15rem 0.25rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.25rem;
		font-family: inherit;
		font-size: 0.7rem;
	}

	.check-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: #6b7280;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.wide-btn {
		width: 100%;
		padding: 0.35rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		border-radius: 0.375rem;
		cursor: pointer;
		font-family: inherit;
	}

	.wide-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.export-actions {
		display: flex;
		gap: 0.4rem;
	}

	/* ------------------------------------------------- layer cards */

	.layer-card {
		border: 1px solid #e2e8f0;
		border-radius: 0.375rem;
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

	details.overrides {
		margin-top: 0.15rem;
		border-top: 1px dashed #e2e8f0;
		padding-top: 0.25rem;
	}

	details.overrides summary {
		cursor: pointer;
		font-size: 0.65rem;
		color: #6b7280;
		user-select: none;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	details.overrides summary::before {
		content: '▸';
		font-size: 0.6rem;
	}

	details.overrides[open] summary::before {
		content: '▾';
	}

	details.overrides summary::-webkit-details-marker {
		display: none;
	}

	details.overrides summary::marker {
		content: '';
	}

	.override-count {
		background: #ffedd5;
		color: #c2410c;
		border-radius: 0.5rem;
		padding: 0 0.35rem;
		font-size: 0.6rem;
		font-weight: 600;
	}

	.override-none {
		color: #b6bcc6;
		font-size: 0.6rem;
	}

	.override-hint {
		font-size: 0.6rem;
		color: #9ca3af;
		margin: 0.2rem 0;
	}

	/* inherited (placeholder) values read clearly as "not set here" */
	details.overrides input::placeholder {
		color: #c3c9d4;
		font-style: italic;
	}

	/* an active override stands out from inherited fields */
	details.overrides input.overridden {
		border-color: darkorange;
		background: #fff7ed;
		font-weight: 600;
	}

	.clear-overrides {
		margin-top: 0.25rem;
		width: 100%;
		border: 1px solid #e2e8f0;
		background: #fff;
		border-radius: 0.25rem;
		cursor: pointer;
		padding: 0.2rem;
		font-family: inherit;
		font-size: 0.65rem;
		color: #6b7280;
	}

	.clear-overrides:hover {
		background: #f3f4f6;
	}

	.layer-row label {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex: 1;
		color: #6b7280;
	}

	.layer-row input[type='number'],
	.layer-row input[type='text'],
	.layer-row select {
		width: 100%;
		box-sizing: border-box;
		padding: 0.15rem 0.25rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.25rem;
		font-family: inherit;
		font-size: 0.75rem;
	}

	.layer-name {
		flex: 1;
		min-width: 0;
	}

	.layer-color {
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.icon-btn {
		border: 1px solid #e2e8f0;
		background: #fff;
		border-radius: 0.25rem;
		cursor: pointer;
		padding: 0.1rem 0.3rem;
		font-size: 0.7rem !important;
	}

	.icon-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.icon-btn.remove:hover:not(:disabled) {
		background: #fee2e2;
		border-color: #ef4444;
	}

	.layers-actions {
		display: flex;
		gap: 0.4rem;
	}

	.layers-actions button {
		flex: 1;
		padding: 0.3rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		border-radius: 0.25rem;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.7rem !important;
	}

	.layers-actions button:hover {
		background: #f3f4f6;
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 850px) {
		.tool {
			flex-direction: column;
			align-items: stretch;
		}

		.panel {
			width: 100%;
			max-height: none;
		}
	}
</style>
