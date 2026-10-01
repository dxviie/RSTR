<script lang="ts">
	// Pill-shaped call to action. "primary" is ink on paper with a small
	// arrow that nudges forward on hover; "ghost" is an outlined pen line.
	import type { Snippet } from 'svelte';

	const {
		href,
		variant = 'primary',
		external = false,
		children
	}: {
		href: string;
		variant?: 'primary' | 'ghost';
		external?: boolean;
		children: Snippet;
	} = $props();
</script>

<a
	class="cta {variant}"
	{href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener' : undefined}
>
	<span>{@render children()}</span>
	<svg viewBox="0 0 16 16" aria-hidden="true">
		{#if external}
			<path d="M5.5 3.5h7v7M12.5 3.5l-9 9" />
		{:else}
			<path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
		{/if}
	</svg>
</a>

<style>
	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.9rem;
		padding: 0.7rem 1.35rem 0.7rem 1.5rem;
		border: 1.5px solid var(--ink, #1a202c);
		border-radius: 999px;
		font-family: 'mono-bold', monospace;
		font-size: 0.88rem;
		line-height: 1.1;
		white-space: nowrap;
		text-decoration: none;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			background-color 0.18s ease;
	}

	.cta svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.25s cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.primary {
		background: var(--ink, #1a202c);
		color: var(--paper, #fdfaff);
		/* a soft ink pool under the button */
		box-shadow: 0 1px 0 rgba(26, 32, 44, 0.12);
	}

	.primary:hover {
		background: var(--ink-soft, #2d3748);
		transform: translateY(-1px);
		box-shadow:
			0 6px 14px -6px rgba(26, 32, 44, 0.45),
			0 2px 0 rgba(26, 32, 44, 0.08);
	}

	.ghost {
		background: transparent;
		color: var(--ink, #1a202c);
		border-color: rgba(26, 32, 44, 0.32);
	}

	.ghost:hover {
		border-color: var(--ink, #1a202c);
		background: var(--sheet, #fffef7);
		transform: translateY(-1px);
	}

	.cta:hover svg {
		transform: translateX(3px);
	}

	.cta:active {
		transform: translateY(1px);
		box-shadow: none;
	}

	.cta:focus-visible {
		outline: 2px solid var(--focus, #df0079);
		outline-offset: 3px;
	}

	@media (max-width: 420px) {
		.cta {
			gap: 0.5rem;
			padding-inline: 1.1rem 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cta,
		.cta svg {
			transition: none;
		}
	}
</style>
