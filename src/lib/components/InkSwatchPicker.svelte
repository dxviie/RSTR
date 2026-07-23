<script lang="ts">
	// The pen-color control of a layer card: a chip that opens a swatch panel
	// of every real ink in the curated palette (inkColors.ts), one section per
	// product line, plus a native color input for any other color. Picking an
	// ink hands the whole InkColor to the caller so the layer can take the
	// ink's name along with its hex; the custom input hands back only a hex.
	//
	// The panel is a native Popover (top layer): the sidebar pane clips
	// overflow, and on mobile its backdrop-filter would trap position: fixed
	// descendants — the top layer escapes both. On desktop it is a dropdown
	// anchored under the chip; on small screens (the page's stacked layout)
	// it is a bottom sheet instead — anchoring and close-on-scroll don't
	// survive phone scrolling (chrome collapse, momentum, chained touch
	// scrolls all fire scroll events). Engines without the Popover API get
	// the old behavior: the chip opens the native color input.
	import { inkByHex, inkSets, type InkColor } from '$lib/rstr2/inkColors';

	const {
		color,
		onpick
	}: {
		/** current pen color (#rrggbb, any case) */
		color: string;
		/** an ink pick carries the ink; a custom-color pick only the hex */
		onpick: (hex: string, ink?: InkColor) => void;
	} = $props();

	const sets = inkSets();
	const uid = $props.id();
	const popoverId = `ink-popover-${uid}`;

	/** the palette ink behind the current color, if it is one */
	const selected = $derived(inkByHex(color));

	let trigger: HTMLButtonElement | undefined = $state();
	let pop: HTMLDivElement | undefined = $state();
	let fallbackInput: HTMLInputElement | undefined = $state();
	let open = $state(false);
	/** ink under the pointer or focus — drives the name readout in the footer */
	let hovered: InkColor | null = $state(null);

	const popoverSupported =
		typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

	// Bottom-sheet presentation below the page's stacked-layout breakpoint.
	// Decided per open (not per mount) so rotation between opens just works.
	const SHEET_QUERY = '(max-width: 900px)';
	const isSheet = () => window.matchMedia(SHEET_QUERY).matches;
	let sheet = $state(false);

	// Top-layer popovers don't anchor natively (CSS anchor positioning isn't
	// everywhere yet): place the panel under the chip by hand, clamped to the
	// viewport, flipped above the chip when there's more room up than down.
	const place = () => {
		if (!trigger || !pop) return;
		const chip = trigger.getBoundingClientRect();
		const margin = 8;
		const gap = 6;
		const x = Math.max(margin, Math.min(chip.left, window.innerWidth - pop.offsetWidth - margin));
		let y = chip.bottom + gap;
		if (y + pop.offsetHeight > window.innerHeight - margin) {
			const above = chip.top - gap - pop.offsetHeight;
			y =
				above >= margin ? above : Math.max(margin, window.innerHeight - margin - pop.offsetHeight);
		}
		pop.style.left = `${x}px`;
		pop.style.top = `${y}px`;
	};

	// Desktop only: a pane scroll under the open panel would leave it floating
	// detached from its chip — close it instead. Scrolling inside the panel
	// itself is fine. The sheet never does this: it is pinned, not anchored,
	// and on touch screens scroll events also come from browser-chrome
	// collapse, momentum settling and scrolls chained through the panel —
	// closing on those snaps the panel shut mid-interaction.
	const onScroll = (event: Event) => {
		if (event.target instanceof Node && pop?.contains(event.target)) return;
		pop?.hidePopover();
	};

	// Crossing the breakpoint while open (rotation, window resize) would need
	// a live presentation swap — close instead and let the next tap reopen.
	const onResize = () => {
		if (isSheet() !== sheet) pop?.hidePopover();
		else if (!sheet) place();
	};

	// beforetoggle fires synchronously before the panel first paints — the
	// sheet class and any stale inline left/top from a desktop open must be
	// settled by then, or the panel flashes in the wrong place.
	const onBeforeToggle = (event: Event) => {
		if ((event as ToggleEvent).newState !== 'open' || !pop) return;
		sheet = isSheet();
		if (sheet) {
			pop.style.left = '';
			pop.style.top = '';
		}
	};

	const onToggle = (event: Event) => {
		open = (event as ToggleEvent).newState === 'open';
		if (open) {
			hovered = null;
			if (!sheet) {
				place();
				window.addEventListener('scroll', onScroll, true);
			}
			window.addEventListener('resize', onResize);
			(
				pop?.querySelector<HTMLElement>('.swatch.selected') ??
				pop?.querySelector<HTMLElement>('.swatch')
			)?.focus();
		} else {
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onResize);
		}
	};

	const pickInk = (ink: InkColor) => {
		onpick(ink.hex, ink);
		pop?.hidePopover();
		trigger?.focus();
	};

	// Arrow keys walk the swatches as one grid across the sets; the column
	// count must match the CSS grid below.
	const GRID_COLUMNS = 10;
	const onGridKeydown = (event: KeyboardEvent) => {
		const step =
			event.key === 'ArrowRight'
				? 1
				: event.key === 'ArrowLeft'
					? -1
					: event.key === 'ArrowDown'
						? GRID_COLUMNS
						: event.key === 'ArrowUp'
							? -GRID_COLUMNS
							: 0;
		if (step === 0 || !pop) return;
		const swatches = [...pop.querySelectorAll<HTMLElement>('.swatch')];
		const index = swatches.indexOf(document.activeElement as HTMLElement);
		if (index < 0) return;
		event.preventDefault();
		swatches[Math.max(0, Math.min(swatches.length - 1, index + step))]?.focus();
	};

	// One swatch is the grid's tab stop (the current ink, or the first);
	// arrows move within, Tab moves on to the custom color row.
	const tabStopHex = $derived(selected?.hex ?? sets[0]?.inks[0]?.hex);
