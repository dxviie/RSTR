<script>
	import * as Card from '$lib/components/ui/card';
	import RasterCanvas from '$lib/RasterCanvas.svelte';
	import RasterConfig from '$lib/RasterConfig.svelte';

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
</script>

<div class="app-container">
	<main class="raster">
		<Card.Root>
			<Card.Header>
				<Card.Title class="title">RSTR</Card.Title>
			</Card.Header>
			<Card.Content>
				<RasterCanvas />
			</Card.Content>
		</Card.Root>
	</main>

	<div class="config">
		<Card.Root>
			<Card.Header>
				<Card.Description class="description">{selectedPhrase}</Card.Description>
			</Card.Header>
			<Card.Content>
				<RasterConfig />
			</Card.Content>
		</Card.Root>
	</div>
</div>

<style>
	.app-container {
		display: flex;
		justify-content: center;
	}

	@media (max-width: 768px) {
		.app-container {
			flex-direction: column;
		}
	}

	.raster {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		max-height: 100vh;
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
</style>
