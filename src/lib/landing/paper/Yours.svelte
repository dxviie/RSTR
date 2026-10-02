<script lang="ts">
	// Ownership and open source: one plain statement, a pen circle drawn
	// round "yours" as it arrives, and the three facts as rubber stamps.
	import { reveal } from '$lib/landing/reveal';

	const STAMPS = [
		{ text: 'commercial use included', ink: 'var(--cyan-ink)', tilt: -2.5 },
		{ text: 'GPL-3.0, source on GitHub', ink: 'var(--magenta-ink)', tilt: 1.8 },
		{ text: 'nothing leaves your device', ink: 'var(--ink)', tilt: -1.2 }
	];
</script>

<section class="yours" aria-labelledby="yours-title">
	<div class="wrap">
		<h2 id="yours-title" use:reveal>
			everything you make is
			<span class="circled"
				>yours<svg viewBox="0 0 200 84" aria-hidden="true"
					><path
						pathLength="1"
						d="M38 14C80 2 158 4 184 26c18 16 6 40-34 50-40 9-102 6-130-10C2 55 4 34 26 22 46 11 84 7 112 8"
					/></svg
				></span
			>
		</h2>
		<p>
			Whatever you create with RSTR belongs to you. Personal projects, gifts, client work, prints or
			plots you sell. Commercial use included, no strings attached.
		</p>
		<p>
			The tool itself is open too. The source code is on
			<a href="https://github.com/dxviie/RSTR" target="_blank" rel="noopener">GitHub</a>, licensed
			under the GPL-3.0.
		</p>
		<ul class="stamps" use:reveal>
			{#each STAMPS as stamp, i (stamp.text)}
				<li style="--ink-color: {stamp.ink}; --tilt: {stamp.tilt}deg; --n: {i}">
					<span class="impression">{stamp.text}</span>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.wrap {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--section-pad) var(--gutter);
		text-align: center;
	}

	h2 {
		font-family: 'mono-bold', monospace;
		font-size: clamp(2rem, 4.6vw, 3.25rem);
		/* room above and below for the pen loop when the line wraps */
		line-height: 1.32;
		text-wrap: balance;
		letter-spacing: -0.01em;
		color: var(--ink);
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.circled {
		position: relative;
		display: inline-block;
		white-space: nowrap;
	}

	/* a loose pen loop round the word, overshooting where it started */
	.circled svg {
		position: absolute;
		left: -0.45em;
		top: calc(50% - 0.84em);
		width: 3.95em;
		height: auto;
		overflow: visible;
		pointer-events: none;
	}

	.circled path {
		fill: none;
		stroke: var(--magenta);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-dasharray: 1 2;
		stroke-dashoffset: 0;
		transition: stroke-dashoffset 1.1s cubic-bezier(0.55, 0, 0.35, 1) 0.45s;
	}

	h2:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(14px);
		/* promoted while it waits to scroll in, released once it has arrived */
		will-change: opacity, transform;
	}

	h2:global([data-reveal='out']) .circled path {
		stroke-dashoffset: 1;
	}

	p {
		max-width: 38rem;
		margin: 1.6rem auto 0;
		text-wrap: balance;
		font-family: 'serif-text', serif;
		font-size: 1.08rem;
		line-height: 1.68;
		color: var(--ink-soft);
	}

	p + p {
		margin-top: 0.8rem;
	}

	p a {
		color: var(--ink);
		border-bottom: 1px dashed var(--muted);
	}

	p a:hover {
		border-bottom-color: var(--magenta);
	}

	p a:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	/* ------------------------------------------------- stamps */

	.stamps {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem 1.25rem;
		margin: 2.4rem 0 0;
		padding: 0;
		list-style: none;
	}

	.stamps li {
		color: var(--ink-color);
		transform: rotate(var(--tilt));
		transition:
			opacity 0.25s ease,
			transform 0.42s cubic-bezier(0.3, 1.5, 0.5, 1);
		transition-delay: calc(0.15s + var(--n) * 0.16s);
	}

	.impression {
		display: block;
		padding: 0.5rem 0.85rem;
		border: 2px solid currentColor;
		border-radius: 5px;
		box-shadow:
			inset 0 0 0 2px var(--paper),
			inset 0 0 0 3px currentColor;
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		letter-spacing: 0.03em;
		white-space: nowrap;
		-webkit-mask-image: var(--grain-mask);
		mask-image: var(--grain-mask);
		-webkit-mask-size: 150px 150px;
		mask-size: 150px 150px;
	}

	/* pressed onto the page one after another */
	.stamps:global([data-reveal='out']) li {
		opacity: 0;
		transform: rotate(var(--tilt)) scale(1.45);
		will-change: opacity, transform;
	}

	@media (max-width: 480px) {
		.impression {
			font-size: 0.74rem;
			white-space: normal;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		h2,
		.circled path,
		.stamps li {
			transition: none;
		}
	}
</style>
