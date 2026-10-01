<script lang="ts">
	// The three pen layers of the CMY Milkmaid, pulled apart like sheets of
	// tracing paper in an exploded view. One layer per pen is exactly what
	// the exported SVG holds: one group each. The card around it fans the
	// sheets further apart by setting --pen-gap (on hover, for instance).
	import { HOW_PENS } from '$lib/landing/how';

	const TABS = ['C', 'M', 'Y'];
</script>

<div
	class="stack"
	role="img"
	aria-label="the Milkmaid's cyan, magenta and yellow pen layers, pulled apart like sheets of tracing paper"
>
	<div class="plane">
		{#each HOW_PENS as pen, i (pen.src)}
			<span class="layer" style="--i: {i}">
				<img
					src={pen.src}
					srcset={pen.srcset}
					sizes="160px"
					alt=""
					width={pen.width}
					height={pen.height}
					loading="lazy"
					decoding="async"
				/>
				<span class="tab">{TABS[i]}</span>
			</span>
		{/each}
	</div>
</div>

<style>
	.stack {
		position: relative;
		display: grid;
		place-items: center;
		height: 15rem;
		perspective: 1100px;
	}

	.plane {
		position: relative;
		width: 9.4rem;
		aspect-ratio: 1200 / 1345;
		transform-style: preserve-3d;
		transform: translateY(1.6rem) rotateX(57deg) rotateZ(-40deg);
	}

	.layer {
		position: absolute;
		inset: 0;
		border-radius: 2px;
		background: rgba(255, 254, 247, 0.42);
		box-shadow:
			0 0 0 1px rgba(96, 115, 159, 0.35),
			0 10px 18px -12px rgba(26, 32, 44, 0.35);
		transform: translateZ(calc(var(--i) * var(--pen-gap, 2.1rem)));
		transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.layer img {
		display: block;
		width: 100%;
		height: 100%;
	}

	.tab {
		position: absolute;
		top: -1px;
		left: 100%;
		display: grid;
		place-items: center;
		width: 1.1rem;
		height: 1.5rem;
		border-radius: 0 3px 3px 0;
		background: var(--cyan);
		font-family: 'mono-bold', monospace;
		font-size: 0.62rem;
		color: #fff;
	}

	.layer:nth-child(2) .tab {
		top: calc(1.5rem + 1px);
		background: var(--magenta);
	}

	.layer:nth-child(3) .tab {
		top: calc(3rem + 3px);
		background: var(--yellow);
		color: var(--ink);
	}

	@media (prefers-reduced-motion: reduce) {
		.layer {
			transition: none;
		}
	}
</style>
