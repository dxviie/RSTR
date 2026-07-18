<script lang="ts">
	// Weighted-pick editor for the rng debug panel: one row per option with a
	// draggable share bar and an exact numeric weight. Weight 0 removes an
	// option from the draw without deleting it.
	import type { WeightedOption } from '$lib/rstr2/randomize';

	const {
		entries,
		labelOf = (value: string) => value,
		swatchesOf,
		locked = false,
		onchange
	}: {
		entries: WeightedOption<string>[];
		labelOf?: (value: string) => string;
		/** optional colour dots per option (e.g. harmony-set family swatches) */
		swatchesOf?: (value: string) => string[];
		locked?: boolean;
		onchange: (value: string, weight: number) => void;
	} = $props();

	const total = $derived(entries.reduce((sum, entry) => sum + entry.weight, 0));
	/** bar scale — the widest bar is the heaviest option, at least 4 */
	const scale = $derived(Math.max(4, ...entries.map((entry) => entry.weight)));

	let dragValue: string | null = $state(null);

	const weightAt = (track: HTMLElement, clientX: number): number => {
		const rect = track.getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		// snap to .5 so dragged weights stay readable
		return Math.round(frac * scale * 2) / 2;
	};

	const startDrag = (value: string) => (event: PointerEvent) => {
		if (locked) return;
		dragValue = value;
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		onchange(value, weightAt(event.currentTarget as HTMLElement, event.clientX));
	};

	const moveDrag = (event: PointerEvent) => {
		if (dragValue === null) return;
		onchange(dragValue, weightAt(event.currentTarget as HTMLElement, event.clientX));
	};

	const endDrag = () => (dragValue = null);

	const inputWeight = (value: string) => (event: Event) => {
		const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (!Number.isFinite(raw)) return;
		onchange(value, Math.min(99, Math.max(0, raw)));
	};

	const keyNudge = (value: string, current: number) => (event: KeyboardEvent) => {
		if (locked) return;
		const direction =
			event.key === 'ArrowRight' || event.key === 'ArrowUp'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowDown'
					? -1
					: 0;
		if (direction === 0) return;
		event.preventDefault();
		onchange(value, Math.min(99, Math.max(0, current + direction * 0.5)));
	};

	const share = (weight: number): string =>
		total > 0 ? `${Math.round((weight / total) * 100)}%` : '—';
</script>

<div class="weights" class:locked>
	{#each entries as entry (entry.value)}
		<div class="w-row">
			<span class="w-label" title={entry.value}>
				<span class="w-text">{labelOf(entry.value)}</span>
				{#if swatchesOf}
					<span class="w-swatches">
						{#each swatchesOf(entry.value) as hex, i (i)}
							<i style={`background:${hex}`}></i>
						{/each}
					</span>
				{/if}
			</span>
			<div
				class="w-track"
				role="slider"
				tabindex={locked ? -1 : 0}
				aria-label={`${labelOf(entry.value)} weight`}
				aria-valuemin="0"
				aria-valuemax={scale}
				aria-valuenow={entry.weight}
				title="drag to set the weight"
				onpointerdown={startDrag(entry.value)}
				onpointermove={moveDrag}
				onpointerup={endDrag}
				onpointercancel={endDrag}
				onkeydown={keyNudge(entry.value, entry.weight)}
			>
				<div
					class="w-bar"
					class:zero={entry.weight === 0}
					style={`width: ${Math.min(100, (entry.weight / scale) * 100)}%`}
				></div>
			</div>
			<input
				type="number"
				min="0"
				max="99"
				step="0.5"
				disabled={locked}
				value={entry.weight}
				oninput={inputWeight(entry.value)}
				title="weight — the chance relative to the other options"
			/>
			<span class="w-share">{share(entry.weight)}</span>
		</div>
	{/each}
	{#if total <= 0}
		<div class="w-warn">all weights are 0 — the roll falls back to the last option</div>
	{/if}
</div>

<style>
	.weights {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.weights.locked {
		opacity: 0.6;
	}

	.weights.locked .w-track {
		pointer-events: none;
	}

	.w-row {
		display: grid;
		grid-template-columns: 6.4rem 1fr 3.2rem 2.4rem;
		align-items: center;
		gap: 0.4rem;
	}

	.w-label {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.w-text {
		font-size: 0.68rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.w-swatches {
		display: flex;
		gap: 2px;
	}

	.w-swatches i {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		border: 1px solid rgba(26, 32, 44, 0.18);
		box-sizing: border-box;
	}

	.w-track {
		position: relative;
		height: 0.85rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 3px;
		background: #fff;
		cursor: ew-resize;
		touch-action: none;
	}

	.w-bar {
		position: absolute;
		inset: 1px auto 1px 1px;
		background: var(--muted, #60739f);
		border-radius: 2px;
		pointer-events: none;
	}

	.w-bar.zero {
		background: transparent;
	}

	.w-row input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.05rem 0.2rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		color: var(--ink, #1a202c);
		font-family: inherit;
		font-size: 0.7rem;
	}

	.w-share {
		font-size: 0.64rem;
		color: var(--muted, #60739f);
		text-align: right;
	}

	.w-warn {
		font-size: 0.64rem;
		color: #b3261e;
	}
</style>
