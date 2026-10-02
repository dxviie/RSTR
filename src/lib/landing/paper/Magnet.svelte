<script lang="ts">
	// Where a sheet is held down on the bed: a small flat dot, the idea of a
	// magnet rather than a picture of one. Decorative. Place it with `style`
	// (left/right/top/bottom of its center point inside a positioned parent).
	const { style = '' }: { style?: string } = $props();
</script>

<span class="magnet" {style} aria-hidden="true"></span>

<style>
	.magnet {
		position: absolute;
		z-index: 3;
		width: 7px;
		height: 7px;
		margin: -3.5px 0 0 -3.5px;
		border-radius: 50%;
		background: var(--border-strong, #c7cfdb);
		pointer-events: none;
	}
</style>
