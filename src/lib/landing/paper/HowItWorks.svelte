<script lang="ts">
	// How it works: one painting through the real pipeline, then the three
	// steps on a thin timeline (each line segment draws down as its step
	// arrives), and the plot service at the end.
	import type { LightboxImage } from '$lib/landing/Lightbox.svelte';
	import { reveal } from '$lib/landing/reveal';
	import DropZone from './DropZone.svelte';
	import Exports from './Exports.svelte';
	import OrderLabel from './OrderLabel.svelte';
	import PenStack from './PenStack.svelte';
	import Pipeline from './Pipeline.svelte';
	import SectionHead from './SectionHead.svelte';
	import StudioShot from './StudioShot.svelte';
	import Swatch from './Swatch.svelte';

	const { onzoom }: { onzoom: (image: LightboxImage) => void } = $props();
</script>

<section class="how" aria-labelledby="how">
	<Swatch
		color="#00bfe8"
		angle={-38}
		gap={5.5}
		label="cyan · 0.5 mm · 38°"
		tilt={-3}
		style="left: calc(50% - 44rem); top: 26rem"
	/>
	<Swatch
		color="#ff2aa6"
		angle={62}
		gap={6.5}
		width={118}
		height={150}
		label="magenta · 0.5 mm · 62°"
		tilt={2}
		style="right: calc(50% - 44rem); top: 128rem"
	/>

	<div class="wrap">
		<SectionHead id="how" title="how it works">
			Here's one painting going all the way through RSTR, from photo to pen on paper.
		</SectionHead>

		<Pipeline {onzoom} />

		<ol class="steps">
			<li class="step" use:reveal>
				<span class="node" aria-hidden="true">01</span>
				<div class="body split">
					<div class="text">
						<h3>drop in a photo or video</h3>
						<p>
							Any image works, and so does video. Crop, zoom and rotate right on the render. Nothing
							gets uploaded. It all runs in your browser, on your own machine.
						</p>
					</div>
					<DropZone />
				</div>
			</li>

			<li class="step" use:reveal>
				<span class="node" aria-hidden="true">02</span>
				<div class="body">
					<div class="text">
						<h3>shape the lines</h3>
						<p>
							Then mess with all the buttons. The lines redraw as you go, so you see right away what
							each setting does. Stuck? Roll the dice for a random look in real ink colors, or start
							from a preset.
						</p>
					</div>
					<StudioShot {onzoom} />
				</div>
			</li>

			<li class="step" use:reveal>
				<span class="node" aria-hidden="true">03</span>
				<div class="body">
					<div class="text">
						<h3>take it home</h3>
						<p>
							Export a PNG to share or print, or a layered SVG for a pen plotter or your own tools.
						</p>
					</div>
					<div class="paths">
						<article class="card plotter">
							<PenStack />
							<h4>for plotter people</h4>
							<p>
								Got a plotter and nothing to plot? Drop in a photo. You get a layered SVG with one
								group per pen, an estimate of the plot time, and a
								<a href="/prep">prep tool</a> that adds paper outlines and calibration marks so multi-pen
								plots line up.
							</p>
						</article>
						<article class="card artist">
							<Exports />
							<h4>for artists & photographers</h4>
							<p>
								Use RSTR as one step in your process. Take the layered SVG into Illustrator,
								Inkscape or Affinity, export a PNG for print, or feed it a video and get every frame
								back as SVG or image. Save a look as a preset to keep a whole series consistent.
							</p>
						</article>
					</div>
				</div>
			</li>
		</ol>

		<OrderLabel />
	</div>
</section>

