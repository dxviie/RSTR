import type p5 from 'p5';

export type Sketch = P5Sketch | PaperSketch;

export interface P5Sketch {
	sketch: (p: p5, options?: SketchOptions) => void;
	name?: string;
	type: 'p5';
}

export interface PaperSketch {
	sketch: (paper: paper.PaperScope, options?: SketchOptions) => void;
	name?: string;
	type: 'paper';
}

export interface SketchOptions {
	height: number;
	width: number;
	unit: 'mm' | 'px';
	params?: Param[];
}

export interface Param {
	name: string;
	value: any;
	type: 'number' | 'string' | 'boolean' | 'range' | 'color';
	min?: number;
	max?: number;
}

export type Vector2D = { x: number; y: number };

export type Pen = {
	strokeColor: string;
	strokeWidth: number;
	opacity?: number;
	name?: string;
	/*
	 In case of a wide pen, this is the angle at which the pen has the maximum width
	 The angle is measured from the horizontal x-axis which runs parallel to the base of the axidraw
	 */
	angle?: number;
};
