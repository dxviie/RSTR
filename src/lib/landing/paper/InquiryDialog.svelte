<script lang="ts">
	// The inquiry form in a dialog on the landing page: a sheet with the house
	// edge laid over the page, opened from the plot service's letter. It keeps
	// the lightbox's manners (the page stops scrolling, focus moves in and
	// back out, Escape closes it), and the form inside is the same TallyEmbed
	// the studio uses, blocked fallback and auto-close included.
	import { fade } from 'svelte/transition';
	import TallyEmbed, { type EmbedStatus } from '$lib/components/TallyEmbed.svelte';
	import { lockPage } from '$lib/landing/modal';
	import { landingInquiryFields } from '$lib/rstr2/order';
	import { INQUIRY_FORM_ID } from '$lib/rstr2/orderForm';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const FIELDS = landingInquiryFields();
	const uid = $props.id();

	let closeButton = $state<HTMLButtonElement>();
	let status = $state<EmbedStatus>('loading');

	const close = () => (open = false);

	$effect(() => {
		if (!open) return;
		return lockPage(closeButton);
	});
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
	<div class="overlay" transition:fade={{ duration: 160 }}>
		<div
			class="sheet"
			class:blocked={status === 'blocked'}
			role="dialog"
			aria-modal="true"
			aria-labelledby="{uid}-title"
		>
			<div class="head">
				<h2 id="{uid}-title">plan a plot with me</h2>
				<button
					class="close"
					type="button"
					aria-label="close"
					bind:this={closeButton}
					onclick={close}
				>
					×
				</button>
			</div>
			<TallyEmbed
				formId={INQUIRY_FORM_ID}
				fields={FIELDS}
				title="RSTR inquiry form"
				onclose={close}
				bind:status
			/>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(26, 32, 44, 0.55);
		/* fades in and out */
		will-change: opacity;
	}

	/* A fixed (viewport-capped) height that never scrolls as a whole: the
	   frame takes the free space, so the only scrollbar is the form's own.
	   The blocked fallback has no frame to fill and shrinks back to fit. */
	.sheet {
		--embed-edge: 1.5px solid var(--ink);
		--embed-radius: 0;

		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		width: min(42rem, 100%);
		height: min(50rem, calc(100dvh - 2rem));
		padding: 1rem;
		border: var(--edge);
		background: var(--sheet);
		box-shadow: var(--hard-lg);
		font-size: 0.9rem;
	}

	.sheet.blocked {
		height: auto;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	h2 {
		font-family: 'mono-bold', monospace;
		font-size: 1.05rem;
		line-height: 1.2;
		color: var(--ink);
	}

	/* the site-wide button rule forces size and hover paint, hence !important */
	.close {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		flex-shrink: 0;
		padding: 0;
		border: var(--edge);
		background: var(--sheet);
		color: var(--ink);
		font-family: 'mono-light', monospace;
		font-size: 1.35rem !important;
		line-height: 1;
		box-shadow: 2px 2px 0 var(--ink);
		cursor: pointer;
		transition:
			transform 0.14s cubic-bezier(0.3, 0.7, 0.4, 1),
			box-shadow 0.14s cubic-bezier(0.3, 0.7, 0.4, 1);
	}

	.close:hover {
		background: var(--sheet) !important;
		transform: translate(-1px, -1px);
		box-shadow: 3px 3px 0 var(--ink);
	}

	.close:active {
		transform: translate(2px, 2px);
		box-shadow: 0 0 0 var(--ink);
	}

	.close:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	/* phones: the form gets the room the gutters would take */
	@media (max-width: 560px) {
		.overlay {
			padding: 0.5rem;
		}

		.sheet {
			height: calc(100dvh - 1rem);
			padding: 0.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.close {
			transition: none;
		}
	}
</style>
