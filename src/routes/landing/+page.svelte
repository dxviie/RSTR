<script lang="ts">
	// Landing page for RSTR — lives at /landing for now, while the v1 app
	// stays on the root route. Copy and imagery lean on the project pages at
	// d17e.dev/projects/rstr and d17e.dev/projects/plotter-art; the images are
	// hotlinked from media.d17e.dev as placeholders.

	import BrandFooter from '$lib/components/BrandFooter.svelte';

	const MEDIA = 'https://media.d17e.dev/images';

	const HERO_IMAGE = `${MEDIA}/703d5084-54e3-4552-a8fa-78e8c5fdf3b4/1200w.webp`;
	const PLOTTER_IMAGE =
		'https://media.d17e.dev/images/6774f12e-dac6-4657-bdbd-7461c731edd8/800w.webp';

	const GALLERY_IMAGES = [
		'ee7a8e7d-e69f-4860-8b95-d18a91f689d5',
		'd5994253-eae4-4398-808b-d3230f2f52a6',
		'd5bf9ac1-9f52-47e4-a1ad-7e81dc1bad43',
		'a0304212-438d-4898-bb79-d1fbc373e423',
		'f5be8d0d-abc7-46d8-9834-e7d33b2c7d6b',
		'0a80182a-b22f-4438-bfe1-bb322390ea39',
		'02e4f632-e956-4588-a9f1-3407eb8489c1',
		'6ed6bf57-c355-4d0c-9672-622811aa7bb1'
	].map((id) => `${MEDIA}/${id}/400w.webp`);

	const STEPS = [
		{
			title: 'drop an image',
			text: 'Any photo or picture works. It never leaves your browser — all the processing happens right on your machine.'
		},
		{
			title: 'tune the lines',
			text: 'Split the image into regions, then hatch them: pick pens, channels, angles and spacing until the drawing feels right.'
		},
		{
			title: 'plot it',
			text: 'Export a clean SVG with one layer per pen, ready for your plotter. Or grab a PNG of the render.'
		}
	];
</script>

<svelte:head>
	<title>RSTR — turn your images into plottable SVGs</title>
	<meta
		name="description"
		content="RSTR is a free online tool that turns raster images into plottable SVGs — hatched line art ready for your pen plotter. Everything runs in your browser."
	/>
</svelte:head>

