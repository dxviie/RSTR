<script lang="ts">
	// Site chrome for the classic app and the help page: shared top bar with
	// the studio / prep / classic switcher, content column, brand footer.
	import BrandFooter from '$lib/components/BrandFooter.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';

	let { children }: { children?: Snippet } = $props();

	const active = $derived(
		$page.url.pathname.startsWith('/classic')
			? 'classic'
			: $page.url.pathname.startsWith('/help')
				? 'help'
				: null
	);
</script>

<div class="site">
	<TopBar {active} tagline="raster images to plottable svg" />
	<main>
		{@render children?.()}
	</main>
	<footer>
		<BrandFooter />
	</footer>
</div>

<style>
	.site {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--bg-c);
	}

	main {
		flex: 1;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	footer {
		width: 100%;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border-c);
	}
</style>