<style>
	.how {
		position: relative;
	}

	.wrap {
		position: relative;
		max-width: var(--wrap);
		margin: 0 auto;
		padding: var(--section-pad) var(--gutter);
	}

	/* ------------------------------------------------- the three steps */

	.steps {
		display: grid;
		gap: clamp(3.5rem, 7vw, 5.5rem);
		margin: clamp(4rem, 8vw, 6rem) 0 0;
		padding: 0;
		list-style: none;
	}

	.step {
		--node: 2.75rem;

		position: relative;
		display: grid;
		grid-template-columns: var(--node) minmax(0, 1fr);
		column-gap: clamp(1rem, 3vw, 2.25rem);
	}

	/* the timeline: a segment from each node down to the next one */
	.step:not(:last-child)::before {
		content: '';
		position: absolute;
		left: calc(var(--node) / 2 - 0.75px);
		top: calc(var(--node) + 0.5rem);
		bottom: calc(-1 * clamp(3.5rem, 7vw, 5.5rem) + 0.5rem);
		width: 1.5px;
		background: linear-gradient(var(--border-strong), var(--border-strong)) no-repeat;
		transform-origin: top;
		transition: transform 1.1s cubic-bezier(0.45, 0, 0.3, 1) 0.25s;
	}

	/* each step number sits in a registration mark: a ring with four
	   ticks, the kind that lines up the pens of a multi-pen plot */
	.node {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: var(--node);
		height: var(--node);
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		background: var(--paper);
		font-family: 'mono-bold', monospace;
		font-size: 0.82rem;
		color: var(--ink);
		transition:
			transform 0.5s cubic-bezier(0.3, 1.4, 0.5, 1),
			opacity 0.4s ease;
	}

	.node::before {
		content: '';
		position: absolute;
		inset: -8px;
		background:
			linear-gradient(var(--ink), var(--ink)) 50% 0 / 1.5px 7px no-repeat,
			linear-gradient(var(--ink), var(--ink)) 50% 100% / 1.5px 7px no-repeat,
			linear-gradient(var(--ink), var(--ink)) 0 50% / 7px 1.5px no-repeat,
			linear-gradient(var(--ink), var(--ink)) 100% 50% / 7px 1.5px no-repeat;
		pointer-events: none;
	}

	.body {
		min-width: 0;
		padding-top: 0.45rem;
		transition:
			opacity 0.7s ease 0.1s,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s;
	}

	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 23rem);
		gap: clamp(2rem, 5vw, 4.5rem);
		align-items: start;
	}

	.text {
		max-width: 37rem;
	}

	h3 {
		font-family: 'mono-bold', monospace;
		font-size: clamp(1.3rem, 2.2vw, 1.6rem);
		line-height: 1.2;
		color: var(--ink);
	}

	.text p {
		margin-top: 0.7rem;
		text-wrap: pretty;
		font-family: 'serif-text', serif;
		font-size: 1.02rem;
		line-height: 1.65;
		color: var(--ink-soft);
	}

	.step:global([data-reveal='out']) .node {
		opacity: 0;
		transform: scale(0.6);
	}

	.step:global([data-reveal='out']) .body {
		opacity: 0;
		transform: translateY(16px);
	}

	.step:global([data-reveal='out'])::before {
		transform: scaleY(0);
	}

	/* ------------------------------------------------- take it home */

	.paths {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(1.25rem, 3vw, 2rem);
		margin-top: 1.9rem;
	}

	.card {
		position: relative;
		padding: 0.5rem clamp(1.25rem, 3vw, 1.9rem) clamp(1.4rem, 3vw, 1.9rem);
		border-radius: 3px;
		background: var(--sheet);
		box-shadow: var(--sheet-shadow);
		transition:
			box-shadow 0.35s ease,
			transform 0.35s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.card:hover {
		transform: translateY(-3px);
		box-shadow: var(--sheet-shadow-lift);
	}

	/* hovering a card fans its illustration out */
	.card:hover,
	.card:focus-within {
		--pen-gap: 3.5rem;
		--spread: 1.45;
	}

	h4 {
		margin-top: 0.4rem;
		font-family: 'mono-bold', monospace;
		font-size: 1.08rem;
		color: var(--ink);
	}

	.card p {
		margin-top: 0.6rem;
		text-wrap: pretty;
		font-family: 'serif-text', serif;
		font-size: 0.97rem;
		line-height: 1.62;
		color: var(--ink-soft);
	}

	.card a {
		color: var(--ink);
		border-bottom: 1px dashed var(--muted);
	}

	.card a:hover {
		border-bottom-color: var(--magenta);
	}

	.card a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	/* ------------------------------------------------- responsive */

	@media (max-width: 900px) {
		.split {
			grid-template-columns: minmax(0, 1fr);
		}

		.paths {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* phones: no room for a timeline column. The number sits above each
	   step and the pictures get the full width. */
	@media (max-width: 640px) {
		.step {
			display: block;
		}

		.step:not(:last-child)::before {
			display: none;
		}

		.node {
			width: 2.3rem;
			height: 2.3rem;
			margin-bottom: 0.9rem;
			font-size: 0.74rem;
		}

		.body {
			padding-top: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.step::before,
		.node,
		.body,
		.card {
			transition: none;
		}
	}
</style>
