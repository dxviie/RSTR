<script lang="ts">
	// Step 1, for real: pick a photo or video here (click, tap or keyboard)
	// or drop one on the zone, and the studio opens with it loaded. The file
	// goes over in memory ($lib/studioHandoff), nothing is uploaded. The
	// photo and the clip falling onto the zone are just the picture of it.
	import { goto } from '$app/navigation';
	import { HOW_PHOTO } from '$lib/landing/how';
	import { reveal } from '$lib/landing/reveal';
	import { handOffFile } from '$lib/studioHandoff';

	// a video, as a strip of frames panning across the same painting
	const FRAMES = ['20% 30%', '50% 40%', '80% 50%'];

	/** a file is being dragged over the zone */
	let over = $state(false);
	let status = $state<'idle' | 'opening' | 'wrong'>('idle');

	const open = (file: File | undefined) => {
		if (!file || status === 'opening') return;
		// the same rule as the studio's own picker
		if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
			status = 'wrong';
			return;
		}
		status = 'opening';
		handOffFile(file);
		void goto('/studio');
	};

	const dragover = (event: DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		over = true;
	};

	// moving onto a child of the zone isn't leaving it
	const dragleave = (event: DragEvent) => {
		const zone = event.currentTarget as Node;
		if (!zone.contains(event.relatedTarget as Node | null)) over = false;
	};

	const drop = (event: DragEvent) => {
		event.preventDefault();
		over = false;
		open(event.dataTransfer?.files?.[0]);
	};
</script>

<label
	class="drop"
	class:over
	ondragenter={dragover}
	ondragover={dragover}
	ondragleave={dragleave}
	ondrop={drop}
	use:reveal
>
	<input
		class="picker"
		type="file"
		accept="image/*,video/*"
		onchange={(event) => open(event.currentTarget.files?.[0])}
	/>
	<span class="zone">
		<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"
			><path d="M12 4v13M6.5 11.5 12 17l5.5-5.5M5 20h14" /></svg
		>
		<span class="hint" aria-live="polite">
			{#if status === 'opening'}
				<span class="lead">opening the studio…</span>
			{:else}
				{#if status === 'wrong'}
					<span class="lead wrong">that's not a photo or a video</span>
				{/if}
				<span class="lead mouse">drop a photo or video here</span>
				<span class="mouse">or click to choose one</span>
				<span class="lead touch">tap to choose a photo or video</span>
				<span class="note">it opens right in the studio</span>
			{/if}
		</span>
	</span>

	<span class="file video" aria-hidden="true">
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

	<span class="file photo" aria-hidden="true">
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
</label>

<style>
	.drop {
		position: relative;
		display: block;
		height: 17rem;
		max-width: 23rem;
		width: 100%;
		margin-inline: auto;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	/* the real file input: invisible, but there for keyboards and screen
	   readers, and what a click anywhere on the label opens */
	.picker {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		opacity: 0;
	}

	.zone {
		position: absolute;
		inset: 1.5rem 0 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
		padding: 0 1rem 1.1rem;
		border: 2px dashed var(--ink);
		background:
			radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 70%),
			rgba(238, 241, 246, 0.55);
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	/* pointing at it, or a file held over it: the zone wakes up */
	.drop:hover .zone,
	.drop.over .zone {
		border-color: var(--magenta-ink);
		background-color: rgba(255, 42, 166, 0.06);
	}

	.drop:has(.picker:focus-visible) .zone {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.arrow {
		width: 1.2rem;
		height: 1.2rem;
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
		will-change: transform;
		transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.drop:hover .arrow,
	.drop.over .arrow {
		stroke: var(--magenta-ink);
		transform: translateY(3px);
	}

	.hint {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		font-family: 'mono-light', monospace;
		font-size: 0.74rem;
		line-height: 1.45;
		text-align: center;
		color: var(--muted);
	}

	.lead {
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		color: var(--ink);
	}

	.wrong {
		color: var(--magenta-ink);
	}

	.note {
		margin-top: 0.25rem;
		font-size: 0.68rem;
	}

	/* touch screens have no drag and drop: just the tap */
	.touch {
		display: none;
	}

	@media (hover: none) {
		.mouse {
			display: none;
		}

		.touch {
			display: inline;
		}
	}

	.file {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 6px 6px 5px;
		border: 1.5px solid var(--ink);
		background: var(--sheet);
		box-shadow: 3px 3px 0 var(--ink);
		will-change: transform, opacity;
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
