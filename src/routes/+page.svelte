<script lang="ts">
	// RSTR landing page. The first sections speak to everyone (make art from
	// your images); the plotter details, the open-source story and the
	// origin live further down. Gallery imagery is served from
	// media.d17e.dev, same as the d17e.dev project pages.

	import BrandFooter from '$lib/components/BrandFooter.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	const MEDIA = 'https://media.d17e.dev/images';

	const PLOTTER_IMAGE = `${MEDIA}/6774f12e-dac6-4657-bdbd-7461c731edd8/800w.webp`;

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
			title: 'shape the lines',
			text: 'RSTR splits your image into regions and redraws them as lines. Play with colors, angles, spacing and density — or roll the dice until something clicks.'
		},
		{
			title: 'take it home',
			text: 'Save a PNG to share or print, or export a layered SVG that a pen plotter can draw with real ink on real paper.'
		}
	];

	const USPS = [
		'free — no account, no uploads, nothing leaves your device',
		'endless looks from a single image',
		'yours to keep, even commercially'
	];
</script>

<svelte:head>
	<title>RSTR — turn your images into unique art</title>
	<meta
		name="description"
		content="RSTR turns your images into unique hatched line art — print it, share it, or plot it with a pen plotter. Free and instant, right in your browser."
	/>
</svelte:head>

<div class="landing">
	<TopBar variant="landing" tagline="turn your images into unique art" />

	<main>
		<!-- hero + USP -->
		<section class="hero">
			<div class="hero-copy">
				<div class="hatch-strip" aria-hidden="true">
					<span class="c"></span><span class="m"></span><span class="y"></span>
				</div>
				<h1>turn your images<br />into unique art.</h1>
				<p class="lede">
					RSTR redraws any picture as striking, hatched line art — a one-of-a-kind piece every time.
					Made in your browser, ready to print, share, or hand to a pen plotter.
				</p>
				<ul class="usp-list">
					{#each USPS as usp (usp)}
						<li>{usp}</li>
					{/each}
				</ul>
				<div class="cta-row">
					<a class="btn primary" href="/studio">launch the app</a>
					<a class="btn ghost" href="#how">how it works ↓</a>
				</div>
			</div>
			<div class="hero-art">
				<img
					src="/rstr-mark.webp"
					alt="RSTR — pixel lettering rebuilt from colorful hatched dots and dashes"
					loading="eager"
				/>
			</div>
		</section>

		<!-- how it works -->
		<section class="steps-section" id="how">
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
					light. The result is an image rebuilt entirely from pen strokes. And even if you never
					touch a plotter, the look is unmistakable.
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

		<!-- ownership + open source -->
		<section class="yours">
			<div class="hatch-strip" aria-hidden="true">
				<span class="c"></span><span class="m"></span><span class="y"></span>
			</div>
			<h2>everything you make is yours</h2>
			<p>
				Whatever you create with RSTR belongs to you — personal projects, gifts, client work, prints
				you sell. Commercial use included, no attribution required, no strings attached. And since
				your images are processed entirely in your browser, nobody else ever sees them.
			</p>
			<p>
				The tool itself is in the open, too: the source code is on
				<a href="https://github.com/dxviie/RSTR" target="_blank" rel="noopener">GitHub</a>, with a
				full open-source release under the GPL license on the way.
			</p>
		</section>

		<!-- #madewithrstr -->
		<section class="gallery-section">
			<h2>#madewithrstr</h2>
			<p class="gallery-lede">
				A few of my own: plots from photos, run through RSTR and drawn with real pens on real paper.
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
				It's made by David Vandenbogaerde — <a
					href="https://www.d17e.dev"
					target="_blank"
					rel="noopener">d17e</a
				> for short — a software engineer and budding artist in Amsterdam, plotting away in the robot
				age.
			</p>
			<div class="cta-row center">
				<a class="btn primary" href="/studio">launch the app</a>
			</div>
		</section>
	</main>

	<footer class="footer">
		<BrandFooter align="right" />
	</footer>
</div>

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
		font-family: 'argesta_regular', serif;
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

	.hero-art img {
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		display: block;
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

	.community {
		margin-top: 2.5rem;
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
		font-family: 'nudica_monobold', monospace;
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
</style>
