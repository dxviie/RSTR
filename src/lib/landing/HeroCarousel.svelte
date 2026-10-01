<script lang="ts">
	// Auto-advancing slideshow of plot photos for the landing hero.
	//
	// Slides sit on top of each other and crossfade. While a slide is on
	// show (and while it fades out) its picture drifts: a slow, linear pan
	// at a constant zoom, run on the compositor. A constant zoom matters
	// with this artwork: scaling fine hatching while it animates makes the
	// lines shimmer, a pan doesn't. The zoom also keeps the photographed
	// paper and desk margins cropped out of the frame.
	//
	// Timing lives in the Carousel controller: decode before show, pause /
	// play, holds while hovered, focused, off screen or in a hidden tab, and
	// starts paused under prefers-reduced-motion (which also drops the drift).
	//
	// Theme it from the outside with the --hc-* custom properties below.
	import { onMount, type Snippet } from 'svelte';
	import { Carousel } from './carousel.svelte';
	import { plotSrc, plotSrcset, shuffleTail, type Plot } from './plots';

	const {
		slides,
		onopen,
		label = 'plots made with RSTR',
		sizes = '(max-width: 820px) 92vw, 480px',
		interval = 5000,
		fade = 1200,
		shuffle = true,
		controls = true,
		children
	}: {
		slides: Plot[];
		onopen?: (plot: Plot) => void;
		label?: string;
		sizes?: string;
		interval?: number;
		fade?: number;
		/** shuffle all but the first slide on the client */
		shuffle?: boolean;
		controls?: boolean;
		/** overlay content inside the frame (badges, captions) */
		children?: Snippet;
	} = $props();

	// server and first client render share one order; the client reshuffles
	// once on mount, so each visit opens on the same picture and then varies
	let order = $derived(slides);
	onMount(() => {
		if (shuffle) order = shuffleTail(slides);
	});

	// svelte-ignore state_referenced_locally
	const carousel = new Carousel({ count: slides.length, interval, fade });

	// pan directions, cycled per slide so consecutive slides drift differently
	const DRIFTS = [
		['-2.4%', '-1.4%', '2.4%', '1.4%'],
		['2.2%', '-1.8%', '-2.2%', '1.8%'],
		['0%', '2.4%', '0%', '-2.4%'],
		['-1.8%', '2.2%', '1.8%', '-2.2%']
	];
	const driftStyle = (index: number) => {
		const [x0, y0, x1, y1] = DRIFTS[index % DRIFTS.length];
		return `--x0: ${x0}; --y0: ${y0}; --x1: ${x1}; --y1: ${y1}`;
	};
</script>

<div
	class="hc"
	class:paused={!carousel.running}
	style="--hc-fade: {fade}ms; --hc-interval: {interval}ms"
	role="region"
	aria-roledescription="carousel"
	aria-label={label}
	use:carousel.root
