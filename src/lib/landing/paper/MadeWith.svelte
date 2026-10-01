<script lang="ts">
	// #madewithrstr: the hashtag set huge in cyan, magenta and yellow
	// hatching with a pen outline, a copy button that ticks itself off, where
	// to post and tag, and the wall of plots with a spot left for yours.
	import type { Plot } from '$lib/landing/plots';
	import { reveal } from '$lib/landing/reveal';
	import { CONTACT_FORM, HASHTAG, SHARE_LINKS, copyText } from '$lib/landing/share';
	import PlotWall from './PlotWall.svelte';
	import Swatch from './Swatch.svelte';

	const { onopen }: { onopen: (plot: Plot) => void } = $props();

	let copied = $state(false);
	/** read out by screen readers through the live region */
	let status = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const copy = async () => {
		const ok = await copyText(HASHTAG);
		clearTimeout(timer);
		copied = ok;
		status = ok
			? `${HASHTAG} copied to your clipboard`
			: `Couldn't copy. Select ${HASHTAG} and copy it by hand.`;
		timer = setTimeout(() => {
			copied = false;
			status = '';
		}, 2600);
	};

	$effect(() => () => clearTimeout(timer));
</script>

<section class="madewith" aria-labelledby="madewithrstr">
	<Swatch
		color="#ffb000"
		angle={-62}
		gap={5}
		width={126}
		height={160}
		label="yellow · 0.5 mm · 62°"
		tilt={3}
		style="right: calc(50% - 44rem); top: 9rem"
	/>

	<div class="wrap">
		<header class="head" use:reveal>
			<p class="kicker">your turn</p>
			<div class="title-row">
				<h2 id="madewithrstr" class="tag">{HASHTAG}</h2>
				<button type="button" class="copy" class:done={copied} onclick={copy}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<g class="sheets">
							<rect x="8.5" y="8.5" width="11" height="11" rx="2" />
							<path d="M15.5 5.5V5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5" />
						</g>
						<path class="check" pathLength="1" d="M5 12.8l4.6 4.6L19.5 7" />
					</svg>
					<span class="label">
						<span class:on={!copied} aria-hidden={copied}>copy the tag</span>
						<span class:on={copied} aria-hidden={!copied}>copied</span>
					</span>
				</button>
			</div>
			<p class="lede">
				Made something with RSTR? Plotted, printed, or straight off the screen, post it with
				<span class="inline-tag">{HASHTAG}</span> and tag me. I'm collecting them for a community gallery
				right here.
			</p>
		</header>

		<div class="post" use:reveal>
			<span class="label-post">post it, tag me</span>
			<ul class="chips">
				{#each SHARE_LINKS as link (link.id)}
					<li>
						<a class="chip" href={link.href} target="_blank" rel="noopener">
							<span class="platform">{link.label}</span>
							<span class="handle">{link.handle}</span>
							<svg viewBox="0 0 16 16" aria-hidden="true"
								><path d="M5.5 3.5h7v7M12.5 3.5l-9 9" /></svg
							>
						</a>
					</li>
				{/each}
			</ul>
			<p class="direct">
				Rather not post it?
				<a href={CONTACT_FORM} target="_blank" rel="noopener">Send it to me directly</a>.
			</p>
		</div>

		<p class="sr-only" aria-live="polite">{status}</p>

		<PlotWall {onopen} oncopy={copy} {copied} />

		<p class="more">
			A few of mine to start the wall. More plots and works in progress over at
			<a href="https://d17e.dev/projects/rstr/" target="_blank" rel="noopener"
				>d17e.dev/projects/rstr</a
			>.
		</p>
	</div>
</section>

<style>
	.madewith {
		position: relative;
	}

	.wrap {
		position: relative;
		max-width: var(--wrap);
		margin: 0 auto;
		padding: var(--section-pad) var(--gutter);
	}

	.head {
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.head:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(16px);
	}

	.kicker {
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--magenta-ink);
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.75rem;
		margin-top: 0.35rem;
	}

	/* ------------------------------------------------- the hatched tag */

	.tag {
		/* fills the column on a phone (13 glyphs at 0.6em each), 108px max */
		font-size: min(6.75rem, calc((100vw - 2.75rem) / 7.9));
		font-family: 'mono-bold', monospace;
		line-height: 1.08;
		letter-spacing: 0;
		color: var(--ink);
	}

	/* where text can be clipped to a background: three inks of hatching,
	   overprinted, inside a pen outline. The hatching slides on hover. */
	@supports ((background-clip: text) or (-webkit-background-clip: text)) {
		.tag {
			color: transparent;
			-webkit-text-stroke: max(1px, 0.013em) var(--ink);
			background-image: var(--hatch-c), var(--hatch-m), var(--hatch-y);
			/* in em, so the hatching keeps its proportions at every size */
			background-size:
				0.085em 0.085em,
				0.085em 0.085em,
				0.066em 0.066em;
			background-position:
				0 0,
				0 0,
				0 0;
			background-blend-mode: multiply;
			-webkit-background-clip: text;
			background-clip: text;
			transition: background-position 1.6s cubic-bezier(0.3, 0.7, 0.3, 1);
		}

		.tag:hover {
			background-position:
				0.255em 0,
				-0.255em 0,
				0 0.132em;
		}
	}

	/* ------------------------------------------------- copy button */

	.copy {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.9rem;
		margin: 0;
		padding: 0.6rem 1.3rem 0.6rem 1.05rem;
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--sheet);
		color: var(--ink);
		font-size: 0.88rem !important;
		cursor: copy;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			background-color 0.25s ease,
			color 0.25s ease;
	}

	.copy:hover {
		background-color: var(--sheet) !important;
		color: var(--ink) !important;
		transform: translateY(-1px);
		box-shadow: 0 6px 14px -6px rgba(26, 32, 44, 0.35);
	}

	.copy:active {
		transform: translateY(1px);
		box-shadow: none;
	}

	.copy:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.copy.done,
	.copy.done:hover {
		background-color: var(--ink) !important;
		color: #fff !important;
	}

	.copy svg {
		width: 1.25rem;
		height: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		overflow: visible;
	}

	.sheets {
		transform-origin: center;
		transition:
			opacity 0.2s ease,
			transform 0.25s ease;
	}

	/* the tick inks itself in, the two sheets drop away */
	.check {
		stroke: var(--yellow);
		stroke-width: 2.4;
		stroke-dasharray: 1 2;
		stroke-dashoffset: 1;
		transition: stroke-dashoffset 0.4s cubic-bezier(0.6, 0, 0.3, 1);
	}

	.done .sheets {
		opacity: 0;
		transform: scale(0.6);
	}

	.done .check {
		stroke-dashoffset: 0;
		transition-delay: 0.08s;
	}

	/* both labels share one cell, so the button keeps its width */
	.label {
		display: grid;
		justify-items: start;
	}

	.label span {
		grid-area: 1 / 1;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.label span.on {
		opacity: 1;
	}

	.lede {
		max-width: 40rem;
		margin-top: 1.4rem;
		font-family: 'serif-text', serif;
		font-size: 1.1rem;
		line-height: 1.65;
		color: var(--ink-soft);
	}

	.inline-tag {
		font-family: 'mono-bold', monospace;
		font-size: 0.92em;
		color: var(--magenta-ink);
		white-space: nowrap;
	}

	/* ------------------------------------------------- where to post */

	.post {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		margin-top: 1.75rem;
		transition:
			opacity 0.7s ease 0.1s,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s;
	}

	.post:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(14px);
	}

	.label-post {
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		min-height: 2.6rem;
		padding: 0.62rem 0.9rem 0.6rem 1rem;
		border: 1px solid #d3d9e3;
		border-radius: 999px;
		background: var(--sheet);
		color: var(--ink);
		text-decoration: none;
		transition:
			border-color 0.15s ease,
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.chip:hover {
		border-color: var(--ink);
		transform: translateY(-1px);
		box-shadow: 0 5px 12px -6px rgba(26, 32, 44, 0.35);
	}

	.chip:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.platform {
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
	}

	.handle {
		font-family: 'mono-light', monospace;
		font-size: 0.8rem;
		color: var(--ink-soft);
	}

	.chip svg {
		align-self: center;
		width: 0.8rem;
		height: 0.8rem;
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.2s ease;
	}

	.chip:hover svg {
		transform: translate(1.5px, -1.5px);
	}

	.direct {
		flex-basis: 100%;
		font-family: 'serif-text', serif;
		font-size: 0.98rem;
		color: var(--ink-soft);
	}

	.direct a,
	.more a {
		color: var(--ink);
		border-bottom: 1px dashed var(--muted);
	}

	.direct a:hover,
	.more a:hover {
		border-bottom-color: var(--magenta);
	}

	.direct a:focus-visible,
	.more a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.more {
		margin-top: 1.4rem;
		font-family: 'serif-text', serif;
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--muted);
		text-align: center;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 560px) {
		.post {
			align-items: flex-start;
			flex-direction: column;
		}

		.chip {
			flex-wrap: wrap;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.head,
		.post,
		.copy,
		.sheets,
		.check,
		.label span,
		.chip,
		.chip svg {
			transition: none;
		}

		.tag {
			transition: none;
		}
	}
</style>
