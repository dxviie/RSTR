import paper from 'paper';
import { imageLoaded, renderingFinished } from '$lib/fsm.svelte.ts';
import { config } from '$lib/config.svelte.ts';

export class Rstr {

	paper: paper.PaperScope;
	project: paper.Project;
	image: paper.Raster | null = null;
	gridLayer: paper.Layer | null = null;
	grid: RstrPixel[][] = [];

	xResolution: number = config.resolution;
	yResolution: number = 0;
	xStep: number = 0;
	yStep: number = 0;

	pixelCount: number = 0;
	gridColorsCalculated: number = 0;
	gridAverageColorValues: number[][] = [];
	gridAverageColorLayer: paper.Layer = new paper.Layer();

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
		this.cleanupGrid();
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
				const pixel = new RstrPixel(
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
		} else {
			this.grid.forEach(row => row.forEach(pixel => pixel.rect.remove()));
		}
	}

	cleanup() {
		this.cleanupGrid();
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

	render() {
		if (this.gridColorsCalculated < this.pixelCount) {
			return this.calculateGridAverageColorValues();
		}
		renderingFinished.action();
		return 'done';
	}

	calculateGridAverageColorValues() {
		if (this.gridColorsCalculated >= this.pixelCount) {
			return;
		}
		const x = this.getXForIndex(this.gridColorsCalculated);
		const y = this.getYForIndex(this.gridColorsCalculated);
		const pixel = this.grid[x][y];
		const avg = this.image.getAverageColor(pixel);
		if (!avg) {
			return `0. no color found for pixel ${x}, ${y}`;
		}
		if (!this.gridAverageColorValues[x]) {
			this.gridAverageColorValues[x] = [];
		}
		this.gridAverageColorValues[x][y] = avg;
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

export class RstrPixel {

	x: number;
	y: number;
	rect: paper.Path.Rectangle;

	constructor(x: number, y: number, width: number = 1, height: number = 1, layer: paper.Layer | null = null) {
		this.x = x;
		this.y = y;
		this.rect = new paper.Path.Rectangle({
			from: [x, y],
			to: [x + width, y + height],
			strokeColor: 'darkorange',
			strokeWidth: 1
		});
	}
}