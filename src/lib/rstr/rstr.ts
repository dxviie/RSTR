import paper from 'paper';
import { imageLoaded, renderingFinished } from '$lib/fsm.svelte.ts';
import type { RstrConfig } from '$lib/rstr/config.svelte.ts';
import { RstrClassicGrouping } from '$lib/rstr/rstrClassic.ts';
import Layer = paper.Layer;

/*****    INTERFACES    *****/
export interface RstrPixel {
	x: number;
	y: number;
	gridX: number;
	gridY: number;
	rect: paper.Path.Rectangle;
	color: paper.Color | null;
	group: RstrGroup | null;

	isNeighbor(other: RstrPixel, allowDiagonals: boolean): boolean;

	getAverageColorValue(): number;
}

export interface RstrGroup {
	pixels: RstrPixel[];
	shape: paper.Path;
	timesVisited: number;
	isFilled: boolean;
	fills: paper.Path[];
	fillColor: paper.Color;

	getAverageLightness(): number;

	getBoundingBox(): paper.Rectangle;

	getCornerPixels(): { topLeft: RstrPixel, topRight: RstrPixel, bottomLeft: RstrPixel, bottomRight: RstrPixel };

	getAverageColor(): paper.Color;
}

export type RstrColor = {
	web: string;
}

export interface RstrGroupingAlgo {
	initGroups: (grid: RstrPixel[][], layer: paper.Layer, config: RstrConfig) => RstrGroup[];
	doGroupingStep: (groups: RstrGroup[], config: RstrConfig) => RstrGroup[];
	iterationsFinished: (groups: RstrGroup[]) => number;
}

export interface RstrFillingAlgo {
	fillGroup: (group: RstrGroup, layer: paper.Layer, config: RstrConfig) => void;
}

/****** IMPLEMENTATION ******/
export class Rstr {

	classicGrouping: RstrGroupingAlgo = new RstrClassicGrouping();

	paper: paper.PaperScope;
	project: paper.Project;
	image: paper.Raster | null = null;
	gridLayer: paper.Layer | null = null;
	grid: RstrPixel[][] = [];
	groupLayer: paper.Layer | null = null;
	groups: RstrGroup[] | null = null;
	fillLayer: paper.Layer | null = null;

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

	/***************************************
	 							IMAGE & GRID
	 ***************************************/
	loadImage(image: string | HTMLImageElement) {
		if (this.image) {
			this.image.remove();
		}
		this.image = new paper.Raster(image);
		this.image.onLoad = () => {
			if (!this.image) return;
			console.debug('Image rasterized', this.image.bounds);
			this.image.fitBounds(this.project.view.bounds);
			console.debug('Image fitted', this.image.bounds);
			imageLoaded.action();
		};
	}

	updateGrid(xResolution: number) {
		this.cleanup();
		if (!this.image) return;
		this.image.opacity = 1;
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
					this.gridLayer,
					x,
					y
				);
				row.push(pixel);
			}
			this.grid.push(row);
		}
	}

	/***************************************
	 							RENDERING
	 ***************************************/
	render(config: RstrConfig) {
		// if (!this.image || !this.gridLayer) {
		// 	return 'no image or grid';
		// }
		// this.image.opacity = 1;
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
			return '1.a initializing groups';
		}
		const iterations = this.classicGrouping.iterationsFinished(this.groups);
		if (iterations < config.iterations) {
			this.groups = this.classicGrouping.doGroupingStep(this.groups, config);
			return `1.b grouping: ${iterations + 1} / ${config.iterations} iterations`;
		}
		/*** filling ***/
		const hasUnfilledGroups = this.groups.some(group => !group.isFilled);
		if (hasUnfilledGroups) {
			if (this.fillLayer === null) {
				this.fillLayer = new paper.Layer();
			}
			for (const group of this.groups) {
				if (!group.isFilled) {
					this.classicGrouping.fillGroup(group, this.fillLayer, config);
					return '2. filling groups';
				}
			}
		}
		if (this.groupLayer) this.groupLayer.opacity = 0;
		// if (this.groups) this.groups.forEach(group => group.shape.opacity = 0);
		if (this.gridAverageColorLayer) this.gridAverageColorLayer.opacity = 0;
		if (this.image) this.image.opacity = 0;
		// this.cleanupGroups(); we need these for SVG export
		this.cleanupPreparation();
		this.cleanupGrid();
		renderingFinished.action();
		return '3. done';
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

	/***************************************
	 							CLEANUP
	 ***************************************/
	cleanup() {
		this.cleanupGrid();
		this.cleanupPreparation();
		this.cleanupGroups();
		this.cleanupFilling();
	}

	reset() {
		this.cleanup();
		if (this.project) {
			this.project.remove();
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
			console.warn('Groups removed');
			this.groups = null;
		}
	}

	cleanupFilling() {
		if (this.fillLayer) {
			this.fillLayer.remove();
			this.fillLayer = null;
		}
	}

	/***************************************
	 							UTILS
	 ***************************************/
	getXForIndex(index: number): number {
		return Math.floor(index / this.yResolution);
	}

	getYForIndex(index: number): number {
		return index % this.yResolution;
	}

	getIndexForXY(x: number, y: number): number {
		return x * this.yResolution + y;
	}
}

function rgbToCmyk(color) {
	// Get RGB values from the Paper.js color object
	let red = color.red;
	let green = color.green;
	let blue = color.blue;

	// Calculate K (black)
	let k = Math.min(1 - red, 1 - green, 1 - blue);

	// Calculate CMY
	let c = (1 - red - k) / (1 - k) || 0;
	let m = (1 - green - k) / (1 - k) || 0;
	let y = (1 - blue - k) / (1 - k) || 0;

	return {
		cyan: c,
		magenta: m,
		yellow: y,
		black: k
	};
}

class RstrPixelImpl implements RstrPixel {

	x: number;
	y: number;
	gridX: number;
	gridY: number;
	rect: paper.Path.Rectangle;
	color: paper.Color | null;
	group: RstrGroup | null;

	constructor(x: number, y: number, width: number, height: number, layer: Layer, gridX: number, gridY: number) {
		this.color = null;
		this.x = x;
		this.y = y;
		this.gridX = gridX;
		this.gridY = gridY;
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

	isNeighbor(other: RstrPixel, allowDiagonals: boolean): boolean {
		const xDiff = Math.abs(this.gridX - other.gridX);
		const yDiff = Math.abs(this.gridY - other.gridY);
		if (allowDiagonals) {
			return xDiff <= 1 && yDiff <= 1;
		}
		return (xDiff === 1 && yDiff === 0) || (xDiff === 0 && yDiff === 1);
	}

	getAverageColorValue(): number {
		if (!this.color) return 0;
		// let cmyk = rgbToCmyk(this.color);
		// const val = 1 - cmyk.black;
		const val = this.color.gray;
		if (val === null) return 0;
		if (val < 0 || val > 1) console.warn('Color value out of bounds', val);
		return val;
	}
}