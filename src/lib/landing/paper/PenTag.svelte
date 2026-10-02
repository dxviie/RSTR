<script lang="ts">
	// A heading run through RSTR itself. On the client the text is set on a
	// canvas, and the real engine (cell grid, regions, hatching) turns it
	// into pen lines, drawn in one black pen as an SVG right over the text.
	// The hatch angles come from a fresh roll on every visit, like the
	// studio's dice, so the tag is never drawn the same way twice. Nothing
	// moves. The text stays underneath, transparent, for screen readers,
	// selection and copying; without JS it simply shows as type.
	import { onMount } from 'svelte';

	const { text, id }: { text: string; id: string } = $props();

	/** canvas type size the engine works at; the SVG scales with the heading */
	const CANVAS_PX = 160;
	/** pen width in canvas px: about 2px on a desktop-sized heading */
	const PEN = 3.2;
	/** below this heading size the pen gets relatively thicker, so the
	 *  lines still read on a phone */
	const SMALL_PX = 72;

	let box = $state<HTMLSpanElement>();
	let probe = $state<HTMLSpanElement>();
	let drawing = $state<{ w: number; h: number; d: string; pen: number } | null>(null);

	const r1 = (v: number) => Math.round(v * 10) / 10;

	const draw = async () => {
		if (!box || !probe) return null;
		const fontSize = parseFloat(getComputedStyle(box).fontSize);
		await document.fonts.load(`${fontSize}px "mono-bold"`);
		const [{ computeCellGrid }, { extractChannel }, { segmentGrid }, regionTools, hatchTools] =
			await Promise.all([
				import('$lib/rstr2/grid'),
				import('$lib/rstr2/layers'),
				import('$lib/rstr2/segmentation'),
				import('$lib/rstr2/regionTools'),
				import('$lib/rstr2/hatchTools')
			]);

		// set the text on a canvas exactly where it sits in the heading: same
		// box, same baseline (the probe is a zero-size inline-block on it)
		const rect = box.getBoundingClientRect();
		const baseline = probe.getBoundingClientRect().top - rect.top;
		const scale = CANVAS_PX / fontSize;
		const w = Math.round(rect.width * scale);
		const h = Math.round(rect.height * scale);
		if (w < 10 || h < 10) return null;
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return null;
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#000';
		ctx.font = `${CANVAS_PX}px "mono-bold"`;
		ctx.textBaseline = 'alphabetic';
		ctx.fillText(text, 0, baseline * scale);
		const px = ctx.getImageData(0, 0, w, h).data;

		// the studio's pipeline: ~3px cells, darkness as ink, watershed regions
		const grid = computeCellGrid(px, w, h, Math.round(w / 3));
		const ink = extractChannel(grid.r, grid.g, grid.b, 'luma-inv');
		const seg = segmentGrid(ink, grid.cols, grid.rows, {
			algorithm: 'watershed',
			tolerance: 0.2,
			minRegionSize: 2,
			smoothing: 0
		});
		const regions = regionTools.buildRegionGeometries(
			seg.labels,
			seg.regionCount,
			grid.cols,
			grid.rows,
			grid.cellW,
			grid.cellH
		);

		// the roll: a random hatch angle range. Each region still picks its
		// angle from its own shape (the studio's rule), but letters are much
		// alike, so the range is wide enough to send them all different ways.
		const angleMin = Math.random() * 180;
		const angleMax = angleMin + 360 + Math.random() * 540;
		const pen = PEN * Math.sqrt(Math.max(1, SMALL_PX / fontSize));
		const minSpacing = pen * (1.9 + Math.random() * 0.4);

		let d = '';
		for (const region of regions) {
			const mean = seg.regionMean[region.id];
			if (mean < 0.3) continue; // the paper around and inside the letters
			const spacing = hatchTools.spacingForInk(mean, pen, minSpacing, pen * 6, {
				curve: 'coverage',
				gamma: 1.8,
				inkBoost: 1
			});
			const shape =
				(Math.atan2(region.maxY - region.minY, region.maxX - region.minX) * 180) / Math.PI;
			const angle = angleMin + (shape / 90) * (angleMax - angleMin);
			const lines = hatchTools.hatchPolygon(region.loops, angle, spacing, pen);
			for (let k = 0; k < lines.length; k += 4) {
				d += `M${r1(lines[k])} ${r1(lines[k + 1])}L${r1(lines[k + 2])} ${r1(lines[k + 3])}`;
			}
		}
		return d ? { w, h, d, pen } : null;
	};

	onMount(() => {
		let alive = true;
		draw().then(
			(result) => {
				if (alive && result) drawing = result;
			},
			() => {
				// no canvas or no engine: the type stays as it is
			}
		);
		return () => (alive = false);
	});
</script>

<h2 {id} class="pen-tag">
	<span class="ink-box">
		<span class="text" class:inked={drawing} bind:this={box}
			>{text}<span class="probe" bind:this={probe} aria-hidden="true"></span></span
		>
		{#if drawing}
			<svg
				class="lines"
				viewBox="0 0 {drawing.w} {drawing.h}"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<path d={drawing.d} stroke-width={drawing.pen} />
			</svg>
		{/if}
	</span>
</h2>

<style>
	/* typography comes from the parent: the heading inherits its font */
	.pen-tag {
		margin: 0;
		font: inherit;
		letter-spacing: inherit;
	}

	/* the text's own box, so the drawing can lie exactly over it */
	.ink-box {
		position: relative;
		display: block;
		width: fit-content;
	}

	.text {
		display: block;
		color: var(--ink);
	}

	/* the drawing takes over; the type stays for reading and copying */
	.text.inked {
		color: transparent;
	}

	.probe {
		display: inline-block;
		width: 0;
		height: 0;
		vertical-align: baseline;
	}

	.lines {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}

	.lines path {
		fill: none;
		stroke: var(--ink);
		stroke-linecap: round;
	}
</style>
