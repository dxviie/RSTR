<script lang="ts">
	// Call to action with an edge: a square box with a hard ink outline,
	// sitting on a flat offset plate. Hovering lifts it off the plate,
	// pressing pushes it down onto it. "primary" is an ink face on a magenta
	// plate, "ghost" a paper face on an ink plate.
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
		--plate: var(--ink, #1a202c);

		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.9rem;
		padding: 0.7rem 1.25rem 0.7rem 1.35rem;
		border: 2px solid var(--ink, #1a202c);
		border-radius: 0;
		font-family: 'mono-bold', monospace;
		font-size: 0.9rem;
		line-height: 1.1;
		white-space: nowrap;
		text-decoration: none;
		box-shadow: 4px 4px 0 var(--plate);
		transition:
			transform 0.14s cubic-bezier(0.3, 0.7, 0.4, 1),
			box-shadow 0.14s cubic-bezier(0.3, 0.7, 0.4, 1);
		/* moves on hover and press: keep it on its own layer */
		will-change: transform;
	}

	.cta svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: square;
		stroke-linejoin: miter;
		transition: transform 0.25s cubic-bezier(0.3, 0.7, 0.3, 1);
		will-change: transform;
	}

	.primary {
		--plate: var(--magenta, #ff2aa6);

		background: var(--ink, #1a202c);
		color: var(--paper, #fdfaff);
	}

	.ghost {
		background: var(--sheet, #fffef7);
		color: var(--ink, #1a202c);
	}

	.cta:hover {
		transform: translate(-2px, -2px);
		box-shadow: 6px 6px 0 var(--plate);
	}

	.cta:hover svg {
		transform: translateX(3px);
	}

	.cta:active {
		transform: translate(4px, 4px);
		box-shadow: 0 0 0 var(--plate);
		transition-duration: 0.05s;
	}

	.cta:focus-visible {
		outline: 2px solid var(--focus, #df0079);
		outline-offset: 4px;
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
