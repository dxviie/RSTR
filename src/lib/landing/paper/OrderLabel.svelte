<script lang="ts">
	// The plot service, as an airmail envelope: cyan, magenta and yellow
	// stripes round the edge, and a postage stamp of the Milkmaid plot whose
	// value is the real starting price, computed from the shop's pricing.
	// Two ways in: make a design in the studio and order it, or start with a
	// free chat about a plot. A plain click on the chat opens the inquiry
	// form in the page's dialog (onask); the link itself goes to the same
	// form, for new tabs and for visitors without JS.
	import { plotSrc } from '$lib/landing/plots';
	import { reveal } from '$lib/landing/reveal';
	import { landingInquiryFields, PRICING } from '$lib/rstr2/order';
	import { formUrl, INQUIRY_FORM_ID } from '$lib/rstr2/orderForm';
	import Cta from './Cta.svelte';

	const { onask }: { onask: () => void } = $props();

	const PRICE = PRICING.tiers.A6.base + PRICING.tiers.A6.shippingEur;
	const INQUIRY_URL = formUrl(INQUIRY_FORM_ID, landingInquiryFields());
	const uid = $props.id();

	const ask = (event: MouseEvent) => {
		// modified clicks (new tab, new window) follow the link as usual
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		onask();
	};
</script>

<div class="envelope" use:reveal>
	<div class="paper">
		<div class="corner" aria-hidden="true">
			<span class="stamp-wrap">
				<span class="stamp">
					<span class="art">
						<img
							src={plotSrc('melkmeisje', 400)}
							alt=""
							width="400"
							height="533"
							loading="lazy"
							decoding="async"
						/>
					</span>
					<span class="value">€{PRICE}</span>
					<span class="land">RSTR</span>
				</span>
			</span>
			<svg class="postmark" viewBox="0 0 150 70">
				<defs>
					<path id="{uid}-ring" d="M35 35m-23.5 0a23.5 23.5 0 1 1 47 0a23.5 23.5 0 1 1-47 0" />
				</defs>
				<circle cx="35" cy="35" r="30" />
				<circle cx="35" cy="35" r="17" />
				<text><textPath href="#{uid}-ring">AMSTERDAM · BY POST · AMSTERDAM ·</textPath></text>
				<text class="mid" x="35" y="38.5" text-anchor="middle">RSTR</text>
				<path
					class="waves"
					d="M70 20c8-4 12 4 20 0s12-4 20 0 12 4 20 0 12-4 18 0M70 30c8-4 12 4 20 0s12-4 20 0 12 4 20 0 12-4 18 0M70 40c8-4 12 4 20 0s12-4 20 0 12 4 20 0 12-4 18 0M70 50c8-4 12 4 20 0s12-4 20 0 12 4 20 0 12-4 18 0"
				/>
			</svg>
		</div>

		<p class="kicker">a real plot, by post</p>
		<h3>don't own a plotter? I'll plot it for you.</h3>
		<p class="pitch">
			Make something in the studio, hit <span class="key">⚡ order this plot</span>, and I'll draw
			it with real pens on real paper and ship it to your door. From €{PRICE} for an A6, shipping included.
		</p>
		<p class="pitch">
			Not sure where to start, or want something the presets can't do? Send me a picture and a few
			words, and we'll plan it together. That first chat is free.
		</p>
		<ul class="facts">
			<li>A6 to A3</li>
			<li>inks from the built-in presets</li>
			<li>flat-packed, with tracking</li>
		</ul>
		<div class="go">
			<Cta href="/studio">make something to plot</Cta>
			<Cta href={INQUIRY_URL} variant="ghost" onclick={ask}>plan a plot with me</Cta>
		</div>
	</div>
</div>

