<script lang="ts">
	// A steel pin magnet holding a sheet down on the plotter bed, like the
	// ones in the real plot photos. Decorative. Place it with `style`
	// (left/right/top/bottom of its center point inside a positioned parent).
	const { style = '' }: { style?: string } = $props();
</script>

<span class="magnet" {style} aria-hidden="true"></span>

<style>
	.magnet {
		position: absolute;
		z-index: 3;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border-radius: 50%;
		/* a polished steel cap, lit from the top left */
		background:
			radial-gradient(circle at 36% 30%, #fff 0 12%, rgba(255, 255, 255, 0) 38%),
			radial-gradient(circle at 50% 46%, #e3e6ea 0 30%, #a3aab5 62%, #6c7482 100%);
		/* a short cast shadow falling down and to the left, like the photos */
		box-shadow:
			0 0 0 0.5px rgba(26, 32, 44, 0.38),
			-1px 2px 2px rgba(26, 32, 44, 0.22),
			-3px 4px 4px rgba(26, 32, 44, 0.14);
		pointer-events: none;
	}
</style>
