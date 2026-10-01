<script lang="ts">
	// RSTR landing page, "paper & ink": a sheet of good paper on a plotter
	// bed. The page is warm white with a faint fiber grain, a grid of tiny
	// crosses shows in the margins like the bed under the sheet, and hatched
	// test strokes and registration marks sit at the edges like notes on a
	// calibration sheet. Animations behave like ink: lines draw themselves,
	// stamps press down, prints settle. Each section is its own component in
	// $lib/landing/paper; this file holds the shared look and the lightbox.

	import BrandFooter from '$lib/components/BrandFooter.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Lightbox, { type LightboxImage } from '$lib/landing/Lightbox.svelte';
	import { plotSrc, plotSrcset, type Plot } from '$lib/landing/plots';
	import Hero from '$lib/landing/paper/Hero.svelte';
	import HowItWorks from '$lib/landing/paper/HowItWorks.svelte';
	import MadeWith from '$lib/landing/paper/MadeWith.svelte';
	import Plotter from '$lib/landing/paper/Plotter.svelte';
	import Story from '$lib/landing/paper/Story.svelte';
	import Yours from '$lib/landing/paper/Yours.svelte';

	// clicking any plot or stage picture opens it near-fullscreen
	let lightbox = $state<LightboxImage | null>(null);
	const openPlot = (plot: Plot) => {
		lightbox = {
			src: plotSrc(plot.name, 800),
			srcset: plotSrcset(plot.name),
			full: plotSrc(plot.name, 1920),
			alt: plot.alt
		};
	};
	const openImage = (image: LightboxImage) => (lightbox = image);
</script>

<svelte:head>
	<title>RSTR: turn your favorite pictures into plotter art</title>
	<meta
		name="description"
		content="RSTR redraws any photo or video as hatched line art, right in your browser. Plot it with a pen plotter, print it, or take the layered SVG into your own tools. Free and open source."
	/>
</svelte:head>

<div class="landing">
	<div class="grain" aria-hidden="true"></div>

	<TopBar variant="landing" tagline="turn your best memories into plotter art" />

	<main>
		<Hero onopen={openPlot} />
		<Plotter />
		<HowItWorks onzoom={openImage} />
		<Yours />
		<MadeWith onopen={openPlot} />
		<Story />
	</main>

	<footer class="footer">
		<BrandFooter />
	</footer>
</div>

<Lightbox bind:image={lightbox} />

<style>
	.landing {
		/* d17e.dev house palette */
		--ink: #1a202c;
		--ink-soft: #2d3748;
		--paper: #fdfaff;
		--border: #e1e4e8;
		--muted: #60739f;
		--muted-light: #eef1f6;
		--cyan: #00bfe8;
		--magenta: #ff2aa6;
		--yellow: #ffb000;

		/* paper & ink additions: the sheets (the same paper white the stage
		   renders are drawn on), the plotter bed under them, and the three
		   inks again, deep enough for small text on paper (AA) */
		--sheet: #fffef7;
		--bed: #edf0f5;
		--border-strong: #c7cfdb;
		--cyan-ink: #00728c;
		--magenta-ink: #c4006c;
		--stamp-ink: #df0079;
		--focus: #df0079;

		--wrap: 1120px;
		--gutter: clamp(1rem, 4vw, 2rem);
		--section-pad: clamp(4rem, 8.5vw, 6.5rem);

		/* the edge, borrowed from the riso poster but kept to the boxes and
		   buttons: hard ink outlines with a flat offset shadow, square corners */
		--edge: 2px solid var(--ink);
		--hard: 4px 4px 0 var(--ink);
		--hard-lg: 6px 6px 0 var(--ink);

		--sheet-shadow:
			0 1px 1px rgba(26, 32, 44, 0.06), 0 2px 6px rgba(54, 66, 96, 0.08),
			0 14px 30px -16px rgba(54, 66, 96, 0.34);
		--sheet-shadow-lift:
			0 2px 3px rgba(26, 32, 44, 0.06), 0 10px 18px rgba(54, 66, 96, 0.1),
			0 28px 46px -20px rgba(54, 66, 96, 0.42);

		/* the bed: a tiny cross every 36px */
		--bed-grid: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Cpath d='M18.5 15.5v6M15.5 18.5h6' stroke='%2360739f' stroke-opacity='.42'/%3E%3C/svg%3E");
		/* uneven rubber-stamp ink: mostly solid, with small speckled gaps */
		--grain-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3 0 0 0 2.55'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");

		position: relative;
		/* everything paints above the grain and the grid below */
		isolation: isolate;
		/* margin decorations may poke out; never let them scroll the page */
		overflow-x: clip;
		min-height: 100dvh;
		background: var(--paper);
		color: var(--ink);
		font-family: 'mono-light', monospace;
	}

	/* the bed grid, shown in the margins and faded out under the column;
	   a little lighter than on the beds the prints are pinned to */
	.landing::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		opacity: 0.75;
		background-image: var(--bed-grid);
		background-position: 50% 0;
		-webkit-mask-image: linear-gradient(
			90deg,
			#000 calc(50% - 41rem),
			transparent calc(50% - 36rem),
			transparent calc(50% + 36rem),
			#000 calc(50% + 41rem)
		);
		mask-image: linear-gradient(
			90deg,
			#000 calc(50% - 41rem),
			transparent calc(50% - 36rem),
			transparent calc(50% + 36rem),
			#000 calc(50% + 41rem)
		);
		pointer-events: none;
	}

	/* paper fiber: static noise on one fixed layer, painted once */
	.grain {
		position: fixed;
		inset: 0;
		z-index: -1;
		opacity: 0.07;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .1 0 0 0 0 .13 0 0 0 0 .2 1.3 0 0 0 -.45'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
		pointer-events: none;
	}

	main {
		display: block;
	}

	/* the TopBar sticks over anchored headings, so leave room for it */
	.landing :global(h2[id]) {
		scroll-margin-top: 5rem;
	}

	.footer {
		position: relative;
		padding: 1.25rem var(--gutter) 1.5rem;
		border-top: 1px solid var(--border);
		background: var(--paper);
	}
</style>
