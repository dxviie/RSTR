<script lang="ts">
	// How spacing makes tone: a square of 0.5 mm pen lines and a slider for
	// how far apart they are. Next to it, the gray the same square reads as
	// from a few steps back. The slider is the studio's own ink-range.
	import { inkRange } from '$lib/inkRange';
	import { hatch } from './hatch';

	/** the square is 24 mm on paper, drawn in a 120-unit box */
	const BOX = 120;
	const UNIT = BOX / 24;
	const PEN_MM = 0.5;

	let spacing = $state(1.2);
	const d = $derived(hatch(BOX, BOX, -45, spacing * UNIT));
	const ink = $derived(Math.min(1, PEN_MM / spacing));
	const percent = $derived(Math.round(ink * 100));

	const uid = $props.id();
</script>

<div class="demo" role="group" aria-labelledby="{uid}-title">
	<div class="squares">
		<div class="square">
			<svg viewBox="0 0 {BOX} {BOX}" aria-hidden="true">
				<path {d} stroke-width={PEN_MM * UNIT} />
			</svg>
			<span class="cap">up close</span>
		</div>
		<span class="equals" aria-hidden="true">≈</span>
		<div class="square">
			<span class="flat" style="opacity: {ink}"></span>
			<span class="cap">from a distance</span>
		</div>
	</div>

	<div class="side">
		<p class="kicker">try it</p>
		<p class="title" id="{uid}-title">spacing makes tone</p>
		<label for="{uid}-spacing">
			line spacing
			<output for="{uid}-spacing">{spacing.toFixed(1)} mm</output>
		</label>
		<div class="row">
			<span aria-hidden="true">dark</span>
			<input
				id="{uid}-spacing"
				type="range"
				class="ink-range"
				min="0.6"
				max="4"
				step="0.1"
				bind:value={spacing}
				use:inkRange={spacing}
				aria-valuetext="{spacing.toFixed(1)} mm apart, {percent}% ink"
			/>
			<span aria-hidden="true">light</span>
		</div>
		<p class="note">
			With a 0.5 mm pen, lines {spacing.toFixed(1)} mm apart put ink on {percent}% of the paper.
		</p>
	</div>
</div>

<style>
	.demo {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: clamp(1.5rem, 4vw, 3rem);
		align-items: center;
		padding: clamp(1.25rem, 3.5vw, 2rem) clamp(1.25rem, 4vw, 2.5rem);
		border-radius: 3px;
		background: var(--sheet);
		box-shadow: var(--sheet-shadow);
	}

	.squares {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
	}

	.square {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 8rem;
	}

	svg,
	.flat {
		display: block;
		width: 8rem;
		height: 8rem;
		box-shadow: 0 0 0 1px rgba(96, 115, 159, 0.25);
	}

	path {
		fill: none;
		stroke: var(--ink);
		stroke-linecap: butt;
	}

	.flat {
		background: var(--ink);
	}

	.equals {
		align-self: center;
		margin-top: -1.5rem;
		font-family: 'mono-light', monospace;
		font-size: 1.35rem;
		color: var(--muted);
	}

	.cap {
		font-family: 'mono-light', monospace;
		font-size: 0.7rem;
		color: var(--muted);
		text-align: center;
	}

	.kicker {
		font-family: 'mono-bold', monospace;
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--magenta-ink);
	}

	.title {
		margin: 0.25rem 0 1rem;
		font-family: 'mono-bold', monospace;
		font-size: 1.15rem;
		color: var(--ink);
	}

	label {
		display: flex;
		justify-content: space-between;
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		color: var(--ink);
	}

	output {
		font-family: 'mono-light', monospace;
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-top: 0.3rem;
		font-family: 'mono-light', monospace;
		font-size: 0.74rem;
		color: var(--muted);
	}

	input {
		flex: 1;
		min-width: 0;
		/* a taller hit area around the studio's slim track */
		height: 2.5rem !important;
		cursor: pointer;
	}

	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.note {
		margin-top: 0.4rem;
		font-family: 'serif-text', serif;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--ink-soft);
	}

	@media (max-width: 640px) {
		.demo {
			grid-template-columns: minmax(0, 1fr);
		}

		.squares {
			justify-content: center;
		}

		.square,
		svg,
		.flat {
			width: 7rem;
		}

		svg,
		.flat {
			height: 7rem;
		}
	}
</style>
