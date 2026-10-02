<script lang="ts">
	// "David", signed in fineliner: each stroke inks itself in at an even
	// writing speed, with short pen lifts between them, once it scrolls in.
	// The pen goes D, "avi", "d", then back for the dot on the i, and
	// finishes with the underline.
	import { reveal } from '$lib/landing/reveal';

	// [path, start (s), duration (s)]: durations follow each stroke's length
	const STROKES: [string, number, number][] = [
		['M31 21C31 38 30 56 28 72', 0, 0.17],
		['M22 26C40 13 68 17 71 40C74 63 50 76 25 71', 0.29, 0.42],
		[
			'M97 52C91 46 81 47 78 55C75 63 80 72 87 70C92 68 95 60 97 52C96 60 96 68 100 72C104 66 106 57 108 51C110 60 112 68 115 72C119 64 123 56 126 50C127 57 127 66 131 72',
			0.83,
			0.6
		],
		[
			'M154 52C148 46 137 48 134 56C131 64 136 73 143 71C150 69 154 60 156 50C158 38 160 26 162 16C162 30 160 52 161 68C162 73 167 72 171 68',
			1.55,
			0.57
		],
		['M127 39l3.5-1.5', 2.27, 0.1],
		['M40 84C82 80 132 79 184 73', 2.52, 0.48]
	];
</script>

<span class="signature" use:reveal>
	<svg viewBox="0 0 220 100" role="img" aria-label="signed, David">
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
