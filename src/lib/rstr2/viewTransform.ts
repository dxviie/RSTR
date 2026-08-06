// Input view: crop / reposition of the source image or video inside its own
// frame — drag, zoom and rotate, applied where the source pixels are
// extracted so everything downstream (grid, segmentation, hatching, preview
// and every export) sees only the reframed picture.
//
// The view maps source pixels into a frame. Without an output format the
// frame is the source's own w×h rectangle and the identity view is the image
// exactly as loaded; with a format active the frame takes the page's aspect
// and the default view becomes containView — the source fitted inside the
// drawable area. Scale and rotation act around the frame center, then the
// offset shifts the result.

export interface InputView {
	/** frame-space offset of the image, in source px */
	x: number;
	y: number;
	/** zoom around the frame center; 1 = the image as loaded */
	scale: number;
	/** rotation around the frame center, radians */
	rotation: number;
}

export const VIEW_SCALE_MIN = 0.1;
export const VIEW_SCALE_MAX = 32;

/** touch rotations snap to the nearest quarter turn inside this (~1.7°) */
export const VIEW_SNAP_RAD = 0.03;

/** the frame edge band the image bbox may never be pushed out of entirely */
const KEEP_IN_FRAME_FRACTION = 0.1;

export const identityView = (): InputView => ({ x: 0, y: 0, scale: 1, rotation: 0 });

export const isIdentityView = (view: InputView): boolean =>
	view.x === 0 && view.y === 0 && view.scale === 1 && view.rotation === 0;

/** exact-field compare — default views are assigned verbatim, so this is safe */
export const viewsEqual = (a: InputView, b: InputView): boolean =>
	a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation === b.rotation;

/**
 * The view that fits a srcW×srcH source inside a frameW×frameH frame with
 * `insetPx` kept clear on every edge, centered and unrotated — the natural
 * starting composition when an output format reframes the input.
 */
export const containView = (
	srcW: number,
	srcH: number,
	frameW: number,
	frameH: number,
	insetPx = 0
): InputView => {
	if (!srcW || !srcH || !frameW || !frameH) return identityView();
	const availW = Math.max(frameW - 2 * insetPx, frameW * 0.1);
	const availH = Math.max(frameH - 2 * insetPx, frameH * 0.1);
	const scale = Math.min(
		Math.max(Math.min(availW / srcW, availH / srcH), VIEW_SCALE_MIN),
		VIEW_SCALE_MAX
	);
	// the offset that puts the source center on the frame center:
	// T(sc) = s·(sc − c) + c + t = c  ⇒  t = s·(c − sc)
	return {
		x: scale * (frameW / 2 - srcW / 2),
		y: scale * (frameH / 2 - srcH / 2),
		scale,
		rotation: 0
	};
};

export interface ViewMatrix {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
}

/**
 * The affine matrix mapping source-image px onto the frame (both w×h), ready
 * for ctx.setTransform(...) + drawImage(source, 0, 0, w, h). `out` scales the
 * whole mapping for targets rendered at a resolution other than the frame's.
 */
export const viewMatrix = (view: InputView, w: number, h: number, out = 1): ViewMatrix => {
	const cos = Math.cos(view.rotation) * view.scale;
	const sin = Math.sin(view.rotation) * view.scale;
	const cx = w / 2;
	const cy = h / 2;
	return {
		a: cos * out,
		b: sin * out,
		c: -sin * out,
		d: cos * out,
		e: (cx + view.x - (cos * cx - sin * cy)) * out,
		f: (cy + view.y - (sin * cx + cos * cy)) * out
	};
};

export interface Point {
	x: number;
	y: number;
}

/**
 * One incremental gesture step in frame coordinates: the frame point `from`
 * should land on `to` while the image zooms by `k` and turns by `dphi` around
 * it. A drag is {k: 1, dphi: 0}, a wheel zoom pins `from === to` under the
 * cursor, a two-finger move comes out of gestureBetween.
 */
export interface GestureDelta {
	k: number;
	dphi: number;
	from: Point;
	to: Point;
}

