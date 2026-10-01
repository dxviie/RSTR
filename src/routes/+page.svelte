<script lang="ts">
	// RSTR landing page. The first sections speak to everyone (make art from
	// your images); the plotter details, the open-source story and the
	// origin live further down. Plot photography lives in static/gallery as
	// pre-sized -400w / -800w / -1920w webp renditions of each shot.

	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import BrandFooter from '$lib/components/BrandFooter.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import HeroCarousel from '$lib/landing/HeroCarousel.svelte';
	import Lightbox, { type LightboxImage } from '$lib/landing/Lightbox.svelte';
	import { GALLERY_PLOTS, HERO_PLOTS, plotSrc, plotSrcset, type Plot } from '$lib/landing/plots';
	import { CONTACT_FORM, HASHTAG, SHARE_LINKS } from '$lib/landing/share';

	const PLOTTER_IMAGE = '/plotter.png';

	// #madewithrstr gallery: only a window of the plots is on screen at once
	// (fewer on mobile), and every so often one visible tile crossfades to a
	// plot that was off-screen. Swaps fire on independent, jittered timers so
	// they never all change at once — the wall feels alive, not synchronized.
	const GALLERY_DESKTOP = 8;
	const GALLERY_MOBILE = 6;

	// deterministic first-paint fill so SSR and hydration agree; the client
	// narrows it to the viewport and starts cycling in onMount.
	let gallerySlots = $state(Array.from({ length: GALLERY_DESKTOP }, (_, i) => i));

	const hiddenPlots = (slots: number[]) => {
		const shown = new Set(slots);
		return GALLERY_PLOTS.map((_, i) => i).filter((i) => !shown.has(i));
	};

	onMount(() => {
		const mobile = window.matchMedia('(max-width: 820px)');
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

		// match the visible count to the viewport, keeping the tiles we already
		// show and topping up (or trimming) from the off-screen pool.
		const resize = () => {
			const target = mobile.matches ? GALLERY_MOBILE : GALLERY_DESKTOP;
			if (target === gallerySlots.length) return;
			if (target < gallerySlots.length) {
				gallerySlots = gallerySlots.slice(0, target);
			} else {
				const pool = hiddenPlots(gallerySlots);
				const extra: number[] = [];
				while (gallerySlots.length + extra.length < target && pool.length) {
					extra.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
				}
				gallerySlots = [...gallerySlots, ...extra];
			}
		};
		resize();
		mobile.addEventListener('change', resize);

		if (reduce.matches) {
			return () => mobile.removeEventListener('change', resize);
		}

		// fetch the rendition the tile will use before swapping, so the new
		// image is decoded and the crossfade never flashes an empty frame.
		const swap = () => {
			const pool = hiddenPlots(gallerySlots);
			if (pool.length) {
				const slot = Math.floor(Math.random() * gallerySlots.length);
				const pick = pool[Math.floor(Math.random() * pool.length)];
				const name = GALLERY_PLOTS[pick].name;
				const pre = new Image();
				pre.sizes = '(max-width: 820px) 46vw, 250px';
				pre.srcset = plotSrcset(name);
				pre.onload = pre.onerror = () => {
					const next = gallerySlots.slice();
					next[slot] = pick;
					gallerySlots = next;
				};
				pre.src = plotSrc(name, 400);
			}
			timer = setTimeout(swap, 1300 + Math.random() * 2400);
		};
		let timer = setTimeout(swap, 1300 + Math.random() * 2400);

		return () => {
			clearTimeout(timer);
			mobile.removeEventListener('change', resize);
		};
	});

	const STEPS = [
		{
			title: 'drop an image or video',
			text: 'Any photo or video works, and it never leaves your browser. Everything runs on your own machine.'
		},
		{
			title: 'shape the lines',
			text: 'RSTR splits your image into regions and redraws them as lines. Play with colors, angles, spacing and density. Or roll the dice until something clicks.'
		},
		{
			title: 'take it home',
			text: 'Save a PNG to share or print, or export a layered SVG that a pen plotter can draw with real ink on real paper.'
		}
	];

	const USPS = [
		'free & open source',
		'your photos never leave your device',
		'everything you make is yours to keep'
	];

	// clicking any plot opens it near-fullscreen
	let lightbox = $state<LightboxImage | null>(null);
	const openPlot = (plot: Plot) => {
		lightbox = {
			src: plotSrc(plot.name, 800),
			srcset: plotSrcset(plot.name),
			full: plotSrc(plot.name, 1920),
			alt: plot.alt
		};
	};
