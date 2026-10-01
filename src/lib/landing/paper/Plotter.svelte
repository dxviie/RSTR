<script lang="ts">
	// What's a plotter: a short introduction to the machine, right under the
	// hero, with the AxiDraw pinned up as a print next to it.
	import Magnet from './Magnet.svelte';
	import SectionHead from './SectionHead.svelte';
	import Swatch from './Swatch.svelte';
	import { reveal } from '$lib/landing/reveal';
</script>

<section class="plotter" aria-labelledby="plotter">
	<Swatch
		color="#ff2aa6"
		angle={-20}
		gap={6}
		width={124}
		height={150}
		label="magenta · 0.5 mm · 20°"
		tilt={2.5}
		style="right: calc(50% - 44rem); top: 8rem"
	/>

	<div class="wrap">
		<div class="copy">
			<SectionHead id="plotter" title="what's a plotter?" />
			<p>
				A pen plotter is a machine that draws by moving a real pen across paper along vector paths.
			</p>
			<p>
				Give it a sheet of paper, a pen and an SVG, and it draws the whole picture, one line after
				another. What you get is real ink on real paper, not printed dots.
			</p>
			<p class="aside">
				Curious about plotter art? Have a look at the
				<a href="https://d17e.dev/projects/plotter-art/" target="_blank" rel="noopener"
					>plotter art project</a
				> on d17e.dev.
			</p>
		</div>

		<figure class="machine" use:reveal>
			<span class="print">
				<img
					src="/plotter.png"
					alt="An AxiDraw SE/A3 pen plotter"
					width="863"
					height="567"
					loading="lazy"
					decoding="async"
				/>
				<Magnet style="left: 12px; top: 12px" />
				<Magnet style="left: calc(100% - 12px); top: 12px" />
			</span>
			<figcaption>
				the robot friend, an
				<a href="https://shop.evilmadscientist.com/908" target="_blank" rel="noopener"
					>AxiDraw SE/A3</a
				>
			</figcaption>
		</figure>
	</div>
</section>

<style>
	.plotter {
		position: relative;
	}

	.wrap {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		gap: clamp(2.5rem, 6vw, 5.5rem);
		align-items: center;
		max-width: var(--wrap);
		margin: 0 auto;
		/* right under the hero, which already leaves room above */
		padding: clamp(1rem, 3vw, 2.5rem) var(--gutter) var(--section-pad);
	}

	.copy p {
		max-width: 34rem;
		margin-top: 1rem;
		text-wrap: pretty;
		font-family: 'serif-text', serif;
		font-size: 1.04rem;
		line-height: 1.7;
		color: var(--ink-soft);
	}

	.copy > p:first-of-type {
		margin-top: 1.4rem;
	}

	.aside {
		font-size: 0.92rem !important;
		color: var(--muted) !important;
	}

	a {
		color: var(--ink);
		border-bottom: 1px dashed var(--muted);
	}

	a:hover {
		border-bottom-color: var(--magenta);
	}

	a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.machine {
		margin: 0;
		transition:
			opacity 0.8s ease,
			transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.print {
		position: relative;
		display: block;
		padding: 22px 14px 12px;
		background: #fff;
		box-shadow: var(--sheet-shadow);
		transform: rotate(1.2deg);
	}

	/* the product shot has a soft gray corner; a hairline edge makes it
	   read as a photo printed on the sheet */
	.print img {
		display: block;
		width: 100%;
		height: auto;
		outline: 1px solid rgba(26, 32, 44, 0.07);
	}

	figcaption {
		margin-top: 0.9rem;
		font-family: 'mono-light', monospace;
		font-size: 0.75rem;
		color: var(--muted);
		text-align: center;
	}

	.machine:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(18px);
	}

	@media (max-width: 900px) {
		.wrap {
			grid-template-columns: minmax(0, 1fr);
		}

		.machine {
			max-width: 34rem;
			width: 100%;
			margin-inline: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.machine {
			transition: none;
		}
	}
</style>
