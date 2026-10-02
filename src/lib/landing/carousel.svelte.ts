// Timing and state for the landing page's auto-advancing slideshows.
//
// What keeps it smooth:
// - a slide only fades in once its <img> has been fetched AND decoded, so a
//   crossfade never runs into a half-painted frame (and the decode never
//   lands on the main thread mid-fade)
// - only the current, the next and the one fading out are mounted, so a
//   long show doesn't keep a dozen full-size bitmaps alive
// - the timer pauses instead of resetting: pause/play, hovering or focusing
//   the show, scrolling it off screen or hiding the tab all hold it at the
//   exact point it stopped. CSS animations tied to the show (a drift, a
//   progress ring) pause with it through the `running` flag.
// - with prefers-reduced-motion the show starts paused; it only advances
//   when the visitor asks it to.

import { prefersReducedMotion } from 'svelte/motion';
import { SvelteSet } from 'svelte/reactivity';
import type { Action } from 'svelte/action';

export interface CarouselOptions {
	/** number of slides */
	count: number;
	/** ms a slide stays before the next one starts fading in */
	interval?: number;
	/** ms of the crossfade */
	fade?: number;
}

export class Carousel {
	readonly count: number;
	readonly interval: number;
	readonly fade: number;

	/** the slide on show */
	current = $state(0);
	/** the slide fading out: still mounted (and still drifting) until the fade ends */
	leaving = $state<number | null>(null);
	/** the visitor's pause button */
	paused = $state(false);
	/** pointer or keyboard focus inside the show: hold without touching the button */
	held = $state(false);
	/** advances so far. Key a progress indicator on it to restart its animation. */
	cycle = $state(0);

	#offscreen = $state(false);
	#hidden = $state(false);
	/** requested slide still decoding; it shows as soon as it is ready */
	#target = $state<number | null>(null);
	#ready = new SvelteSet<number>();
	#remaining: number;
	/** plain mirror of `cycle`: effect teardowns read $state as it was before
	 *  the change, so they need a non-reactive way to tell a new slide */
	#slide = 0;
	#leaveTimer: ReturnType<typeof setTimeout> | undefined;

	/** true while the show is actually advancing */
	running = $derived(!this.paused && !this.held && !this.#offscreen && !this.#hidden);

	constructor({ count, interval = 5000, fade = 1200 }: CarouselOptions) {
		this.count = count;
		this.interval = interval;
		this.fade = fade;
		this.#remaining = interval;

		// Respect reduced motion: start (or drop to) paused. Applied after
		// hydration so server and client render the same first frame.
		$effect(() => {
			if (prefersReducedMotion.current) this.paused = true;
		});

		$effect(() => {
			void this.cycle;
			if (!this.running || this.count < 2) return;
			const slide = this.#slide;
			const started = performance.now();
			const timer = setTimeout(() => this.#advance(), this.#remaining);
			return () => {
				clearTimeout(timer);
				// paused mid-slide: keep the time left (a new slide resets it)
				if (this.#slide === slide) {
					this.#remaining = Math.max(0, this.#remaining - (performance.now() - started));
				}
			};
		});

		$effect(() => () => clearTimeout(this.#leaveTimer));
	}

	get nextIndex() {
		return (this.current + 1) % this.count;
	}

	get prevIndex() {
		return (this.current - 1 + this.count) % this.count;
	}

	/** whether slide `index` should be in the DOM right now */
	isMounted = (index: number) =>
		index === this.current ||
		index === this.leaving ||
		index === this.#target ||
		index === this.nextIndex;

	/** show slide `index` as soon as it has decoded */
	go = (index: number) => {
		const target = ((index % this.count) + this.count) % this.count;
		if (target === this.current) {
			this.#target = null;
			return;
		}
		if (this.#ready.has(target)) this.#show(target);
		else this.#target = target;
	};

	next = () => this.go(this.current + 1);
	prev = () => this.go(this.current - 1);
	toggle = () => (this.paused = !this.paused);

	/**
	 * Put on every slide's <img>: decodes the image before the slide may
	 * show, and forgets it again when the slide unmounts.
	 */
	slide: Action<HTMLImageElement, number> = (img, index) => {
		let current = index;
		let alive = true;
		const ready = () => {
			if (!alive) return;
			this.#ready.add(current);
			if (this.#target === current) this.#show(current);
		};
		img.decode().then(ready, ready);
		return {
			update: (next: number) => {
				this.#ready.delete(current);
				current = next;
				img.decode().then(ready, ready);
			},
			destroy: () => {
				alive = false;
				this.#ready.delete(current);
			}
		};
	};

	/**
	 * Put on the show's root element: pauses it off screen, in hidden tabs
	 * and while the pointer or focus is inside; arrow keys step through it.
	 */
	root: Action<HTMLElement> = (node) => {
		const io = new IntersectionObserver(
			([entry]) => {
				this.#offscreen = !entry.isIntersecting;
			},
			{ threshold: 0.15 }
		);
		io.observe(node);

		const visibility = () => {
			this.#hidden = document.visibilityState === 'hidden';
		};
		visibility();
		document.addEventListener('visibilitychange', visibility);

		// a mouse resting on the show, or keyboard focus inside it, holds it.
		// Focus from a mouse click doesn't count, so clicking a control and
		// moving away never leaves the show frozen.
		let pointerInside = false;
		let keyboardInside = false;
		const hold = () => (this.held = pointerInside || keyboardInside);
		const enter = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			pointerInside = true;
			hold();
		};
		const leave = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			pointerInside = false;
			hold();
		};
		const focusIn = () => {
			keyboardInside = node.querySelector(':focus-visible') !== null;
			hold();
		};
		const focusOut = (event: FocusEvent) => {
			if (node.contains(event.relatedTarget as Node | null)) return;
			keyboardInside = false;
			hold();
		};
		const keydown = (event: KeyboardEvent) => {
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				this.next();
			} else if (event.key === 'ArrowLeft') {
				event.preventDefault();
				this.prev();
			}
		};

		node.addEventListener('pointerenter', enter);
		node.addEventListener('pointerleave', leave);
		node.addEventListener('focusin', focusIn);
		node.addEventListener('focusout', focusOut);
		node.addEventListener('keydown', keydown);

		return {
			destroy: () => {
				io.disconnect();
				document.removeEventListener('visibilitychange', visibility);
				node.removeEventListener('pointerenter', enter);
				node.removeEventListener('pointerleave', leave);
				node.removeEventListener('focusin', focusIn);
				node.removeEventListener('focusout', focusOut);
				node.removeEventListener('keydown', keydown);
			}
		};
	};

	#advance() {
		this.#remaining = 0;
		this.go(this.current + 1);
	}

	#show(index: number) {
		this.#target = null;
		this.leaving = this.current;
		this.current = index;
		this.#remaining = this.interval;
		this.#slide++;
		this.cycle++;
		clearTimeout(this.#leaveTimer);
		this.#leaveTimer = setTimeout(() => (this.leaving = null), this.fade + 50);
	}
}