<style>
	/* airmail: the brand's three inks as the envelope's striped border */
	/* about the proportions of a real envelope, 2:1 on a wide screen */
	.envelope {
		position: relative;
		max-width: 57rem;
		margin: clamp(3.5rem, 7vw, 5rem) auto 0;
		padding: 8px;
		border: var(--edge);
		background: repeating-linear-gradient(
			-45deg,
			var(--cyan) 0 13px,
			var(--sheet) 13px 21px,
			var(--magenta) 21px 34px,
			var(--sheet) 34px 42px,
			var(--yellow) 42px 55px,
			var(--sheet) 55px 63px
		);
		box-shadow: var(--hard-lg);
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.envelope:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(18px) rotate(-0.6deg);
		/* promoted while it waits to scroll in, released once it has arrived */
		will-change: opacity, transform;
	}

	.paper {
		position: relative;
		padding: clamp(1.6rem, 4vw, 2.6rem) clamp(1.25rem, 4vw, 2.75rem);
		border: var(--edge);
		background: var(--sheet);
	}

	/* ------------------------------------------------- stamp + postmark */

	.corner {
		float: right;
		position: relative;
		width: 12rem;
		height: 9rem;
		margin: -0.4rem -0.6rem 0.5rem 1.5rem;
	}

	/* perforated edge: a grid of holes, kept only outside the content box.
	   Sizes are multiples of the 10px hole pitch so the bites line up. */
	/* the shadow and tilt live on a wrapper: a filter on the stamp itself
	   would be cut away by its own perforation mask */
	.stamp-wrap {
		position: absolute;
		top: 0;
		right: 0;
		filter: drop-shadow(0 1px 1.5px rgba(26, 32, 44, 0.28));
		transform: rotate(4deg);
	}

	.stamp {
		display: grid;
		grid-template-rows: 1fr auto;
		grid-template-columns: 1fr auto;
		width: 100px;
		height: 120px;
		padding: 8px;
		background: #fff;
		-webkit-mask:
			linear-gradient(#000 0 0) content-box,
			radial-gradient(circle, #0000 2.6px, #000 3.1px) -5px -5px / 10px 10px;
		mask:
			linear-gradient(#000 0 0) content-box,
			radial-gradient(circle, #0000 2.6px, #000 3.1px) -5px -5px / 10px 10px;
	}

	.art {
		grid-column: 1 / -1;
		overflow: hidden;
		background: #f3f0e8;
	}

	.art img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 42%;
		transform: scale(1.5);
	}

	.value,
	.land {
		padding-top: 3px;
		font-family: 'mono-bold', monospace;
		font-size: 0.72rem;
		line-height: 1;
		color: var(--ink);
	}

	.land {
		font-size: 0.5rem;
		letter-spacing: 0.12em;
		color: var(--magenta-ink);
		align-self: end;
	}

	.postmark {
		position: absolute;
		top: 2.6rem;
		right: 3.4rem;
		width: 9.4rem;
		height: auto;
		overflow: visible;
		fill: none;
		stroke: var(--ink-soft);
		stroke-width: 1.3;
		opacity: 0.62;
		transform: rotate(-9deg);
		pointer-events: none;
	}

	.postmark text {
		fill: var(--ink-soft);
		stroke: none;
		font-family: 'mono-bold', monospace;
		font-size: 6.4px;
		letter-spacing: 0.06em;
	}

	.postmark .mid {
		font-size: 9px;
	}

	.waves {
		stroke-linecap: round;
	}

	/* ------------------------------------------------- text */

	/* a little ink tag, like a label stuck on the envelope */
	.kicker {
		display: inline-block;
		padding: 0.32rem 0.6rem 0.28rem;
		background: var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.74rem;
		letter-spacing: 0.04em;
		color: var(--paper);
		transform: rotate(-1.5deg);
		transform-origin: left center;
	}

	h3 {
		max-width: 22ch;
		margin-top: 0.6rem;
		text-wrap: balance;
		font-family: 'mono-bold', monospace;
		font-size: clamp(1.35rem, 2.6vw, 1.85rem);
		line-height: 1.2;
		color: var(--ink);
	}

	.pitch {
		max-width: 36rem;
		margin-top: 1rem;
		font-family: 'serif-text', serif;
		font-size: 1.02rem;
		line-height: 1.65;
		color: var(--ink-soft);
	}

	.key {
		padding: 0.05rem 0.4rem;
		background: var(--ink);
		color: #fff;
		font-family: 'mono-bold', monospace;
		font-size: 0.85em;
		white-space: nowrap;
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.3rem 0 0;
		padding: 0;
		list-style: none;
	}

	.facts li {
		padding: 0.3rem 0.65rem;
		border: 1.5px solid var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.74rem;
		color: var(--ink);
	}

	.go {
		clear: both;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.1rem;
		margin-top: 1.6rem;
	}

	/* phones: the stamp gets a row of its own, so the heading keeps the
	   full width */
	@media (max-width: 560px) {
		.corner {
			float: none;
			width: 10.5rem;
			height: 7.9rem;
			margin: -0.6rem -0.5rem 0.4rem auto;
		}

		.postmark {
			top: 3.1rem;
			right: 4.5rem;
			width: 7.4rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.envelope {
			transition: none;
		}
	}
</style>
