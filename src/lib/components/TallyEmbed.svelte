<script lang="ts" module>
	/** Where an embedded form stands: waiting for a sign of life, up, or blocked. */
	export type EmbedStatus = 'loading' | 'ready' | 'blocked';
</script>

<script lang="ts">
	// One embedded Tally form with a sign-of-life watchdog, shared by the
	// studio's order dialog and the landing page's inquiry dialog. The frame
	// is a plain iframe on Tally's /embed/ path, and the messages it posts
	// flip it from loading to ready. When none arrive within the timeout (a
	// strict content blocker is the usual reason), it offers the same form as
	// a plain link instead. The frame stays mounted behind that fallback, so
	// a slow form still revives it the moment it reports in. After a
	// submission the thank-you page stays up for a moment, then onclose runs.
	//
	// The host owns the dialog chrome (card, title, close button) and lays
	// these blocks out in a flex column: the frame takes the free height, so
	// the only scrollbar is the form's own. Text sizes follow the host's font
	// size, colors its --ink, --ink-soft and --muted, and --embed-edge and
	// --embed-radius restyle the frame and the fallback's button.
	import {
		EMBED_AUTOCLOSE_MS,
		EMBED_TIMEOUT_MS,
		formEmbedUrl,
		formSignal,
		formUrl
	} from '$lib/rstr2/orderForm';

	// $props() is destructured in one go and only the bindable status is
	// ever reassigned, which the core prefer-const rule can't see
	/* eslint-disable prefer-const */
	let {
		formId,
		fields,
		title,
		onclose,
		status = $bindable('loading')
	}: {
		formId: string;
		/** hidden-field payload, sent as query params */
		fields: Record<string, string>;
		/** the iframe's accessible name */
		title: string;
		/** closes the host dialog: the fallback's button, and the auto-close */
		onclose: () => void;
		status?: EmbedStatus;
	} = $props();
	/* eslint-enable prefer-const */

	const src = $derived(formEmbedUrl(formId, fields));
	const fallback = $derived(formUrl(formId, fields));

	let timer = 0;

	// every form that loads gets its own watchdog
	$effect(() => {
		void src;
		status = 'loading';
		timer = window.setTimeout(() => {
			if (status === 'loading') status = 'blocked';
		}, EMBED_TIMEOUT_MS);
		return () => window.clearTimeout(timer);
	});

	const onmessage = (event: MessageEvent) => {
		const signal = formSignal(formId, event.origin, event.data);
		if (!signal) return;
		status = 'ready';
		if (signal === 'submitted') {
			window.clearTimeout(timer);
			timer = window.setTimeout(onclose, EMBED_AUTOCLOSE_MS);
		}
	};
</script>

<svelte:window {onmessage} />

{#if status === 'blocked'}
	<p class="note">
		the form isn't loading in here, usually because a strict ad or content blocker is being careful.
		the same form, details and all, works in its own tab:
		<a href={fallback} target="_blank" rel="noreferrer">open the form ↗</a>
	</p>
	<div class="actions">
		<button type="button" onclick={onclose}>close</button>
	</div>
{/if}
<div class="frame" class:blocked={status === 'blocked'}>
	{#if status === 'loading'}
		<div class="loading">
			<span class="dot" aria-hidden="true"></span>
			loading the form…
		</div>
	{/if}
	<iframe {src} {title} allow="fullscreen"></iframe>
</div>
{#if status !== 'blocked'}
	<p class="note">
		form stuck? <a href={fallback} target="_blank" rel="noreferrer">open it in a new tab ↗</a>
	</p>
{/if}

<style>
	.note {
		margin: 0;
		font-size: 0.9em;
		line-height: 1.45;
		color: var(--ink-soft);
	}

	.note a {
		color: var(--ink);
		text-decoration: underline;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	/* the site-wide button rule forces a font size, hence !important */
	.actions button {
		padding: 0.4rem 0.7rem;
		border: var(--embed-edge, 1px solid var(--border, #e1e4e8));
		border-radius: var(--embed-radius, 8px);
		background: #fff;
		color: var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.94em !important;
		cursor: pointer;
	}

	.frame {
		position: relative;
		flex: 1 1 auto;
		min-height: 200px;
		border: var(--embed-edge, 1px solid var(--border, #e1e4e8));
		border-radius: var(--embed-radius, 8px);
		overflow: hidden;
		background: #fff;
	}

	/* kept mounted (display:none still loads) so a late form can revive it */
	.frame.blocked {
		display: none;
	}

	.loading {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.94em;
		color: var(--muted);
		background: #fff;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--muted);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
	}

	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}
</style>
