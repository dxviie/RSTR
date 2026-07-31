import { describe, it, expect } from 'vitest';
import {
	applyGesture,
	gestureBetween,
	identityView,
	isIdentityView,
	snapAngle,
	viewMatrix,
	viewRotationDeg,
	VIEW_SCALE_MAX,
	VIEW_SCALE_MIN,
	type InputView,
	type Point
} from './viewTransform';

const W = 100;
const H = 80;

/** map a source point through a view's matrix into frame coordinates */
const map = (view: InputView, p: Point, out = 1): Point => {
	const m = viewMatrix(view, W, H, out);
	return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
};

const expectPoint = (got: Point, want: Point) => {
	expect(got.x).toBeCloseTo(want.x, 6);
	expect(got.y).toBeCloseTo(want.y, 6);
};

describe('identityView', () => {
	it('is the image exactly as loaded', () => {
		expectPoint(map(identityView(), { x: 0, y: 0 }), { x: 0, y: 0 });
		expectPoint(map(identityView(), { x: 12, y: 34 }), { x: 12, y: 34 });
		expectPoint(map(identityView(), { x: W, y: H }), { x: W, y: H });
		expect(isIdentityView(identityView())).toBe(true);
	});

	it('stops being identity after any change', () => {
		expect(isIdentityView({ ...identityView(), x: 1 })).toBe(false);
		expect(isIdentityView({ ...identityView(), scale: 2 })).toBe(false);
		expect(isIdentityView({ ...identityView(), rotation: 0.1 })).toBe(false);
	});
});

describe('viewMatrix', () => {
	it('rotates around the frame center', () => {
		const view = { ...identityView(), rotation: Math.PI / 2 };
		// a quarter turn around (50, 40): the top-left corner lands at (90, -10)
		expectPoint(map(view, { x: 0, y: 0 }), { x: 90, y: -10 });
		// the center stays put
		expectPoint(map(view, { x: 50, y: 40 }), { x: 50, y: 40 });
	});

	it('scales around the frame center and applies the offset last', () => {
		const view: InputView = { x: 5, y: -3, scale: 2, rotation: 0 };
		expectPoint(map(view, { x: 50, y: 40 }), { x: 55, y: 37 });
		expectPoint(map(view, { x: 60, y: 40 }), { x: 75, y: 37 });
	});

	it('scales the whole mapping by `out` for smaller render targets', () => {
		const view: InputView = { x: 10, y: 20, scale: 1.5, rotation: 0.3 };
		const full = map(view, { x: 12, y: 34 });
		const half = map(view, { x: 12, y: 34 }, 0.5);
		expectPoint(half, { x: full.x / 2, y: full.y / 2 });
	});
});

