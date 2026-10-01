<script lang="ts">
	// Hero. Left, the pitch; right, the slideshow as a print pinned to the
	// plotter bed with steel magnets and stamped #madewithrstr. The entrance
	// (pen strokes, the underline under "plotter art", the magnets, the
	// stamp) is plain CSS keyed to page load: it needs no JS, ends on the
	// normal layout, and is skipped entirely under reduced motion.
	import HeroCarousel from '$lib/landing/HeroCarousel.svelte';
	import { HERO_PLOTS, type Plot } from '$lib/landing/plots';
	import { HASHTAG } from '$lib/landing/share';
	import Cta from './Cta.svelte';
	import Magnet from './Magnet.svelte';
	import RegMark from './RegMark.svelte';

	const { onopen }: { onopen: (plot: Plot) => void } = $props();

	const USPS = [
		'free & open source',
		'your photos never leave your device',
		'everything you make is yours to keep'
	];
</script>

<section class="hero" aria-labelledby="hero-title">
	<div class="copy">
		<span class="strokes" aria-hidden="true"><i></i><i></i><i></i></span>
		<h1 id="hero-title">
			turn your best memories into
			<span class="underlined"
				>plotter art<svg class="squiggle" viewBox="0 0 300 30" aria-hidden="true"
					><path
						pathLength="1"
						d="M4 19c22-5 47-8 74-8 30 0 52 7 82 7 29 0 46-9 74-10 21-1 41 3 61 9"
					/></svg
				></span
			>
		</h1>
		<p class="lede">
			RSTR redraws any photo or video as hatched line art, right in your browser. Plot it, print it,
			or take the SVG into your own tools.
		</p>
		<ul class="usps">
			{#each USPS as usp, i (usp)}
				<li style="--n: {i}">{usp}</li>
			{/each}
		</ul>
		<div class="ctas">
			<Cta href="/studio">launch RSTR</Cta>
			<Cta href="https://github.com/dxviie/RSTR" variant="ghost" external>view on GitHub</Cta>
		</div>
	</div>

	<div class="bed">
		<RegMark style="top: -11px; left: -11px" />
		<RegMark style="bottom: -11px; right: -11px" />
		<div class="sheet">
			<HeroCarousel
				slides={HERO_PLOTS}
				{onopen}
				sizes="(max-width: 860px) min(80vw, 430px), 360px"
			/>
			<Magnet style="left: 15px; top: 15px" />
			<Magnet style="left: calc(100% - 15px); top: 15px" />
			<Magnet style="left: 15px; top: calc(100% - 15px)" />
			<Magnet style="left: calc(100% - 15px); top: calc(100% - 15px)" />
		</div>
		<a class="stamp" href="#madewithrstr">
			<span class="ink">
				<span class="tag">{HASHTAG}</span>
				<span class="sub">tag your plots</span>
			</span>
		</a>
	</div>
</section>

<style>
	.hero {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
		gap: clamp(2.5rem, 5.5vw, 5.5rem);
		align-items: center;
		max-width: var(--wrap);
		margin: 0 auto;
		padding: clamp(2.75rem, 7vh, 4.75rem) var(--gutter) clamp(3.5rem, 9vh, 6.5rem);
	}

	/* ------------------------------------------------- copy */

	.strokes {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1.4rem;
	}

	.strokes i {
		width: 3.4rem;
		height: 4px;
		border-radius: 2px;
		background: var(--cyan);
		transform: rotate(var(--r, -2deg));
		transform-origin: left center;
		animation: draw-x 0.6s cubic-bezier(0.3, 0.7, 0.3, 1) 0.15s both;
	}

	.strokes i:nth-child(2) {
		--r: 1.5deg;
		background: var(--magenta);
		animation-delay: 0.27s;
	}

	.strokes i:nth-child(3) {
		--r: -1deg;
		background: var(--yellow);
		animation-delay: 0.39s;
	}

	@keyframes draw-x {
		from {
			transform: rotate(var(--r, -2deg)) scaleX(0);
		}
		to {
			transform: rotate(var(--r, -2deg)) scaleX(1);
		}
	}

	h1 {
		font-family: 'mono-bold', monospace;
		font-size: clamp(2.3rem, 4.6vw, 3.75rem);
		line-height: 1.08;
		letter-spacing: -0.012em;
		color: var(--ink);
		animation: rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s both;
	}

	.underlined {
		position: relative;
		display: inline-block;
		white-space: nowrap;
	}

	/* a hand-drawn underline that inks itself in after the headline lands */
	.squiggle {
		position: absolute;
		left: -3%;
		top: 84%;
		width: 106%;
		height: auto;
		overflow: visible;
		pointer-events: none;
	}

	.squiggle path {
		fill: none;
		stroke: var(--magenta);
		stroke-width: 3.4;
		stroke-linecap: round;
		/* dash 1, gap 2 (pathLength 1): the gap outlasts the path, so no
		   round cap dot shows before the line draws */
		stroke-dasharray: 1 2;
		stroke-dashoffset: 0;
		animation: ink-in 0.95s cubic-bezier(0.55, 0, 0.3, 1) 0.8s both;
	}

	@keyframes ink-in {
		from {
			stroke-dashoffset: 1;
		}
	}

	.lede {
		max-width: 31rem;
		margin-top: 1.6rem;
		font-family: 'serif-text', serif;
		font-size: 1.13rem;
		line-height: 1.6;
		color: var(--ink-soft);
		animation: rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 0.28s both;
	}

	.usps {
		display: grid;
		gap: 0.5rem;
		margin: 1.4rem 0 0;
		padding: 0;
		list-style: none;
	}

	.usps li {
		position: relative;
		padding-left: 1.65rem;
		font-family: 'serif-text', serif;
		font-size: 0.95rem;
		color: var(--ink-soft);
		animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
		animation-delay: calc(0.4s + var(--n) * 0.08s);
	}

	/* each bullet is a tiny hatched test swatch in one of the three inks */
	.usps li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.38em;
		width: 1rem;
		height: 0.72rem;
		border-radius: 1px;
		background: repeating-linear-gradient(
			-50deg,
			var(--c, var(--cyan)) 0 1.5px,
			transparent 1.5px 3.6px
		);
	}

	.usps li:nth-child(2) {
		--c: var(--magenta);
	}

	.usps li:nth-child(3) {
		--c: var(--yellow);
	}

	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2.1rem;
		animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.62s both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}

	/* ------------------------------------------------- the print on the bed */

	.bed {
		position: relative;
		padding: clamp(1.1rem, 2.4vw, 1.9rem);
		border-radius: 16px;
		background-color: var(--bed);
		background-image: var(--bed-grid);
		background-position: center;
		box-shadow:
			inset 0 0 0 1px rgba(96, 115, 159, 0.13),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
	}

	.sheet {
		position: relative;
		padding: 30px 30px 14px;
		background: var(--sheet);
		box-shadow: var(--sheet-shadow);
		animation: settle 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s both;

		--hc-max-width: none;
		--hc-aspect: 4 / 5;
		/* each photo brings its own zoom (framing in plots.ts); this taller
		   frame needs a touch more of it to keep the sheet edges out */
		--hc-zoom: 1.24;
		--hc-zoom-boost: 1.06;
		--hc-radius: 0;
		--hc-shadow: 0 0 0 1px rgba(26, 32, 44, 0.07);
		--hc-frame-bg: #f3f0e8;
		--hc-ink: var(--ink);
		--hc-muted: var(--muted);
		--hc-accent: var(--magenta);
		--hc-btn-bg: var(--sheet);
		--hc-btn-hover: var(--muted-light);
		--hc-btn-border: #d9dee7;
	}

	/* the shared controls are a little small for a thumb: 40px and up */
	.sheet :global(.hc-btn) {
		width: 2.5rem;
		height: 2.5rem;
	}

	.sheet :global(.hc-play) {
		width: 2.85rem;
		height: 2.85rem;
	}

	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(16px) rotate(0.8deg);
		}
	}

	/* the magnets click onto the sheet one after another */
	.sheet :global(.magnet) {
		animation: snap 0.36s cubic-bezier(0.3, 1.6, 0.5, 1) both;
		animation-delay: 0.95s;
	}

	.sheet :global(.magnet:nth-of-type(2)) {
		animation-delay: 1.05s;
	}

	.sheet :global(.magnet:nth-of-type(3)) {
		animation-delay: 1.15s;
	}

	.sheet :global(.magnet:nth-of-type(4)) {
		animation-delay: 1.25s;
	}

	@keyframes snap {
		from {
			opacity: 0;
			transform: translate(-3px, -5px) scale(1.35);
		}
	}

	/* ------------------------------------------------- the rubber stamp */

	.stamp {
		position: absolute;
		z-index: 4;
		left: -0.9rem;
		bottom: 5.4rem;
		display: block;
		padding: 0.32rem;
		border: none;
		border-radius: 9px;
		background: var(--sheet);
		color: var(--stamp-ink);
		text-decoration: none;
		box-shadow:
			0 1px 1px rgba(26, 32, 44, 0.08),
			0 6px 16px -6px rgba(26, 32, 44, 0.35);
		transform: rotate(-7deg);
		animation: stamp 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 1.45s both;
		transition:
			transform 0.25s cubic-bezier(0.3, 0.7, 0.3, 1),
			box-shadow 0.25s ease;
	}

	.stamp:hover {
		transform: rotate(-4deg) translateY(-2px);
		box-shadow:
			0 1px 1px rgba(26, 32, 44, 0.08),
			0 10px 22px -8px rgba(26, 32, 44, 0.4);
	}

	.stamp:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	/* the impression: a double rule and the tag, in uneven, grainy ink */
	.ink {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.12rem;
		padding: 0.5rem 0.85rem 0.45rem;
		border: 2.5px solid currentColor;
		border-radius: 6px;
		box-shadow:
			inset 0 0 0 2.5px var(--sheet),
			inset 0 0 0 3.5px currentColor;
		-webkit-mask-image: var(--grain-mask);
		mask-image: var(--grain-mask);
		-webkit-mask-size: 150px 150px;
		mask-size: 150px 150px;
	}

	.tag {
		font-family: 'mono-bold', monospace;
		font-size: 1.2rem;
		line-height: 1.15;
		letter-spacing: 0.01em;
	}

	.sub {
		font-family: 'mono-bold', monospace;
		font-size: 0.6rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	/* inked and pressed: comes down big and fast, lands a hair past, settles */
	@keyframes stamp {
		0% {
			opacity: 0;
			transform: rotate(-15deg) scale(1.9);
		}
		55% {
			opacity: 1;
			transform: rotate(-7deg) scale(0.95);
		}
		78% {
			transform: rotate(-7deg) scale(1.02);
		}
		100% {
			opacity: 1;
			transform: rotate(-7deg) scale(1);
		}
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 860px) {
		.hero {
			grid-template-columns: 1fr;
			gap: 2.75rem;
		}

		.bed {
			max-width: 34rem;
			width: 100%;
			margin-inline: auto;
		}
	}

	@media (max-width: 520px) {
		.sheet {
			padding: 22px 22px 10px;
		}

		.lede {
			font-size: 1.05rem;
		}

		.stamp {
			left: -0.4rem;
			bottom: 4.6rem;
		}

		.tag {
			font-size: 1.05rem;
		}

		.sub {
			font-size: 0.56rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.strokes i,
		h1,
		.squiggle path,
		.lede,
		.usps li,
		.ctas,
		.sheet,
		.sheet :global(.magnet),
		.stamp {
			animation: none;
		}

		.stamp {
			transition: none;
		}
	}
</style>
