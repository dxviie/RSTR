<script lang="ts">
	// The real studio, framed as a browser window, with a few notes pencilled
	// in the margin like annotations on a drawing. Each note sits at the
	// height of the control it points to; on narrow screens the rings get
	// numbers and the notes move into a list under the picture.
	import type { LightboxImage } from '$lib/landing/Lightbox.svelte';
	import { HOW_STUDIO } from '$lib/landing/how';
	import { reveal } from '$lib/landing/reveal';

	const { onzoom }: { onzoom: (image: LightboxImage) => void } = $props();

	/** positions in % of the 1440 × 900 screenshot */
	const NOTES = [
		{ x: 85.7, y: 10.2, title: 'roll the dice', text: 'palettes from real fountain-pen inks' },
		{ x: 90.2, y: 30.1, title: 'one layer per pen', text: 'each with its own color and angles' },
		{ x: 96.7, y: 70.8, title: 'plot time', text: 'estimated per pen, before you plot' }
	];

	const zoom = () =>
		onzoom({
			src: HOW_STUDIO.src,
			srcset: HOW_STUDIO.srcset,
			alt: HOW_STUDIO.alt,
			full: '/how/studio-1440w.webp'
		});
</script>

<figure class="studio" use:reveal>
	<div class="window">
		<div class="chrome" aria-hidden="true">
			<span class="lights"><i></i><i></i><i></i></span>
			<span class="url">rstr.d17e.dev/studio</span>
		</div>
		<div class="shot">
			<button type="button" class="zoom" aria-label="enlarge: {HOW_STUDIO.alt}" onclick={zoom}>
				<img
					src={HOW_STUDIO.src}
					srcset={HOW_STUDIO.srcset}
					sizes="(max-width: 900px) 92vw, 760px"
					alt={HOW_STUDIO.alt}
					width={HOW_STUDIO.width}
					height={HOW_STUDIO.height}
					loading="lazy"
					decoding="async"
				/>
			</button>
			{#each NOTES as note, i (note.title)}
				<div class="callout" style="left: {note.x}%; top: {note.y}%; --n: {i}" aria-hidden="true">
					<span class="ring"><span class="num">{i + 1}</span></span>
					<span class="leader"></span>
					<span class="note">
						<span class="title">{note.title}</span>
						<span class="text">{note.text}</span>
					</span>
				</div>
			{/each}
		</div>
	</div>
	<figcaption>
		<ol class="notes">
			{#each NOTES as note, i (note.title)}
				<li style="--n: {i}">
					<span class="num" aria-hidden="true">{i + 1}</span>
					<span><span class="title">{note.title}</span>, {note.text}</span>
				</li>
			{/each}
		</ol>
	</figcaption>
</figure>

<style>
	.studio {
		position: relative;
		margin: 2rem 0 0;
		/* room in the margin for the notes */
		padding-right: 15.5rem;
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.window {
		position: relative;
		border: 1px solid #d5dae3;
		border-radius: 11px;
		background: #fff;
		box-shadow:
			0 1px 2px rgba(26, 32, 44, 0.06),
			0 18px 40px -18px rgba(54, 66, 96, 0.38);
	}

	.chrome {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		height: 2rem;
		padding: 0 0.75rem;
		border-bottom: 1px solid #e3e6ec;
		border-radius: 10px 10px 0 0;
		background: #f6f7fa;
	}

	.lights {
		display: flex;
		gap: 0.35rem;
	}

	.lights i {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--cyan);
	}

	.lights i:nth-child(2) {
		background: var(--magenta);
	}

	.lights i:nth-child(3) {
		background: var(--yellow);
	}

	.url {
		flex: 0 1 18rem;
		margin-inline: auto;
		padding: 0.12rem 0.75rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: inset 0 0 0 1px #e3e6ec;
		font-family: 'mono-light', monospace;
		font-size: 0.68rem;
		color: var(--muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.shot {
		position: relative;
	}

	.zoom {
		display: block;
		width: 100%;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0 0 10px 10px;
		background: none !important;
		overflow: hidden;
		cursor: zoom-in;
	}

	.zoom:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.zoom img {
		display: block;
		width: 100%;
		height: auto;
	}

	/* ------------------------------------------------- margin notes */

	.callout {
		position: absolute;
		/* from the ring on the control out into the margin */
		right: -15.5rem;
		display: flex;
		align-items: center;
		transform: translateY(-50%);
		pointer-events: none;
		transition:
			opacity 0.5s ease,
			transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
		transition-delay: calc(0.45s + var(--n) * 0.18s);
	}

	.ring {
		position: relative;
		flex: none;
		width: 1.65rem;
		height: 1.65rem;
		margin-left: -0.825rem;
		border: 2px solid var(--magenta);
		border-radius: 50%;
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 0.85),
			inset 0 0 0 2px rgba(255, 255, 255, 0.6);
	}

	.ring .num {
		display: none;
	}

	.leader {
		flex: 1;
		min-width: 1rem;
		height: 0;
		border-top: 1.5px dashed rgba(96, 115, 159, 0.75);
	}

	.note {
		flex: none;
		display: grid;
		gap: 0.1rem;
		width: 13.5rem;
		padding: 0.5rem 0.7rem 0.55rem;
		border-left: 3px solid var(--magenta);
		border-radius: 2px 6px 6px 2px;
		background: var(--sheet);
		box-shadow: var(--sheet-shadow);
	}

	.title {
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		color: var(--ink);
	}

	.note .text {
		font-family: 'serif-text', serif;
		font-size: 0.8rem;
		line-height: 1.4;
		color: var(--ink-soft);
	}

	/* the list version of the notes, for narrow screens */
	figcaption {
		display: none;
	}

	/* ------------------------------------------------- entrance */

	.studio:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(18px);
	}

	.studio:global([data-reveal='out']) .callout {
		opacity: 0;
		transform: translate(-8px, -50%);
	}

	/* ------------------------------------------------- narrow: numbered */

	@media (max-width: 900px) {
		.studio {
			padding-right: 0;
		}

		.callout {
			right: auto;
		}

		.leader,
		.note {
			display: none;
		}

		.ring {
			width: 1.35rem;
			height: 1.35rem;
			margin-left: -0.675rem;
		}

		.ring .num {
			position: absolute;
			right: 70%;
			bottom: 70%;
			display: grid;
			place-items: center;
			width: 1.15rem;
			height: 1.15rem;
			border-radius: 50%;
			background: var(--ink);
			color: #fff;
			font-family: 'mono-bold', monospace;
			font-size: 0.66rem;
			line-height: 1;
		}

		figcaption {
			display: block;
		}

		.notes {
			display: grid;
			gap: 0.55rem;
			margin: 1.1rem 0 0;
			padding: 0;
			list-style: none;
		}

		.notes li {
			display: flex;
			gap: 0.6rem;
			align-items: baseline;
			font-family: 'serif-text', serif;
			font-size: 0.92rem;
			line-height: 1.45;
			color: var(--ink-soft);
		}

		.notes .num {
			flex: none;
			display: grid;
			place-items: center;
			width: 1.3rem;
			height: 1.3rem;
			border-radius: 50%;
			background: var(--ink);
			color: #fff;
			font-family: 'mono-bold', monospace;
			font-size: 0.7rem;
			transform: translateY(0.15rem);
		}

		.notes .title {
			font-size: 0.86rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.studio,
		.callout {
			transition: none;
		}
	}
</style>
