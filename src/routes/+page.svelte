<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import RasterCanvas from '$lib/components/RasterCanvas.svelte';
	import RasterConfig from '$lib/components/RasterConfig.svelte';

	let spinner: HTMLDivElement | null = null;

</script>

<div class="page">
	<div id="spinner" class="spinner" style="display: none;" bind:this={spinner}></div>
	<div class="app-container">
		<main class="raster">
			<RasterCanvas />
		</main>

		<div class="config">
			<RasterConfig />
		</div>
	</div>
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
    }

    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid darkorange;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1000;
    }

    .app-container {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        align-items: center;
        gap: 1rem;
    }

    .raster {
        padding: 1rem;
    }

    .config {
        padding: 1rem;
        background-color: hsl(var(--background));
        border-radius: 0.5rem;
        box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
        z-index: 999;
    }

    @media (max-width: 850px) {
        .app-container {
            flex-direction: column;
            min-height: 100svh;
            max-width: 1200px;
        }

        .raster {
            position: sticky;
            top: 5rem;
        }

        .config {
            background-color: rgba(255, 255, 255, 0.8);
            width: 100vw;
            z-index: 1;
            backdrop-filter: blur(5px);
        }
    }

    :global(.short-file-input) {
        max-width: 15rem;
        white-space: nowrap;
    }

    :global(.title) {
        font-family: Bitter, serif;
    }

    :global(.description) {
        font-family: Poppins, sans-serif;
    }
</style>
