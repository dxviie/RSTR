<script lang="ts">
	// Section heading: three short pen strokes (cyan, magenta, yellow) that
	// draw themselves in as the heading scrolls into view, then the title.
	import type { Snippet } from 'svelte';
	import { reveal } from '$lib/landing/reveal';

	const {
		title,
		id,
		align = 'left',
		children
	}: {
		title: string;
		id?: string;
		align?: 'left' | 'center';
		/** the lede under the title */
		children?: Snippet;
	} = $props();
</script>

<header class="head {align}" use:reveal>
	<span class="strokes" aria-hidden="true"><i></i><i></i><i></i></span>
	<h2 {id}>{title}</h2>
	{#if children}
		<p class="lede">{@render children()}</p>
	{/if}
</header>

<style>
	.head {
		max-width: 40rem;
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.head.center {
		margin-inline: auto;
		text-align: center;
	}

	.strokes {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1.1rem;
	}

	.center .strokes {
		justify-content: center;
	}

	.strokes i {
		width: 2.6rem;
		height: 5px;
		background: var(--cyan);
		/* same function list in both states so it interpolates cleanly */
		transform: rotate(var(--r, -2deg)) scaleX(1);
		transform-origin: left center;
		transition: transform 0.55s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.strokes i:nth-child(2) {
		--r: 1.5deg;
		background: var(--magenta);
		transition-delay: 0.12s;
	}

	.strokes i:nth-child(3) {
		--r: -1deg;
		background: var(--yellow);
		transition-delay: 0.24s;
	}

	/* the strokes are drawn left to right once the heading arrives */
	.head:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(14px);
		/* promoted while it waits to scroll in, released once it has arrived */
		will-change: opacity, transform;
	}

	.head:global([data-reveal='out']) .strokes i {
		transform: rotate(var(--r, -2deg)) scaleX(0);
		will-change: transform;
	}

	h2 {
		font-family: 'mono-bold', monospace;
		font-size: clamp(2rem, 4.2vw, 3.15rem);
		line-height: 1.06;
		letter-spacing: -0.02em;
		color: var(--ink);
	}

	.lede {
		margin-top: 0.9rem;
		font-family: 'serif-text', serif;
		font-size: 1.06rem;
		line-height: 1.62;
		color: var(--ink-soft);
	}

	@media (prefers-reduced-motion: reduce) {
		.head,
		.strokes i {
			transition: none;
		}
	}
</style>
