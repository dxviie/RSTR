<script lang="ts">
	// The "lines" stage of the pipeline plots itself the first time it
	// scrolls into view. The coarse single-pen render (one path per region,
	// in plotting order) is inlined and drawn region by region with
	// stroke-dashoffset, then the full-detail render crossfades in over it.
	// `plot()` runs it again on request (the panel's "plot again" button).
	//
	// The finished render is what the server sends, so without JS, under
	// reduced motion, or when the panel is already on screen at load, the
	// finished lines simply show. The SVG is only fetched once the panel is
	// near, and the image is only hidden while nobody can see it (or when
	// someone asked to watch it plot).
	import { onMount } from 'svelte';
	import { HOW_COARSE_SVG, HOW_HEIGHT, HOW_LINES_PAPER, HOW_WIDTH } from '$lib/landing/how';

	type Phase = 'idle' | 'armed' | 'plotting' | 'done' | 'rest';

	interface Region {
		d: string;
		/** longest line in the region: the dash that hides and then draws it */
		len: number;
		/** ms after the start that the pen reaches this region */
		at: number;
	}

	let { phase = $bindable('idle') }: { phase?: Phase } = $props();

	/** start times are spread over this many ms, in plotting order */
	const SPREAD = 3100;
	/** how long one region takes to draw */
	const STROKE = 600;

	let regions = $state<Region[]>([]);
	let root: HTMLElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let cache: Promise<Region[]> | undefined;

	const diagonal = Math.hypot(HOW_WIDTH, HOW_HEIGHT);

	/**
	 * Every path is a run of straight lines ("M x y L x y ..."). Each M starts
	 * a new line, and SVG restarts the dash pattern on every subpath, so all
	 * lines of a region grow at once: the region's longest line sets the dash.
	 */
	const parse = (svg: string): Region[] => {
		const paths = [...svg.matchAll(/<path[^>]*?\sd="([^"]+)"/g)].map((m) => m[1]);
		const lengths = paths.map((d) => {
			const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
			let longest = 0;
			let run = 0;
			let x = 0;
			let y = 0;
			let command = '';
			for (let i = 0; i < tokens.length;) {
				if (/[a-zA-Z]/.test(tokens[i])) {
					command = tokens[i++];
					// anything but absolute moves and lines: fall back to the
					// worst case so the dash still covers the whole region
					if (command !== 'M' && command !== 'L') return diagonal;
					continue;
				}
				const nx = Number(tokens[i++]);
				const ny = Number(tokens[i++]);
				if (command === 'M') {
					run = 0;
					command = 'L'; // extra pairs after an M are line-tos
				} else {
					run += Math.hypot(nx - x, ny - y);
					longest = Math.max(longest, run);
				}
				x = nx;
				y = ny;
			}
			return Math.ceil(longest) + 2;
		});
		// the pen's arrival times follow the ink laid down so far, so the
		// plot advances at an even pace whether regions are big or small
		const total = lengths.reduce((sum, len) => sum + len, 0) || 1;
		let laid = 0;
		return paths.map((d, i) => {
			const at = Math.round((laid / total) * SPREAD);
			laid += lengths[i];
			return { d, len: lengths[i], at };
		});
	};

	/** the coarse render, fetched and parsed once */
	const load = () =>
		(cache ??= fetch(HOW_COARSE_SVG)
			.then((response) => (response.ok ? response.text() : ''))
			.then((text) => (text ? parse(text) : []))
			.catch(() => [])); // offline without the file cached: no plotting

	const run = () => {
		clearTimeout(timer);
		phase = 'plotting';
		timer = setTimeout(
			() => {
				phase = 'done';
				// once the overlay has faded out, unmount its 250 paths
				timer = setTimeout(() => (phase = 'rest'), 1300);
			},
			SPREAD + STROKE + 120
		);
	};

	/** draw the lines again, on request */
	export const plot = async () => {
		if (phase !== 'idle' && phase !== 'rest') return;
		const list = await load();
		if (!list.length) return;
		regions = list;
		run();
	};

	onMount(() => {
		const stop = () => clearTimeout(timer);
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return stop;
		const onScreen = () => {
			const rect = root.getBoundingClientRect();
			return rect.top < window.innerHeight && rect.bottom > 0;
		};
		if (onScreen()) return stop;

		let alive = true;

		const start = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				start.disconnect();
				run();
			},
			{ threshold: 0.4 }
		);

		// fetch when the panel gets close, start once it's well in view
		const near = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				near.disconnect();
				load().then((list) => {
					// never blank a render someone is already looking at
					if (!alive || !list.length || phase !== 'idle' || onScreen()) return;
					regions = list;
					phase = 'armed';
					start.observe(root);
				});
			},
			{ rootMargin: '900px 0px' }
		);
		near.observe(root);

		return () => {
			alive = false;
			near.disconnect();
			start.disconnect();
			stop();
		};
	});
</script>

<span class="plotted" data-phase={phase} bind:this={root}>
	<img
		class="final"
		src={HOW_LINES_PAPER.src}
		srcset={HOW_LINES_PAPER.srcset}
		sizes="(max-width: 640px) 80vw, (max-width: 1020px) 40vw, 240px"
		alt={HOW_LINES_PAPER.alt}
		width={HOW_LINES_PAPER.width}
		height={HOW_LINES_PAPER.height}
		loading="lazy"
		decoding="async"
	/>
	{#if phase === 'armed' || phase === 'plotting' || phase === 'done'}
		<svg class="coarse" viewBox="0 0 {HOW_WIDTH} {HOW_HEIGHT}" aria-hidden="true">
			<g>
				{#each regions as region, i (i)}
					<path
						d={region.d}
						style="--len: {region.len}; --gap: {region.len + 4}; --off: {region.len +
							2}; --at: {region.at}ms"
					/>
				{/each}
			</g>
		</svg>
	{/if}
</span>

<style>
	.plotted {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
	}

	.final {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: opacity 1s ease;
	}

	/* hidden only while off screen and waiting for the pen */
	[data-phase='armed'] .final,
	[data-phase='plotting'] .final {
		opacity: 0;
	}

	.coarse {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transition: opacity 1s ease 0.15s;
	}

	.coarse g {
		fill: none;
		stroke: #1a1a1a;
		stroke-width: 4.8;
		stroke-linecap: round;
	}

	/* dash = the region's longest line; start just inside the gap so no
	   round cap peeks out before the pen arrives */
	.coarse path {
		stroke-dasharray: var(--len) var(--gap);
		stroke-dashoffset: var(--off);
	}

	[data-phase='plotting'] .coarse path,
	[data-phase='done'] .coarse path {
		animation: plot 0.6s cubic-bezier(0.45, 0, 0.55, 1) var(--at) forwards;
	}

	@keyframes plot {
		to {
			stroke-dashoffset: 0;
		}
	}

	[data-phase='done'] .coarse {
		opacity: 0;
	}
</style>
