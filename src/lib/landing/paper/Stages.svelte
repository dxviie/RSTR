<script lang="ts">
	// How it works in one frame: the Milkmaid at every stage of the
	// pipeline, stacked on one sheet, split by a handle shaped like the
	// plotter's pen carriage. Left of the handle is the stage before, right
	// of it the stage picked in the tabs, so every pass is compared with the
	// one it builds on. The photo has nothing before it and shows alone.
	//
	// - The split lives in a real range input (visually hidden, focusable),
	//   so keyboards and screen readers get a native slider. A pointer drag
	//   anywhere on the frame moves it too; touch only takes over on a
	//   clearly sideways drag so vertical swipes still scroll the page, and
	//   a tap moves the handle to the tap.
	// - The right-hand picture is clipped by two opposite translations (a
	//   window sliding right, the picture inside sliding back left), so
	//   dragging and the intro only ever change transforms.
	// - Pictures mount on demand (hovering or focusing a tab prefetches) and
	//   a stage only replaces the one on screen once its pictures are
	//   decoded, so a switch never shows a half-loaded picture.
	// - The intro plays the stages like plotter passes the first time the
	//   frame comes into view: the photo, then each stage wiping in from the
	//   right over the one before, parking halfway on the real plot. Never
	//   under reduced motion, and any touch, click or key stops it on the
	//   spot. The server render (no JS, reduced motion) is that parked state.
	import { onMount } from 'svelte';
	import type { Action } from 'svelte/action';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import type { LightboxImage } from '$lib/landing/Lightbox.svelte';
	import {
		HOW_HEIGHT,
		HOW_LINES_PAPER,
		HOW_PHOTO,
		HOW_PLOT,
		HOW_REGIONS,
		HOW_STATS,
		HOW_WIDTH,
		MILKMAID_CREDIT,
		type HowImage
	} from '$lib/landing/how';
	import { plotSrc } from '$lib/landing/plots';
	import { reveal } from '$lib/landing/reveal';
	import { formatCount } from './hatch';
	import Cta from './Cta.svelte';

	const { onzoom }: { onzoom: (image: LightboxImage) => void } = $props();

	// the stage renders come at 600w and 1200w; the lightbox opens the larger
	const largest = (srcset: string) => srcset.split(',').at(-1)?.trim().split(' ')[0];
	const zoomable = (image: HowImage): LightboxImage => ({
		src: image.src,
		srcset: image.srcset,
		alt: image.alt,
		full: largest(image.srcset)
	});

	const STAGES = [
		{
			num: '01',
			name: 'photo',
			stat: 'any image or video',
			caption: "Any photo or video works. This one is Vermeer's Milkmaid.",
			picture: zoomable(HOW_PHOTO)
		},
		{
			num: '02',
			name: 'regions',
			stat: `${formatCount(HOW_STATS.regions)} flat areas`,
			caption: `RSTR carves it into ${formatCount(HOW_STATS.regions)} regions of similar tone.`,
			picture: zoomable(HOW_REGIONS)
		},
		{
			num: '03',
			name: 'lines',
			// on a narrow tab this breaks after the number, not before "lines"
			stat: `${formatCount(HOW_STATS.lines)} straight\u00a0lines`,
			caption:
				"Then it fills each region with straight lines, dense where it's dark and sparse where it's light.",
			picture: zoomable(HOW_LINES_PAPER)
		},
		{
			num: '04',
			name: 'plotted',
			stat: `~${HOW_STATS.plotTime}, one pen`,
			caption: "And here's the real thing, drawn by my AxiDraw with one black pen.",
			picture: {
				src: HOW_PLOT.src,
				srcset: HOW_PLOT.srcset,
				alt: HOW_PLOT.alt,
				full: plotSrc(HOW_PLOT.name, 1920)
			}
		}
	];
	const LAST = STAGES.length - 1;

	// Two slots: the base under the handle holds the stage before the
	// picked one (or the photo alone), the clipped window on the right
	// holds the picked stage. The middle stages can be in either, so their
	// pictures exist twice; the browser loads and decodes each file once.
	type Slot = 'base' | 'after';
	const BASE = [0, 1, 2];
	const AFTER = [1, 2, 3];
	const keysFor = (s: number) => (s === 0 ? ['base-0'] : [`base-${s - 1}`, `after-${s}`]);

	const SIZES = '(max-width: 640px) calc(100vw - 2.25rem), 35rem';
	/** the plot photo is drawn 113% wide to line up with the renders */
	const PLOT_SIZES = '(max-width: 640px) 110vw, 40rem';

	/** picked in the tabs */
	let stage = $state(LAST);
	/** on screen: follows `stage` once its pictures are decoded */
	let shown = $state(LAST);
	/** handle position, % from the left */
	let split = $state(50);
	/** the intro lifts the carriage off the sheet between passes */
	let penUp = $state(false);
	/**
	 * armed: waiting for the frame to come into view (the caption stays
	 * quiet for screen readers until the intro is over); playing: the passes
	 * are running and stages swap without a fade
	 */
	let intro = $state<'off' | 'armed' | 'playing'>('off');

	const mountedKeys = new SvelteSet<string>(keysFor(LAST));
	const decodedKeys = new SvelteSet<string>();
	const isReady = (s: number) => keysFor(s).every((key) => decodedKeys.has(key));
	const prefetch = (s: number) => keysFor(s).forEach((key) => mountedKeys.add(key));

	// stage and shown change together in one update, so the frame never
	// renders a split meant for one stage over the pictures of another
	const sync = () => {
		if (isReady(stage)) shown = stage;
	};
	const setStage = (s: number) => {
		stage = s;
		prefetch(s);
		sync();
	};

	/** the intro waits here for a stage's pictures; a check is true once done */
	let waiters: (() => boolean)[] = [];
	const whenReady = (s: number) =>
		new Promise<void>((resolve) => {
			const check = () => {
				if (!isReady(s)) return false;
				resolve();
				return true;
			};
			if (!check()) waiters.push(check);
		});

	/** decode before a layer may show; its key marks it ready */
	const decoded: Action<HTMLImageElement, string> = (img, key) => {
		let alive = true;
		const done = () => {
			if (!alive) return;
			decodedKeys.add(key);
			sync();
			waiters = waiters.filter((check) => !check());
		};
		img.decode().then(done, done);
		return { destroy: () => (alive = false) };
	};

	const current = $derived(STAGES[stage]);
	/** either side of the handle */
	const before = $derived(STAGES[Math.max(0, shown - 1)]);
	const after = $derived(STAGES[shown]);
	const comparing = $derived(shown > 0);
	const isOn = (slot: Slot, k: number) =>
		slot === 'base' ? k === Math.max(0, shown - 1) : comparing && k === shown;

	const pick = (s: number) => {
		stopIntro();
		// a handle parked at either edge would hide the comparison
		if (split < 5 || split > 95) split = 50;
		setStage(s);
	};

	// a mouse press on a tab stops the intro at once; a finger only once it
	// taps (click), so scrolling past the tabs leaves the intro running
	const pressTab = (event: PointerEvent) => {
		if (event.pointerType === 'mouse') stopIntro();
	};

	const zoom = () => {
		stopIntro();
		onzoom(STAGES[stage].picture);
	};

	// ------------------------------------------------- the split

	let frame = $state<HTMLDivElement>();
	let dragging = $state(false);
	const clamp = (v: number) => Math.min(100, Math.max(0, v));

	const valueAt = (event: PointerEvent) => {
		const rect = frame!.getBoundingClientRect();
		return clamp(((event.clientX - rect.left) / rect.width) * 100);
	};

	// plain (non-reactive) drag bookkeeping
	let pointer: number | null = null;
	let engaged = false;
	let startX = 0;
	let startY = 0;

	const engage = (event: PointerEvent) => {
		stopIntro();
		engaged = true;
		dragging = true;
		frame!.setPointerCapture(event.pointerId);
		split = valueAt(event);
	};

	// A mouse takes over at once. A finger may only be scrolling past, so
	// touch and pen wait for the gesture: sideways drags, a tap moves the
	// handle, and a vertical swipe scrolls the page and leaves the intro be.
	const onpointerdown = (event: PointerEvent) => {
		const mouse = event.pointerType === 'mouse';
		if (mouse) stopIntro();
		if (event.button !== 0) return;
		pointer = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		engaged = false;
		if (!mouse || !comparing) return;
		event.preventDefault();
		engage(event);
	};

	const onpointermove = (event: PointerEvent) => {
		if (event.pointerId !== pointer) return;
		if (engaged) {
			split = valueAt(event);
			return;
		}
		if (event.pointerType === 'mouse') return;
		const dx = Math.abs(event.clientX - startX);
		const dy = Math.abs(event.clientY - startY);
		if (dx < 6 && dy < 6) return;
		if (dy > dx || !comparing) {
			// a scroll, or a swipe across the photo alone (nothing to drag)
			if (dx >= dy) stopIntro();
			pointer = null;
			return;
		}
		engage(event);
	};

	const onpointerup = (event: PointerEvent) => {
		if (event.pointerId !== pointer) return;
		// a tap (no drag) moves the handle there
		if (!engaged) {
			stopIntro();
			if (comparing) split = valueAt(event);
		}
		release();
	};

	const release = () => {
		pointer = null;
		engaged = false;
		dragging = false;
	};

	// lostpointercapture bubbles: taking capture from the picture a touch
	// started on fires it too, so only the frame's own loss ends a drag
	const onlostpointercapture = (event: PointerEvent) => {
		if (event.target === frame && event.pointerId === pointer) release();
	};

	// ------------------------------------------------- the intro

	// the intro awaits one step at a time, so one timer and one frame
	// request cover everything that's pending
	let run = 0;
	let raf = 0;
	let timer = 0;

	function stopIntro() {
		if (intro === 'off') return;
		run++;
		cancelAnimationFrame(raf);
		clearTimeout(timer);
		intro = 'off';
		penUp = false;
	}

	const sleep = (ms: number) =>
		new Promise<void>((resolve) => (timer = window.setTimeout(resolve, ms)));

	/**
	 * A plotter's move: a short ramp up, an even cruise, a short ramp down
	 * (a trapezoid velocity profile, `r` of the time on each ramp).
	 */
	const carriage = (t: number, r = 0.28) => {
		const v = 1 / (1 - r);
		if (t < r) return (v * t * t) / (2 * r);
		if (t > 1 - r) return 1 - (v * (1 - t) ** 2) / (2 * r);
		return v * (t - r / 2);
	};

	const glide = (to: number, ms: number) =>
		new Promise<void>((resolve) => {
			const from = split;
			const start = performance.now();
			const step = (now: number) => {
				const t = Math.min(1, (now - start) / ms);
				split = from + (to - from) * carriage(t);
				if (t < 1) raf = requestAnimationFrame(step);
				else resolve();
			};
			raf = requestAnimationFrame(step);
		});

	async function play(me: number) {
		const live = () => me === run;
		await whenReady(0);
		if (!live()) return;
		// a moment on the photo before the first pass
		await sleep(800);
		if (!live()) return;
		intro = 'playing';
		for (let s = 1; s <= LAST; s++) {
			await whenReady(s);
			if (!live()) return;
			// the carriage drops in at the right edge and draws the next
			// pass leftwards over the last one. The last stage moved under
			// the handle while the full picture of it hid the swap.
			split = 100;
			setStage(s);
			penUp = false;
			await sleep(250);
			if (!live()) return;
			if (s === LAST) {
				// park halfway: the lines render next to the real plot
				await glide(50, 1200);
				break;
			}
			await glide(0, 1300);
			if (!live()) return;
			penUp = true;
			await sleep(450);
		}
		if (live()) intro = 'off';
	}

	onMount(() => {
		if (prefersReducedMotion.current || !frame) return;
		intro = 'armed';
		const me = run;
		for (let s = 0; s <= LAST; s++) prefetch(s);
		// start from the bare photo. Usually the frame is still below the
		// fold and nobody sees the switch; on a screen tall enough to show
		// it at load, the stages crossfade to the photo.
		whenReady(0).then(() => me === run && setStage(0));
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				io.disconnect();
				if (me === run) play(me);
			},
			{ threshold: 0.6 }
		);
		io.observe(frame);
		return () => {
			io.disconnect();
			stopIntro();
		};
	});
