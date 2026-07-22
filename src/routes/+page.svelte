<script lang="ts">
	// RSTR landing page. The first sections speak to everyone (make art from
	// your images); the plotter details, the open-source story and the
	// origin live further down. Plot photography lives in static/gallery as
	// pre-sized -400w / -800w / -1920w webp renditions of each shot.

	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import BrandFooter from '$lib/components/BrandFooter.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	const PLOTTER_IMAGE = '/plotter.png';

	const plotSrc = (name: string, width: number) => `/gallery/${name}-${width}w.webp`;
	const plotSrcset = (name: string) =>
		[400, 800, 1920].map((w) => `${plotSrc(name, w)} ${w}w`).join(', ');

	// gallery order: full pieces and detail shots interleaved. The grid only
	// shows a window of these at a time (see GALLERY_* below) and cycles the
	// rest in over time, so the first-paint order also seeds that window.
	const GALLERY_PLOTS = [
		{
			name: 'space-1-1',
			alt: 'plot of the Cosmic Cliffs of the Carina Nebula in layered colored pens'
		},
		{
			name: 'lia-1',
			alt: 'a child standing in a field of red poppies, rebuilt in dense multicolor hatching'
		},
		{
			name: 'pearl-1',
			alt: 'Girl with a Pearl Earring rebuilt from blocks of directional hatching'
		},
		{ name: 'street-1', alt: 'a canal bridge and townscape plotted in layered colour hatching' },
		{ name: 'mona-1', alt: 'figure and its long shadow on a path, in dense multicolor crosshatch' },
		{ name: 'path-1', alt: 'two figures by a mountain lake, rebuilt from fine pen hatching' },
		{ name: 'melkmeisje', alt: "Vermeer's Milkmaid plotted in single-pen black hatching" },
		{ name: 'webb-1', alt: 'a nebula plotted in bands of purple, gold and red with bright stars' },
		{
			name: 'puma-1',
			alt: "a puma's face rebuilt in dense multicolor pen hatching, with bright yellow eyes"
		},
		{
			name: 'siesta-1',
			alt: 'a dog resting in a sunlit garden, rebuilt in warm multicolor hatching'
		},
		{
			name: 'weave-1',
			alt: 'a portrait of a bearded man rebuilt in woven blocks of colored pen hatching'
		},
		{
			name: 'broken-gradient-2',
			alt: 'abstract gradient study — a dark monolith over a teal-to-magenta field'
		},
		{ name: 'metro-1', alt: 'a child in a red hat on the metro, in warm hatched colour' },
		{ name: 'mona-2', alt: 'close-up of the crosshatched pen strokes' },
		{ name: 'lines-1', alt: 'an abstract portrait plotted in dense single-pen directional lines' },
		{ name: 'space-2-1', alt: 'plot of a nebula in reds and oranges on a dark starfield' },
		{ name: 'street-2', alt: 'detail of the townscape plot — blue sky over hatched rooftops' },
		{ name: 'pearl-2', alt: 'detail of the hatched blocks in the Pearl Earring plot' },
		{ name: 'hatch-1', alt: 'close-up of vivid magenta, blue and yellow pen strokes' },
		{ name: 'melkmeisje-2', alt: 'the Milkmaid plot in progress on the AxiDraw' },
		{ name: 'space-1-2', alt: 'detail of the Carina Nebula plot — thousands of tiny pen strokes' },
		{ name: 'broken-gradient-2-2', alt: 'detail of the woven hatch texture in the gradient study' },
		{ name: 'space-2-2', alt: 'detail of the red nebula plot with sparkling star highlights' }
	];

	// hero carousel: the brand mark first, then the finished pieces (details
	// stay in the gallery). Slides crossfade in place, stacked in one frame.
	const HERO_PLOTS = new Set([
		'space-1-1',
		'lia-1',
		'pearl-1',
		'street-1',
		'mona-1',
		'path-1',
		'melkmeisje',
		'webb-1',
		'puma-1',
		'siesta-1',
		'weave-1',
		'metro-1',
		'lines-1',
		'space-2-1',
		'melkmeisje-2'
	]);

	// deterministic order for SSR/hydration; onMount reshuffles on the client so
	// the carousel opens on a different piece each page load.
	let heroSlides = $state(
		GALLERY_PLOTS.filter((p) => HERO_PLOTS.has(p.name)).map((p) => ({
			name: p.name,
			src: plotSrc(p.name, 800),
			srcset: plotSrcset(p.name),
			alt: p.alt
		}))
	);

	const HERO_INTERVAL_MS = 4500;
	let heroCurrent = $state(0);
	// slides mount one step ahead of the show, so each image is fetched and
	// decoded before it fades in (and nothing loads that is never shown)
	let heroMounted = $state(1);

	onMount(() => {
		// randomize the running order for this load (client only)
		const shuffled = heroSlides.slice();
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		heroSlides = shuffled;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const id = setInterval(() => {
			heroCurrent = (heroCurrent + 1) % heroSlides.length;
			heroMounted = Math.max(heroMounted, Math.min(heroCurrent + 1, heroSlides.length - 1));
		}, HERO_INTERVAL_MS);
		return () => clearInterval(id);
	});

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
			text: 'Any photo or video works. It never leaves your browser. All the processing happens right on your machine.'
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

	// clicking any plot opens it near-fullscreen; the "open full size" link
	// inside the overlay hands off to a new tab for unlimited native zoom/pan.
	let lightbox = $state<{ srcset: string; full: string; alt: string } | null>(null);

	const openLightbox = (name: string, alt: string) => {
		lightbox = { srcset: plotSrcset(name), full: plotSrc(name, 1920), alt };
	};
	const closeLightbox = () => (lightbox = null);

	// lock the page behind the overlay so only the image scrolls/zooms
	$effect(() => {
		if (lightbox) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => (document.body.style.overflow = prev);
		}
	});
