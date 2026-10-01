<script lang="ts">
	// "d17e", signed in fineliner: each stroke inks itself in at an even
	// writing speed, with short pen lifts between them, once it scrolls in.
	import { reveal } from '$lib/landing/reveal';

	// [path, start (s), duration (s)]: durations follow each stroke's length
	const STROKES: [string, number, number][] = [
		[
			'M46 53C42 46 32 46 27 51c-6 6-6 17 2 20 8 3 15-5 18-14 3-10 7-28 10-43 1-5-3-6-4-1-2 16-3 38-3 50 0 7 4 9 9 4',
			0,
			0.58
		],
		['M67 27c4-3 9-8 12-14-1 17-4 39-7 58', 0.68, 0.24],
		['M88 17c8 1 17-1 27-4-6 15-15 37-21 59', 1, 0.28],
		['M96 45c5-1 11-2 16-3', 1.36, 0.12],
		[
			'M123 61c8 0 18-4 18-11 0-6-7-7-12-2-6 6-6 18 1 22 8 5 21-1 31-10 8-7 17-10 16-2-2 14-52 27-153 30',
			1.56,
			0.85
		]
	];
</script>

<span class="signature" use:reveal>
	<svg viewBox="0 0 220 100" role="img" aria-label="signed, d17e">
		<g transform="translate(18 0) skewX(-13)">
			{#each STROKES as [d, at, duration] (d)}
				<path pathLength="1" {d} style="--at: {at}s; --duration: {duration}s" />
			{/each}
		</g>
	</svg>
</span>

<style>
	.signature {
		display: block;
		width: 11.5rem;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.3;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1 2;
		stroke-dashoffset: 0;
		transition: stroke-dashoffset var(--duration) cubic-bezier(0.4, 0, 0.6, 1)
			calc(0.35s + var(--at));
	}

	.signature:global([data-reveal='out']) path {
		stroke-dashoffset: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		path {
			transition: none;
		}
	}
</style>
