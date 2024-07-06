<script>
	import * as Card from "$lib/components/ui/card";
	import RasterCanvas from '$lib/RasterCanvas.svelte';
	import RasterConfig from '$lib/RasterConfig.svelte';

</script>

<div class="app-container">

	<main class="raster">
		<Card.Root>
			<Card.Header>
				<Card.Title>RSTR</Card.Title>
				<Card.Description>Creative Image Rasterization For Plotters</Card.Description>
			</Card.Header>
			<Card.Content>
				<RasterCanvas/>
			</Card.Content>
		</Card.Root>
	</main>

	<div class="config">
		<Card.Root>
			<Card.Header>
				<Card.Title>RSTR Configuration</Card.Title>
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
	}

	.config {
		padding: 1rem;
			max-width: 30rem;
	}

  :global(.short-file-input) {
      max-width: 15rem;
      white-space: nowrap;
  }
</style>