/** the similarity transform between two two-finger poses, as a GestureDelta */
export const gestureBetween = (a0: Point, b0: Point, a1: Point, b1: Point): GestureDelta => {
	const dx0 = b0.x - a0.x;
	const dy0 = b0.y - a0.y;
	const dx1 = b1.x - a1.x;
	const dy1 = b1.y - a1.y;
	const len0 = Math.hypot(dx0, dy0);
	const len1 = Math.hypot(dx1, dy1);
	return {
		k: len0 > 1e-6 ? len1 / len0 : 1,
		dphi: len0 > 1e-6 && len1 > 1e-6 ? Math.atan2(dy1, dx1) - Math.atan2(dy0, dx0) : 0,
		from: { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 },
		to: { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }
	};
};

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

/**
 * Nudge the offset so the transformed image can never be pushed fully out of
 * the frame — its bounding box always reaches at least a tenth of the frame
 * in from every edge it could escape over.
 */
const clampOffset = (
	view: InputView,
	w: number,
	h: number,
	srcW: number,
	srcH: number
): InputView => {
	const m = viewMatrix(view, w, h);
	// transformed source corners: (0,0) (srcW,0) (0,srcH) (srcW,srcH)
	const xs = [m.e, m.a * srcW + m.e, m.c * srcH + m.e, m.a * srcW + m.c * srcH + m.e];
	const ys = [m.f, m.b * srcW + m.f, m.d * srcH + m.f, m.b * srcW + m.d * srcH + m.f];
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	const margin = Math.min(w, h) * KEEP_IN_FRAME_FRACTION;
	let dx = 0;
	let dy = 0;
	if (maxX < margin) dx = margin - maxX;
	if (minX > w - margin) dx = w - margin - minX;
	if (maxY < margin) dy = margin - maxY;
	if (minY > h - margin) dy = h - margin - minY;
	if (dx === 0 && dy === 0) return view;
	return { ...view, x: view.x + dx, y: view.y + dy };
};

/**
 * Apply a gesture step to a view. The zoom clamps to VIEW_SCALE_MIN..MAX (the
 * pivot math uses the factor that survives the clamp) and the offset clamps
 * so the image always keeps a corner inside the frame. srcW/srcH are the
 * source's own dimensions — they only differ from the frame's when an output
 * format reshapes it. Pure — returns a new view.
 */
export const applyGesture = (
	view: InputView,
	delta: GestureDelta,
	w: number,
	h: number,
	srcW = w,
	srcH = h
): InputView => {
	const cx = w / 2;
	const cy = h / 2;
	const scale = clamp(view.scale * delta.k, VIEW_SCALE_MIN, VIEW_SCALE_MAX);
	const k = scale / view.scale;
	const cos = Math.cos(delta.dphi) * k;
	const sin = Math.sin(delta.dphi) * k;
	// keep `from`'s source point under `to`: t' = to − c − k·R(dphi)·(from − c − t)
	const fx = delta.from.x - cx - view.x;
	const fy = delta.from.y - cy - view.y;
	return clampOffset(
		{
			x: delta.to.x - cx - (cos * fx - sin * fy),
			y: delta.to.y - cy - (sin * fx + cos * fy),
			scale,
			rotation: view.rotation + delta.dphi
		},
		w,
		h,
		srcW,
		srcH
	);
};

/** snap an angle to the nearest quarter turn when it lands within `threshold` */
export const snapAngle = (rad: number, threshold = VIEW_SNAP_RAD): number => {
	const quarter = Math.PI / 2;
	const nearest = Math.round(rad / quarter) * quarter;
	return Math.abs(rad - nearest) <= threshold ? nearest : rad;
};

/** rotation for readouts: degrees normalized to (−180, 180] */
export const viewRotationDeg = (view: InputView): number => {
	let deg = (view.rotation * 180) / Math.PI;
	deg = ((deg % 360) + 360) % 360;
	return deg > 180 ? deg - 360 : deg;
};
