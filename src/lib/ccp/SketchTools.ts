import type { Vector2D } from '$lib/ccp/sketchTypes';

export const PAPERJS_MM_TO_PT = 3.775;

export function getTranslationVector(degrees: number, distance: number): Vector2D {
	const radians = degrees * (Math.PI / 180);
	return { x: distance * Math.cos(radians), y: distance * Math.sin(radians) };
}

export function getVerticalFactor(degrees: number, length: number): number {
	const radians = degrees * (Math.PI / 180);
	return Math.tan(radians) * length;
}
