<script lang="ts">
	// A printer's registration mark (circle + crosshair), the kind the prep
	// tool adds so multi-pen plots line up. Decorative; place it with `style`.
	const { style = '', size = 22 }: { style?: string; size?: number } = $props();
</script>

<svg class="reg" viewBox="0 0 24 24" width={size} height={size} {style} aria-hidden="true">
	<circle cx="12" cy="12" r="6.5" />
	<path d="M12 .5v23M.5 12h23" />
</svg>

<style>
	.reg {
		position: absolute;
		fill: none;
		stroke: var(--reg-color, #60739f);
		stroke-width: 1;
		opacity: 0.6;
		pointer-events: none;
	}
</style>
