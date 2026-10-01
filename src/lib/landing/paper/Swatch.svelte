<script lang="ts">
	// A hatched test stroke in the page margin, like the pen swatches on a
	// plotter calibration sheet, with a pencilled note of pen, gap and angle.
	// Decorative. Place it against the column edge (left/right: calc(50% -
	// 44rem)); as the margin narrows it slides off the window edge instead
	// of over the content, and it's hidden where there's no margin at all.
	// Where CSS scroll-driven animations exist it drifts a little as it
	// passes through the viewport (transform only), never under reduced
	// motion.
	import { hatch } from './hatch';

	const {
		color,
		angle = 45,
		gap = 6,
		width = 132,
		height = 168,
		tilt = 0,
		label = '',
		style = ''
	}: {
		color: string;
		angle?: number;
		gap?: number;
		width?: number;
		height?: number;
		tilt?: number;
		label?: string;
		style?: string;
	} = $props();

	const d = $derived(hatch(width, height, angle, gap));
</script>

<div class="swatch" style="--tilt: {tilt}deg; {style}" aria-hidden="true">
	<svg viewBox="0 0 {width} {height}" {width} {height}>
		<path {d} stroke={color} />
	</svg>
	{#if label}
		<span class="note">{label}</span>
	{/if}
</div>

<style>
	.swatch {
		position: absolute;
		z-index: 0;
		pointer-events: none;
		transform: rotate(var(--tilt));
	}

	svg {
		display: block;
		mix-blend-mode: multiply;
		opacity: 0.38;
	}

	path {
		fill: none;
		stroke-width: 1.4;
		stroke-linecap: round;
	}

	/* pencilled on a scrap of the page, so the bed grid doesn't cross it */
	.note {
		display: inline-block;
		margin-top: 0.4rem;
		padding: 0.1rem 0.3rem;
		background: var(--paper, #fdfaff);
		font-family: 'mono-light', monospace;
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: #60739f;
		white-space: nowrap;
	}

	@supports (animation-timeline: view()) {
		@media (prefers-reduced-motion: no-preference) {
			.swatch {
				animation: drift linear both;
				animation-timeline: view();
				animation-range: cover;
			}
		}
	}

	@keyframes drift {
		from {
			transform: translateY(46px) rotate(var(--tilt));
		}
		to {
			transform: translateY(-46px) rotate(var(--tilt));
		}
	}

	@media (max-width: 1199px) {
		.swatch {
			display: none;
		}
	}
</style>
