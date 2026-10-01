// Scroll-triggered entrances. An element that starts below the fold gets
// data-reveal="out" on mount and "in" once it scrolls into view; pages
// style those two states. Without JS, with reduced motion, or for anything
// already on screen at load, the attribute is never set, so content is
// never left hidden.

import type { Action } from 'svelte/action';

export const reveal: Action<HTMLElement, { margin?: string } | undefined> = (node, options) => {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const rect = node.getBoundingClientRect();
	if (rect.top < window.innerHeight && rect.bottom > 0) return;

	node.dataset.reveal = 'out';
	const io = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			node.dataset.reveal = 'in';
			io.disconnect();
		},
		{ rootMargin: options?.margin ?? '0px 0px -12% 0px' }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
};
