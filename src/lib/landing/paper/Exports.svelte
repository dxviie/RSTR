<script lang="ts">
	// What comes out of the studio for people with their own toolchain: a
	// fan of files. The card around it spreads the fan by setting --spread
	// (on hover, for instance). Decorative; the card's text lists them.
	import { HOW_CMY, HOW_LINES_PAPER, HOW_PHOTO } from '$lib/landing/how';

	const FRAMES = ['15% 30%', '50% 45%', '85% 55%'];
</script>

<div class="files" aria-hidden="true">
	<span class="file" style="--i: -1.5">
		<span class="thumb">
			<img
				src={HOW_CMY.src}
				alt=""
				width={HOW_CMY.width}
				height={HOW_CMY.height}
				loading="lazy"
				decoding="async"
			/>
		</span>
		<span class="ext">.svg</span>
		<span class="what">layered</span>
	</span>
	<span class="file" style="--i: -0.5">
		<span class="thumb">
			<img
				src={HOW_LINES_PAPER.src}
				alt=""
				width={HOW_LINES_PAPER.width}
				height={HOW_LINES_PAPER.height}
				loading="lazy"
				decoding="async"
			/>
		</span>
		<span class="ext">.png</span>
		<span class="what">to print</span>
	</span>
	<span class="file" style="--i: 0.5">
		<span class="thumb frames">
			{#each FRAMES as position (position)}
				<img
					src={HOW_PHOTO.src}
					alt=""
					width={HOW_PHOTO.width}
					height={HOW_PHOTO.height}
					loading="lazy"
					decoding="async"
					style="object-position: {position}"
				/>
			{/each}
		</span>
		<span class="ext">.zip</span>
		<span class="what">every frame</span>
	</span>
	<span class="file" style="--i: 1.5">
		<span class="thumb code">
			<i style="--w: 40%"></i>
			<i style="--w: 72%; --c: var(--cyan)"></i>
			<i style="--w: 58%; --c: var(--magenta)"></i>
			<i style="--w: 66%; --c: var(--yellow)"></i>
			<i style="--w: 48%"></i>
			<i style="--w: 30%"></i>
		</span>
		<span class="ext">.json</span>
		<span class="what">your look</span>
	</span>
</div>

<style>
	.files {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 15rem;
	}

	/* a loose hand of cards: overlapping a little, outer ones tilted and
	   lower; --spread (set by the card around it) opens the hand */
	.file {
		position: relative;
		flex: none;
		display: flex;
		flex-direction: column;
		width: clamp(3.9rem, 17vw, 5.4rem);
		margin: 0 -0.32rem;
		padding: 5px 5px 6px;
		border-radius: 3px;
		background: var(--sheet);
		box-shadow: var(--sheet-shadow-lift);
		transform: translate(
				calc(var(--i) * (var(--spread, 1) - 1) * 1.6rem),
				calc(var(--i) * var(--i) * 3px)
			)
			rotate(calc(var(--i) * 4deg * var(--spread, 1)));
		transition: transform 0.5s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.thumb {
		display: block;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: #fffef7;
	}

	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.frames {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 5px 7px;
		background:
			radial-gradient(circle, #fff 0 1px, transparent 1.5px) 1.5px 0 / 5px 6px repeat-y,
			radial-gradient(circle, #fff 0 1px, transparent 1.5px) calc(100% - 1.5px) 0 / 5px 6px repeat-y,
			var(--ink);
	}

	.frames img {
		flex: 1;
		min-height: 0;
	}

	.code {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.42rem;
		padding: 0.6rem 0.55rem;
		background: #f4f5f8;
	}

	.code i {
		display: block;
		width: var(--w);
		height: 3px;
		border-radius: 2px;
		background: var(--c, #c3cad6);
	}

	.code i:nth-child(n + 2):nth-child(-n + 4) {
		margin-left: 0.45rem;
	}

	.ext {
		margin-top: 0.4rem;
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		line-height: 1.1;
		color: var(--ink);
	}

	.what {
		font-family: 'mono-light', monospace;
		font-size: 0.6rem;
		line-height: 1.3;
		color: var(--muted);
	}

	/* narrow cards: the extensions say enough */
	@media (max-width: 440px) {
		.what {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.file {
			transition: none;
		}
	}
</style>