</script>

<!-- |important: the site-wide button:hover rule force-paints buttons
     --muted-light — these buttons ARE their color, so the inline value
     must survive hover -->
<button
	bind:this={trigger}
	class="chip"
	class:open
	type="button"
	style:background-color|important={color}
	popovertarget={popoverSupported ? popoverId : undefined}
	onclick={() => {
		if (!popoverSupported) fallbackInput?.click();
	}}
	title={`pen color — ${selected ? selected.name : color} — used in the render and the exported SVG`}
	aria-label={`pen color: ${selected ? selected.name : color}`}
></button>

{#if popoverSupported}
	<div
		bind:this={pop}
		id={popoverId}
		class="ink-popover"
		class:sheet
		popover="auto"
		role="dialog"
		aria-label="pick a pen color"
		onbeforetoggle={onBeforeToggle}
		ontoggle={onToggle}
	>
		<div class="sets">
			{#each sets as set (set.label)}
				<section class="set">
					<h3 class="set-name">{set.label}</h3>
					<div class="swatches">
						{#each set.inks as ink (ink.hex)}
							<button
								class="swatch"
								class:selected={selected?.hex === ink.hex}
								type="button"
								tabindex={ink.hex === tabStopHex ? 0 : -1}
								style:background-color|important={ink.hex}
								title={`${ink.name} · ${ink.hex}`}
								aria-label={ink.name}
								aria-pressed={selected?.hex === ink.hex}
								onclick={() => pickInk(ink)}
								onkeydown={onGridKeydown}
								onmouseenter={() => (hovered = ink)}
								onmouseleave={() => (hovered = null)}
								onfocus={() => (hovered = ink)}
								onblur={() => (hovered = null)}
							></button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
		<footer class="foot">
			<div class="readout">
				<span class="readout-chip" style:background-color={hovered?.hex ?? color} aria-hidden="true"
				></span>
				<span class="readout-name">{(hovered ?? selected)?.name ?? 'custom color'}</span>
				<span class="readout-hex">{hovered?.hex ?? color.toUpperCase()}</span>
			</div>
			<div class="hint">an ink pick also names the layer</div>
			<label class="custom" title="any other color — opens the native color picker">
				custom color…
				<input
					class="custom-input"
					type="color"
					value={color}
					oninput={(event) => onpick(event.currentTarget.value)}
				/>
			</label>
		</footer>
	</div>
{:else}
	<input
		bind:this={fallbackInput}
		class="fallback-input"
		type="color"
		value={color}
		tabindex="-1"
		aria-hidden="true"
		oninput={(event) => onpick(event.currentTarget.value)}
	/>
{/if}

<style>
	/* sizes match the old input[type=color] chip and the layer-row controls */
	.chip {
		flex-shrink: 0;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
		cursor: pointer;
		transition: box-shadow 0.1s ease;
	}

	.chip.open {
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.25),
			0 0 0 2px var(--muted-light, #eef1f6),
			0 0 0 3px var(--muted, #60739f);
	}

	@media (hover: hover) {
		.chip:hover {
			box-shadow:
				inset 0 0 0 1px rgba(255, 255, 255, 0.25),
				0 0 0 2px var(--muted-light, #eef1f6),
				0 0 0 3px var(--muted, #60739f);
		}
	}

	.chip:focus-visible,
	.swatch:focus-visible,
	.custom:has(.custom-input:focus-visible) {
		outline: var(--muted, #60739f) dashed 1px;
		outline-offset: 2px;
	}

	.ink-popover {
		/* the UA default centers popovers (inset: 0 + margin: auto); place()
		   sets left/top inline instead */
		position: fixed;
		inset: auto;
		margin: 0;
		width: min(21rem, calc(100vw - 1rem));
		max-height: calc(100vh - 1rem);
		max-height: calc(100dvh - 1rem);
		padding: 0;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 8px;
		background: #fff;
		color: var(--ink, #1a202c);
		box-shadow: 0 12px 32px rgba(26, 32, 44, 0.22);
		font-family: 'mono-light', monospace;
		font-size: 0.72rem;
	}

	/* display only while open — an unconditional author `display` would beat
	   the UA's `[popover] { display: none }` and leave the panel always on */
	.ink-popover:popover-open {
		display: flex;
		flex-direction: column;
	}

	/* the mobile presentation: pinned to the bottom edge (no anchoring math,
	   immune to browser-chrome resizes), centered and capped on tablets */
	.ink-popover.sheet {
		inset: auto 0 0 0;
		width: min(100%, 30rem);
		margin: 0 auto;
		max-height: 80dvh;
		border-bottom: none;
		border-radius: 12px 12px 0 0;
		box-shadow: 0 -12px 32px rgba(26, 32, 44, 0.25);
	}

	/* the dim reads as "panel on top, tap outside to close" — only the sheet
	   is modal-flavored enough to want it */
	.ink-popover.sheet::backdrop {
		background: rgba(26, 32, 44, 0.28);
	}

	.sets {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		/* a touch scroll that hits the list's edge must die here, not chain
		   on to the page behind the panel */
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.6rem 0.6rem 0.5rem;
	}

	.set-name {
		margin: 0 0 0.25rem;
		font-family: 'mono-bold', monospace;
		font-size: 0.62rem;
		font-weight: normal;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted, #60739f);
	}

	.swatches {
		display: grid;
		/* GRID_COLUMNS in the script must match */
		grid-template-columns: repeat(10, 1fr);
		gap: 4px;
	}

	.swatch {
		aspect-ratio: 1;
		width: 100%;
		padding: 0;
		border: none;
		border-radius: 4px;
		/* keeps near-white inks (real, but pale) visible on the white panel */
		box-shadow: inset 0 0 0 1px rgba(26, 32, 44, 0.14);
		cursor: pointer;
		transition: transform 0.08s ease;
	}

	/* hover-capable pointers only — on touch screens :hover sticks to the
	   last-tapped swatch and leaves it stuck enlarged */
	@media (hover: hover) {
		.swatch:hover {
			transform: scale(1.12);
		}
	}

	.swatch.selected {
		box-shadow:
			inset 0 0 0 1px rgba(26, 32, 44, 0.14),
			0 0 0 1.5px #fff,
			0 0 0 3px var(--ink, #1a202c);
	}

	.foot {
		border-top: 1px solid var(--border, #e1e4e8);
		padding: 0.45rem 0.6rem 0.5rem;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.3rem 0.5rem;
	}

	/* the full ink name gets a row of its own — the kooky names are the fun */
	.readout {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.readout-chip {
		flex-shrink: 0;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(26, 32, 44, 0.14);
	}

	.readout-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.readout-hex {
		flex-shrink: 0;
		color: var(--muted, #60739f);
		font-size: 0.62rem;
	}

	.custom {
		position: relative;
		justify-self: end;
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		font-family: 'mono-bold', monospace;
		font-size: 0.62rem;
		cursor: pointer;
		white-space: nowrap;
	}

	@media (hover: hover) {
		.custom:hover {
			background: var(--muted-light, #eef1f6);
		}
	}

	/* the real native input, invisible over the whole button, so a click opens
	   the platform picker with no scripting involved */
	.custom-input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		opacity: 0;
		cursor: pointer;
	}

	.hint {
		color: var(--muted, #60739f);
		font-size: 0.6rem;
	}

	/* no Popover API: the chip clicks through to this hidden native input */
	.fallback-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	/* home-indicator clearance when the sheet sits on the screen's bottom edge */
	.ink-popover.sheet .foot {
		padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
	}

	@media (pointer: coarse) {
		.swatches {
			gap: 5px;
		}

		/* the custom-color row is the panel's smallest target — give fingers
		   more to land on than the desktop's text-sized button */
		.custom {
			padding: 0.45rem 0.6rem;
		}
	}
</style>