</script>

{#snippet layer(slot: Slot, k: number)}
	{@const item = STAGES[k]}
	{@const on = isOn(slot, k)}
	<div class="layer" class:on class:plot={k === LAST} aria-hidden={on ? undefined : true}>
		<img
			src={item.picture.src}
			srcset={item.picture.srcset}
			sizes={k === LAST ? PLOT_SIZES : SIZES}
			alt={on ? item.picture.alt : ''}
			width={k === LAST ? 800 : HOW_WIDTH}
			height={k === LAST ? 1067 : HOW_HEIGHT}
			loading="lazy"
			decoding="async"
			draggable="false"
			use:decoded={`${slot}-${k}`}
		/>
		<span class="label" aria-hidden="true">{item.num} {item.name}</span>
	</div>
{/snippet}

<div class="stages" class:instant={intro === 'playing'}>
	<div class="frame-col" use:reveal>
		<!-- the photo alone has nothing to compare, so no split either -->
		{#if comparing}
			<input
				class="range"
				type="range"
				min="0"
				max="100"
				step="1"
				bind:value={split}
				aria-label="move the split between {before.name} and {after.name}"
				aria-valuetext="{Math.round(split)}% {before.name}, {100 - Math.round(split)}% {after.name}"
				onkeydown={stopIntro}
				onfocus={stopIntro}
			/>
		{/if}
		<div
			class="sheet"
			class:comparing
			class:dragging
			bind:this={frame}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			onpointercancel={release}
			{onlostpointercapture}
			role="presentation"
		>
			<div class="view" class:pen-up={penUp} style:aspect-ratio="{HOW_WIDTH} / {HOW_HEIGHT}">
				<div class="slot base">
					{#each BASE as k (k)}
						{#if mountedKeys.has(`base-${k}`)}
							{@render layer('base', k)}
						{/if}
					{/each}
				</div>
				<div
					class="slot after"
					class:empty={!comparing}
					style:transform="translate3d({split}%, 0, 0)"
				>
					<div class="after-inner" style:transform="translate3d({-split}%, 0, 0)">
						{#each AFTER as k (k)}
							{#if mountedKeys.has(`after-${k}`)}
								{@render layer('after', k)}
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<div
				class="handle"
				class:hidden={!comparing || penUp}
				style:transform="translate3d({split}%, 0, 0)"
				style:--split={split}
				aria-hidden="true"
			>
				<span class="rail"></span>
				<span class="grip">
					<svg viewBox="0 0 22 12"><path d="M7 1 1.5 6 7 11zM15 1l5.5 5L15 11z" /></svg>
				</span>
			</div>

			<button
				type="button"
				class="enlarge"
				aria-label="enlarge {current.num} {current.name}"
				title="enlarge"
				onpointerdown={(e) => e.stopPropagation()}
				onfocus={stopIntro}
				onclick={zoom}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"
					><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></svg
				>
			</button>
		</div>
	</div>

	<div class="side" use:reveal>
		<fieldset class="tabs">
			<legend class="sr-only">show a stage</legend>
			{#each STAGES as item, i (item.num)}
				<label class="tab" class:on={stage === i}>
					<input
						type="radio"
						name="how-stage"
						value={i}
						checked={stage === i}
						onchange={() => pick(i)}
						onpointerdown={pressTab}
						onclick={stopIntro}
						onkeydown={stopIntro}
						onfocus={() => {
							stopIntro();
							prefetch(i);
						}}
						onpointerenter={() => prefetch(i)}
					/>
					<span class="num">{item.num}</span>
					<span class="name">{item.name}</span>
					<span class="stat">{item.stat}</span>
				</label>
			{/each}
		</fieldset>

		<div class="caption">
			{#each STAGES as item (item.num)}
				<p class="sizer" aria-hidden="true">{item.caption}</p>
			{/each}
			<div class="live" aria-live={intro === 'off' ? 'polite' : 'off'}>
				{#key stage}
					<p class="line">{current.caption}</p>
				{/key}
			</div>
		</div>

		<div class="open">
			<Cta href="/studio?example=milkmaid">open in RSTR</Cta>
			<p class="open-note">the Milkmaid, with the exact settings of this drawing</p>
		</div>

		<p class="credit">{MILKMAID_CREDIT}</p>
	</div>
</div>

<style>
	.stages {
		--gap: clamp(2.5rem, 5.5vw, 4.75rem);
		--side-min: 16rem;
		--screen-h: 100vh;
		/* the frame always fits the screen's height, with room to spare */
		--frame-w: min(35rem, max(20rem, calc((var(--screen-h) - 9rem) * 1200 / 1345)));
		/* and next to the tabs it gives way before they get too narrow */
		--frame-col: min(var(--frame-w), 100% - var(--side-min) - var(--gap));

		display: grid;
		grid-template-columns: var(--frame-col) minmax(var(--side-min), 23rem);
		gap: var(--gap);
		align-items: center;
		margin-top: clamp(2.5rem, 5vw, 3.75rem);
	}

	/* the small viewport height ignores the phone's collapsing toolbars */
	@supports (height: 100svh) {
		.stages {
			--screen-h: 100svh;
		}
	}

	/* ------------------------------------------------- the sheet */

	.frame-col {
		position: relative;
		transition:
			opacity 0.7s ease,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.sheet {
		position: relative;
		/* the grip measures the frame in cqw to stay inside it */
		container-type: inline-size;
		border: var(--edge);
		background: var(--sheet);
		box-shadow: var(--hard-lg);
		/* vertical swipes still scroll the page; sideways drags are ours */
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}

	.sheet.comparing {
		cursor: ew-resize;
	}

	.view {
		position: relative;
		overflow: hidden;
		isolation: isolate;
	}

	.view img {
		-webkit-user-drag: none;
	}

	.slot,
	.after-inner {
		position: absolute;
		inset: 0;
	}

	.after,
	.after-inner {
		will-change: transform;
	}

	.after {
		z-index: 1;
		overflow: hidden;
	}

	.layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--sheet);
		/* the incoming stage fades in on top; the outgoing one waits under
		   it until the fade is done, so a switch never dips to paper */
		opacity: 0;
		transition: opacity 0.3s ease 0.3s;
		/* stages crossfade: each picture on its own layer */
		will-change: opacity;
	}

	.layer.on {
		z-index: 1;
		opacity: 1;
		transition-delay: 0s;
	}

	/* nothing comes in when the photo shows alone: just fade out */
	.empty .layer {
		transition-delay: 0s;
	}

	/* the intro swaps stages only where nobody can see the swap */
	.instant .layer {
		transition: none;
	}

	.layer img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}

	/* the plot photo: its drawn area mapped onto the frame (the ink spans
	   3.5%-92% of the photo's width and 7.3%-81.3% of its height), so the
	   split lines up with the renders */
	.plot {
		background: #e9e5da;
	}

	.plot img {
		width: 113%;
		height: auto;
		left: -3.95%;
		top: -9.8%;
		right: auto;
		bottom: auto;
		max-width: none;
	}

	/* each picture carries its own label, so the handle cuts across it */
	.label {
		position: absolute;
		top: 0.65rem;
		z-index: 1;
		padding: 0.22rem 0.42rem 0.26rem;
		border: 2px solid var(--ink);
		background: var(--sheet);
		color: var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.72rem;
		line-height: 1;
		white-space: nowrap;
		transition: opacity 0.18s ease;
	}

	/* between intro passes the labels lift with the carriage, so a stage
	   moving from the right slot to the left one never shows a jump */
	.pen-up .label {
		opacity: 0;
	}

	.base .label {
		left: 0.65rem;
	}

	.after .label {
		right: 0.65rem;
		background: var(--ink);
		color: var(--sheet);
	}

	/* ------------------------------------------------- the pen carriage */

	.handle {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		will-change: transform;
		transition: opacity 0.18s ease;
	}

	.handle.hidden {
		opacity: 0;
	}

	/* an ink line with a paper edge, so it reads on dark and light alike */
	.rail {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -1px;
		width: 2px;
		background: var(--ink);
		box-shadow: 0 0 0 1.5px rgba(255, 254, 247, 0.9);
	}

	/* centered on the line, except at either end of its travel, where the
	   carriage stops at the edge of the frame and the line runs on */
	.grip {
		--half: 1.375rem;

		position: absolute;
		top: 50%;
		left: 0;
		display: grid;
		place-items: center;
		width: calc(2 * var(--half));
		height: 2.25rem;
		translate: -50% -50%;
		border: var(--edge);
		background: var(--sheet);
		box-shadow: var(--hard);
		color: var(--ink);
		transition:
			transform 0.13s ease,
			box-shadow 0.13s ease;
		/* rides the split: keep it on its own layer */
		will-change: transform;
	}

	@supports (width: 1cqw) {
		.grip {
			translate: calc(
					-50% +
						clamp(var(--half) - var(--split) * 1cqw, 0px, (100 - var(--split)) * 1cqw - var(--half))
				) -50%;
		}
	}

	.grip svg {
		width: 1.35rem;
		height: 0.75rem;
		fill: currentColor;
	}

	@media (hover: hover) {
		.comparing:hover .grip {
			transform: translate(-2px, -2px);
			box-shadow: 6px 6px 0 var(--ink);
		}
	}

	.comparing.dragging .grip {
		transform: translate(4px, 4px);
		box-shadow: 0 0 0 var(--ink);
	}

	.range:focus-visible + .sheet .grip {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	/* ------------------------------------------------- enlarge */

	.enlarge {
		position: absolute;
		right: 0.65rem;
		bottom: 0.65rem;
		z-index: 3;
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		margin: 0;
		padding: 0;
		border: var(--edge);
		border-radius: 0;
		background: var(--sheet) !important;
		box-shadow: var(--hard);
		color: var(--ink) !important;
		cursor: zoom-in;
		transition:
			transform 0.13s ease,
			box-shadow 0.13s ease;
		/* moves on hover and press: keep it on its own layer */
		will-change: transform;
	}

	.enlarge svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: square;
	}

	.enlarge:hover {
		transform: translate(-2px, -2px);
		box-shadow: 6px 6px 0 var(--ink);
	}

	.enlarge:active {
		transform: translate(4px, 4px);
		box-shadow: 0 0 0 var(--ink);
	}

	.enlarge:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	/* ------------------------------------------------- the tabs */

	.side {
		min-width: 0;
		transition:
			opacity 0.7s ease 0.15s,
			transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.15s;
	}

	.tabs {
		display: grid;
		gap: 0.8rem;
		min-inline-size: 0;
		margin: 0;
		/* room for the shadows, and for the picked tab pressed into its own */
		padding: 0 4px 4px 0;
		border: 0;
	}

	.tab {
		position: relative;
		display: grid;
		grid-template-columns: 2.9rem minmax(0, 1fr);
		column-gap: 0.85rem;
		align-items: baseline;
		align-content: start;
		padding: 0.6rem 0.8rem 0.65rem 0;
		border: var(--edge);
		background: var(--sheet);
		box-shadow: var(--hard);
		color: var(--ink);
		cursor: pointer;
		transition:
			transform 0.13s ease,
			box-shadow 0.13s ease;
		/* moves on hover and press: keep it on its own layer */
		will-change: transform;
	}

	/* the radio covers the whole tab: one click target, native arrow keys */
	.tab input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.num {
		grid-row: span 2;
		align-self: stretch;
		display: grid;
		place-items: center;
		margin-block: -0.6rem -0.65rem;
		border-right: 2px solid var(--ink);
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		color: var(--ink);
	}

	.name {
		font-family: 'mono-bold', monospace;
		font-size: 1.02rem;
		line-height: 1.35;
	}

	.stat {
		grid-column: 2;
		font-family: 'mono-light', monospace;
		font-size: 0.8rem;
		line-height: 1.4;
		color: var(--muted);
	}

	@media (hover: hover) {
		.tab:not(.on):hover {
			transform: translate(-2px, -2px);
			box-shadow: 6px 6px 0 var(--ink);
		}
	}

	.tab:not(.on):active {
		transform: translate(4px, 4px);
		box-shadow: 0 0 0 var(--ink);
	}

	/* the picked stage is pressed down into its shadow and inked */
	.tab.on {
		background: var(--ink);
		color: var(--sheet);
		transform: translate(4px, 4px);
		box-shadow: 0 0 0 var(--ink);
	}

	.tab.on .num {
		color: var(--sheet);
		border-color: rgba(255, 254, 247, 0.4);
	}

	.tab.on .stat {
		color: rgba(255, 254, 247, 0.78);
	}

	.tab.on,
	.tab.on input {
		cursor: default;
	}

	.tab:has(input:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	/* ------------------------------------------------- caption */

	/* every caption sits in the same cell, so the tallest sets the height
	   and switching never moves anything */
	.caption {
		display: grid;
		margin-top: 1.5rem;
	}

	.caption > * {
		grid-area: 1 / 1;
	}

	.sizer {
		visibility: hidden;
	}

	.sizer,
	.line {
		text-wrap: pretty;
		font-family: 'serif-text', serif;
		font-size: 1.02rem;
		line-height: 1.6;
		color: var(--ink-soft);
	}

	.line {
		animation: caption-in 0.4s ease both;
	}

	@keyframes caption-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}

	/* open this very drawing in the studio: same picture, same settings */
	.open {
		margin-top: 1.75rem;
	}

	.open-note {
		margin-top: 0.8rem;
		font-family: 'mono-light', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.credit {
		margin-top: 1.25rem;
		font-family: 'mono-light', monospace;
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.range,
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* ------------------------------------------------- entrance */

	.frame-col:global([data-reveal='out']),
	.side:global([data-reveal='out']) {
		opacity: 0;
		transform: translateY(18px);
	}

	/* ------------------------------------------------- narrow: one column */

	@media (max-width: 900px) {
		.stages {
			grid-template-columns: minmax(0, 1fr);
			justify-items: center;
			gap: 2.25rem;
		}

		.frame-col,
		.side {
			width: min(100%, var(--frame-w));
		}

		.tabs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.7rem;
		}

		.caption {
			margin-top: 1.25rem;
		}
	}

	/* phones: the number moves in front of the name */
	@media (max-width: 480px) {
		.tab {
			grid-template-columns: auto minmax(0, 1fr);
			column-gap: 0.45rem;
			padding: 0.5rem 0.65rem 0.55rem;
		}

		.num {
			grid-row: auto;
			display: block;
			margin: 0;
			border: 0;
			font-size: 0.74rem;
			color: var(--muted);
		}

		.tab.on .num {
			color: rgba(255, 254, 247, 0.78);
		}

		.name {
			font-size: 0.95rem;
		}

		.stat {
			grid-column: 1 / -1;
			font-size: 0.74rem;
		}
	}

	@keyframes caption-fade {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.frame-col,
		.side,
		.grip,
		.tab,
		.enlarge {
			transition: none;
		}

		.line {
			animation-name: caption-fade;
		}
	}
</style>
