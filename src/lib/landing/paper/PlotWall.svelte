<script lang="ts">
	// The #madewithrstr wall: plot photos pinned to the plotter bed with two
	// magnets each, every position with its own slight tilt. Hovering a
	// print straightens and lifts it. One empty sheet waits for yours.
	//
	// Only a few plots fit at once, so every few seconds one print fades to
	// a plot that wasn't up yet: one at a time, never the one under the
	// pointer, only while the wall is on screen and the tab is visible, and
	// never under reduced motion.
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { GALLERY_PLOTS, plotSrc, plotSrcset, type Plot } from '$lib/landing/plots';
	import { reveal } from '$lib/landing/reveal';
	import { HASHTAG } from '$lib/landing/share';
	import Magnet from './Magnet.svelte';
	import RegMark from './RegMark.svelte';

	const {
		onopen,
		oncopy,
		copied
	}: {
		onopen: (plot: Plot) => void;
		/** the empty sheet copies the hashtag */
		oncopy: () => void;
		copied: boolean;
	} = $props();

	const WIDE = 7;
	const NARROW = 5;
	const SIZES = '(max-width: 560px) 42vw, (max-width: 820px) 28vw, 230px';

	// the server and the first client render show the same prints
	const FIRST = ['space-1-1', 'lia-1', 'pearl-1', 'siesta-1', 'mona-1', 'metro-1', 'path-1'];
	let slots = $state(FIRST.map((name) => GALLERY_PLOTS.findIndex((plot) => plot.name === name)));

	// tilt belongs to the place on the wall, so a swap never jolts a print
	const TILT = [-1.6, 1.1, -0.6, 1.5, 0.9, -1.3, 1.2, -0.8];

	let wall: HTMLElement;
	/** slot under the mouse: never swapped while someone looks at it */
	let held = -1;

	const offWall = () => {
		const shown = new Set(slots);
		return GALLERY_PLOTS.map((_, i) => i).filter((i) => !shown.has(i));
	};

	onMount(() => {
		const narrow = window.matchMedia('(max-width: 820px)');

		// match the number of prints to the layout, keeping the ones up
		const fit = () => {
			const target = narrow.matches ? NARROW : WIDE;
			if (target < slots.length) {
				slots = slots.slice(0, target);
			} else if (target > slots.length) {
				const pool = offWall();
				const extra: number[] = [];
				while (slots.length + extra.length < target && pool.length) {
					extra.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
				}
				slots = [...slots, ...extra];
			}
		};
		fit();
		narrow.addEventListener('change', fit);

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return () => narrow.removeEventListener('change', fit);
		}

		let visible = false;
		let hidden = document.visibilityState === 'hidden';
		let timer: ReturnType<typeof setTimeout> | undefined;
		let busy = false;

		const schedule = () => {
			clearTimeout(timer);
			timer = undefined;
			if (visible && !hidden && !busy) timer = setTimeout(swap, 2800 + Math.random() * 2600);
		};

		// decode the next plot before it goes up, so the crossfade never
		// fades into an empty frame
		const swap = () => {
			const pool = offWall();
			const free = slots.map((_, i) => i).filter((i) => i !== held);
			if (!pool.length || !free.length) {
				schedule();
				return;
			}
			const slot = free[Math.floor(Math.random() * free.length)];
			const pick = pool[Math.floor(Math.random() * pool.length)];
			const next = new Image();
			next.sizes = SIZES;
			next.srcset = plotSrcset(GALLERY_PLOTS[pick].name);
			next.src = plotSrc(GALLERY_PLOTS[pick].name, 400);
			busy = true;
			next
				.decode()
				.catch(() => {})
				.then(() => {
					busy = false;
					if (slot < slots.length && slot !== held && !slots.includes(pick)) {
						const updated = slots.slice();
						updated[slot] = pick;
						slots = updated;
					}
					schedule();
				});
		};

		const io = new IntersectionObserver(
			(entries) => {
				visible = entries.some((entry) => entry.isIntersecting);
				schedule();
			},
			{ threshold: 0.2 }
		);
		io.observe(wall);

		const visibility = () => {
			hidden = document.visibilityState === 'hidden';
			schedule();
		};
		document.addEventListener('visibilitychange', visibility);

		return () => {
			clearTimeout(timer);
			io.disconnect();
			narrow.removeEventListener('change', fit);
			document.removeEventListener('visibilitychange', visibility);
		};
	});
</script>

