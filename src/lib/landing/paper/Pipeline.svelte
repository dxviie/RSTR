<script lang="ts">
	// One painting through the whole pipeline: photo → regions → lines →
	// the real plot. Four paper cards joined by dashed "pen-up" moves that
	// draw themselves as the strip arrives. Every card opens its picture
	// in the lightbox; the lines card can plot itself again on request, and
	// the last one shows the plot on the AxiDraw on hover.
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { LightboxImage } from '$lib/landing/Lightbox.svelte';
	import {
		HOW_PHOTO,
		HOW_PLOT,
		HOW_PLOT_ON_MACHINE,
		HOW_REGIONS,
		HOW_LINES_PAPER,
		HOW_STATS,
		MILKMAID_CREDIT,
		type HowImage
	} from '$lib/landing/how';
	import { plotSrc } from '$lib/landing/plots';
	import { reveal } from '$lib/landing/reveal';
	import { formatCount } from './hatch';
	import PlottedLines from './PlottedLines.svelte';

	const { onzoom }: { onzoom: (image: LightboxImage) => void } = $props();

	const SIZES = '(max-width: 640px) 80vw, (max-width: 1020px) 40vw, 240px';

	// mouse hover or keyboard focus swaps the plot photo for the one taken
	// on the machine; a tap on a phone just opens the lightbox
	let onMachine = $state(false);
	const plotShown = $derived(onMachine ? HOW_PLOT_ON_MACHINE : HOW_PLOT);

	// the stage renders come at 600w and 1200w; the lightbox gets both and
	// opens the larger one full size
	const largest = (srcset: string) => srcset.split(',').at(-1)?.trim().split(' ')[0];
	const zoomStage = (image: HowImage) =>
		onzoom({ src: image.src, srcset: image.srcset, alt: image.alt, full: largest(image.srcset) });

	// "plot again" only exists once the page runs, and never under reduced motion
	let lines = $state<ReturnType<typeof PlottedLines>>();
	let linesPhase = $state<'idle' | 'armed' | 'plotting' | 'done' | 'rest'>('idle');
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const canReplay = $derived(
		mounted && !prefersReducedMotion.current && (linesPhase === 'idle' || linesPhase === 'rest')
	);

	const zoomPlot = () =>
		onzoom({
			src: plotShown.src,
			srcset: plotShown.srcset,
			alt: plotShown.alt,
			full: plotSrc(plotShown.name, 1920)
		});
</script>

