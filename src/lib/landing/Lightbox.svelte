<script lang="ts" module>
	export interface LightboxImage {
		src: string;
		srcset?: string;
		alt: string;
		/** the largest rendition, opened in a new tab for native zoom/pan */
		full?: string;
	}
</script>

<script lang="ts">
	// Near-fullscreen view of one picture. Tap anywhere or press Escape to
	// close; focus moves to the close button and returns to whatever opened
	// the box. "open full size" hands off to a new tab for unlimited zoom.
	import { fade } from 'svelte/transition';

	let { image = $bindable(null) }: { image?: LightboxImage | null } = $props();

	let closeButton = $state<HTMLButtonElement>();

	const close = () => (image = null);

	// Lock the page behind the overlay so only the image scrolls/zooms.
	// Hiding the scrollbar would widen the page and shift it sideways, so
	// the body is padded by the scrollbar's width for as long as it's gone.
	$effect(() => {
		if (!image) return;
		const opener = document.activeElement as HTMLElement | null;
		const { overflow, paddingRight } = document.body.style;
		const scrollbar = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = 'hidden';
		if (scrollbar > 0) {
			const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
			document.body.style.paddingRight = `${padding + scrollbar}px`;
		}
		closeButton?.focus();
		return () => {
			document.body.style.overflow = overflow;
			document.body.style.paddingRight = paddingRight;
			opener?.focus?.({ preventScroll: true });
		};
	});
</script>

<svelte:window onkeydown={(e) => image && e.key === 'Escape' && close()} />

{#if image}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label={image.alt}
		tabindex="-1"
		transition:fade={{ duration: 200 }}
		onclick={close}
	>
		<button
			class="lightbox-close"
			type="button"
			aria-label="close"
			bind:this={closeButton}
			onclick={close}
		>
			×
		</button>
		<img src={image.full ?? image.src} srcset={image.srcset} sizes="100vw" alt={image.alt} />
		<a
			class="lightbox-full"
			href={image.full ?? image.src}
			target="_blank"
			rel="noopener"
			onclick={(e) => e.stopPropagation()}
		>
			open full size ↗
		</a>
	</div>
{/if}

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4vmin;
		background: rgba(26, 32, 44, 0.92);
		cursor: zoom-out;
		/* fades in and out */
		will-change: opacity;
	}

	/* Fill the padded box and letterbox the picture inside it. Sizing the
	   element (not the content) sidesteps the srcset intrinsic-size trap:
	   some -1920w renditions are narrower than their descriptor claims, so
	   the browser under-computes the natural CSS size and max-width/height
	   alone would show them tiny. Tapping anywhere (image included) closes. */
	.lightbox img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.lightbox-close {
		position: absolute;
		top: 0.75rem;
		right: 1.1rem;
		padding: 0;
		background: none;
		border: none;
		color: #fff;
		font-family: 'mono-light', monospace;
		font-size: 2.25rem !important;
		line-height: 1;
		cursor: pointer;
		opacity: 0.8;
		transition: opacity 0.1s ease;
		will-change: opacity;
	}

	.lightbox-close:hover,
	.lightbox-close:focus-visible {
		opacity: 1;
		background: none !important;
		color: #fff !important;
	}

	.lightbox-full {
		position: absolute;
		bottom: 1.1rem;
		left: 50%;
		transform: translateX(-50%);
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		color: #fff;
		text-decoration: none;
		border: none;
		border-bottom: 1px dashed rgba(255, 255, 255, 0.55);
		opacity: 0.85;
		transition: opacity 0.1s ease;
	}

	.lightbox-full:hover {
		opacity: 1;
		border-bottom-color: #fff;
	}
</style>