</script>

<svelte:head>
	<title>RSTR: turn your favorite pictures into plotter art</title>
	<meta
		name="description"
		content="RSTR turns your best memories into hatched line art. Print it, share it, or plot it with a pen plotter. Free, instant, and it all happens in your browser."
	/>
</svelte:head>

<div class="landing">
	<TopBar variant="landing" tagline="turn your best memories into plotter art" />

	<main>
		<!-- hero + USP -->
		<section class="hero">
			<div class="hero-copy">
				<div class="hatch-strip" aria-hidden="true">
					<span class="c"></span><span class="m"></span><span class="y"></span>
				</div>
				<h1>turn your best memories into plotter art</h1>
				<p class="lede">
					RSTR redraws any picture as hatched line art.<br />
					Made in your browser, ready to print, share, or hand to a pen plotter.
				</p>
				<ul class="usp-list">
					{#each USPS as usp (usp)}
						<li>{usp}</li>
					{/each}
				</ul>
				<div class="cta-row">
					<a class="btn primary" href="/studio">launch RSTR</a>
					<a class="btn ghost" href="https://github.com/dxviie/RSTR">view on GitHub</a>
				</div>
			</div>
			<figure class="hero-figure">
				<HeroCarousel slides={HERO_PLOTS} onopen={openPlot} />
				<figcaption class="hero-caption">{HASHTAG}</figcaption>
			</figure>
		</section>

		<!-- how it works -->
		<section class="steps-section" id="how">
			<h2>how it works</h2>
			<ol class="steps">
				{#each STEPS as step, index (step.title)}
					<li>
						<div class="step-head">
							<span class="step-number">{index + 1}</span>
							<h3>{step.title}</h3>
						</div>
						<p>{step.text}</p>
					</li>
				{/each}
			</ol>
			<div class="plot-service">
				<h3>don't own a plotter?</h3>
				<p>
					I can plot yours for you. Make something in the studio, then hit
					<strong>⚡ order this plot</strong> and I'll draw it with real pens on real paper and ship it
					to your door.
				</p>
			</div>
		</section>

		<!-- ownership + open source -->
		<section class="yours">
			<div class="hatch-strip" aria-hidden="true">
				<span class="c"></span><span class="m"></span><span class="y"></span>
			</div>
			<h2>everything you make is yours</h2>
			<p>
				Whatever you create with RSTR belongs to you: personal projects, gifts, client work, prints
				or plots you sell. Commercial use included, no strings attached. All processing happens in
				your browser.
			</p>
			<p>
				The tool itself is open too. The source code is on
				<a href="https://github.com/dxviie/RSTR" target="_blank" rel="noopener">GitHub</a>, licensed
				under the GPL.
			</p>
		</section>

		<!-- #madewithrstr -->
		<section class="gallery-section">
			<h2>{HASHTAG}</h2>
			<p class="gallery-lede">
				A few of mine. Photos run through RSTR, then drawn with real pens on real paper.
			</p>
			<div class="gallery">
				{#each gallerySlots as plotIndex, slot (slot)}
					<div class="gallery-item">
						{#key plotIndex}
							<button
								type="button"
								class="zoom"
								aria-label="open plot: {GALLERY_PLOTS[plotIndex].alt}"
								onclick={() => openPlot(GALLERY_PLOTS[plotIndex])}
								in:fade={{ duration: 500 }}
								out:fade={{ duration: 500 }}
							>
								<img
									src={plotSrc(GALLERY_PLOTS[plotIndex].name, 400)}
									srcset={plotSrcset(GALLERY_PLOTS[plotIndex].name)}
									sizes="(max-width: 820px) 46vw, 250px"
									alt={GALLERY_PLOTS[plotIndex].alt}
									loading="lazy"
								/>
							</button>
						{/key}
					</div>
				{/each}
			</div>
			<p class="gallery-more">
				More plots and works in progress over at
				<a href="https://d17e.dev/projects/rstr/" target="_blank" rel="noopener"
					>d17e.dev/projects/rstr</a
				>.
			</p>
			<div class="community">
				<h3>your turn</h3>
				<p>
					Made something with RSTR, plotted, printed, or straight off the screen? Post it with
					<strong>{HASHTAG}</strong> and tag me so other people can find it. A community gallery is going
					up right here, and I'd like yours in it.
				</p>
				<ul class="share-links">
					{#each SHARE_LINKS as link (link.id)}
						<li>
							<a href={link.href} target="_blank" rel="noopener">{link.label} {link.handle}</a>
						</li>
					{/each}
					<li>
						<a href={CONTACT_FORM} target="_blank" rel="noopener">or send it to me directly</a>
					</li>
				</ul>
			</div>
		</section>

		<!-- story + artist + closing cta -->
		<section class="origin">
			<div class="hatch-strip" aria-hidden="true">
				<span class="c"></span><span class="m"></span><span class="y"></span>
			</div>
			<h2>the story</h2>
			<p>
				RSTR started as a sketch for the Genuary '24 prompt
				<a href="https://genuary24.d17e.dev/?prompt=5" target="_blank" rel="noopener"
					><em>"In the style of Vera Molnár (1924-2023)"</em></a
				>, and never really stopped. One experiment turned into the studio you see now. The
				<a href="/classic">original version</a> still runs if you're feeling nostalgic.
			</p>
			<p>
				It's made by me, David Vandenbogaerde (or <a
					href="https://www.d17e.dev"
					target="_blank"
					rel="noopener">d17e</a
				>
				for short), a software engineer and artist living in Amsterdam 🇳🇱. Ever since I got a plotter,
				I've been looking for new ways to turn images into something it can draw.<br />
				That's why RSTR exists. I hope you like it.
			</p>
			<div class="cta-row center">
				<a class="btn primary" href="/studio">launch RSTR</a>
			</div>
		</section>

		<!-- what's a plotter -->
		<section class="split">
			<div class="split-copy">
				<h2>what's a plotter?</h2>
				<p>
					A pen plotter is a machine that draws by moving a real pen across paper along vector
					paths. It can't color in shapes the way software does. To get a colored square you draw a
					lot of lines next to each other, tight for a solid block, spaced further apart for a
					lighter shade. That technique is called
					<a href="https://en.wikipedia.org/wiki/Hatching" target="_blank" rel="noopener"
						><em>hatching</em></a
					>, and it's probably as old as drawing itself.
				</p>
				<p>
					RSTR does the hatching for you. It splits your image into regions of similar tone and
					fills each one with lines, dense where the image is dark, sparse where it's light. What
					comes out is your picture rebuilt entirely from straight lines.
				</p>
				<p class="aside">
					Curious about plotter art? Have a look at the
					<a href="https://d17e.dev/projects/plotter-art/" target="_blank" rel="noopener"
						>plotter art project</a
					> on d17e.dev.
				</p>
			</div>
			<figure class="split-art">
				<img src={PLOTTER_IMAGE} alt="An AxiDraw SE/A3 pen plotter" loading="lazy" />
				<figcaption>
					the robot friend: an
					<a href="https://shop.evilmadscientist.com/908" target="_blank" rel="noopener"
						>AxiDraw SE/A3</a
					>
				</figcaption>
			</figure>
		</section>
	</main>

	<footer class="footer">
		<BrandFooter />
	</footer>
</div>

<Lightbox bind:image={lightbox} />

<style>
	/* Landing page in the d17e.dev brand. Normal document flow — the page
	   scrolls with the body, so there is exactly one scrollbar. */
	.landing {
		--ink: #1a202c;
		--ink-soft: #2d3748;
		--bg: #fdfaff;
		--border: #e1e4e8;
		--muted: #60739f;
		--muted-light: #eef1f6;
		--cyan: #00bfe8;
		--magenta: #ff2aa6;
		--yellow: #ffb000;

		min-height: 100dvh;
		background: var(--bg);
		color: var(--ink);
		font-family: 'mono-light', monospace;
	}

	.landing a {
		border: none;
		color: var(--ink);
	}

	.landing main {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	h1,
	h2,
	h3 {
		font-family: 'mono-bold', monospace;
		letter-spacing: 0.02em;
		margin: 0;
	}

	p {
		font-family: 'serif-text', serif;
		line-height: 1.65;
	}

	em {
		font-style: italic;
	}

	/* ------------------------------------------------- shared bits */

	.hatch-strip {
		display: flex;
		gap: 0.35rem;
		margin-bottom: 1rem;
	}

	.hatch-strip span {
		height: 4px;
		width: 3.5rem;
		border-radius: 2px;
	}

	.hatch-strip .c {
		background: var(--cyan);
		transform: rotate(-2deg);
	}

	.hatch-strip .m {
		background: var(--magenta);
		transform: rotate(1.5deg);
	}

	.hatch-strip .y {
		background: var(--yellow);
		transform: rotate(-1deg);
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.75rem;
	}

	.cta-row.center {
		justify-content: center;
	}

	.btn {
		font-family: 'mono-bold', monospace;
		font-size: 0.85rem;
		padding: 0.6rem 1.4rem;
		border-radius: 999px;
		transition:
			background 0.1s ease,
			transform 0.1s ease;
	}

	.btn:active {
		transform: scale(0.97);
	}

	.btn.primary {
		background: var(--ink);
		color: var(--bg);
		border: 1px solid var(--ink);
	}

	.btn.primary:hover {
		background: var(--ink-soft);
		color: #fff;
	}

	.btn.ghost {
		border: 1px solid var(--border);
		color: var(--ink);
	}

	.btn.ghost:hover {
		border-color: var(--ink);
		background: var(--muted-light);
	}

	section {
		padding: 4.5rem 0;
		border-bottom: 1px solid var(--border);
	}

	section:last-of-type {
		border-bottom: none;
	}

	h2 {
		font-size: 1.6rem;
		margin-bottom: 1.25rem;
	}

	/* inline links inside body copy keep a subtle dashed underline */
	.landing p a {
		border-bottom: 1px dashed var(--muted);
	}

	.landing p a:hover {
		border-color: var(--ink);
	}

	/* ------------------------------------------------- hero */

	.hero {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 3rem;
		align-items: center;
		padding-top: 4.5rem;
	}

	.hero h1 {
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		line-height: 1.1;
	}

	.lede {
		font-size: 1.05rem;
		color: var(--ink-soft);
		margin-top: 1.25rem;
		max-width: 34rem;
	}

	.usp-list {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.usp-list li {
		font-family: 'serif-text', serif;
		font-size: 0.92rem;
		color: var(--ink-soft);
		padding-left: 1.4rem;
		position: relative;
	}

	.usp-list li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.52em;
		width: 0.85rem;
		height: 4px;
		border-radius: 2px;
		background: var(--cyan);
		transform: rotate(-8deg);
	}

	.usp-list li:nth-child(2)::before {
		background: var(--magenta);
		transform: rotate(6deg);
	}

	.usp-list li:nth-child(3)::before {
		background: var(--yellow);
		transform: rotate(-5deg);
	}

	.hero-figure {
		margin: 0;
	}

	.hero-caption {
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		color: var(--muted);
		text-align: center;
		margin-top: 0.6rem;
	}

	/* ------------------------------------------------- split section */

	.split {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 3rem;
		align-items: center;
	}

	.split-copy p {
		max-width: 36rem;
		margin: 0 0 1rem;
	}

	.aside {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.split-art {
		margin: 0;
	}

	.split-art img {
		width: 100%;
		height: auto;
		box-shadow:
			0 2px 6px rgba(96, 115, 159, 0.25),
			0 8px 24px rgba(96, 115, 159, 0.2);
	}

	.split-art figcaption {
		font-family: 'serif-text', serif;
		font-size: 0.75rem;
		color: var(--muted);
		text-align: center;
		margin-top: 0.5rem;
	}

	.split-art figcaption a {
		border-bottom: 1px dashed var(--muted);
	}

	.split-art figcaption a:hover {
		border-color: var(--ink);
	}

	/* ------------------------------------------------- steps */

	.steps-section {
		display: grid;
	}

	.steps {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2rem;
		list-style: none;
		margin: 0;
		padding: 0;
		counter-reset: step;
	}

	.steps li {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		padding: 1.25rem;
	}

	.step-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.6rem;
	}

	.step-number {
		font-family: 'mono-bold', monospace;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		border-radius: 999px;
		background: var(--muted-light);
	}

	.steps li:nth-child(1) .step-number {
		box-shadow: inset 0 -3px 0 var(--cyan);
	}

	.steps li:nth-child(2) .step-number {
		box-shadow: inset 0 -3px 0 var(--magenta);
	}

	.steps li:nth-child(3) .step-number {
		box-shadow: inset 0 -3px 0 var(--yellow);
	}

	.steps h3 {
		font-size: 0.95rem;
		margin: 0;
	}

	.steps p {
		font-size: 0.9rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.plot-service {
		max-width: 46rem;
		justify-self: center;
		margin-top: 2rem;
		border: 1px dashed var(--muted);
		border-radius: 8px;
		padding: 1.5rem;
		background: #fff;
	}

	.plot-service h3 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}

	.plot-service p {
		margin: 0;
		color: var(--ink-soft);
	}

	.plot-service strong {
		font-family: 'mono-bold', monospace;
		font-size: 0.9em;
	}

	/* ------------------------------------------------- yours (ownership) */

	.yours {
		text-align: center;
	}

	.yours .hatch-strip {
		justify-content: center;
	}

	.yours p {
		max-width: 38rem;
		margin: 0 auto 1rem;
		color: var(--ink-soft);
	}

	/* ------------------------------------------------- gallery */

	.gallery-lede {
		color: var(--ink-soft);
		margin-top: -0.5rem;
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.gallery-item {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		background: #fffef7;
		box-shadow: 0 2px 8px rgba(96, 115, 159, 0.2);
	}

	.gallery-item .zoom {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
	}

	.gallery-item img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* zoomed in by default so the photographed paper/desk margins stay
		   cropped; eases out slightly on hover, but never far enough to
		   bring them back in */
		transform: scale(1.16);
		transition: transform 0.5s ease;
	}

	.gallery-item:hover img {
		transform: scale(1.11);
	}

	.gallery-more {
		font-size: 0.85rem;
		color: var(--muted);
		margin-top: 1.25rem;
	}

	.community {
		max-width: 46rem;
		margin: 2.5rem auto 0;
		border: 1px dashed var(--muted);
		border-radius: 8px;
		padding: 1.5rem;
		background: #fff;
	}

	.community h3 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}

	.community p {
		margin: 0;
		max-width: 44rem;
		color: var(--ink-soft);
	}

	.community strong {
		font-family: 'mono-bold', monospace;
		font-size: 0.9em;
	}

	.share-links {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		margin: 0.9rem 0 0;
		padding: 0;
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
	}

	.share-links a {
		border-bottom: 1px dashed var(--muted);
	}

	.share-links a:hover {
		border-color: var(--magenta);
	}

	/* ------------------------------------------------- origin / story */

	.origin {
		text-align: center;
	}

	.origin .hatch-strip {
		justify-content: center;
	}

	.origin p {
		max-width: 38rem;
		margin: 0 auto 1rem;
		color: var(--ink-soft);
	}

	/* ------------------------------------------------- footer */

	.footer {
		border-top: 1px solid var(--border);
		padding: 1rem 1.5rem;
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 820px) {
		.hero,
		.split {
			grid-template-columns: 1fr;
			gap: 2rem;
		}

		.hero {
			padding-top: 2.5rem;
		}

		.steps {
			grid-template-columns: 1fr;
		}

		.gallery {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
