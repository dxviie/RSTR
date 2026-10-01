<script lang="ts">
	// The real studio, framed as a browser window, with every section of it
	// outlined and numbered: the map from the help page, in ink only. Wide,
	// the left pane's sections (and the render) are labelled in a column left
	// of the window and the right pane's in a column to its right, each label
	// tied to its outline by a thin leader. Narrow, the outlines keep their
	// numbers and the labels become a legend under the picture. Pointing at
	// a label or an outline lights up its partner; each label links to its
	// part of the help page.
	import type { LightboxImage } from '$lib/landing/Lightbox.svelte';
	import { HOW_STUDIO } from '$lib/landing/how';
	import { reveal } from '$lib/landing/reveal';

	const { onzoom }: { onzoom: (image: LightboxImage) => void } = $props();

	interface Part {
		n: number;
		name: string;
		line: string;
		/** the help page section that documents it */
		help: string;
		side: 'left' | 'right';
		/** the outline: x, y, width, height in % of the 1440 × 900 screenshot */
		box: [number, number, number, number];
		/** where the leader meets the outline, in % of the screenshot height */
		ly: number;
		/** shares its top edge with the outline above, so that edge is drawn once */
		joined?: boolean;
		/** the number sits in the bottom corner, off the values at the top */
		low?: boolean;
	}

	// Measured from the DOM of the studio in the screenshot's exact state (the
	// panel groups, the render canvas, the stats box), padded 6px so the lines
	// clear the controls. Export and stats sit only 7px apart, so they share an
	// edge. The render's leader runs through the empty strip under the lines.
	// The numbers sit top right, where the group titles leave room.
	const PARTS: Part[] = [
		{
			n: 1,
			name: 'image',
			line: 'tune the photo before tracing',
			help: 'image',
			side: 'left',
			box: [0.42, 5.27, 17.99, 27.1],
			ly: 18.8
		},
		{
			n: 2,
			name: 'segmentation',
			line: "how it's carved into regions",
			help: 'segmentation',
			side: 'left',
			box: [0.42, 33.81, 17.99, 20.68],
			ly: 43.5
		},
		{
			n: 3,
			name: 'lines',
			line: 'pen width, spacing and ink',
			help: 'lines',
			side: 'left',
			box: [0.42, 55.93, 17.99, 29.32],
			ly: 67
		},
		{
			n: 4,
			name: 'the render',
			line: 'drag, zoom and rotate to frame it',
			// framing on the render is documented with the image controls
			help: 'image',
			side: 'left',
			box: [23.73, 5.27, 52.54, 94.07],
			ly: 90
		},
		{
			n: 5,
			name: 'presets',
			line: 'roll the dice or save a look',
			help: 'presets',
			side: 'right',
			box: [81.6, 5.27, 17.99, 17.74],
			ly: 12.5
		},
		{
			n: 6,
			name: 'layers',
			line: 'one pen each, own color and angles',
			help: 'layers',
			side: 'right',
			box: [81.6, 24.44, 17.99, 15.64],
			ly: 32
		},
		{
			n: 7,
			name: 'export',
			line: 'SVG or PNG, any page size',
			help: 'export',
			side: 'right',
			box: [81.6, 41.54, 17.99, 21.69],
			ly: 51.5
		},
		{
			n: 8,
			name: 'stats',
			line: 'lines, regions and plot time',
			help: 'stats',
			side: 'right',
			box: [81.6, 63.23, 17.99, 12.61],
			ly: 70.5,
			joined: true,
			low: true
		}
	];

	/** entrance order: both columns at once, top to bottom (1 and 5, 2 and 6, ...) */
	const row = (part: Part) => (part.n - 1) % 4;

	/** the outline edge a label's leader runs to, in % of the screenshot width */
	const edge = ({ side, box: [x, , w] }: Part) => (side === 'left' ? x : +(x + w).toFixed(2));

	/** the part under the pointer or keyboard focus, lit on both sides */
	let active = $state<number | null>(null);

	// touch has no hover: a tap opens the picture or the help page instead
	const point = (e: PointerEvent, n: number | null) => {
		if (e.pointerType !== 'touch') active = n;
	};

	const pointShot = (e: PointerEvent) => {
		const box = (e.target as Element).closest<HTMLElement>('[data-n]');
		point(e, box ? Number(box.dataset.n) : null);
	};

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
			<span class="dots"><i></i><i></i><i></i></span>
			<span class="url">rstr.d17e.dev/studio</span>
		</div>
		<button
			type="button"
			class="zoom"
			aria-label="enlarge: {HOW_STUDIO.alt}"
			onclick={zoom}
			onpointerover={pointShot}
			onpointerleave={(e) => point(e, null)}
		>
			<img
				src={HOW_STUDIO.src}
				srcset={HOW_STUDIO.srcset}
				sizes="(min-width: 1081px) 620px, (min-width: 641px) calc(100vw - 9rem), 94vw"
				alt={HOW_STUDIO.alt}
				width={HOW_STUDIO.width}
				height={HOW_STUDIO.height}
				loading="lazy"
				decoding="async"
			/>
			<span class="boxes" aria-hidden="true">
				{#each PARTS as part (part.n)}
					<span
						class="box"
						class:joined={part.joined}
						class:low={part.low}
						class:on={active === part.n}
						data-n={part.n}
						style:left="{part.box[0]}%"
						style:top="{part.box[1]}%"
						style:width="{part.box[2]}%"
						style:height="{part.box[3]}%"
						style:--i={row(part)}
					>
						<span class="tag">{part.n}</span>
					</span>
				{/each}
			</span>
		</button>
	</div>
	<figcaption>
		<ol class="labels">
			{#each PARTS as part (part.n)}
				<li
					class="label {part.side}"
					class:on={active === part.n}
					style:--x={edge(part)}
					style:--ly={part.ly}
					style:--i={row(part)}
				>
					<a
						href="/help#{part.help}"
						onpointerenter={(e) => point(e, part.n)}
						onpointerleave={(e) => point(e, null)}
						onfocus={() => (active = part.n)}
						onblur={() => (active = null)}
					>
						<span class="num">{part.n}</span>
						<span class="name">{part.name}</span>
						<span class="line">{part.line}</span>
					</a>
					<span class="leader" aria-hidden="true"></span>
				</li>
			{/each}
		</ol>
	</figcaption>
</figure>

<style>
	.studio {
		/* the window's ink edge, and the chrome bar including its rule */
		--frame: 2px;
		--chrome: 1.9rem;
		/* the numbered squares in the labels */
		--tag: 1.05rem;
		/* wide only: a margin column each side of the window for the labels
		   and the start of their leaders, and the text width inside it */
		--col: 11.75rem;
		--text: 9.6rem;
		/* the first line of a label, where its leader leaves */
		--head: 1.3rem;

		position: relative;
		margin: 2rem 0 0;
		container: studio / inline-size;
	}

	/* ------------------------------------------------- the window */

	.window {
		position: relative;
		/* room for the offset shadow, so the window still sits in the column */
		margin-right: 6px;
		border: var(--edge);
		background: var(--sheet);
		box-shadow: var(--hard-lg);
	}

	.chrome {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: var(--chrome);
		padding: 0 0.6rem;
		border-bottom: var(--edge);
		background: var(--sheet);
	}

	.dots {
		display: flex;
		gap: 0.3rem;
	}

	.dots i {
		width: 0.55rem;
		height: 0.55rem;
		border: 1.5px solid var(--ink);
	}

	.url {
		padding: 0.1rem 0.9rem;
		border: 1.5px solid var(--ink);
		background: var(--paper);
		font-family: 'mono-light', monospace;
		font-size: 0.7rem;
		line-height: 1.35;
		color: var(--ink);
		white-space: nowrap;
	}

	.zoom {
		position: relative;
		display: block;
		width: 100%;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0;
		background: none !important;
		cursor: zoom-in;
		transition: none;
	}

	/* the layout's global button press nudge would shake the whole picture */
	.zoom:active {
		transform: none;
	}

	.zoom:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.zoom img {
		display: block;
		width: 100%;
		height: auto;
	}

	/* ------------------------------------------------- the outlines */

	.boxes {
		position: absolute;
		inset: 0;
	}

	.box {
		position: absolute;
		border: 1.5px solid var(--ink);
	}

	.box.joined {
		border-top: none;
	}

	/* lit: a magenta wash and edge, faded in on its own layer */
	.box::after {
		content: '';
		position: absolute;
		inset: -1.5px;
		border: 2px solid var(--magenta-ink);
		background: rgba(255, 42, 166, 0.06);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.box.on::after {
		opacity: 1;
	}

	.tag {
		position: absolute;
		z-index: 1;
		top: -1.5px;
		right: -1.5px;
		display: grid;
		place-items: center;
		width: 0.95rem;
		height: 0.95rem;
		background: var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.6rem;
		line-height: 1;
		color: var(--paper);
	}

	.box.low .tag {
		top: auto;
		bottom: -1.5px;
	}

	.box.on .tag {
		background: var(--magenta-ink);
	}

	/* ------------------------------------------------- the labels: legend */

	figcaption {
		margin-top: 1.6rem;
	}

	.labels {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(4, auto);
		/* down the left column first, like the panes: 1-4 left, 5-8 right */
		grid-auto-flow: column;
		gap: 0.15rem clamp(1.5rem, 4vw, 3rem);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* number and name, the line under the name */
	.label a {
		display: grid;
		grid-template-columns: var(--tag) minmax(0, 1fr);
		grid-template-areas: 'num name' '. line';
		gap: 0.1rem 0.6rem;
		align-items: center;
		min-height: 2.5rem;
		padding: 0.4rem 0;
		border: none;
		color: var(--ink);
	}

	.num {
		grid-area: num;
		display: grid;
		place-items: center;
		width: var(--tag);
		height: var(--tag);
		background: var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.64rem;
		line-height: 1;
		color: var(--paper);
	}

	.name {
		grid-area: name;
		font-family: 'mono-bold', monospace;
		font-size: 0.84rem;
		line-height: 1.3;
	}

	.line {
		grid-area: line;
		text-wrap: balance;
		font-family: 'serif-text', serif;
		font-size: 0.86rem;
		line-height: 1.4;
		color: var(--ink-soft);
	}

	.label a:hover .name {
		text-decoration: underline;
		text-decoration-thickness: 1.5px;
		text-underline-offset: 0.2em;
	}

	.label a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.label.on .num {
		background: var(--magenta-ink);
	}

	.leader {
		display: none;
	}

	@container studio (max-width: 560px) {
		.labels {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			grid-auto-flow: row;
		}

		/* the outlines are small here: keep the numbers from covering them */
		.tag {
			width: 0.8rem;
			height: 0.8rem;
			font-size: 0.52rem;
		}
	}

	/* room for a table: number, name and line on one row, names aligned */
	@container studio (min-width: 760px) {
		.label a {
			grid-template-columns: var(--tag) 6.6rem minmax(0, 1fr);
			grid-template-areas: 'num name line';
			align-items: baseline;
		}
	}

	/* ------------------------------------------------- the labels: margins */

	@container studio (min-width: 940px) {
		.window {
			/* and room underneath for the render's label, which hangs low */
			margin: 0 var(--col) 1rem;
		}

		figcaption {
			position: absolute;
			inset: 0;
			margin: 0;
			pointer-events: none;
		}

		/* exactly over the screenshot, so labels can sit at % of its height */
		.labels {
			position: absolute;
			top: calc(var(--frame) + var(--chrome));
			left: calc(var(--col) + var(--frame));
			right: calc(var(--col) + var(--frame));
			display: block;
			aspect-ratio: 1440 / 900;
		}

		/* each label runs from the margin to the edge of its outline */
		.label {
			position: absolute;
			top: calc(var(--ly) * 1%);
			display: grid;
			margin-top: calc(var(--head) / -2);
		}

		.label.left {
			left: calc(-1 * (var(--col) + var(--frame)));
			right: calc((100 - var(--x)) * 1%);
			grid-template-columns: var(--text) minmax(0, 1fr);
		}

		.label.right {
			left: calc(var(--x) * 1%);
			right: calc(-1 * (var(--col) + var(--frame)));
			grid-template-columns: minmax(0, 1fr) var(--text);
		}

		.label a {
			grid-row: 1;
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-areas: 'num name' 'line line';
			gap: 0.1rem 0.45rem;
			align-items: center;
			min-height: 0;
			padding: 0;
			pointer-events: auto;
		}

		.label.left a {
			grid-column: 1;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'name num' 'line line';
			text-align: right;
		}

		.label.right a {
			grid-column: 2;
		}

		.name {
			line-height: var(--head);
		}

		.line {
			font-size: 0.8rem;
			line-height: 1.35;
		}

		.leader {
			grid-row: 1;
			display: block;
			align-self: start;
			height: 1px;
			margin-top: calc(var(--head) / 2 - 0.5px);
			background: var(--ink);
		}

		.label.left .leader {
			grid-column: 2;
			margin-left: 0.45rem;
			transform-origin: left;
		}

		.label.right .leader {
			grid-column: 1;
			margin-right: 0.45rem;
			transform-origin: right;
		}

		.label.on .leader {
			background: var(--magenta-ink);
		}
	}

	/* ------------------------------------------------- entrance */

	/* the outlines appear, the leaders draw out from the labels, the labels
	   follow; transitions only on the way in, so hiding is instant */
	.studio:global([data-reveal='out']) .box,
	.studio:global([data-reveal='out']) .label a {
		opacity: 0;
	}

	.studio:global([data-reveal='out']) .leader {
		transform: scaleX(0);
	}

	.studio:global([data-reveal='in']) .box {
		transition: opacity 0.4s ease calc(0.2s + var(--i) * 0.1s);
	}

	.studio:global([data-reveal='in']) .leader {
		transition: transform 0.45s cubic-bezier(0.3, 0.7, 0.3, 1) calc(0.35s + var(--i) * 0.1s);
	}

	.studio:global([data-reveal='in']) .label a {
		transition: opacity 0.4s ease calc(0.5s + var(--i) * 0.1s);
	}

	/* reveal() never hides anything under reduced motion; this covers the
	   setting changing while the page is open */
	@media (prefers-reduced-motion: reduce) {
		.studio:global([data-reveal]) .box,
		.studio:global([data-reveal]) .leader,
		.studio:global([data-reveal]) .label a {
			transition: none;
		}
	}
</style>
