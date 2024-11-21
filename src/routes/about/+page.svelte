<script lang="ts">
	import { Button } from '$lib/components/ui/button';
</script>

<div class="content">


	<p class="intro">
		<b>Hi! :)</b><br /><br />
		I'm David Vandenbogaerde, or <i><a href="https://www.d17e.dev" target="_blank">d17e</a></i> for short. A software engineer and budding
		artist residing in Amsterdam.<br /><br />
		This project is an attempt at turning rasterized images into plottable SVGs.<br />
		Because I like plotting stuff with my plotter. And all it can do is SVGs.<br /><br />
	</p>
	<p class="intro">
		<a href="https://genuary.d17e.dev/?prompt=5" alt="link to my genuary 2024 entry that was the direct inspiration for this project">The
			Vera Molnar prompt for Genuary 2024</a>
		was the direct inspiration for this project.<br /><br />
		There's still a long list of features I'd like to implement, so make sure to check back every now and then!
	</p>
</div>

<style>
    .content {
        padding-top: 2rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100vw;
    }

    img {
        width: 90vw;
        max-width: 40rem;
        margin: 1rem 0;
    }

    video {
        width: 90vw;
        max-width: 40rem;
        margin: 1rem 0;
    }

    .intro {
        width: 90vw;
        max-width: 40rem;
    }
</style>