<script lang="ts">
	// The story, as a short letter on a folded sheet, signed by hand.
	import { reveal } from '$lib/landing/reveal';
	import Cta from './Cta.svelte';
	import SectionHead from './SectionHead.svelte';
	import Signature from './Signature.svelte';
	import Swatch from './Swatch.svelte';
</script>

<section class="story" aria-labelledby="story">
	<Swatch
		color="#00bfe8"
		angle={20}
		gap={6}
		width={120}
		height={154}
		label="cyan · 0.3 mm · 20°"
		tilt={-2}
		style="left: calc(50% - 44rem); top: 12rem"
	/>

	<div class="wrap">
		<SectionHead id="story" title="the story" align="center" />

		<article class="letter" use:reveal>
			<p class="place">Amsterdam</p>
			<p>
				RSTR started as a sketch for the Genuary '24 prompt
				<a href="https://genuary24.d17e.dev/?prompt=5" target="_blank" rel="noopener"
					><em>"In the style of Vera Molnár (1924-2023)"</em></a
				>, and never really stopped. One experiment turned into the studio you see now. The
				<a href="/classic">original version</a> still runs if you're feeling nostalgic.
			</p>
			<p>
				It's made by me, David Vandenbogaerde, or
				<a href="https://www.d17e.dev" target="_blank" rel="noopener">d17e</a> for short. I'm a software
				engineer and artist living in Amsterdam 🇳🇱. Ever since I got a plotter, I've been looking for
				new ways to turn images into something it can draw.
			</p>
			<p>That's why RSTR exists. I hope you like it.</p>
			<div class="sign">
				<Signature />
			</div>
		</article>

		<div class="go">
			<Cta href="/studio">launch RSTR</Cta>
		</div>
	</div>
</section>

<style>
	.story {
		position: relative;
	}

	.wrap {
		max-width: 46rem;
		margin: 0 auto;
		padding: var(--section-pad) var(--gutter);
	}

	/* a sheet folded in three for the envelope: two faint creases */
	.letter {
		position: relative;
		margin-top: 2.25rem;
		padding: clamp(1.75rem, 5vw, 3.25rem) clamp(1.35rem, 5.5vw, 3.75rem) clamp(1.5rem, 4vw, 2.5rem);
		border-radius: 2px;
		background:
			linear-gradient(
				to bottom,
				transparent calc(33.3% - 1px),
				rgba(96, 115, 159, 0.07) calc(33.3% - 1px),
				rgba(255, 255, 255, 0.9) 33.3%,
				transparent calc(33.3% + 2px)
			),
			linear-gradient(
				to bottom,
				transparent calc(66.6% - 1px),
				rgba(96, 115, 159, 0.07) calc(66.6% - 1px),
				rgba(255, 255, 255, 0.9) 66.6%,
				transparent calc(66.6% + 2px)
			),
			var(--sheet);
		box-shadow: var(--sheet-shadow);
		transition:
			opacity 0.8s ease,
			transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.letter:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(20px) rotate(0.5deg);
	}

	.place {
		margin-bottom: 1.4rem;
		font-family: 'mono-light', monospace;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		color: var(--muted);
		text-align: right;
	}

	p {
		font-family: 'serif-text', serif;
		font-size: 1.08rem;
		line-height: 1.75;
		color: var(--ink-soft);
	}

	p + p {
		margin-top: 1rem;
	}

	em {
		font-style: italic;
	}

	a {
		color: var(--ink);
		border-bottom: 1px dashed var(--muted);
	}

	a:hover {
		border-bottom-color: var(--magenta);
	}

	a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.sign {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
		margin-right: -0.5rem;
	}

	.go {
		display: flex;
		justify-content: center;
		margin-top: 2.5rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.letter {
			transition: none;
		}
	}
</style>
