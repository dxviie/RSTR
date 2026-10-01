<script lang="ts">
	// Step 1, drawn: a photo and a video clip dropping onto the render, the
	// way you start in the studio. Decorative; the step's text says it all.
	import { HOW_PHOTO } from '$lib/landing/how';
	import { reveal } from '$lib/landing/reveal';

	// a video, as a strip of frames panning across the same painting
	const FRAMES = ['20% 30%', '50% 40%', '80% 50%'];
</script>

<div class="drop" aria-hidden="true" use:reveal>
	<div class="zone">
		<svg class="arrow" viewBox="0 0 24 24"><path d="M12 4v13M6.5 11.5 12 17l5.5-5.5M5 20h14" /></svg
		>
		<span class="hint">drop it on the render</span>
	</div>

	<span class="file video">
		<span class="film">
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
		<span class="name">clip.mp4</span>
	</span>

	<span class="file photo">
		<img
			src={HOW_PHOTO.src}
			alt=""
			width={HOW_PHOTO.width}
			height={HOW_PHOTO.height}
			loading="lazy"
			decoding="async"
		/>
		<span class="name">photo.jpg</span>
	</span>
</div>

<style>
	.drop {
		position: relative;
		height: 14rem;
		max-width: 23rem;
		width: 100%;
		margin-inline: auto;
	}

	.zone {
		position: absolute;
		inset: 1.5rem 0 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
		padding-bottom: 1.1rem;
		border: 1.5px dashed rgba(96, 115, 159, 0.6);
		border-radius: 14px;
		background:
			radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 70%),
			rgba(238, 241, 246, 0.55);
	}

	.arrow {
		width: 1.2rem;
		height: 1.2rem;
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.hint {
		font-family: 'mono-light', monospace;
		font-size: 0.74rem;
		color: var(--muted);
	}

	.file {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 6px 6px 5px;
		border-radius: 3px;
		background: var(--sheet);
		box-shadow: var(--sheet-shadow-lift);
		transition:
			opacity 0.6s ease,
			transform 0.8s cubic-bezier(0.25, 1.25, 0.4, 1);
	}

	.name {
		font-family: 'mono-bold', monospace;
		font-size: 0.64rem;
		color: var(--ink-soft);
		text-align: center;
	}

	.photo {
		top: 0;
		left: 50%;
		width: 7.6rem;
		margin-left: -5.6rem;
		transform: rotate(-6deg);
		transition-delay: 0.1s;
	}

	.photo img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1200 / 1345;
		object-fit: cover;
	}

	.video {
		top: 2.4rem;
		left: 50%;
		width: 8.6rem;
		margin-left: 0.2rem;
		transform: rotate(7deg);
		transition-delay: 0.3s;
	}

	/* a strip of film: three frames between sprocket holes */
	.film {
		display: flex;
		gap: 3px;
		padding: 7px 4px;
		border-radius: 2px;
		background:
			radial-gradient(circle, #fff 0 1.1px, transparent 1.6px) 0 1.5px / 7px 5px repeat-x,
			radial-gradient(circle, #fff 0 1.1px, transparent 1.6px) 0 calc(100% - 1.5px) / 7px 5px
				repeat-x,
			var(--ink);
	}

	.film img {
		display: block;
		flex: 1;
		min-width: 0;
		height: 2.9rem;
		object-fit: cover;
	}

	/* the files fall onto the zone and settle */
	.drop:global([data-reveal='out']) .photo {
		opacity: 0;
		transform: translate(-1.2rem, -2.2rem) rotate(-16deg);
	}

	.drop:global([data-reveal='out']) .video {
		opacity: 0;
		transform: translate(1.2rem, -2.6rem) rotate(16deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.file {
			transition: none;
		}
	}
</style>
