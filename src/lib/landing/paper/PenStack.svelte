<script lang="ts">
	// The three pen layers of the CMY Milkmaid, pulled apart like sheets of
	// tracing paper in an exploded view, stacked in plotting order: yellow
	// goes down first, so it sits at the bottom, then magenta, then cyan.
	// One layer per pen is exactly what the exported SVG holds: one group
	// each. The card around it fans the sheets further apart by setting
	// --pen-gap (on hover, for instance).
	import { HOW_PENS } from '$lib/landing/how';
</script>

<div
	class="stack"
	role="img"
	aria-label="the Milkmaid's yellow, magenta and cyan pen layers in plotting order, pulled apart like sheets of tracing paper"
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
				<span class="tab" style="--tab: {pen.ink}">{pen.pen}</span>
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

	/* a tab per sheet, like an index tab cut in the pen's color, near the
	   front corner: the sheets above cover the rest of each edge */
	.tab {
		position: absolute;
		top: calc(100% - 2.4rem);
		left: calc(100% - 1px);
		display: grid;
		place-items: center;
		width: 1.2rem;
		height: 1.5rem;
		border: 1.5px solid var(--ink);
		background: var(--tab);
		font-family: 'mono-bold', monospace;
		font-size: 0.62rem;
		color: var(--ink);
	}

	@media (prefers-reduced-motion: reduce) {
		.layer {
			transition: none;
		}
	}
</style>
