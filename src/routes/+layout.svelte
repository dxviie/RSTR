<script>
	import '../app.css';
	import '@fontsource/bitter';
	import '@fontsource/poppins';
	import { Button } from '$lib/components/ui/button';
	import BrandFooter from '$lib/components/BrandFooter.svelte';
</script>

<div class="app-container">
	<header>
		<div class="header-left">
			<a href="/" target="_self" aria-label="link to home" class="header-link">
				<div class="title"><p class="logo">rstr.d17e.dev</p></div>
				<div><p class="description">Raster Images to Plottable SVG</p></div>
			</a>
		</div>
		<div class="header-right">
			<a href="/about" target="_self" class="header-link">
				<Button variant="ghost" size="icon">
					?
					<span class="sr-only">Go to about page</span>
				</Button>
			</a>
		</div>
	</header>
	<main>
		<slot></slot>
	</main>
	<footer>
		<BrandFooter />
	</footer>
</div>

<style>
    .app-container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    header {
        background-color: hsl(var(--background));
        width: 100%;
        height: 6rem;
        position: fixed;
        padding: 1rem;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        align-self: center;
        font-size: large;
        z-index: 99;
    }

    .header-left {
        display: flex;
        flex-direction: row;
        align-items: center;
    }

    .header-right {
        height: 2.5rem;
    }

    .header-link {
        border-bottom-width: 0;
    }

    .title {
        padding: 0 .7rem 0 0.6rem;
        background-color: hsl(var(--foreground));
        color: hsl(var(--background));
        font-size: xx-large;
        font-weight: bold;
    }

    .description {
        font-size: x-small;
        font-weight: normal;
    }

    main {
        min-height: calc(100vh - 5rem);
        max-width: 1200px;
        padding-top: 6rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    footer {
        height: 5rem;
        width: 100%;
    }

    :global(button) {
        font-family: Bitter, serif;
        font-weight: bold !important;
        font-size: large !important;
    }

    :global(button:hover) {
        background-color: darkorange !important;
    }

    :global(button:active) {
        transform: translateY(1px);
    }

    :global(body) {
        font-family: Poppins, sans-serif;
        font-size: medium;
    }

    :global(.title) {
        font-family: Bitter, serif;
    }

    :global(.description) {
        font-family: Poppins, sans-serif;
    }

    :global(a) {
        border-style: dashed;
        border-bottom-width: 1px;
        border-color: hsl(var(--foreground));
    }

    :global(a:hover) {
        border-color: darkorange;
    }

</style>