import paper from 'paper';
import { imageLoaded, renderingFinished } from '$lib/fsm.svelte.ts';
import type { RstrConfig } from '$lib/rstr/config.svelte.ts';
import { RstrClassicGrouping } from '$lib/rstr/rstrClassic.ts';
import Layer = paper.Layer;

export interface RstrPixel {
	x: number;
	y: number;
	rect: paper.Path.Rectangle;
	color: paper.Color | null;
}

export interface RstrGroup {
	pixels: RstrPixel[];
	shape: paper.Path;
	timesVisited: number;
}

export interface RstrGroupingAlgo {
	initGroups: (grid: RstrPixel[][], layer: paper.Layer, config: RstrConfig) => RstrGroup[];
	doGroupingStep: (groups: RstrGroup[], config: RstrConfig) => RstrGroup[];
	iterationsFinished: (groups: RstrGroup[]) => number;
}

export class Rstr {

	classicGrouping: RstrGroupingAlgo = new RstrClassicGrouping();

	paper: paper.PaperScope;
	project: paper.Project;
	image: paper.Raster | null = null;
	gridLayer: paper.Layer | null = null;
	grid: RstrPixel[][] = [];
	groupLayer: paper.Layer | null = null;
	groups: RstrGroup[] | null = null;

	xResolution: number = 0;
	yResolution: number = 0;
	xStep: number = 0;
	yStep: number = 0;

	pixelCount: number = 0;
	gridColorsCalculated: number = 0;
	gridAverageColorLayer: paper.Layer | null = null;

	constructor(paper: paper.PaperScope) {
		this.paper = paper;
		this.project = paper.project;
	}

	loadImage(image: string | HTMLImageElement) {
		if (this.image) {
			this.image.remove();
		}
		this.image = new paper.Raster(image);
		this.image.onLoad = () => {
			if (!this.image) return;
			console.debug('Image loaded', this.image.bounds);
			this.image.fitBounds(this.project.view.bounds);
			console.debug('Image fitted', this.image.bounds);
			imageLoaded.action();
		};
	}

	updateGrid(xResolution: number) {
		this.cleanup();
		if (!this.image) return;
		if (this.gridLayer) {
			this.gridLayer.remove();
		}
		this.gridLayer = new paper.Layer();
		this.grid = [];
		this.xResolution = xResolution;
		this.xStep = this.image.bounds.width / xResolution;
		this.yResolution = Math.round(this.image.bounds.height / this.xStep);
		this.pixelCount = this.xResolution * this.yResolution;
		this.yStep = this.image.bounds.height / this.yResolution;
		for (let x = 0; x < xResolution; x++) {
			const row: RstrPixel[] = [];
			for (let y = 0; y < this.yResolution; y++) {
				const pixel = new RstrPixelImpl(
					x * this.xStep + this.image.bounds.x,
					y * this.yStep + this.image.bounds.y,
					this.xStep,
					this.yStep,
					this.gridLayer
				);
				row.push(pixel);
			}
			this.grid.push(row);
		}
	}

	cleanupGrid() {
		if (this.gridLayer) {
			this.gridLayer.remove();
			this.gridLayer = null;
		}
		if (this.grid) {
			this.grid.forEach(row => row.forEach(pixel => pixel.rect.remove()));
		}
	}

	cleanupPreparation() {
		if (this.gridAverageColorLayer) {
			this.gridAverageColorLayer.remove();
			this.gridAverageColorLayer = null;
		}
		this.gridAverageColorValues = [];
		this.gridColorsCalculated = 0;
	}

	cleanupGroups() {
		if (this.groupLayer) {
			this.groupLayer.remove();
			this.groupLayer = null;
		}
		if (this.groups) {
			this.groups.forEach(group => group.shape.remove());
			this.groups = null;
		}
	}

	cleanup() {
		this.cleanupGrid();
		this.cleanupPreparation();
		this.cleanupGroups();
	}

	reset() {
		this.cleanup();
		if (this.project) {
			this.project.remove();
		}
	}

	getXForIndex(index: number): number {
		return Math.floor(index / this.yResolution);
	}

	getYForIndex(index: number): number {
		return index % this.yResolution;
	}

	getIndexForXY(x: number, y: number): number {
		return x * this.yResolution + y;
	}

	/***************************************
	 							RENDERING
	 ***************************************/
	render(config: RstrConfig) {
		/*** preparation ***/
		if (this.gridColorsCalculated < this.pixelCount) {
			if (this.gridAverageColorLayer === null) {
				this.gridAverageColorLayer = new paper.Layer();
			}
			return this.calculateGridAverageColorValues();
		}
		/*** grouping ***/
		if (this.groups === null) {
			if (this.groupLayer === null) {
				this.groupLayer = new paper.Layer();
			}
			this.groups = this.classicGrouping.initGroups(this.grid, this.groupLayer, config);
			console.info('initializing groups');
			return 'initializing groups';
		}
		const iterations = this.classicGrouping.iterationsFinished(this.groups);
		console.info(`grouping: ${iterations} / ${config.iterations} iterations`);
		if (iterations < config.iterations) {
			this.groups = this.classicGrouping.doGroupingStep(this.groups, config);
			return `grouping: ${iterations} / ${config.iterations} iterations`;
		}
		console.info('Rendering finished');
		renderingFinished.action();
		return 'done';
	}

	/***************************************
	 							PREPARATION
	 ***************************************/
	calculateGridAverageColorValues() {
		if (this.gridColorsCalculated >= this.pixelCount) {
			return;
		}
		const x = this.getXForIndex(this.gridColorsCalculated);
		const y = this.getYForIndex(this.gridColorsCalculated);
		const pixel = this.grid[x][y];
		const avg = this.image.getAverageColor(pixel.rect.bounds);
		if (!avg) {
			console.error(`0. no color found for pixel ${x}, ${y}, ${pixel.rect.bounds}, ${this.image}`);
			this.gridColorsCalculated++;
			return `0. no color found for pixel ${x}, ${y} - ${pixel.rect.bounds}`;
		}
		pixel.color = avg;
		const from = new paper.Point({
			x: pixel.rect.bounds.topLeft.x,
			y: pixel.rect.bounds.topLeft.y + ((1 - (avg.lightness || 0)) * pixel.rect.bounds.height)
		});
		const clr = new paper.Path.Rectangle({
			from: from,
			to: pixel.rect.bounds.bottomRight,
			fillColor: 'darkorange',
			opacity: 0.7
		});
		this.gridAverageColorLayer.addChild(clr);
		this.gridColorsCalculated++;
		return '0. pre-calculating average color values';
	}
}

class RstrPixelImpl implements RstrPixel {

	x: number;
	y: number;
	rect: paper.Path.Rectangle;
	color: paper.Color | null;

	constructor(x: number, y: number, width: number = 1, height: number = 1, layer: Layer) {
		this.color = null;
		this.x = x;
		this.y = y;
		this.rect = new paper.Path.Rectangle({
			from: [x, y],
			to: [x + width, y + height],
			strokeColor: 'darkorange',
			strokeWidth: 1
		});
		if (layer) {
			this.rect.addTo(layer);
		}
	}
}