</script>

<svelte:head>
	<title>RSTR — turn your favorite pictures into bespoke art</title>
	<meta
		name="description"
		content="RSTR turns your best memories into unique hatched line art. Print it, share it, or plot it with a pen plotter. Free and instant, right in your browser."
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
				<div class="hero-art">
					{#each heroSlides as slide, index (slide.src)}
						{#if index <= heroMounted}
							<button
								type="button"
								class="hero-slide"
								class:current={index === heroCurrent}
								aria-hidden={index !== heroCurrent}
								tabindex={index === heroCurrent ? 0 : -1}
								aria-label="open plot: {slide.alt}"
								onclick={() => openLightbox(slide.name, slide.alt)}
							>
								<img
									src={slide.src}
									srcset={slide.srcset}
									sizes={slide.srcset ? '(max-width: 820px) 92vw, 480px' : undefined}
									alt={slide.alt}
									loading={index === 0 ? 'eager' : 'lazy'}
								/>
							</button>
						{/if}
					{/each}
				</div>
				<figcaption class="hero-caption">#madewithrstr</figcaption>
			</figure>
		</section>

		<!-- why lines -->
		<section class="split">
			<div class="split-copy">
				<h2>what's a plotter?</h2>
				<p>
					A pen plotter is a machine that draws by moving a real pen across paper along vector
					paths. It can't color in shapes the way software does. If you want a colored square, you
					have to draw a bunch of lines neatly next to each other — or with some spacing in between
					to create different shades. That technique is called
					<a href="https://en.wikipedia.org/wiki/Hatching" target="_blank" rel="noopener"
						><em>hatching</em></a
					>, and it's probably as old as drawing itself.
				</p>
				<p>
					RSTR reimagines hatching for pen plotters: it splits your image into regions of similar
					tone and fills each one with lines — denser where the image is dark, sparser where it's
					light. The result is an image rebuilt entirely from straight lines.
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
				The tool itself is in the open, too: the source code is on
				<a href="https://github.com/dxviie/RSTR" target="_blank" rel="noopener">GitHub</a>, licensed
				under the GPL.
			</p>
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
					No problem — I can plot yours for you. Make something in the studio, then hit
					<strong>⚡ order this plot</strong> to have it drawn with real pens on real paper and shipped
					to your door.
				</p>
			</div>
		</section>

		<!-- #madewithrstr -->
		<section class="gallery-section">
			<h2>#madewithrstr</h2>
			<p class="gallery-lede">
				A few of my own: plots from photos, run through RSTR and drawn with real pens on real paper.
			</p>
			<div class="gallery">
				{#each gallerySlots as plotIndex, slot (slot)}
					<div class="gallery-item">
						{#key plotIndex}
							<button
								type="button"
								class="zoom"
								aria-label="open plot: {GALLERY_PLOTS[plotIndex].alt}"
								onclick={() =>
									openLightbox(GALLERY_PLOTS[plotIndex].name, GALLERY_PLOTS[plotIndex].alt)}
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
					Made something with RSTR — plotted, printed, or straight off the screen? Share it and tag
					it <strong>#madewithrstr</strong> so others can find it. A community gallery will grow right
					here, so show off your work!
				</p>
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
					><em>“In the style of Vera Molnár (1924–2023)”</em></a
				>
				— and never really stopped. It grew from a single experiment into the studio it is today; the
				<a href="/classic">original version</a> still lives on if you're feeling nostalgic.
			</p>
			<p>
				It's made by me, David Vandenbogaerde (or <a
					href="https://www.d17e.dev"
					target="_blank"
					rel="noopener">d17e</a
				>
				for short), a software engineer and artist living in Amsterdam 🇳🇱. Ever since I owned a plotter,
				I've been experimenting with novel ways to turn images into plotter art.<br />
				Which is why RSTR exists. I hope you like it.
			</p>
			<div class="cta-row center">
				<a class="btn primary" href="/studio">launch RSTR</a>
			</div>
		</section>
	</main>

	<footer class="footer">
		<BrandFooter />
	</footer>
</div>

<svelte:window onkeydown={(e) => lightbox && e.key === 'Escape' && closeLightbox()} />

{#if lightbox}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label={lightbox.alt}
		tabindex="-1"
		transition:fade={{ duration: 200 }}
		onclick={closeLightbox}
	>
		<button class="lightbox-close" type="button" aria-label="close" onclick={closeLightbox}>
			×
		</button>
		<img src={lightbox.full} srcset={lightbox.srcset} sizes="100vw" alt={lightbox.alt} />
		<a
			class="lightbox-full"
			href={lightbox.full}
			target="_blank"
			rel="noopener"
			onclick={(e) => e.stopPropagation()}
		>
			open full size ↗
		</a>
	</div>
{/if}

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

	/* stacked auto-changing carousel: slides sit on top of each other in a
	   square frame (the shadow lives on the frame so it doesn't pulse while
	   two slides crossfade) */
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

	.hero-art {
		position: relative;
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		aspect-ratio: 1;
		background: #fffef7;
		overflow: hidden;
		box-shadow:
			0 2px 6px rgba(96, 115, 159, 0.25),
			0 12px 32px rgba(96, 115, 159, 0.2);
	}

	.hero-slide {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		overflow: hidden;
		opacity: 0;
		/* only the visible slide takes the click */
		pointer-events: none;
		cursor: zoom-in;
		transition: opacity 0.9s ease;
	}

	.hero-slide.current {
		opacity: 1;
		pointer-events: auto;
	}

	.hero-art img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* held zoomed in even at rest so the photographed paper/desk margins
		   around each plot stay cropped out of the frame */
		transform: scale(1.14);
	}

	/* slow Ken Burns: each slide starts further in and eases back out to the
	   1.14 rest zoom — never far enough to bring the borders back in */
	.hero-slide.current img {
		animation: hero-zoom 6s ease-out both;
	}

	@keyframes hero-zoom {
		from {
			transform: scale(1.26);
		}
		to {
			transform: scale(1.14);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-slide.current img {
			animation: none;
		}
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

	/* ------------------------------------------------- lightbox */

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4vmin;
		background: rgba(26, 32, 44, 0.92);
		cursor: zoom-out;
	}

	/* Fill the padded box and letterbox the picture inside it. Sizing the
	   element (not the content) sidesteps the srcset intrinsic-size trap:
	   some -1920w renditions are narrower than their descriptor claims, so
	   the browser under-computes the natural CSS size and max-width/height
	   alone would show them tiny. Tapping anywhere (image included) closes. */
	.lightbox img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.lightbox-close {
		position: absolute;
		top: 0.75rem;
		right: 1.1rem;
		padding: 0;
		background: none;
		border: none;
		color: #fff;
		font-family: 'mono-light', monospace;
		font-size: 2.25rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.8;
		transition: opacity 0.1s ease;
	}

	.lightbox-close:hover {
		opacity: 1;
	}

	.lightbox-full {
		position: absolute;
		bottom: 1.1rem;
		left: 50%;
		transform: translateX(-50%);
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		color: #fff;
		text-decoration: none;
		border-bottom: 1px dashed rgba(255, 255, 255, 0.55);
		opacity: 0.85;
		transition: opacity 0.1s ease;
	}

	.lightbox-full:hover {
		opacity: 1;
	}
</style>