describe('applyGesture', () => {
	it('pans by the pointer travel', () => {
		const view = applyGesture(
			identityView(),
			{ k: 1, dphi: 0, from: { x: 10, y: 10 }, to: { x: 30, y: 25 } },
			W,
			H
		);
		expect(view).toEqual({ x: 20, y: 15, scale: 1, rotation: 0 });
	});

	it('zooms around the cursor, keeping the point under it fixed', () => {
		const q = { x: 25, y: 60 };
		const view = applyGesture(identityView(), { k: 2, dphi: 0, from: q, to: q }, W, H);
		expect(view.scale).toBe(2);
		// the source point that sat under the cursor still sits under it
		expectPoint(map(view, q), q);
	});

	it('composes: a second zoom at another point keeps that point fixed', () => {
		const first = applyGesture(
			identityView(),
			{ k: 2, dphi: 0, from: { x: 25, y: 60 }, to: { x: 25, y: 60 } },
			W,
			H
		);
		const q = { x: 70, y: 20 };
		// the source point currently under q, before the second zoom
		const m = viewMatrix(first, W, H);
		const inv = 1 / (m.a * m.d - m.b * m.c);
		const source = {
			x: (m.d * (q.x - m.e) - m.c * (q.y - m.f)) * inv,
			y: (m.a * (q.y - m.f) - m.b * (q.x - m.e)) * inv
		};
		const second = applyGesture(first, { k: 1.5, dphi: 0, from: q, to: q }, W, H);
		expect(second.scale).toBeCloseTo(3, 6);
		expectPoint(map(second, source), q);
	});

	it('reproduces the exact two-finger similarity: both fingers stay on their spots', () => {
		const a0 = { x: 10, y: 10 };
		const b0 = { x: 20, y: 10 };
		const a1 = { x: 30, y: 30 };
		const b1 = { x: 30, y: 50 };
		const delta = gestureBetween(a0, b0, a1, b1);
		expect(delta.k).toBeCloseTo(2, 6);
		expect(delta.dphi).toBeCloseTo(Math.PI / 2, 6);
		const view = applyGesture(identityView(), delta, W, H);
		// starting from identity, the source points under the fingers are the
		// finger positions themselves — they must follow the fingers exactly
		expectPoint(map(view, a0), a1);
		expectPoint(map(view, b0), b1);
	});

	it('keeps still fingers still', () => {
		const a = { x: 40, y: 30 };
		const b = { x: 60, y: 50 };
		const view = applyGesture(identityView(), gestureBetween(a, b, a, b), W, H);
		expect(view.x).toBeCloseTo(0, 6);
		expect(view.y).toBeCloseTo(0, 6);
		expect(view.scale).toBeCloseTo(1, 6);
		expect(view.rotation).toBeCloseTo(0, 6);
	});

	it('clamps the zoom range', () => {
		const q = { x: 50, y: 40 };
		const zoomedIn = applyGesture(identityView(), { k: 1e6, dphi: 0, from: q, to: q }, W, H);
		expect(zoomedIn.scale).toBe(VIEW_SCALE_MAX);
		const zoomedOut = applyGesture(identityView(), { k: 1e-6, dphi: 0, from: q, to: q }, W, H);
		expect(zoomedOut.scale).toBe(VIEW_SCALE_MIN);
	});

	it('never lets the image leave the frame entirely', () => {
		let view = identityView();
		const drag = { k: 1, dphi: 0, from: { x: 0, y: 0 }, to: { x: W * 10, y: 0 } };
		view = applyGesture(view, drag, W, H);
		// the image's left edge may go no further right than the margin band
		const m = viewMatrix(view, W, H);
		const leftEdge = m.e; // x of the transformed (0, 0) corner
		expect(leftEdge).toBeLessThanOrEqual(W - Math.min(W, H) * 0.1 + 1e-9);
	});

	it('does not mutate its input', () => {
		const view = identityView();
		applyGesture(view, { k: 2, dphi: 0.5, from: { x: 0, y: 0 }, to: { x: 9, y: 9 } }, W, H);
		expect(view).toEqual(identityView());
	});
});

describe('snapAngle', () => {
	it('snaps close to the quarter turns', () => {
		expect(snapAngle(0.02)).toBe(0);
		expect(snapAngle(Math.PI / 2 - 0.02)).toBe(Math.PI / 2);
		expect(snapAngle(-Math.PI + 0.01)).toBe(-Math.PI);
	});

	it('leaves deliberate angles alone', () => {
		expect(snapAngle(0.2)).toBe(0.2);
		expect(snapAngle(Math.PI / 4)).toBe(Math.PI / 4);
	});
});

describe('viewRotationDeg', () => {
	it('normalizes to (−180, 180]', () => {
		expect(viewRotationDeg({ ...identityView(), rotation: Math.PI / 2 })).toBeCloseTo(90, 6);
		expect(viewRotationDeg({ ...identityView(), rotation: -Math.PI / 2 })).toBeCloseTo(-90, 6);
		expect(viewRotationDeg({ ...identityView(), rotation: 3 * Math.PI })).toBeCloseTo(180, 6);
		expect(viewRotationDeg({ ...identityView(), rotation: -Math.PI })).toBeCloseTo(180, 6);
	});
});