<div class="landing">
	<!-- top bar -->
	<header class="topbar">
		<a class="logo-link" href="https://d17e.dev" title="d17e.dev">
			<svg
				class="logo"
				role="img"
				aria-label="D17E logo"
				viewBox="0 0 1046 447"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g transform="matrix(1.2778,0,0,0.628916,-169.768,-154.959)">
					<path
						d="M930.998,957.001L930.998,957.183L132.86,957.183L132.86,246.391L930.998,246.391L930.998,246.802L951.958,246.802L951.958,957.001L930.998,957.001ZM399.748,807.315L517.675,807.315L517.675,734.622L477.603,734.622L477.603,400.234L441.538,400.234L441.538,417.68C441.538,444.431 436.099,452.573 422.647,452.573L401.18,452.573L401.18,522.358L441.252,522.358L441.252,734.622L399.748,734.622L399.748,807.315ZM586.656,807.315L627.3,807.315L706.3,475.253L706.3,400.234L566.047,400.234L566.047,472.345L665.655,472.345L586.656,801.499L586.656,807.315ZM208.261,807.315L268.083,807.315C326.76,807.315 354.238,728.806 354.238,627.036L354.238,580.513C354.238,478.742 326.76,400.234 268.083,400.234L208.261,400.234L208.261,807.315ZM245.471,734.622L245.471,472.927L268.083,472.927C306.438,472.927 317.028,516.543 317.028,580.513L317.028,627.036C317.028,691.006 306.438,734.622 268.083,734.622L245.471,734.622ZM750.665,807.315L876.606,807.315L876.606,735.785L787.875,735.785L787.875,632.852L867.733,632.852L867.733,561.903L787.875,561.903L787.875,471.764L876.606,471.764L876.606,400.234L750.665,400.234L750.665,807.315Z"
						fill="currentColor"
					/>
				</g>
			</svg>
		</a>
		<span class="wordmark">RSTR</span>
		<span class="tagline">raster images to plottable svg</span>
		<div class="spacer"></div>
		<a class="top-cta" href="/">launch the app</a>
	</header>

	<main>
		<!-- hero -->
		<section class="hero">
			<div class="hero-copy">
				<div class="hatch-strip" aria-hidden="true">
					<span class="c"></span><span class="m"></span><span class="y"></span>
				</div>
				<h1>your images,<br />drawn in lines.</h1>
				<p class="lede">
					RSTR turns raster images into plottable SVGs — hatched line art a pen plotter can actually
					draw. Free, instant, and everything stays in your browser.
				</p>
				<div class="cta-row">
					<a class="btn primary" href="/">launch RSTR</a>
					<a class="btn ghost" href="/v2">try the v2 beta →</a>
				</div>
			</div>
			<div class="hero-art">
				<img src={HERO_IMAGE} alt="A plotted artwork made with RSTR" loading="eager" />
			</div>
		</section>

		<!-- why lines -->
		<section class="split">
			<div class="split-copy">
				<h2>why lines?</h2>
				<p>
					A pen plotter can't color in shapes the way software does. If you want a colored square,
					you have to draw a bunch of lines neatly next to each other — or with some spacing in
					between to create different shades. That technique is called
					<em>hatching</em>, and it's probably as old as drawing itself.
				</p>
				<p>
					RSTR reimagines hatching for the robot age: it splits your image into regions of similar
					tone and fills each one with lines — denser where the image is dark, sparser where it's
					light. The result is an image rebuilt entirely from pen strokes.
				</p>
				<p class="aside">
					Curious about the machines? Have a look at the
					<a href="https://d17e.dev/projects/plotter-art/" target="_blank" rel="noopener"
						>plotter art project</a
					> on d17e.dev.
				</p>
			</div>
			<figure class="split-art">
				<img src={PLOTTER_IMAGE} alt="An AxiDraw SE/A3 pen plotter" loading="lazy" />
				<figcaption>the robot friend: an AxiDraw SE/A3</figcaption>
			</figure>
		</section>

		<!-- how it works -->
		<section class="steps-section">
			<h2>how it works</h2>
			<ol class="steps">
				{#each STEPS as step, index (step.title)}
					<li>
						<span class="step-number">{index + 1}</span>
						<h3>{step.title}</h3>
						<p>{step.text}</p>
					</li>
				{/each}
			</ol>
		</section>

		<!-- gallery -->
		<section class="gallery-section">
			<h2>made with RSTR</h2>
			<p class="gallery-lede">
				Plots from photos, run through RSTR and drawn with real pens on real paper.
			</p>
			<div class="gallery">
				{#each GALLERY_IMAGES as src, index (src)}
					<img {src} alt="Plotted artwork made with RSTR #{index + 1}" loading="lazy" />
				{/each}
			</div>
			<p class="gallery-more">
				More plots and works in progress over at
				<a href="https://d17e.dev/projects/rstr/" target="_blank" rel="noopener"
					>d17e.dev/projects/rstr</a
				>.
			</p>
		</section>

		<!-- origin + closing cta -->
		<section class="origin">
			<div class="hatch-strip" aria-hidden="true">
				<span class="c"></span><span class="m"></span><span class="y"></span>
			</div>
			<p>
				RSTR grew out of the Genuary '24 prompt <em>“In the style of Vera Molnár (1924–2023)”</em> —
				and kept going. Layers, pens, new patterns and algorithms are landing in the next iteration,
				so make sure to check back every now and then.
			</p>
			<div class="cta-row center">
				<a class="btn primary" href="/">start plotting</a>
				<a class="btn ghost" href="/v2">peek at v2 →</a>
			</div>
		</section>
	</main>

	<footer class="footer">
		<BrandFooter align="right" />
	</footer>
</div>

<style>
	@font-face {
		font-family: 'nudica_monobold';
		src: url('/fonts/nudicamono-bold-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'nudica_monolight';
		src: url('/fonts/nudicamono-light-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'argesta_regular';
		src: url('/fonts/argestatext-regular-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	/* Full-viewport page in the d17e.dev brand, covering the root layout's
	   site chrome the same way the /v2 app shell does — but scrollable. */
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

		position: fixed;
		inset: 0;
		z-index: 200;
		overflow-y: auto;
		background: var(--bg);
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
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
		font-family: 'nudica_monobold', monospace;
		letter-spacing: 0.02em;
		margin: 0;
	}

	p {
		font-family: 'argesta_regular', serif;
		line-height: 1.65;
	}

	em {
		font-style: italic;
	}

	/* ------------------------------------------------- top bar */

	.topbar {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 1rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		z-index: 10;
	}

	.logo-link {
		display: flex;
		align-items: center;
	}

	.logo {
		height: 26px;
		width: auto;
		color: var(--ink);
	}

	.logo-link:hover .logo {
		opacity: 0.7;
	}

	.wordmark {
		font-family: 'nudica_monobold', monospace;
		font-size: 1.15rem;
		letter-spacing: 0.08em;
	}

	.tagline {
		font-family: 'argesta_regular', serif;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.spacer {
		flex: 1;
	}

	/* .landing prefix so these beat the `.landing a` color reset above */
	.landing .top-cta {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.75rem;
		padding: 0.25rem 0.8rem;
		border: 1px solid var(--ink) !important;
		border-radius: 999px;
		background: var(--ink);
		color: var(--bg);
		transition: background 0.1s ease;
	}

	.landing .top-cta:hover {
		background: var(--ink-soft);
		color: #fff;
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
		font-family: 'nudica_monobold', monospace;
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

	/* ------------------------------------------------- hero */

	.hero {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 3rem;
		align-items: center;
		padding-top: 5rem;
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

	.hero-art img {
		width: 100%;
		height: auto;
		background: #fffef7;
		box-shadow:
			0 2px 6px rgba(96, 115, 159, 0.25),
			0 12px 32px rgba(96, 115, 159, 0.2);
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

	.split-copy a {
		border-bottom: 1px dashed var(--muted);
	}

	.split-copy a:hover {
		border-color: var(--ink);
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
		font-family: 'argesta_regular', serif;
		font-size: 0.75rem;
		color: var(--muted);
		text-align: center;
		margin-top: 0.5rem;
	}

	/* ------------------------------------------------- steps */

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
		padding: 1.5rem;
	}

	.step-number {
		font-family: 'nudica_monobold', monospace;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		background: var(--muted-light);
		margin-bottom: 0.9rem;
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
		margin-bottom: 0.5rem;
	}

	.steps p {
		font-size: 0.9rem;
		color: var(--ink-soft);
		margin: 0;
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

	.gallery img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		background: #fffef7;
		box-shadow: 0 2px 8px rgba(96, 115, 159, 0.2);
		transition: transform 0.15s ease;
	}

	.gallery img:hover {
		transform: scale(1.02);
	}

	.gallery-more {
		font-size: 0.85rem;
		color: var(--muted);
		margin-top: 1.25rem;
	}

	.gallery-more a {
		border-bottom: 1px dashed var(--muted);
	}

	.gallery-more a:hover {
		border-color: var(--ink);
	}

	/* ------------------------------------------------- origin */

	.origin {
		text-align: center;
	}

	.origin .hatch-strip {
		justify-content: center;
	}

	.origin p {
		max-width: 38rem;
		margin: 0 auto;
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
			padding-top: 3rem;
		}

		.steps {
			grid-template-columns: 1fr;
		}

		.gallery {
			grid-template-columns: repeat(2, 1fr);
		}

		.tagline {
			display: none;
		}
	}
</style>