{#snippet connector()}
	<svg class="conn" viewBox="0 0 56 28" aria-hidden="true">
		<path class="travel" d="M4 18c10-9 26-13 42-6" />
		<path class="head" d="M40 6.5l7.5 5.8-8.4 3.4" />
	</svg>
{/snippet}

<div class="pipeline" use:reveal>
	<ol class="strip">
		<li class="panel" style="--n: 0">
			<figure>
				<div class="frame">
					<button
						type="button"
						class="media"
						aria-label="enlarge: {HOW_PHOTO.alt}"
						onclick={() => zoomStage(HOW_PHOTO)}
					>
						<img
							src={HOW_PHOTO.src}
							srcset={HOW_PHOTO.srcset}
							sizes={SIZES}
							alt={HOW_PHOTO.alt}
							width={HOW_PHOTO.width}
							height={HOW_PHOTO.height}
							loading="lazy"
							decoding="async"
						/>
					</button>
				</div>
				<figcaption>
					<span class="num">01</span>
					<span class="name">photo</span>
					<span class="stat">any image or video</span>
				</figcaption>
			</figure>
			{@render connector()}
		</li>

		<li class="panel" style="--n: 1">
			<figure>
				<div class="frame">
					<button
						type="button"
						class="media"
						aria-label="enlarge: {HOW_REGIONS.alt}"
						onclick={() => zoomStage(HOW_REGIONS)}
					>
						<img
							src={HOW_REGIONS.src}
							srcset={HOW_REGIONS.srcset}
							sizes={SIZES}
							alt={HOW_REGIONS.alt}
							width={HOW_REGIONS.width}
							height={HOW_REGIONS.height}
							loading="lazy"
							decoding="async"
						/>
					</button>
				</div>
				<figcaption>
					<span class="num">02</span>
					<span class="name">regions</span>
					{#if HOW_STATS.regions}
						<span class="stat">{formatCount(HOW_STATS.regions)} flat areas</span>
					{/if}
				</figcaption>
			</figure>
			{@render connector()}
		</li>

		<li class="panel" style="--n: 2">
			<figure>
				<div class="frame">
					<button
						type="button"
						class="media"
						aria-label="enlarge: {HOW_LINES_PAPER.alt}"
						onclick={() => zoomStage(HOW_LINES_PAPER)}
					>
						<PlottedLines bind:this={lines} bind:phase={linesPhase} />
					</button>
					{#if canReplay}
						<button
							type="button"
							class="replay"
							onclick={() => lines?.plot()}
							transition:fade={{ duration: 250 }}
						>
							<svg viewBox="0 0 16 16" aria-hidden="true"
								><path d="M3.2 9.2a5 5 0 1 0 1.3-4.9M4.2 1.8v2.9h2.9" /></svg
							>
							{linesPhase === 'rest' ? 'plot again' : 'watch it plot'}
						</button>
					{/if}
				</div>
				<figcaption>
					<span class="num">03</span>
					<span class="name">lines</span>
					{#if HOW_STATS.lines}
						<span class="stat">{formatCount(HOW_STATS.lines)} straight lines</span>
					{/if}
				</figcaption>
			</figure>
			{@render connector()}
		</li>

		<li class="panel" style="--n: 3">
			<figure>
				<div class="frame">
					<button
						type="button"
						class="media plot"
						class:on-machine={onMachine}
						aria-label="enlarge: {plotShown.alt}"
						onclick={zoomPlot}
						onpointerenter={(e) => e.pointerType === 'mouse' && (onMachine = true)}
						onpointerleave={(e) => e.pointerType === 'mouse' && (onMachine = false)}
						onfocus={(e) => e.currentTarget.matches(':focus-visible') && (onMachine = true)}
						onblur={() => (onMachine = false)}
					>
						<img
							src={HOW_PLOT.src}
							srcset={HOW_PLOT.srcset}
							sizes={SIZES}
							alt={HOW_PLOT.alt}
							width="800"
							height="1067"
							loading="lazy"
							decoding="async"
						/>
						<img
							class="alt"
							src={HOW_PLOT_ON_MACHINE.src}
							srcset={HOW_PLOT_ON_MACHINE.srcset}
							sizes={SIZES}
							alt=""
							width="800"
							height="1067"
							loading="lazy"
							decoding="async"
						/>
						<span class="where" aria-hidden="true">{onMachine ? 'on the AxiDraw' : 'on paper'}</span
						>
					</button>
				</div>
				<figcaption>
					<span class="num">04</span>
					<span class="name">plotted</span>
					{#if HOW_STATS.plotTime}
						<span class="stat">~{HOW_STATS.plotTime}, one pen</span>
					{/if}
				</figcaption>
			</figure>
		</li>
	</ol>
	<p class="credit">{MILKMAID_CREDIT}</p>
</div>

<style>
	.pipeline {
		margin-top: clamp(2.5rem, 5vw, 3.75rem);
	}

	.strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 3.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.panel {
		position: relative;
	}

	figure {
		margin: 0;
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
		transition-delay: calc(var(--n) * 0.32s);
	}

	.media {
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
		transition: box-shadow 0.3s ease;
	}

	.frame {
		position: relative;
		transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	/* the whole card lifts, chips included */
	.frame:hover {
		transform: translateY(-3px);
	}

	.frame:hover .media {
		box-shadow: var(--sheet-shadow-lift);
	}

	.frame:has(.media:active) {
		transform: translateY(0);
	}

	.media:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.media img,
	.media :global(.plotted) {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1200 / 1345;
		object-fit: cover;
		background: #fffef7;
	}

	/* the plot photos are 3:4; crop them to the stage framing, keeping the
	   drawing and losing some of the bed above and below */
	.plot {
		overflow: hidden;
	}

	.plot .alt {
		position: absolute;
		inset: 9px;
		width: calc(100% - 18px);
		height: calc(100% - 18px);
		opacity: 0;
		transition: opacity 0.45s ease;
	}

	.plot.on-machine .alt {
		opacity: 1;
	}

	.where {
		position: absolute;
		right: 16px;
		bottom: 16px;
		display: inline-flex;
		align-items: center;
		min-height: 1.9rem;
		padding: 0 0.7rem;
		border-radius: 999px;
		background: rgba(255, 254, 247, 0.92);
		box-shadow: 0 1px 3px rgba(26, 32, 44, 0.18);
		font-family: 'mono-bold', monospace;
		font-size: 0.72rem;
		letter-spacing: 0.01em;
		color: var(--ink);
	}

	/* "watch it plot" / "plot again", over the corner of the lines card */
	.replay {
		position: absolute;
		right: 16px;
		bottom: 16px;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 1.9rem;
		margin: 0;
		padding: 0 0.75rem 0 0.6rem;
		border: 1px solid rgba(26, 32, 44, 0.14);
		border-radius: 999px;
		background: rgba(255, 254, 247, 0.94);
		box-shadow: 0 2px 6px rgba(26, 32, 44, 0.16);
		color: var(--ink);
		font-size: 0.72rem !important;
		letter-spacing: 0.01em;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
	}

	/* a 40px target around the slimmer pill */
	.replay::before {
		content: '';
		position: absolute;
		inset: -5px;
	}

	.replay:hover {
		background-color: #fff !important;
		border-color: var(--ink);
		color: var(--ink) !important;
	}

	.replay:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.replay svg {
		width: 0.9rem;
		height: 0.9rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.35s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.replay:hover svg {
		transform: rotate(-200deg);
	}

	figcaption {
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: 0.55rem;
		margin-top: 0.95rem;
		padding-inline: 0.15rem;
	}

	.num {
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		line-height: 1.5rem;
		color: var(--muted);
	}

	.name {
		font-family: 'mono-bold', monospace;
		font-size: 1.05rem;
		line-height: 1.5rem;
		color: var(--ink);
	}

	.stat {
		grid-column: 2;
		font-family: 'mono-light', monospace;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--muted);
	}

	/* ------------------------------------------------- pen-up connectors */

	.conn {
		position: absolute;
		/* level with the middle of the picture above the caption */
		top: calc(42% - 14px);
		left: 100%;
		width: 3.4rem;
		height: 1.7rem;
		padding: 0 0.3rem;
		overflow: visible;
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: clip-path 0.55s cubic-bezier(0.5, 0, 0.3, 1);
		transition-delay: calc(0.3s + var(--n) * 0.32s);
	}

	.travel {
		stroke-dasharray: 2.5 4.5;
	}

	/* ------------------------------------------------- entrance */

	.pipeline:global([data-reveal='out']) figure {
		opacity: 0;
		transform: translateY(18px);
	}

	.pipeline:global([data-reveal='out']) .conn {
		clip-path: inset(0 100% 0 0);
	}

	.pipeline:global([data-reveal='in']) .conn {
		clip-path: inset(0 0 0 0);
	}

	.credit {
		margin-top: 1.6rem;
		font-family: 'mono-light', monospace;
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--muted);
		text-align: right;
	}

	/* ------------------------------------------------- tablet: 2 × 2 */

	@media (max-width: 1020px) {
		.strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: 2.75rem;
			column-gap: 4rem;
			max-width: 40rem;
			margin-inline: auto;
		}

		.conn {
			width: 4rem;
		}

		/* end of the first row: the eye wraps to the next line by itself */
		.panel:nth-child(2) .conn {
			display: none;
		}

		.credit {
			text-align: center;
		}
	}

	/* ------------------------------------------------- phone: zigzag stack */

	@media (max-width: 640px) {
		.strip {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 3.4rem;
		}

		.panel {
			width: 80%;
		}

		.panel:nth-child(even) {
			justify-self: end;
		}

		/* the pen-up move turns downwards, toward the next card */
		.panel .conn,
		.panel:nth-child(2) .conn {
			display: block;
			top: calc(100% + 0.35rem);
			left: auto;
			right: -2.6rem;
			width: 3.6rem;
			height: 2.8rem;
			transform: rotate(68deg);
		}

		.panel:nth-child(even) .conn {
			right: auto;
			left: -2.6rem;
			transform: scaleX(-1) rotate(68deg);
		}

		.credit {
			text-align: left;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		figure,
		.frame,
		.media,
		.conn,
		.plot .alt {
			transition: none;
		}
	}
</style>
