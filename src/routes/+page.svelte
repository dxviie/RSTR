<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import RasterCanvas from '$lib/components/RasterCanvas.svelte';
	import RasterConfig from '$lib/components/RasterConfig.svelte';
	import { marked } from 'marked';

	let spinner: HTMLDivElement | null = null;

	const phrases = [
		'Creative Image Rasterization For Plotters',
		'Innovative Rasterization Techniques for Plotting Images',
		'Artistic Rasterization for Plotter Devices',
		'Plotter-Focused Creative Rasterization of Images',
		'Advanced Image Rasterization for Precision Plotters',
		'Artistic Scribbles for High-Tech Doodlers',
		'Pixel-Wrangling for Plotter Jockeys',
		'Crafty Pixel Magic for Plotter Wizards',
		'Plotter Shenanigans: Artistic Pixel Mischief',
		'From Pixels to Plots: The Artistic Alchemy'
	];
	let selectedPhrase = $state('');
	$effect(() => {
		selectedPhrase = phrases[Math.floor(Math.random() * phrases.length)];
	});

	let footerContent = $state('');

	async function loadFooter() {
		const response = await fetch('/md/footer.md');
		const text = await response.text();
		footerContent = marked(text);
	}

	$effect(() => {
		loadFooter();
	});

</script>

<div class="page">
	<div id="spinner" class="spinner" style="display: none;" bind:this={spinner}></div>
	<div class="app-container">
		<main class="raster">
			<Card.Root>
				<Card.Header>
					<Card.Title class="title">RSTR</Card.Title>
					<Card.Description class="description">{selectedPhrase}</Card.Description>
				</Card.Header>
				<Card.Content>
					<RasterCanvas />
				</Card.Content>
			</Card.Root>
		</main>

		<div class="config">
			<Card.Root>
				<Card.Header>
					<Card.Description class="description">Configuration</Card.Description>
				</Card.Header>
				<Card.Content>
					<RasterConfig />
				</Card.Content>
			</Card.Root>
		</div>
	</div>
	<div class="markdown-container">
		<div class="markdown-content page-footer">
			{@html footerContent}
		</div>
	</div>
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
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
        justify-content: center;
    }

    @media (max-width: 850px) {
        .app-container {
            flex-direction: column;
            align-items: center;
        }
    }

    .raster {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
    }

    .config {
        padding: 1rem;
        max-width: 30rem;
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

    .markdown-container {
        display: flex;
        flex-direction: column;
    }

    .page-footer {
        margin-top: 1rem;
        margin-bottom: 1rem;
        text-align: center;
        line-height: 14pt;
    }

    :global(a) {
        color: darkorange;
        text-decoration: none;
    }
</style>
