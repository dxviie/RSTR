<script lang="ts">
	import DualRangeInput from '@stanko/dual-range-input';
	import '@stanko/dual-range-input/dist/index.css';
	import BrandFooter from '$lib/components/BrandFooter.svelte';
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
		type Rstr2Params,
		type SegmentationAlgorithm
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
	import { randomizeSettings } from '$lib/rstr2/randomize';
	import { segmentGrid } from '$lib/rstr2/segmentation';
	import { buildRegionGeometries } from '$lib/rstr2/regionTools';
	import { hatchPolygon, spacingForInk, type HatchSegments } from '$lib/rstr2/hatchTools';
	import { buildSvgDocument, type ExportLayer } from '$lib/rstr2/svgExport';
	import {
		defaultPlotterConfig,
		estimateLayerPlotTime,
		formatPlotTime,
		parseStoredPlotterConfig,
		PLOTTER_STORAGE_KEY,
		type PlotterConfig
	} from '$lib/rstr2/plotTime';
	import {
		defaultVideoConfig,
		exportFrameRange,
		frameTime,
		MAX_SEQUENCE_FRAMES,
		parseStoredVideoConfig,
		totalFrameCount,
		VIDEO_STORAGE_KEY,
		type VideoExportConfig
	} from '$lib/rstr2/video';
	import { buildZip, type ZipEntry } from '$lib/rstr2/zip';
	import { buildExportName } from '$lib/rstr2/exportName';

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

	// On a fresh session (nothing persisted yet) we open on a random built-in
	// preset — otherwise a returning session restores exactly what it left.
	let initialPresetName = '';
	const loadInitialSettings = (): Rstr2Settings => {
		if (typeof localStorage === 'undefined') {
			return { params: defaultParams(), layers: defaultCmyLayers() };
		}
		const storedParams = localStorage.getItem(PARAMS_STORAGE_KEY);
		const storedLayers = localStorage.getItem(LAYER_STORAGE_KEY);
		if (storedParams === null && storedLayers === null) {
			const presets = builtinPresets();
			const choice = presets[Math.floor(Math.random() * presets.length)];
			initialPresetName = choice.name;
			return choice.settings;
		}
		return {
			params: parseStoredParams(storedParams),
			layers: parseStoredLayers(storedLayers) ?? defaultCmyLayers()
		};
	};

	const initialSettings = loadInitialSettings();
	const params: Rstr2Params = $state(initialSettings.params);
	let layers: LayerConfig[] = $state(initialSettings.layers);

	let inputImage = $state('');
	// filename of the current image source (for export names); '' when none
	let inputName = $state('');
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

	// video input — the source element stays hidden, frames are pulled out of
	// it on demand and fed into the same pipeline an image goes through
	const loadVideoConfig = (): VideoExportConfig => {
		if (typeof localStorage === 'undefined') return defaultVideoConfig();
		return parseStoredVideoConfig(localStorage.getItem(VIDEO_STORAGE_KEY));
	};
	const video: VideoExportConfig = $state(loadVideoConfig());
	let videoSrc = $state('');
	let videoName = $state('');
	let videoEl: HTMLVideoElement | undefined = $state();
	let videoDuration = $state(0);
	/** timeline position, in output frames at the chosen fps */
	let currentFrame = $state(0);

	const videoTotalFrames = $derived(totalFrameCount(videoDuration, video.fps));
	const videoRange = $derived(exportFrameRange(videoDuration, video));

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

	// Holding the input thumb shows the same adjusted-source view for as long
	// as the press lasts.
	let previewHeld = $state(false);
	const showAdjustPreview = $derived(adjustActive || previewHeld);

	const holdPreview = (event: PointerEvent) => {
		if (!previewBase) return;
		// capture so the release fires even when the pointer leaves the thumb
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		previewHeld = true;
	};
	const releasePreview = () => (previewHeld = false);

	const status = $state({ busy: false, segMs: 0, hatchMs: 0, regions: 0, lines: 0 });

	const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

	// Settings (params + layers) persist only once the user actually engages with
	// the config — a manual edit, a preset pick, or an import. The random preset
	// we open on (and any dice roll) stays ephemeral until then, so a plain
	// refresh re-rolls instead of pinning the first random start. markSettingsEdited
	// flips this on; see the config panes' input/change handler and the mutators.
	let persistSettings = $state(false);
	const markSettingsEdited = () => (persistSettings = true);
	const noteSettingsEdit = (event: Event) => {
		const target = event.target as HTMLElement | null;
		// file pickers (image/video/import) and the dice controls aren't config edits
		if (target instanceof HTMLInputElement && target.type === 'file') return;
		if (target?.closest?.('.randomize-row')) return;
		markSettingsEdited();
	};

	// persist settings (JSON.stringify also registers deep dependencies)
	$effect(() => {
		const json = JSON.stringify(params);
		if (persistSettings && typeof localStorage !== 'undefined')
			localStorage.setItem(PARAMS_STORAGE_KEY, json);
	});
	$effect(() => {
		const json = JSON.stringify(layers);
		if (persistSettings && typeof localStorage !== 'undefined')
			localStorage.setItem(LAYER_STORAGE_KEY, json);
	});
	$effect(() => {
		const json = JSON.stringify(video);
		if (typeof localStorage !== 'undefined') localStorage.setItem(VIDEO_STORAGE_KEY, json);
	});

	//***************************************************************
	// 														IMAGE INPUT
	//***************************************************************

	// Start with a random sample so there is something to play with right
	// away — once. Later transitions through an empty input (switching from
	// video back to an image) must not race the user's own pick.
	let sampleOffered = false;
	$effect(() => {
		if (!inputImage && !videoSrc && !sampleOffered) {
			sampleOffered = true;
			const sample = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
			inputImage = sample;
			inputName = sample;
		}
	});

	const openFile = (files: FileList | null | undefined) => {
		const file = files?.[0];
		if (!file) return;
		if (file.type.startsWith('video/')) {
			openVideoFile(file);
			return;
		}
		if (!file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => {
			// only drop a running video once the image is actually ready
			closeVideo();
			inputImage = reader.result as string;
			inputName = file.name;
		};
		reader.readAsDataURL(file);
	};

	const onDrop = (event: DragEvent) => {
		event.preventDefault();
		dragActive = false;
		openFile(event.dataTransfer?.files);
	};

	//***************************************************************
	// 														VIDEO INPUT
	//***************************************************************

	const openVideoFile = (file: File) => {
		closeVideo();
		inputImage = '';
		hatchReady = false;
		videoName = file.name;
		videoSrc = URL.createObjectURL(file);
	};

	const closeVideo = () => {
		if (videoSrc) URL.revokeObjectURL(videoSrc);
		videoSrc = '';
		videoName = '';
		videoDuration = 0;
		currentFrame = 0;
	};

	const onVideoMetadata = () => {
		const el = videoEl;
		if (!el) return;
		// Mobile browsers won't decode frames from a video that never played;
		// a muted inline play/pause kick makes drawImage deliver pixels there.
		el.play()
			.then(() => el.pause())
			.catch(() => {
				/* autoplay denied — desktop browsers decode without it */
			});
		if (!isFinite(el.duration)) {
			// screen/browser recordings (MediaRecorder webm) report Infinity
			// until the decoder is pushed to the end once — force that, then
			// read the real duration
			const fix = () => {
				el.removeEventListener('durationchange', fix);
				if (isFinite(el.duration)) applyVideoDuration(el.duration);
			};
			el.addEventListener('durationchange', fix);
			el.currentTime = Number.MAX_SAFE_INTEGER;
			return;
		}
		applyVideoDuration(el.duration);
	};

	const applyVideoDuration = (duration: number) => {
		videoDuration = duration;
		// land the playhead on the first exported frame
		currentFrame = exportFrameRange(duration, video).start;
	};

	const seekVideo = (el: HTMLVideoElement, t: number): Promise<void> =>
		new Promise((resolve) => {
			if (el.readyState >= 2 && Math.abs(el.currentTime - t) < 1e-3) {
				resolve();
				return;
			}
			const done = () => {
				el.removeEventListener('seeked', done);
				resolve();
			};
			el.addEventListener('seeked', done);
			el.currentTime = t;
		});

	// scrub / fps change / new video -> current frame into the pipeline (the
	// same entry point a loaded image uses: pixels + preview base)
	let grabToken = 0;
	$effect(() => {
		const frame = currentFrame;
		void video.fps;
		const el = videoEl;
		// the export loop owns the video element while it runs; when it ends
		// this effect re-runs and restores the scrubbed frame
		if (!videoSrc || !el || !videoDuration || exporting.running) return;
		grabFrame(el, frame);
	});

	const grabFrame = async (el: HTMLVideoElement, frame: number) => {
		const token = ++grabToken;
		await seekVideo(el, frameTime(frame, video.fps, videoDuration));
		// bail if outrun by a newer grab or the video was swapped for an image
		if (token !== grabToken || !videoSrc || !el.videoWidth) return;
		const canvas = document.createElement('canvas');
		canvas.width = el.videoWidth;
		canvas.height = el.videoHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(el, 0, 0);
		imgWidth = canvas.width;
		imgHeight = canvas.height;
		pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		previewBase = buildPreviewBase(canvas, canvas.width, canvas.height);
	};

	// keep the playhead and the start offset inside the video when the fps
	// (and with it the frame count) changes
	$effect(() => {
		const total = videoTotalFrames;
		if (!total) return;
		if (currentFrame > total - 1) currentFrame = total - 1;
		if (video.startFrame > total - 1) video.startFrame = total - 1;
	});

	// The export window is edited as [start, end] on a dual-range slider;
	// internally it stays start offset + frame cap, so a longer video (or a
	// higher fps) keeps growing the window until the cap bites again.
	const videoEndFrame = $derived(
		Math.min(video.startFrame + video.maxFrames - 1, Math.max(videoTotalFrames - 1, 0))
	);

	const setFrameWindow = (start: number, end: number) => {
		const last = Math.max(videoTotalFrames - 1, 0);
		const s = Math.min(Math.max(Math.floor(start), 0), last);
		const e = Math.min(Math.max(Math.floor(end), s), last);
		video.startFrame = s;
		video.maxFrames = Math.min(e - s + 1, MAX_SEQUENCE_FRAMES);
	};

	// dual-range slider for the export window, same setup as the spacing one
	let frameMinEl: HTMLInputElement | undefined = $state();
	let frameMaxEl: HTMLInputElement | undefined = $state();
	// $state so the sync effect below re-runs the moment the instance is created
	let frameDri: DualRangeInput | undefined = $state();

	$effect(() => {
		if (!frameMinEl || !frameMaxEl) return;
		const dri = new DualRangeInput(frameMinEl, frameMaxEl);
		frameDri = dri;
		return () => {
			dri.destroy();
			frameDri = undefined;
		};
	});

	// keep the track fill in sync when the window changes from the number
	// inputs or the frame count changes with the fps. reading `frameDri` (a
	// $state) as a dependency means the very first correct `max` — which only
	// arrives once the video metadata loads, after the slider is built — still
	// triggers an update() instead of leaving the thumbs mispositioned.
	$effect(() => {
		const dri = frameDri;
		// Sum of every bound that should re-sync the fill. This has to be a real
		// (used) read: a bare `void x` does not register as a dependency in this
		// Svelte version, which is why the slider stayed broken until the first
		// interaction — the correct `max` only arrives once the video metadata
		// loads, after the slider has already been built.
		const bound = video.startFrame + video.maxFrames + videoTotalFrames;
		if (dri && Number.isFinite(bound)) dri.update();
	});

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
			// a newer source (another image, or a video frame) won the race
			if (inputImage !== src) return;
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.drawImage(img, 0, 0);
			imgWidth = img.width;
			imgHeight = img.height;
			pixels = ctx.getImageData(0, 0, img.width, img.height).data;
			previewBase = buildPreviewBase(img, img.width, img.height);
		};
		img.src = src;
	});

	const buildPreviewBase = (
		source: HTMLImageElement | HTMLCanvasElement,
		width: number,
		height: number
	): PreviewBase | null => {
		const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(width, height));
		const w = Math.max(1, Math.round(width * scale));
		const h = Math.max(1, Math.round(height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(source, 0, 0, w, h);
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
	// or the input thumb is held down
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
		if (!showAdjustPreview || !base || !canvas) return;
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

	// Per-layer dependency reads for the segmentation and hatch effects. These
	// MUST be called directly inside the effect body: routing the reads
	// through a $derived key string doesn't re-trigger the effects on deep
	// per-layer mutations in the pinned Svelte 5 prerelease. The field lists
	// stay deliberately narrow — segmentation only cares about channel/enabled
	// (mapping tweaks must not retrigger the watershed), hatching about
	// everything that shapes or colors the lines.
	const trackSegLayerDeps = () => {
		for (const layer of layers) {
			void layer.channel;
			void layer.enabled;
		}
	};
	const trackHatchLayerDeps = () => {
		for (const layer of layers) {
			void layer.enabled;
			void layer.angleMin;
			void layer.angleMax;
			void layer.penWidthMm;
			void layer.spacingMinMm;
			void layer.spacingMaxMm;
			void layer.threshold;
			void layer.inkGamma;
			void layer.inkBoost;
			void layer.color;
		}
	};

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
		trackSegLayerDeps();
		void params.algorithm;
		void params.tolerance;
		void params.smoothing;
		void params.minRegionSize;
		void params.slicCellSize;
		void params.slicCompactness;
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
				minRegionSize: params.minRegionSize,
				slicCellSize: params.slicCellSize,
				slicCompactness: params.slicCompactness
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
		trackHatchLayerDeps();
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
	const angleForRegion = (
		layer: LayerConfig,
		region: Pick<RenderRegion, 'boundsW' | 'boundsH'>
	): number => {
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
	// 														PLOT TIME
	//***************************************************************

	// The plotter profile is about the user's machine, not the artwork — it
	// lives in its own storage key and is deliberately not part of presets.
	const loadPlotterConfig = (): PlotterConfig => {
		if (typeof localStorage === 'undefined') return defaultPlotterConfig();
		return parseStoredPlotterConfig(localStorage.getItem(PLOTTER_STORAGE_KEY));
	};

	const plotter: PlotterConfig = $state(loadPlotterConfig());

	$effect(() => {
		const json = JSON.stringify(plotter);
		if (typeof localStorage !== 'undefined') localStorage.setItem(PLOTTER_STORAGE_KEY, json);
	});

	const resetPlotter = () => Object.assign(plotter, defaultPlotterConfig());

	interface PlotEstimate {
		seconds: number;
		perLayer: { name: string; seconds: number }[];
	}

	let plotEstimate: PlotEstimate | null = $state(null);

	// re-estimate whenever a hatch pass lands or the plotter profile changes
	$effect(() => {
		void status.hatchMs;
		void status.lines;
		const config: PlotterConfig = JSON.parse(JSON.stringify(plotter));
		if (!hatchReady || !imgWidth) {
			plotEstimate = null;
			return;
		}
		const pxPerMm = imgWidth / params.outputWidthMm;
		const perLayer = layers
			.filter((layer) => layer.enabled)
			.map((layer) => {
				const result = layerResults.find((res) => res.layerId === layer.id);
				const segmentLists = result?.regions.map((region) => region.hatchSegments ?? []) ?? [];
				return {
					name: layer.name,
					seconds: estimateLayerPlotTime(segmentLists, pxPerMm, config).seconds
				};
			});
		plotEstimate = {
			seconds: perLayer.reduce((sum, layer) => sum + layer.seconds, 0),
			perLayer
		};
	});

	const plotTimeTip = $derived.by(() => {
		let tip =
			'estimated plotting time on an AxiDraw-style machine (saxi motion model): pen-down drawing, pen-up travel and pen lifts';
		if (plotEstimate && plotEstimate.perLayer.length > 1) {
			const breakdown = plotEstimate.perLayer
				.map((layer) => `${layer.name} ${formatPlotTime(layer.seconds)}`)
				.join(' · ');
			tip += ` — per pen: ${breakdown} (pen changes not included)`;
		}
		return tip + ' — tune the profile under plotter settings';
	});

	//***************************************************************
	// 														LAYERS
	//***************************************************************

	const addLayer = () => {
		layers.push(createLayer());
		markSettingsEdited();
	};

	const removeLayer = (id: string) => {
		layers = layers.filter((layer) => layer.id !== id);
		markSettingsEdited();
	};

	const moveLayer = (id: string, delta: number) => {
		const index = layers.findIndex((layer) => layer.id === id);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= layers.length) return;
		const [layer] = layers.splice(index, 1);
		layers.splice(target, 0, layer);
		markSettingsEdited();
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
	// reflects the random built-in chosen on a fresh session (empty otherwise)
	let selectedPreset = $state(initialPresetName);
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

	// the dice — gaussian rolls, curves live in $lib/rstr2/randomize.ts
	let stickToPresets = $state(false);

	const randomize = () => {
		applySettings(randomizeSettings(currentSettings(), stickToPresets));
		selectedPreset = '';
	};

	const applySelectedPreset = () => {
		const preset =
			BUILTIN_PRESETS.find((entry) => entry.name === selectedPreset) ??
			userPresets.find((entry) => entry.name === selectedPreset);
		if (preset) {
			applySettings(preset.settings);
			markSettingsEdited();
		}
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
		markSettingsEdited();
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
		// name the file after the preset if one is typed or selected, otherwise
		// fall back to the plain rstr-settings-<stamp>.json shape
		const preset = presetName.trim() || selectedPreset;
		downloadBlob(
			new Blob([json], { type: 'application/json' }),
			buildExportName(preset, 'settings', 'json', stamp())
		);
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
			markSettingsEdited();
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

	// Fold the current source's name into export file names — video takes
	// priority while one is loaded, otherwise the image.
	const exportName = (suffix: string, ext: string): string =>
		buildExportName(videoName || inputName, suffix, ext, stamp());

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
		downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), exportName('', 'svg'));
	};

	const downloadPng = () => {
		hatchCanvas?.toBlob((blob) => {
			if (blob) downloadBlob(blob, exportName('', 'png'));
		});
	};

	//***************************************************************
	// 												SEQUENCE EXPORT
	//***************************************************************

	const exporting = $state({ running: false, done: 0, total: 0, bytes: 0, cancel: false });

	const rasterExt = $derived(video.rasterFormat === 'jpeg' ? 'jpg' : video.rasterFormat);

	/**
	 * Run one frame through the full pipeline off-screen: grid -> adjust ->
	 * per-layer segmentation -> hatching. Same math as the interactive
	 * effects, but synchronous and without touching any reactive state.
	 */
	const computeExportLayers = (px: Uint8ClampedArray, w: number, h: number): ExportLayer[] => {
		const adjustments = {
			brightness: params.brightness,
			contrast: params.contrast,
			gamma: params.imageGamma,
			saturation: params.saturation,
			vibrance: params.vibrance
		};
		const grid = computeCellGrid(px, w, h, params.resolution);
		const adjusted = isNeutralAdjustment(adjustments)
			? grid
			: { ...grid, ...adjustColors(grid.r, grid.g, grid.b, adjustments) };
		const pxPerMm = w / params.outputWidthMm;
		return layers
			.filter((layer) => layer.enabled)
			.map((layer) => {
				const values = extractChannel(adjusted.r, adjusted.g, adjusted.b, layer.channel);
				const seg = segmentGrid(values, adjusted.cols, adjusted.rows, {
					algorithm: params.algorithm,
					tolerance: params.tolerance,
					smoothing: params.smoothing,
					minRegionSize: params.minRegionSize,
					slicCellSize: params.slicCellSize,
					slicCompactness: params.slicCompactness
				});
				const geometries = buildRegionGeometries(
					seg.labels,
					seg.regionCount,
					adjusted.cols,
					adjusted.rows,
					adjusted.cellW,
					adjusted.cellH
				);
				const hatch = effectiveHatch(layer);
				const penWidthPx = hatch.penWidthMm * pxPerMm;
				const minSpacingPx = Math.max(hatch.spacingMinMm * pxPerMm, 0.1);
				const maxSpacingPx = Math.max(hatch.spacingMaxMm * pxPerMm, minSpacingPx);
				const spacingOptions = {
					curve: 'coverage' as const,
					gamma: hatch.gamma,
					inkBoost: hatch.inkBoost
				};
				const segments = geometries.map((geometry) => {
					const ink = seg.regionMean[geometry.id];
					if (ink < hatch.threshold) return [];
					const spacing = spacingForInk(
						ink,
						penWidthPx,
						minSpacingPx,
						maxSpacingPx,
						spacingOptions
					);
					const angle = angleForRegion(layer, {
						boundsW: geometry.maxX - geometry.minX,
						boundsH: geometry.maxY - geometry.minY
					});
					return hatchPolygon(geometry.loops, angle, spacing, penWidthPx);
				});
				return { layer, penWidthPx, segments };
			});
	};

	/** render export layers to a raster blob, mirroring the preview style */
	const renderRasterBlob = (
		exportLayers: ExportLayer[],
		w: number,
		h: number
	): Promise<Blob | null> => {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(w * video.rasterScale));
		canvas.height = Math.max(1, Math.round(h * video.rasterScale));
		const ctx = canvas.getContext('2d');
		if (!ctx) return Promise.resolve(null);
		ctx.scale(canvas.width / w, canvas.height / h);
		ctx.fillStyle = '#FFFEF7'; // warm paper white
		ctx.fillRect(0, 0, w, h);
		ctx.lineCap = 'round';
		ctx.globalCompositeOperation = 'multiply';
		ctx.globalAlpha = 0.85;
		for (const { layer, penWidthPx, segments } of exportLayers) {
			ctx.strokeStyle = layer.color;
			ctx.lineWidth = penWidthPx;
			ctx.beginPath();
			for (const segmentList of segments) {
				for (let k = 0; k < segmentList.length; k += 4) {
					ctx.moveTo(segmentList[k], segmentList[k + 1]);
					ctx.lineTo(segmentList[k + 2], segmentList[k + 3]);
				}
			}
			ctx.stroke();
		}
		const mime =
			video.rasterFormat === 'png'
				? 'image/png'
				: video.rasterFormat === 'jpeg'
					? 'image/jpeg'
					: 'image/webp';
		return new Promise((resolve) => canvas.toBlob(resolve, mime, video.rasterQuality));
	};

	const exportSequence = async () => {
		const el = videoEl;
		if (!el || !videoDuration || exporting.running) return;
		if (!video.exportSvg && !video.exportRaster) return;
		const range = exportFrameRange(videoDuration, video);
		if (range.count === 0) return;
		exporting.running = true;
		exporting.cancel = false;
		exporting.done = 0;
		exporting.total = range.count;
		exporting.bytes = 0;

		const encoder = new TextEncoder();
		const entries: ZipEntry[] = [];
		// both formats in one archive get sorted into subfolders
		const both = video.exportSvg && video.exportRaster;
		const grabCanvas = document.createElement('canvas');
		grabCanvas.width = el.videoWidth;
		grabCanvas.height = el.videoHeight;
		const grabCtx = grabCanvas.getContext('2d', { willReadFrequently: true });
		try {
			if (!grabCtx) return;
			for (let i = 0; i < range.count; i++) {
				if (exporting.cancel) return;
				const frame = range.start + i;
				await seekVideo(el, frameTime(frame, video.fps, videoDuration));
				grabCtx.drawImage(el, 0, 0);
				const px = grabCtx.getImageData(0, 0, grabCanvas.width, grabCanvas.height).data;
				const exportLayers = computeExportLayers(px, grabCanvas.width, grabCanvas.height);
				const name = `frame-${String(frame).padStart(5, '0')}`;
				if (video.exportSvg) {
					const svg = buildSvgDocument(
						exportLayers,
						grabCanvas.width,
						grabCanvas.height,
						params.outputWidthMm
					);
					const data = encoder.encode(svg);
					entries.push({ name: `${both ? 'svg/' : ''}${name}.svg`, data });
					exporting.bytes += data.length;
				}
				if (video.exportRaster) {
					const blob = await renderRasterBlob(exportLayers, grabCanvas.width, grabCanvas.height);
					if (blob) {
						const data = new Uint8Array(await blob.arrayBuffer());
						entries.push({ name: `${both ? `${rasterExt}/` : ''}${name}.${rasterExt}`, data });
						exporting.bytes += data.length;
					}
				}
				exporting.done = i + 1;
				// let the progress bar paint between frames
				await nextFrame();
			}
			if (entries.length > 0) {
				const zip = buildZip(entries);
				downloadBlob(new Blob([zip], { type: 'application/zip' }), exportName('seq', 'zip'));
			}
		} finally {
			exporting.running = false;
		}
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
		/** only shown while one of these algorithms is selected (absent = always) */
		algorithms?: SegmentationAlgorithm[];
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
			id: 'slicCellSize',
			label: 'superpixel size',
			min: 2,
			max: 64,
			step: 1,
			algorithms: ['slic'],
			tip: 'superpixel spacing in grid cells — smaller = more, finer superpixels'
		},
		{
			id: 'slicCompactness',
			label: 'compactness',
			min: 0,
			max: 1,
			step: 0.02,
			algorithms: ['slic'],
			tip: 'shape regularity — high keeps superpixels grid-like, low lets them follow image detail'
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

	// sliders scoped to an algorithm (SLIC's size/compactness) only show while
	// that algorithm is selected
	const segmentationSliders = $derived(
		SEGMENTATION_SLIDERS.filter(
			(slider) => !slider.algorithms || slider.algorithms.includes(params.algorithm)
		)
	);

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

	interface PlotterFieldDef {
		id: keyof PlotterConfig;
		label: string;
		min: number;
		step: number;
		tip: string;
	}

	const PLOTTER_FIELDS: PlotterFieldDef[] = [
		{
			id: 'penDownMaxVelocity',
			label: 'pen-down speed',
			min: 1,
			step: 1,
			tip: 'max drawing speed (mm/s) — saxi default 50'
		},
		{
			id: 'penDownAcceleration',
			label: 'pen-down accel',
			min: 1,
			step: 10,
			tip: 'drawing acceleration (mm/s²) — saxi default 200'
		},
		{
			id: 'penDownCorneringFactor',
			label: 'cornering factor',
			min: 0,
			step: 0.001,
			tip: 'how fast corners are taken — saxi default 0.127'
		},
		{
			id: 'penUpMaxVelocity',
			label: 'pen-up speed',
			min: 1,
			step: 1,
			tip: 'max travel speed between lines (mm/s) — saxi default 200'
		},
		{
			id: 'penUpAcceleration',
			label: 'pen-up accel',
			min: 1,
			step: 10,
			tip: 'travel acceleration (mm/s²) — saxi default 400'
		},
		{
			id: 'penDropDuration',
			label: 'pen drop (s)',
			min: 0,
			step: 0.01,
			tip: 'pause to put the pen on the paper — saxi default 0.12'
		},
		{
			id: 'penLiftDuration',
			label: 'pen lift (s)',
			min: 0,
			step: 0.01,
			tip: 'pause to lift the pen off the paper — saxi default 0.12'
		},
		{
			id: 'pathJoinRadiusMm',
			label: 'join radius (mm)',
			min: 0,
			step: 0.1,
			tip: "lines closer than this are drawn without lifting the pen — saxi's join nearby paths, default 0.5"
		}
	];

	// Dual-range slider for the spacing bounds
	let spacingMinEl: HTMLInputElement | undefined = $state();
	let spacingMaxEl: HTMLInputElement | undefined = $state();
	// $state so the sync effect below re-runs the moment the instance is created
	let spacingDri: DualRangeInput | undefined = $state();

	$effect(() => {
		if (!spacingMinEl || !spacingMaxEl) return;
		const dri = new DualRangeInput(spacingMinEl, spacingMaxEl);
		spacingDri = dri;
		return () => {
			dri.destroy();
			spacingDri = undefined;
		};
	});

	// keep the track fill in sync when the values change from the number inputs
	$effect(() => {
		const dri = spacingDri;
		// real (used) read of both bounds — see the frame slider effect above for
		// why a bare `void x` is not enough to subscribe the effect here
		const bound = params.spacingMinMm + params.spacingMaxMm;
		if (dri && Number.isFinite(bound)) dri.update();
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
		<a class="top-link" href="/prep" title="plot prep — decorate an exported SVG for plotting"
			>prep</a
		>
		<a class="top-link" href="/about" title="about RSTR">?</a>
	</header>

	<div class="workspace">
		<!-------------------------------------------------------------
			LEFT PANE — image + adjust, segmentation, lines
		-------------------------------------------------------------->
		<aside class="pane left" oninput={noteSettingsEdit} onchange={noteSettingsEdit}>
			<section class="panel-group">
				<div class="group-title">image</div>
				<div class="image-picker">
					<button
						class="thumb current"
						onclick={() => {
							if (!previewBase) fileInput?.click();
						}}
						onpointerdown={holdPreview}
						onpointerup={releasePreview}
						onpointercancel={releasePreview}
						oncontextmenu={(event) => event.preventDefault()}
						title="hold to see the input with the image adjustments applied"
					>
						{#if inputImage}
							<img src={inputImage} alt="current input" />
						{:else if videoSrc}
							<span class="thumb-video" title={videoName}>🎞</span>
						{:else}
							+
						{/if}
					</button>
					<button
						class="browse-btn"
						onclick={() => fileInput?.click()}
						title="pick an image or video from your device — it never leaves the browser"
					>
						browse image / video<span class="browse-sub">or drop one on the render</span>
					</button>
					<button
						class="dice-btn"
						onclick={randomize}
						title="roll the dice — randomize all segmentation, lines and layer settings"
					>
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<rect
								x="0.5"
								y="0.5"
								width="15"
								height="15"
								rx="2"
								fill="#fff"
								stroke="currentColor"
								stroke-width="1"
								vector-effect="non-scaling-stroke"
							/>
							<circle cx="4.9" cy="4.9" r="1.15" fill="currentColor" />
							<circle cx="11.1" cy="4.9" r="1.15" fill="currentColor" />
							<circle cx="8" cy="8" r="1.15" fill="currentColor" />
							<circle cx="4.9" cy="11.1" r="1.15" fill="currentColor" />
							<circle cx="11.1" cy="11.1" r="1.15" fill="currentColor" />
						</svg>
					</button>
				</div>
				{#if videoSrc}
					<div class="video-name" title={videoName}>{videoName}</div>
				{/if}
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

			{#if videoSrc}
				<section class="panel-group">
					<div class="group-title">video</div>
					<label
						class="slider-row"
						title="output frame rate the video is sampled at — fewer frames per second means fewer, smaller files"
					>
						<span>output fps</span>
						<input type="range" min="1" max="30" step="1" bind:value={video.fps} />
						<input type="number" min="1" max="60" step="1" bind:value={video.fps} />
					</label>
					<div
						class="spacing-control"
						title="exported frame window — start frame offset and last frame; the timeline shades this range"
					>
						<div class="spacing-head">
							<span>frames</span>
							<input
								type="number"
								min="0"
								max={videoEndFrame}
								step="1"
								value={video.startFrame}
								oninput={(event) =>
									setFrameWindow(Number(event.currentTarget.value), videoEndFrame)}
								title="first exported frame — skips everything before it"
							/>
							<span class="spacing-dash">–</span>
							<input
								type="number"
								min={video.startFrame}
								max={Math.max(videoTotalFrames - 1, 0)}
								step="1"
								value={videoEndFrame}
								oninput={(event) =>
									setFrameWindow(video.startFrame, Number(event.currentTarget.value))}
								title="last exported frame"
							/>
						</div>
						<div class="dual-range-input">
							<input
								bind:this={frameMinEl}
								type="range"
								min="0"
								max={Math.max(videoTotalFrames - 1, 0)}
								step="1"
								value={video.startFrame}
								oninput={(event) =>
									setFrameWindow(Number(event.currentTarget.value), videoEndFrame)}
							/>
							<input
								bind:this={frameMaxEl}
								type="range"
								min="0"
								max={Math.max(videoTotalFrames - 1, 0)}
								step="1"
								value={videoEndFrame}
								oninput={(event) =>
									setFrameWindow(video.startFrame, Number(event.currentTarget.value))}
							/>
						</div>
					</div>
					<div
						class="video-summary"
						title="what the current fps, start frame and limit select out of the video"
					>
						→ {videoRange.count} frame{videoRange.count === 1 ? '' : 's'} · {(
							videoRange.count / video.fps
						).toFixed(1)}s of {videoDuration.toFixed(1)}s
					</div>
				</section>
			{/if}

			<section class="panel-group">
				<div class="group-title">segmentation</div>
				<label
					class="select-row"
					title="segmentation strategy — watershed follows tonal basins, posterize bands intensities, k-means clusters them, SLIC carves compact superpixels"
				>
					<span>algorithm</span>
					<select bind:value={params.algorithm}>
						<option value="watershed">Watershed</option>
						<option value="posterize">Posterize</option>
						<option value="kmeans">K-means</option>
						<option value="slic">SLIC superpixels</option>
					</select>
				</label>
				{#each segmentationSliders as slider (slider.id)}
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
			style={`--stage-aspect: ${imgWidth && imgHeight ? imgHeight / imgWidth : 0.75}`}
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
				class:hidden={!hatchReady || showAdjustPreview}
				width={imgWidth}
				height={imgHeight}
			></canvas>
			<canvas
				bind:this={adjustCanvas}
				class="render"
				class:hidden={!showAdjustPreview || !previewBase}
				width={previewBase?.w ?? 0}
				height={previewBase?.h ?? 0}
			></canvas>
			{#if !showAdjustPreview && !hatchReady}
				{#if inputImage}
					<img class="render placeholder" src={inputImage} alt="input" />
				{:else if !videoSrc}
					<div class="dropzone-hint">
						<p class="hint-title">drop an image or video here</p>
						<p class="hint-sub">everything stays in your browser</p>
					</div>
				{/if}
			{/if}
			{#if videoSrc && videoTotalFrames > 0}
				<div class="timeline">
					<div class="timeline-buttons">
						<button
							class="icon-btn"
							onclick={() => (currentFrame = Math.max(currentFrame - 1, 0))}
							disabled={exporting.running || currentFrame <= 0}
							title="previous frame">◂</button
						>
						<button
							class="icon-btn"
							onclick={() => (currentFrame = Math.min(currentFrame + 1, videoTotalFrames - 1))}
							disabled={exporting.running || currentFrame >= videoTotalFrames - 1}
							title="next frame">▸</button
						>
					</div>
					<div
						class="timeline-track"
						title="scrub through the video — the shaded band is the exported range"
					>
						<div
							class="timeline-window"
							style={`left: ${(videoRange.start / videoTotalFrames) * 100}%; width: ${(videoRange.count / videoTotalFrames) * 100}%`}
						></div>
						<input
							class="timeline-scrub"
							type="range"
							min="0"
							max={videoTotalFrames - 1}
							step="1"
							bind:value={currentFrame}
							disabled={exporting.running}
						/>
					</div>
					<div class="timeline-readout" title="frame index and time of the playhead">
						{currentFrame} / {videoTotalFrames - 1} · {frameTime(
							currentFrame,
							video.fps,
							videoDuration
						).toFixed(2)}s
					</div>
				</div>
			{/if}
		</main>

		<!-------------------------------------------------------------
			RIGHT PANE — layers + export
		-------------------------------------------------------------->
		<aside class="pane right" oninput={noteSettingsEdit} onchange={noteSettingsEdit}>
			<section class="panel-group">
				<div class="group-title">presets</div>
				<div class="randomize-row">
					<button
						class="randomize-btn"
						onclick={randomize}
						title="roll the dice — randomize all segmentation, lines and layer settings"
					>
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<rect
								x="1.5"
								y="1.5"
								width="13"
								height="13"
								rx="2.5"
								fill="none"
								stroke="currentColor"
								stroke-width="1.4"
							/>
							<circle cx="5.2" cy="5.2" r="1.15" fill="currentColor" />
							<circle cx="10.8" cy="5.2" r="1.15" fill="currentColor" />
							<circle cx="8" cy="8" r="1.15" fill="currentColor" />
							<circle cx="5.2" cy="10.8" r="1.15" fill="currentColor" />
							<circle cx="10.8" cy="10.8" r="1.15" fill="currentColor" />
						</svg>
						randomize
					</button>
					<label
						class="randomize-stick"
						title="limit the roll to built-in presets — the ink + pen width combinations that physically exist, so the result can actually be plotted; spacings and angles still randomize"
					>
						<input type="checkbox" bind:checked={stickToPresets} />
						stick to built-in presets
					</label>
				</div>
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
						title="save the current settings and layers as a preset in this browser">+ save</button
					>
				</div>
				<div class="settings-io">
					<button
						onclick={exportSettings}
						title="download all current settings and layers as a JSON file">↓ export .json</button
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
				{#if videoSrc}
					<div class="seq-block">
						<div
							class="seq-title"
							title="render every frame in the selected range and download them as one zip"
						>
							frame sequence
						</div>
						<div class="seq-formats">
							<label title="one plottable SVG per frame — filesize follows the line count">
								<input type="checkbox" bind:checked={video.exportSvg} /> svg
							</label>
							<label title="one rendered image per frame">
								<input type="checkbox" bind:checked={video.exportRaster} /> image
							</label>
							<select
								bind:value={video.rasterFormat}
								disabled={!video.exportRaster}
								title="image format — jpeg/webp trade quality for much smaller files, png is lossless"
							>
								<option value="png">png</option>
								<option value="jpeg">jpeg</option>
								<option value="webp">webp</option>
							</select>
						</div>
						{#if video.exportRaster}
							<label
								class="slider-row"
								title="jpeg/webp encoder quality — lower means smaller files; png ignores it"
							>
								<span>quality</span>
								<input
									type="range"
									min="0.05"
									max="1"
									step="0.05"
									bind:value={video.rasterQuality}
									disabled={video.rasterFormat === 'png'}
								/>
								<input
									type="number"
									min="0.05"
									max="1"
									step="0.05"
									bind:value={video.rasterQuality}
									disabled={video.rasterFormat === 'png'}
								/>
							</label>
							<label
								class="slider-row"
								title="image size relative to the video resolution — the main filesize lever"
							>
								<span>scale</span>
								<input type="range" min="0.1" max="1" step="0.05" bind:value={video.rasterScale} />
								<input type="number" min="0.1" max="1" step="0.05" bind:value={video.rasterScale} />
							</label>
						{/if}
						{#if exporting.running}
							<div class="seq-progress">
								<div class="seq-progress-bar">
									<div
										class="seq-progress-fill"
										style={`width: ${(exporting.done / Math.max(exporting.total, 1)) * 100}%`}
									></div>
								</div>
								<span class="seq-progress-text"
									>{exporting.done}/{exporting.total} · {(exporting.bytes / (1024 * 1024)).toFixed(
										1
									)}MB</span
								>
								<button
									class="icon-btn remove"
									onclick={() => (exporting.cancel = true)}
									title="stop the export — nothing is downloaded">✕</button
								>
							</div>
						{:else}
							<button
								class="primary-btn"
								onclick={exportSequence}
								disabled={!hatchReady ||
									status.busy ||
									videoRange.count === 0 ||
									(!video.exportSvg && !video.exportRaster)}
								title="render every frame in the selected range with the current settings and download the sequence as one zip"
							>
								↓ export {videoRange.count} frame{videoRange.count === 1 ? '' : 's'} (.zip)
							</button>
						{/if}
					</div>
				{/if}
				<div class="stats">
					{#if status.busy}
						<div class="stat-row wide"><span class="busy-dot"></span> computing…</div>
					{:else if cellGrid}
						<div
							class="stat-row"
							title="sampling grid the image is reduced to (cells across × down)"
						>
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<rect x="1.5" y="1.5" width="13" height="13" rx="1" />
								<path d="M5.8 1.5v13M10.2 1.5v13M1.5 5.8h13M1.5 10.2h13" />
							</svg>
							<span class="stat-label">grid</span>
							<span class="stat-value">{cellGrid.cols}×{cellGrid.rows}</span>
						</div>
						<div
							class="stat-row"
							title="tonal regions found by segmentation, across all enabled layers"
						>
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<circle cx="6" cy="6.2" r="4.2" />
								<circle cx="10.8" cy="10.6" r="3.2" />
							</svg>
							<span class="stat-label">regions</span>
							<span class="stat-value">{status.regions}</span>
						</div>
						<div class="stat-row" title="hatch lines drawn, across all enabled layers">
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<path d="M2 7 7 2M2 12 12 2M4.5 14.5 14.5 4.5M9.5 14.5 14.5 9.5" />
							</svg>
							<span class="stat-label">lines</span>
							<span class="stat-value">{status.lines}</span>
						</div>
						<div
							class="stat-row"
							title="time your browser needed to compute this render (segmentation + hatching) — not plotting time"
						>
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<path d="M9 1.5 3.5 9h4L6.8 14.5 12.5 7h-4z" />
							</svg>
							<span class="stat-label">render</span>
							<span class="stat-value">{(status.segMs + status.hatchMs).toFixed(0)}ms</span>
						</div>
						<div class="stat-row wide" title={plotTimeTip}>
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<circle cx="8" cy="8" r="6.3" />
								<path d="M8 4.4V8l2.6 1.6" />
							</svg>
							<span class="stat-label">plot time</span>
							<span class="stat-value">
								{#if plotEstimate}~{formatPlotTime(plotEstimate.seconds)}{:else}—{/if}
							</span>
						</div>
					{:else}
						<div class="stat-row wide">waiting for an image</div>
					{/if}
				</div>
				<details class="plotter-settings">
					<summary title="motion profile behind the plot time estimate — for power users">
						plotter settings
					</summary>
					<p class="plotter-hint">
						motion profile for the plot time estimate, mirroring saxi's plan options — match it to
						your machine setup
					</p>
					{#each PLOTTER_FIELDS as field (field.id)}
						<label class="plotter-row" title={field.tip}>
							<span>{field.label}</span>
							<input
								type="number"
								min={field.min}
								step={field.step}
								bind:value={plotter[field.id]}
							/>
						</label>
					{/each}
					<button
						class="plotter-reset"
						onclick={resetPlotter}
						title="restore saxi's default AxiDraw profile"
					>
						↺ saxi defaults
					</button>
				</details>
			</section>

			<div class="spacer"></div>
			<BrandFooter />
		</aside>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*,video/*"
		style="display: none;"
		onchange={(event) => openFile(event.currentTarget.files)}
	/>

	{#if videoSrc}
		<!-- hidden decoder — frames are seeked out of it into the pipeline -->
		<video
			bind:this={videoEl}
			class="hidden-video"
			src={videoSrc}
			preload="auto"
			muted
			playsinline
			onloadedmetadata={onVideoMetadata}
		>
			<track kind="captions" />
		</video>
	{/if}

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
		/* size container for the mobile stage height (cqw sees the true
		   content width, unlike 100vw which includes scrollbars) */
		container-type: inline-size;
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
		/* held down to preview — no scroll grab, text select or long-press
		   image callout while the finger stays on it */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 0;
		pointer-events: none;
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

	/* secondary dice — same roll as the presets pane; mobile-only (enabled in
	   the responsive block below), on desktop the presets pane is in view.
	   The dice glyph IS the button: no box of its own, the svg fills the
	   thumb-sized square. */
	.dice-btn {
		width: 64px;
		flex-shrink: 0;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--ink);
		display: none;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	/* the app-wide hover rule paints the button box — keep the dice's box
	   invisible, the svg face is the visual */
	.app .dice-btn:hover:not(:disabled) {
		background: none !important;
	}

	.dice-btn svg {
		width: 100%;
		height: 100%;
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

	/* neutral theme for @stanko/dual-range-input — tuned to match the native
	   accent-color range inputs used everywhere else (chunky rounded track, a
	   light-gray gutter and a ~15px ink thumb) so the two read as one control */
	.app :global(.dual-range-input) {
		--dri-height: 1.3rem;
		--dri-thumb-width: 0.94rem;
		--dri-thumb-height: 0.94rem;
		--dri-thumb-color: var(--ink);
		--dri-thumb-hover-color: var(--ink-soft);
		--dri-thumb-active-color: var(--ink-soft);
		--dri-thumb-border-color: transparent;
		--dri-thumb-border-radius: 999px;
		--dri-track-height: 0.5rem;
		--dri-track-color: #efefef;
		--dri-track-filled-color: var(--ink);
	}

	/* 1px gutter outline. box-sizing is border-box in the library CSS, so this
	   keeps the track at its --dri-track-height. The track is two abutting halves
	   (one input each); bordering top/bottom throughout but the sides only on the
	   outer caps avoids a seam where the halves meet in the middle. */
	.app :global(.dual-range-input input::-webkit-slider-runnable-track) {
		border-top: 1px solid #b2b2b2;
		border-bottom: 1px solid #b2b2b2;
	}
	.app :global(.dual-range-input input::-moz-range-track) {
		border-top: 1px solid #b2b2b2;
		border-bottom: 1px solid #b2b2b2;
	}
	.app :global(.dual-range-input input:first-child::-webkit-slider-runnable-track) {
		border-left: 1px solid #b2b2b2;
	}
	.app :global(.dual-range-input input:first-child::-moz-range-track) {
		border-left: 1px solid #b2b2b2;
	}
	.app :global(.dual-range-input input:last-child::-webkit-slider-runnable-track) {
		border-right: 1px solid #b2b2b2;
	}
	.app :global(.dual-range-input input:last-child::-moz-range-track) {
		border-right: 1px solid #b2b2b2;
	}

	/* ------------------------------------------------- randomize */

	.randomize-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.randomize-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: #fff;
		color: var(--ink);
		cursor: pointer;
		flex-shrink: 0;
	}

	.randomize-btn svg {
		width: 15px;
		height: 15px;
	}

	.randomize-stick {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.66rem;
		color: var(--muted);
		cursor: pointer;
		line-height: 1.25;
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
		padding: 0.1rem 0.5rem;
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
		padding: 0.2rem;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: var(--ink);
	}

	/* preset actions are secondary — keep them compact (the .app button rule
	   sets its size with !important, so this needs to as well) */
	.pane .preset-save,
	.pane .settings-io button {
		font-size: 0.66rem !important;
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

	/* details readout below the export buttons */
	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem 0.6rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		color: var(--muted);
		font-size: 0.65rem;
	}

	.stat-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
	}

	.stat-row.wide {
		grid-column: 1 / -1;
	}

	.stat-row svg {
		width: 0.8rem;
		height: 0.8rem;
		flex-shrink: 0;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.stat-label {
		white-space: nowrap;
	}

	.stat-value {
		margin-left: auto;
		color: var(--ink);
		font-family: 'nudica_monobold', monospace;
		white-space: nowrap;
	}

	/* the plot estimate is the headline number for plotter users */
	.stat-row.wide:not(:first-child) {
		border-top: 1px dashed var(--border);
		padding-top: 0.35rem;
	}

	/* ------------------------------------------------- plotter settings */

	/* deliberately unassuming — a power-user corner, collapsed by default */
	details.plotter-settings summary {
		cursor: pointer;
		font-size: 0.66rem;
		color: var(--muted);
		user-select: none;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	details.plotter-settings summary::before {
		content: '▸';
		font-size: 0.6rem;
	}

	details.plotter-settings[open] summary::before {
		content: '▾';
	}

	details.plotter-settings summary::-webkit-details-marker {
		display: none;
	}

	details.plotter-settings summary::marker {
		content: '';
	}

	.plotter-hint {
		font-family: 'argesta_regular', serif;
		font-size: 0.62rem;
		color: var(--muted);
		margin: 0.3rem 0;
	}

	.plotter-row {
		display: grid;
		grid-template-columns: 1fr 4rem;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
		font-size: 0.66rem;
		margin-top: 0.25rem;
	}

	.plotter-row input[type='number'] {
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

	.plotter-reset {
		margin-top: 0.35rem;
		width: 100%;
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		padding: 0.2rem;
		color: var(--muted);
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

	/* ------------------------------------------------- video */

	/* parked offscreen rather than display:none — mobile browsers refuse to
	   decode frames from an unrendered video element */
	.hidden-video {
		position: fixed;
		right: 0;
		bottom: 0;
		width: 2px;
		height: 2px;
		opacity: 0.01;
		pointer-events: none;
	}

	.thumb-video {
		font-size: 1.5rem;
	}

	.video-name {
		font-family: 'argesta_regular', serif;
		font-size: 0.66rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.video-summary {
		font-family: 'argesta_regular', serif;
		font-size: 0.68rem;
		color: var(--muted);
	}

	/* floating scrubber over the bottom edge of the stage */
	.timeline {
		position: absolute;
		left: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.88);
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
		box-shadow: 0 2px 6px rgba(96, 115, 159, 0.15);
	}

	.timeline-buttons {
		display: flex;
		gap: 0.25rem;
	}

	.timeline-track {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		height: 1.3rem;
	}

	/* the exported range shows as a shaded band under the scrubber */
	.timeline-window {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		height: 1rem;
		background: var(--muted-light);
		border: 1px solid var(--border);
		border-radius: 4px;
		pointer-events: none;
	}

	.timeline-scrub {
		position: relative;
		width: 100%;
		min-width: 0;
		margin: 0;
	}

	.timeline-readout {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.65rem;
		color: var(--ink);
		white-space: nowrap;
	}

	/* ------------------------------------------------- sequence export */

	.seq-block {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		border-top: 1px dashed var(--border);
		padding-top: 0.45rem;
	}

	.seq-title {
		font-size: 0.68rem;
		color: var(--muted);
	}

	.seq-formats {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--muted);
		font-size: 0.7rem;
	}

	.seq-formats label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
	}

	.seq-formats select {
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

	.seq-formats select:disabled {
		opacity: 0.45;
	}

	.seq-progress {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.seq-progress-bar {
		flex: 1;
		min-width: 0;
		height: 0.45rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: #fff;
		overflow: hidden;
	}

	.seq-progress-fill {
		height: 100%;
		background: var(--ink);
		transition: width 0.15s ease;
	}

	.seq-progress-text {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.62rem;
		color: var(--muted);
		white-space: nowrap;
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 900px) {
		.workspace {
			flex-direction: column;
			overflow-y: auto;
		}

		/* the presets pane (and its dice) sits far below the fold here — show
		   the secondary dice next to the image controls */
		.dice-btn {
			display: flex;
		}

		/* The render stays pinned at the top while the control panes scroll
		   over it on a translucent, blurred backdrop (same overlay trick as
		   the v1 page) — the effect of every tweak stays visible. */
		.stage {
			position: sticky;
			top: 0;
			order: 1;
			/* the base rule's flex: 1 means flex-basis: 0%, which would
			   collapse the height in the column layout */
			flex: none;
			/* Follow the content's aspect so the render always spans the full
			   width (portrait content used to letterbox inside a fixed-height
			   band). Clamped: at 80svh a 9:16 phone video still fits the full
			   width and the controls keep peeking in (they scroll over the
			   sticky stage anyway); panoramas keep a usable drop target. The
			   1.5rem compensates the stage's own padding. */
			height: clamp(25vh, calc((100vw - 1.5rem) * var(--stage-aspect, 0.75) + 1.5rem), 80vh);
			height: clamp(25svh, calc((100vw - 1.5rem) * var(--stage-aspect, 0.75) + 1.5rem), 80svh);
			/* exact fit where container units are supported — 100cqw is the
			   workspace's content width, scrollbars already excluded */
			height: clamp(25svh, calc((100cqw - 1.5rem) * var(--stage-aspect, 0.75) + 1.5rem), 80svh);
			z-index: 0;
		}

		.pane {
			width: auto;
			overflow-y: visible;
			position: relative;
			z-index: 1;
			background: rgba(253, 250, 255, 0.82);
			-webkit-backdrop-filter: blur(6px);
			backdrop-filter: blur(6px);
		}

		.pane.left {
			border-right: none;
			border-top: 1px solid var(--border);
			order: 2;
		}

		.pane.right {
			border-left: none;
			border-top: 1px solid var(--border);
			order: 3;
		}

		/* let the render shimmer through the cards too */
		.layer-card,
		.stats {
			background: rgba(255, 255, 255, 0.55);
		}

		/* Mobile browsers zoom the whole page when a focused control renders
		   under 16px — keep every text-editable control at 16px on small
		   screens (also easier to hit), and widen the value columns to fit. */
		.slider-row input[type='number'],
		.spacing-head input[type='number'],
		.layer-row input[type='number'],
		.layer-row input[type='text'],
		.layer-row select,
		.plotter-row input[type='number'],
		.select-row select,
		.preset-row select,
		.preset-name {
			font-size: 16px;
		}

		.slider-row {
			grid-template-columns: 5.4rem 1fr 4.4rem;
		}

		.spacing-head {
			grid-template-columns: 1fr 4.4rem auto 4.4rem;
		}

		.plotter-row {
			grid-template-columns: 1fr 5rem;
		}
	}
</style>