>
	<div class="hc-frame" aria-live={carousel.running ? 'off' : 'polite'}>
		{#each order as plot, index (plot.name)}
			{#if carousel.isMounted(index)}
				<button
					type="button"
					class="hc-slide"
					class:current={index === carousel.current}
					class:leaving={index === carousel.leaving}
					style={driftStyle(index)}
					aria-hidden={index !== carousel.current}
					tabindex={index === carousel.current ? 0 : -1}
					aria-label="open plot {index + 1} of {order.length}: {plot.alt}"
					onclick={() => onopen?.(plot)}
				>
					<img
						src={plotSrc(plot.name, 800)}
						srcset={plotSrcset(plot.name)}
						{sizes}
						alt={plot.alt}
						decoding="async"
						fetchpriority={index === 0 ? 'high' : 'auto'}
						use:carousel.slide={index}
					/>
				</button>
			{/if}
		{/each}
		{@render children?.()}
	</div>

	{#if controls}
		<div class="hc-controls">
			<button
				type="button"
				class="hc-btn"
				aria-label="previous plot"
				title="previous"
				onclick={carousel.prev}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
			</button>
			<button
				type="button"
				class="hc-btn hc-play"
				aria-label={carousel.paused ? 'play slideshow' : 'pause slideshow'}
				title={carousel.paused ? 'play' : 'pause'}
				onclick={carousel.toggle}
			>
				{#key carousel.cycle}
					<svg class="hc-ring" viewBox="0 0 36 36" aria-hidden="true">
						<circle cx="18" cy="18" r="16" pathLength="100" />
					</svg>
				{/key}
				<svg class="hc-icon" viewBox="0 0 16 16" aria-hidden="true">
					{#if carousel.paused}
						<path class="fill" d="M5 3.2v9.6L13 8z" />
					{:else}
						<path d="M5.5 3.5v9M10.5 3.5v9" />
					{/if}
				</svg>
			</button>
			<button
				type="button"
				class="hc-btn"
				aria-label="next plot"
				title="next"
				onclick={carousel.next}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
			</button>
			<span class="hc-count" aria-hidden="true">
				{String(carousel.current + 1).padStart(2, '0')}<span class="hc-of">/</span>{String(
					order.length
				).padStart(2, '0')}
			</span>
		</div>
	{/if}
</div>

<style>
	.hc {
		--ink: var(--hc-ink, #1a202c);
		--muted: var(--hc-muted, #60739f);
		--accent: var(--hc-accent, #ff2aa6);
		--frame-bg: var(--hc-frame-bg, #fffef7);
		--btn-bg: var(--hc-btn-bg, transparent);
		--btn-hover: var(--hc-btn-hover, #eef1f6);
		--btn-border: var(--hc-btn-border, #e1e4e8);

		position: relative;
		width: 100%;
		max-width: var(--hc-max-width, 480px);
		margin: 0 auto;
	}

	.hc-frame {
		position: relative;
		width: 100%;
		aspect-ratio: var(--hc-aspect, 1);
		overflow: hidden;
		border-radius: var(--hc-radius, 0);
		background: var(--frame-bg);
		/* the shadow lives on the frame, so it doesn't pulse while two
		   slides crossfade */
		box-shadow: var(
			--hc-shadow,
			0 2px 6px rgba(96, 115, 159, 0.25),
			0 12px 32px rgba(96, 115, 159, 0.2)
		);
		/* own compositing layer: the fades and drifts never repaint the page */
		isolation: isolate;
	}

	.hc-slide {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 0;
		border: none;
		background: none !important;
		overflow: hidden;
		opacity: 0;
		/* only the visible slide takes the click */
		pointer-events: none;
		cursor: zoom-in;
		transition: opacity var(--hc-fade) ease-in-out;
	}

	/* the incoming slide fades in on top while the outgoing one stays fully
	   opaque underneath, so the crossfade never dips to the frame color */
	.hc-slide.current {
		opacity: 1;
		pointer-events: auto;
		z-index: 1;
	}

	.hc-slide.leaving {
		opacity: 1;
	}

	.hc-slide:focus-visible {
		outline: 3px solid var(--accent);
		outline-offset: -3px;
	}

	.hc-slide img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(var(--hc-zoom, 1.2));
		will-change: transform;
		backface-visibility: hidden;
	}

	/* the drift runs for the whole time a slide is visible, fades included,
	   so it never stops or snaps on screen */
	.hc-slide.current img,
	.hc-slide.leaving img {
		animation: hc-drift calc(var(--hc-interval) + 2 * var(--hc-fade)) linear both;
	}

	.paused .hc-slide img {
		animation-play-state: paused;
	}

	@keyframes hc-drift {
		from {
			transform: translate3d(var(--x0), var(--y0), 0) scale(var(--hc-zoom, 1.2));
		}
		to {
			transform: translate3d(var(--x1), var(--y1), 0) scale(var(--hc-zoom, 1.2));
		}
	}

	/* ------------------------------------------------- controls */

	.hc-controls {
		display: flex;
		align-items: center;
		justify-content: var(--hc-controls-justify, center);
		gap: 0.4rem;
		margin-top: 0.75rem;
	}

	.hc-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 2.1rem;
		padding: 0;
		border: 1px solid var(--btn-border);
		border-radius: 999px;
		background: var(--btn-bg);
		color: var(--ink);
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.15s ease;
	}

	.hc-btn:hover {
		background: var(--btn-hover) !important;
		color: var(--ink) !important;
		border-color: var(--ink);
	}

	.hc-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.hc-btn svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.hc-btn svg .fill {
		fill: currentColor;
		stroke: none;
	}

	.hc-play {
		width: 2.5rem;
		height: 2.5rem;
	}

	/* progress ring around the pause button: fills over one slide and
	   pauses with the show */
	.hc-ring {
		position: absolute;
		inset: -1px;
		width: calc(100% + 2px) !important;
		height: calc(100% + 2px) !important;
		transform: rotate(-90deg);
		pointer-events: none;
	}

	.hc-ring circle {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.2;
		stroke-dasharray: 100;
		stroke-dashoffset: 100;
		animation: hc-progress var(--hc-interval) linear forwards;
	}

	.paused .hc-ring circle {
		animation-play-state: paused;
	}

	/* paused by the visitor (not just held): dim the ring where it stopped */
	.hc-play[aria-label='play slideshow'] .hc-ring {
		opacity: 0.35;
	}

	@keyframes hc-progress {
		to {
			stroke-dashoffset: 0;
		}
	}

	.hc-count {
		font-family: 'mono-bold', monospace;
		font-size: 0.75rem;
		color: var(--muted);
		margin-left: 0.35rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}

	.hc-of {
		margin: 0 0.2em;
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: reduce) {
		.hc-slide img {
			animation: none !important;
		}

		.hc-slide {
			transition-duration: 0.25s;
		}
	}
</style>