<div class="bed" bind:this={wall} use:reveal>
	<RegMark style="top: -11px; left: -11px" />
	<RegMark style="top: -11px; right: -11px" />
	<RegMark style="bottom: -11px; left: -11px" />
	<RegMark style="bottom: -11px; right: -11px" />

	<ul class="wall">
		{#each slots as plotIndex, slot (slot)}
			{@const plot = GALLERY_PLOTS[plotIndex]}
			<li
				class="pin"
				style="--tilt: {TILT[slot]}deg; --n: {slot}"
				onpointerenter={() => (held = slot)}
				onpointerleave={() => (held = -1)}
			>
				<button
					type="button"
					class="print"
					aria-label="open plot: {plot.alt}"
					onclick={() => onopen(plot)}
				>
					<span class="photo">
						{#key plotIndex}
							<img
								src={plotSrc(plot.name, 400)}
								srcset={plotSrcset(plot.name)}
								sizes={SIZES}
								alt={plot.alt}
								loading="lazy"
								decoding="async"
								in:fade={{ duration: 800 }}
								out:fade={{ duration: 800 }}
							/>
						{/key}
					</span>
					<Magnet style="left: 18%; top: 8px" />
					<Magnet style="left: 82%; top: 8px" />
				</button>
			</li>
		{/each}

		<li class="pin" style="--tilt: {TILT[slots.length]}deg; --n: {slots.length}">
			<button
				type="button"
				class="print empty"
				aria-label="your plot here. Copy {HASHTAG} to tag yours"
				onclick={oncopy}
			>
				<span class="slot">
					<span class="here">your plot here</span>
					<span class="how">tag {HASHTAG}</span>
					<span class="act" aria-hidden="true">
						<span class:on={!copied}>copy the tag</span>
						<span class:on={copied}>copied</span>
					</span>
				</span>
				<Magnet style="left: 18%; top: 8px" />
				<Magnet style="left: 82%; top: 8px" />
			</button>
		</li>
	</ul>
</div>

<style>
	.bed {
		position: relative;
		margin-top: clamp(2.5rem, 5vw, 3.5rem);
		padding: clamp(1.75rem, 4vw, 3.25rem) clamp(1.1rem, 4vw, 3.25rem);
		border: var(--edge);
		background-color: var(--bed);
		background-image: var(--bed-grid);
		background-position: center;
	}

	.wall {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: clamp(1.75rem, 3.5vw, 2.75rem) clamp(1.1rem, 3vw, 2.4rem);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pin {
		transition:
			opacity 0.6s ease,
			transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
		transition-delay: calc(var(--n) * 0.07s);
	}

	.bed:global([data-reveal='out']) .pin {
		opacity: 0;
		transform: translateY(22px);
	}

	/* once a print has settled, its magnets snap on, like in the hero */
	.pin :global(.magnet) {
		transition:
			opacity 0.2s ease,
			transform 0.36s cubic-bezier(0.3, 1.6, 0.5, 1);
		transition-delay: calc(0.45s + var(--n) * 0.07s);
	}

	.bed:global([data-reveal='out']) .pin :global(.magnet) {
		opacity: 0;
		transform: translate(-3px, -5px) scale(1.35);
	}

	.print {
		position: relative;
		display: block;
		width: 100%;
		margin: 0;
		padding: 9px;
		border: none;
		border-radius: 1px;
		background: var(--sheet) !important;
		box-shadow: var(--sheet-shadow);
		cursor: zoom-in;
		transform: rotate(var(--tilt));
		transition:
			transform 0.45s cubic-bezier(0.3, 0.7, 0.3, 1),
			box-shadow 0.45s ease;
	}

	/* straightened and lifted off the bed */
	.print:hover,
	.print:focus-visible {
		transform: rotate(0deg) translateY(-6px);
		box-shadow: var(--sheet-shadow-lift);
	}

	.print:active {
		transform: rotate(0deg) translateY(-3px);
	}

	.print:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 4px;
	}

	.photo {
		position: relative;
		display: block;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: #f3f0e8;
	}

	.photo img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* zoomed so the photographed desk around each sheet stays cropped */
		transform: scale(1.14);
	}

	/* ------------------------------------------------- the empty sheet */

	.empty {
		background: transparent !important;
		box-shadow: none;
		cursor: copy;
	}

	.empty:hover,
	.empty:focus-visible {
		box-shadow: none;
	}

	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		/* the same footprint as a photo on the other prints */
		aspect-ratio: 4 / 5;
		padding: 1rem 0.5rem;
		border: 2px dashed var(--ink);
		background: rgba(255, 254, 247, 0.6);
		text-align: center;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.empty:hover .slot,
	.empty:focus-visible .slot {
		border-color: var(--magenta);
		background: rgba(255, 254, 247, 0.95);
	}

	.here {
		font-family: 'mono-bold', monospace;
		font-size: clamp(0.9rem, 1.6vw, 1.05rem);
		color: var(--ink);
	}

	.how {
		font-family: 'mono-light', monospace;
		font-size: 0.78rem;
		color: var(--ink-soft);
	}

	/* "copy the tag" and "copied" share one cell, so nothing shifts */
	.act {
		display: grid;
		margin-top: 0.7rem;
		font-family: 'mono-bold', monospace;
		font-size: 0.72rem;
		color: var(--magenta-ink);
	}

	.act span {
		grid-area: 1 / 1;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.act span.on {
		opacity: 1;
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 820px) {
		.wall {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.wall {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.print {
			padding: 7px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pin,
		.pin :global(.magnet),
		.print,
		.slot,
		.act span {
			transition: none;
		}
	}
</style>
