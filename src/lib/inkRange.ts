// Cross-browser look for single-value range inputs.
//
// The studio used to lean on `accent-color`, but every engine draws that
// differently: Chrome shows an ink thumb on an ink fill, Firefox a gray
// thumb with a light edge, iOS Safari a white pill. Sliders opt into a
// fully custom-drawn control instead via this action: it tags the input
// with the `ink-range` class (styled in app.css, tuned to match the
// @stanko/dual-range-input theme) and keeps `--ink-range-fill` — the
// filled share of the track, 0..1 — in sync with the value, which pure
// CSS cannot do.
//
// Pass the bound value as the parameter so programmatic changes (presets,
// randomize, imports) re-sync the fill; user drags are covered by the
// input listener. When min/max are reactive too, pass an array of every
// value the fill depends on, e.g. [currentFrame, totalFrames].

import type { Action } from 'svelte/action';

export const inkRange: Action<HTMLInputElement, unknown> = (node) => {
	node.classList.add('ink-range');
	const sync = () => {
		const min = node.min === '' ? 0 : Number(node.min);
		const max = node.max === '' ? 100 : Number(node.max);
		const fill = max > min ? (Number(node.value) - min) / (max - min) : 0;
		node.style.setProperty('--ink-range-fill', Math.min(Math.max(fill, 0), 1).toFixed(4));
	};
	sync();
	node.addEventListener('input', sync);
	return {
		// runs whenever the passed parameter changes — the value itself is
		// read fresh from the DOM, the parameter only triggers the sync
		update: sync,
		destroy: () => node.removeEventListener('input', sync)
	};
};
