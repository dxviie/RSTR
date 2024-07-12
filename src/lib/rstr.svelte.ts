import paper from 'paper';
import { imageLoaded } from '$lib/fsm.svelte.ts';
import { config } from '$lib/config.svelte.ts';

export class Rstr {

	paper: paper.PaperScope;
	project: paper.Project;
	image: paper.Raster | null = null;
	gridLayer: paper.Layer | null = null;
	grid: RstrPixel[][] = [];

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
		const xStep = this.image.bounds.width / xResolution;
		const yResolution = Math.round(this.image.bounds.height / xStep);
		const yStep = this.image.bounds.height / yResolution;
		for (let x = 0; x < xResolution; x++) {
			const row: RstrPixel[] = [];
			for (let y = 0; y < yResolution; y++) {
				const pixel = new RstrPixel(
					x * xStep + this.image.bounds.x,
					y * yStep + this.image.bounds.y,
					xStep,
					yStep,
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
		}
		else {
			this.grid.forEach(row => row.forEach(pixel => pixel.rect.remove()));
		}
	}

	cleanup() {
		this.cleanupGrid();
		if (this.project) {
			this.project.remove();
		}
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