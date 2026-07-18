<script lang="ts">
	// Visual distribution editor for one dice parameter. The grey histogram is
	// the ground truth — actual samples after clamping and step-rounding, so
	// bound pile-ups and step combing are visible — while the ink line is the
	// analytic shape. Handles drag the shape; the numeric inputs mirror every
	// field for exact entry. Switching kind converts the curve in place.
	import {
		convertDistribution,
		describeDistribution,
		DISTRIBUTION_KINDS,
		DISTRIBUTION_LABELS,
		distributionDensity,
		sampleDistribution,
		type Distribution,
		type DistributionKind
	} from '$lib/rstr2/distributions';
	import { mulberry32 } from '$lib/rstr2/rngSources';
	import type { CurveMeta } from '$lib/rstr2/rngProfiles';

	const {
		label,
		meta,
		dist,
		locked = false,
		onchange
	}: {
		label: string;
		meta: CurveMeta;
		dist: Distribution;
		locked?: boolean;
		onchange: (dist: Distribution) => void;
	} = $props();

	// ─── chart geometry ──────────────────────────────────────────────────────

	const W = 340;
	const H = 112;
	const PX = 10; // horizontal padding
	const TOP = 8; // headroom above the tallest bar
	const BASE = H - 16; // baseline, leaves room for the bound labels

	const span = $derived(meta.hardMax - meta.hardMin);
	const x = (v: number): number => PX + ((v - meta.hardMin) / span) * (W - 2 * PX);
	const xClamped = (v: number): number => Math.min(W - PX, Math.max(PX, x(v)));

	// drag precision: about a pixel of the domain, expressed in nice decimals
	const decimals = $derived(Math.min(4, Math.max(0, 2 - Math.floor(Math.log10(span)))));
	const round = (v: number): number => parseFloat(v.toFixed(decimals));
	const fmt = (v: number): string => {
		const text = v.toFixed(Math.min(4, decimals + 1));
		return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
	};

	// ─── samples: the ground truth histogram + stats ─────────────────────────

	const SAMPLE_N = 2500;
	const BIN_N = 64;

	// fixed seed → the histogram is stable while dragging instead of boiling
	const samples = $derived.by(() => {
		const rng = mulberry32(0x5eed);
		const out = new Array<number>(SAMPLE_N);
		for (let i = 0; i < SAMPLE_N; i++) out[i] = sampleDistribution(dist, rng);
		return out;
	});

	const histPath = $derived.by(() => {
		if (dist.kind === 'choice') return '';
		const bins = new Array<number>(BIN_N).fill(0);
		for (const v of samples) {
			const idx = Math.min(BIN_N - 1, Math.max(0, Math.floor(((v - meta.hardMin) / span) * BIN_N)));
			bins[idx]++;
		}
		const maxBin = Math.max(...bins, 1);
		const barW = (W - 2 * PX) / BIN_N;
		let path = '';
		for (let i = 0; i < BIN_N; i++) {
			if (bins[i] === 0) continue;
			const h = (bins[i] / maxBin) * (BASE - TOP);
			path += `M${(PX + i * barW).toFixed(1)} ${BASE} h${barW.toFixed(2)} v${(-h).toFixed(1)} h${(-barW).toFixed(2)} Z`;
		}
		return path;
	});

	const stats = $derived.by(() => {
		const sorted = [...samples].sort((a, b) => a - b);
		const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
		const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
		return { mean, p05: q(0.05), p50: q(0.5), p95: q(0.95) };
	});

	// ─── the analytic shape ──────────────────────────────────────────────────

	const curve = $derived.by(() => {
		if (dist.kind === 'constant' || dist.kind === 'choice') return { path: '', peak: 0 };
		const STEPS = 140;
		const points: [number, number][] = [];
		let peak = 0;
		for (let i = 0; i <= STEPS; i++) {
			const v = dist.min + ((dist.max - dist.min) * i) / STEPS;
			const density = distributionDensity(dist, v);
			peak = Math.max(peak, density);
			points.push([v, density]);
		}
		if (peak <= 0) return { path: '', peak: 0 };
		let path = `M${x(dist.min).toFixed(1)} ${BASE}`;
		for (const [v, density] of points) {
			path += ` L${x(v).toFixed(1)} ${(BASE - (density / peak) * (BASE - TOP)).toFixed(1)}`;
		}
		path += ` L${x(dist.max).toFixed(1)} ${BASE}`;
		return { path, peak };
	});

	/** y of the analytic curve at value v (baseline when flat/discrete) */
	const yOf = (v: number): number => {
		if (curve.peak <= 0) return BASE;
		return BASE - (distributionDensity(dist, v) / curve.peak) * (BASE - TOP);
	};

	const choiceScale = $derived(
		dist.kind === 'choice' ? Math.max(...dist.options.map((o) => o.weight), 1) : 1
	);

	// mini shape for the collapsed card summary
	const spark = $derived.by(() => {
		const SW = 44;
		const SH = 14;
		const sx = (v: number) => ((v - meta.hardMin) / span) * SW;
		if (dist.kind === 'constant') {
			const cx = sx(dist.value).toFixed(1);
			return `M${cx} ${SH} L${cx} 2`;
		}
		if (dist.kind === 'choice') {
			return dist.options
				.map(
					(o) =>
						`M${sx(o.value).toFixed(1)} ${SH} v${(-(Math.max(0, o.weight) / choiceScale) * (SH - 2)).toFixed(1)}`
				)
				.join(' ');
		}
		const STEPS = 36;
		let peak = 0;
		const points: [number, number][] = [];
		for (let i = 0; i <= STEPS; i++) {
			const v = dist.min + ((dist.max - dist.min) * i) / STEPS;
			const density = distributionDensity(dist, v);
			peak = Math.max(peak, density);
			points.push([v, density]);
		}
		if (peak <= 0) return '';
		let path = `M${sx(dist.min).toFixed(1)} ${SH}`;
		for (const [v, density] of points) {
			path += ` L${sx(v).toFixed(1)} ${(SH - (density / peak) * (SH - 2)).toFixed(1)}`;
		}
		return path + ` L${sx(dist.max).toFixed(1)} ${SH}`;
	});

	// ─── handles & dragging ──────────────────────────────────────────────────

	type DragTarget =
		| 'min'
		| 'max'
		| 'mean'
		| 'sigma'
		| 'meanA'
		| 'sigmaA'
		| 'meanB'
		| 'sigmaB'
		| 'mode'
		| 'median'
		| 'value';

	interface Handle {
		target: DragTarget;
		v: number;
		y: number;
		hollow?: boolean;
		title: string;
	}

	const handles = $derived.by((): Handle[] => {
		switch (dist.kind) {
			case 'gaussian':
				return [
					{ target: 'mean', v: dist.mean, y: yOf(dist.mean), title: `mean ${dist.mean}` },
					{
						target: 'sigma',
						v: dist.mean + dist.stdDev,
						y: yOf(dist.mean + dist.stdDev),
						hollow: true,
						title: `stdDev ${dist.stdDev} — drag sideways to widen the bell`
					}
				];
			case 'triangular':
				return [{ target: 'mode', v: dist.mode, y: yOf(dist.mode), title: `peak ${dist.mode}` }];
			case 'power': {
				const median = dist.min + (dist.max - dist.min) * Math.pow(0.5, dist.gamma);
				return [
					{
						target: 'median',
						v: median,
						y: yOf(median),
						title: `median ${fmt(median)} — drag to shift the bias (γ ${dist.gamma})`
					}
				];
			}
			case 'bimodal':
				return [
					{
						target: 'meanA',
						v: dist.meanA,
						y: yOf(dist.meanA),
						title: `bell A mean ${dist.meanA}`
					},
					{
						target: 'sigmaA',
						v: dist.meanA + dist.stdDevA,
						y: yOf(dist.meanA + dist.stdDevA),
						hollow: true,
						title: `bell A stdDev ${dist.stdDevA}`
					},
					{
						target: 'meanB',
						v: dist.meanB,
						y: yOf(dist.meanB),
						title: `bell B mean ${dist.meanB}`
					},
					{
						target: 'sigmaB',
						v: dist.meanB + dist.stdDevB,
						y: yOf(dist.meanB + dist.stdDevB),
						hollow: true,
						title: `bell B stdDev ${dist.stdDevB}`
					}
				];
			case 'constant':
				return [{ target: 'value', v: dist.value, y: TOP + 4, title: `value ${dist.value}` }];
			default:
				return [];
		}
	});

	let svgEl: SVGSVGElement | undefined = $state();
	let dragging: DragTarget | null = $state(null);

	const valueAt = (clientX: number): number => {
		if (!svgEl) return meta.hardMin;
		const rect = svgEl.getBoundingClientRect();
		const frac = (clientX - rect.left) / rect.width;
		const v = meta.hardMin + ((frac * W - PX) / (W - 2 * PX)) * span;
		return Math.min(meta.hardMax, Math.max(meta.hardMin, v));
	};

	const startDrag = (target: DragTarget) => (event: PointerEvent) => {
		if (locked) return;
		dragging = target;
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		event.preventDefault();
	};

	const moveDrag = (event: PointerEvent) => {
		if (!dragging) return;
		const v = round(valueAt(event.clientX));
		switch (dragging) {
			case 'min':
				setField('min', v);
				break;
			case 'max':
				setField('max', v);
				break;
			case 'mean':
			case 'meanA':
			case 'meanB':
			case 'mode':
			case 'value':
			case 'median':
				setField(dragging, v);
				break;
			case 'sigma':
				if (dist.kind === 'gaussian') setField('stdDev', round(Math.abs(v - dist.mean)));
				break;
			case 'sigmaA':
				if (dist.kind === 'bimodal') setField('stdDevA', round(Math.abs(v - dist.meanA)));
				break;
			case 'sigmaB':
				if (dist.kind === 'bimodal') setField('stdDevB', round(Math.abs(v - dist.meanB)));
				break;
		}
	};

	const endDrag = () => (dragging = null);

	// keyboard version of a drag — one precision increment per arrow press
	const nudge = (target: DragTarget, direction: number): void => {
		const inc = Math.max(dist.step, Math.pow(10, -decimals)) * direction;
		switch (target) {
			case 'min':
				setField('min', round(dist.min + inc));
				break;
			case 'max':
				setField('max', round(dist.max + inc));
				break;
			case 'mean':
				if (dist.kind === 'gaussian') setField('mean', round(dist.mean + inc));
				break;
			case 'sigma':
				if (dist.kind === 'gaussian') setField('stdDev', round(Math.max(0, dist.stdDev + inc)));
				break;
			case 'mode':
				if (dist.kind === 'triangular') setField('mode', round(dist.mode + inc));
				break;
			case 'value':
				if (dist.kind === 'constant') setField('value', round(dist.value + inc));
				break;
			case 'meanA':
				if (dist.kind === 'bimodal') setField('meanA', round(dist.meanA + inc));
				break;
			case 'meanB':
				if (dist.kind === 'bimodal') setField('meanB', round(dist.meanB + inc));
				break;
			case 'sigmaA':
				if (dist.kind === 'bimodal') setField('stdDevA', round(Math.max(0, dist.stdDevA + inc)));
				break;
			case 'sigmaB':
				if (dist.kind === 'bimodal') setField('stdDevB', round(Math.max(0, dist.stdDevB + inc)));
				break;
			case 'median':
				// arrow right pushes the median right — a lower gamma
				if (dist.kind === 'power') {
					const factor = direction > 0 ? 1 / 1.1 : 1.1;
					setField('gamma', parseFloat((dist.gamma * factor).toFixed(3)));
				}
				break;
		}
	};

	const keyNudge = (target: DragTarget) => (event: KeyboardEvent) => {
		if (locked) return;
		const direction =
			event.key === 'ArrowRight' || event.key === 'ArrowUp'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowDown'
					? -1
					: 0;
		if (direction === 0) return;
		event.preventDefault();
		nudge(target, direction);
	};

	// ─── field updates (shared by drags and numeric inputs) ──────────────────

	const clampDomain = (v: number): number => Math.min(meta.hardMax, Math.max(meta.hardMin, v));

	const setField = (field: string, raw: number): void => {
		if (locked || !Number.isFinite(raw)) return;
		const d = dist;
		switch (field) {
			case 'min':
				onchange({ ...d, min: Math.min(clampDomain(raw), d.max - d.step) });
				break;
			case 'max':
				onchange({ ...d, max: Math.max(clampDomain(raw), d.min + d.step) });
				break;
			case 'step':
				onchange({ ...d, step: Math.max(raw, 0.000001) });
				break;
			case 'mean':
				if (d.kind === 'gaussian') onchange({ ...d, mean: clampDomain(raw) });
				break;
			case 'stdDev':
				if (d.kind === 'gaussian') onchange({ ...d, stdDev: Math.max(0, raw) });
				break;
			case 'mode':
				if (d.kind === 'triangular') onchange({ ...d, mode: clampDomain(raw) });
				break;
			case 'gamma':
				if (d.kind === 'power') onchange({ ...d, gamma: Math.min(20, Math.max(0.05, raw)) });
				break;
			case 'median': {
				// dragging the median point solves for gamma: median = min + span·0.5^γ
				if (d.kind !== 'power') break;
				const extent = d.max - d.min;
				if (extent <= 0) break;
				const t = Math.min(0.998, Math.max(0.002, (clampDomain(raw) - d.min) / extent));
				const gamma = Math.min(20, Math.max(0.05, Math.log(t) / Math.log(0.5)));
				onchange({ ...d, gamma: parseFloat(gamma.toFixed(3)) });
				break;
			}
			case 'meanA':
				if (d.kind === 'bimodal') onchange({ ...d, meanA: clampDomain(raw) });
				break;
			case 'meanB':
				if (d.kind === 'bimodal') onchange({ ...d, meanB: clampDomain(raw) });
				break;
			case 'stdDevA':
				if (d.kind === 'bimodal') onchange({ ...d, stdDevA: Math.max(0, raw) });
				break;
			case 'stdDevB':
				if (d.kind === 'bimodal') onchange({ ...d, stdDevB: Math.max(0, raw) });
				break;
			case 'mixA':
				if (d.kind === 'bimodal') onchange({ ...d, mixA: Math.min(1, Math.max(0, raw)) });
				break;
			case 'value':
				if (d.kind === 'constant') onchange({ ...d, value: clampDomain(raw) });
				break;
		}
	};

	const numInput = (field: string) => (event: Event) => {
		const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (Number.isFinite(raw)) setField(field, raw);
	};

	const switchKind = (event: Event) => {
		const kind = (event.currentTarget as HTMLSelectElement).value as DistributionKind;
		onchange(convertDistribution({ ...dist }, kind));
	};

	// ─── choice options ──────────────────────────────────────────────────────

	const setOption = (index: number, field: 'value' | 'weight') => (event: Event) => {
		if (dist.kind !== 'choice') return;
		const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (!Number.isFinite(raw)) return;
		const options = dist.options.map((option, i) =>
			i === index
				? { ...option, [field]: field === 'weight' ? Math.max(0, raw) : clampDomain(raw) }
				: { ...option }
		);
		onchange({ ...dist, options });
	};

	const addOption = () => {
		if (dist.kind !== 'choice') return;
		const options = [
			...dist.options.map((o) => ({ ...o })),
			{ value: round((dist.min + dist.max) / 2), weight: 1 }
		];
		onchange({ ...dist, options });
	};

	const removeOption = (index: number) => () => {
		if (dist.kind !== 'choice' || dist.options.length <= 1) return;
		onchange({
			...dist,
			options: dist.options.filter((_, i) => i !== index).map((o) => ({ ...o }))
		});
	};
</script>

<details class="curve-card">
	<summary>
		<span class="c-name">{label}</span>
		<svg class="spark" viewBox="0 0 44 14" aria-hidden="true">
			<path d={spark} />
		</svg>
		<span class="c-desc">{DISTRIBUTION_LABELS[dist.kind]} · {describeDistribution(dist)}</span>
	</summary>

	<div class="c-body" class:locked>
		<div class="c-head">
			<select
				value={dist.kind}
				disabled={locked}
				onchange={switchKind}
				title="sampling strategy for this parameter"
			>
				{#each DISTRIBUTION_KINDS as kind (kind)}
					<option value={kind}>{DISTRIBUTION_LABELS[kind]}</option>
				{/each}
			</select>
			{#if meta.unit}<span class="c-unit">{meta.unit}</span>{/if}
		</div>

		<svg
			bind:this={svgEl}
			class="chart"
			viewBox={`0 0 ${W} ${H}`}
			role="img"
			aria-label={`distribution of ${label}`}
			onpointermove={moveDrag}
			onpointerup={endDrag}
			onpointercancel={endDrag}
		>
			<line class="axis" x1={PX} y1={BASE} x2={W - PX} y2={BASE} />
			<path class="hist" d={histPath} />
			{#if dist.kind === 'choice'}
				{#each dist.options as option, i (i)}
					<rect
						class="choice-bar"
						x={xClamped(option.value) - 3}
						y={BASE - (Math.max(0, option.weight) / choiceScale) * (BASE - TOP)}
						width="6"
						height={(Math.max(0, option.weight) / choiceScale) * (BASE - TOP)}
					/>
				{/each}
			{/if}
			{#if dist.kind === 'constant'}
				<line class="pdf" x1={xClamped(dist.value)} y1={BASE} x2={xClamped(dist.value)} y2={TOP} />
			{:else}
				<path class="pdf" d={curve.path} />
			{/if}

			<!-- min / max bounds -->
			{#each [{ target: 'min' as const, v: dist.min }, { target: 'max' as const, v: dist.max }] as bound (bound.target)}
				<line class="bound" x1={x(bound.v)} y1={TOP - 4} x2={x(bound.v)} y2={BASE} />
				<text
					class="bound-label"
					x={x(bound.v)}
					y={H - 4}
					text-anchor={bound.target === 'min' ? 'end' : 'start'}>{fmt(bound.v)}</text
				>
				<rect
					class="grab"
					role="slider"
					tabindex={locked ? -1 : 0}
					aria-label={`${label} ${bound.target} bound`}
					aria-valuemin={meta.hardMin}
					aria-valuemax={meta.hardMax}
					aria-valuenow={bound.v}
					x={x(bound.v) - 5}
					y={TOP - 4}
					width="10"
					height={BASE - TOP + 4}
					onpointerdown={startDrag(bound.target)}
					onkeydown={keyNudge(bound.target)}
				>
					<title>{bound.target} bound {fmt(bound.v)} — drag</title>
				</rect>
			{/each}

			<!-- shape handles -->
			{#each handles as handle (handle.target)}
				<circle
					class="handle"
					class:hollow={handle.hollow}
					role="slider"
					tabindex={locked ? -1 : 0}
					aria-label={`${label} ${handle.target}`}
					aria-valuemin={meta.hardMin}
					aria-valuemax={meta.hardMax}
					aria-valuenow={handle.v}
					cx={xClamped(handle.v)}
					cy={Math.min(BASE - 2, Math.max(TOP, handle.y))}
					r="5"
					onpointerdown={startDrag(handle.target)}
					onkeydown={keyNudge(handle.target)}
				>
					<title>{handle.title}</title>
				</circle>
			{/each}
		</svg>

		<div class="c-stats">
			sampled: x̄ {fmt(stats.mean)} · p5 {fmt(stats.p05)} · p50 {fmt(stats.p50)} · p95 {fmt(
				stats.p95
			)}
		</div>

		{#if dist.kind === 'gaussian'}
			<div class="c-fields">
				<label
					><span>mean</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.mean}
						oninput={numInput('mean')}
					/></label
				>
				<label
					><span>σ</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.stdDev}
						oninput={numInput('stdDev')}
					/></label
				>
				<label
					><span>min</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.min}
						oninput={numInput('min')}
					/></label
				>
				<label
					><span>max</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.max}
						oninput={numInput('max')}
					/></label
				>
				<label
					><span>step</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.step}
						oninput={numInput('step')}
					/></label
				>
			</div>
		{:else if dist.kind === 'uniform'}
			<div class="c-fields">
				<label
					><span>min</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.min}
						oninput={numInput('min')}
					/></label
				>
				<label
					><span>max</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.max}
						oninput={numInput('max')}
					/></label
				>
				<label
					><span>step</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.step}
						oninput={numInput('step')}
					/></label
				>
			</div>
		{:else if dist.kind === 'triangular'}
			<div class="c-fields">
				<label
					><span>peak</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.mode}
						oninput={numInput('mode')}
					/></label
				>
				<label
					><span>min</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.min}
						oninput={numInput('min')}
					/></label
				>
				<label
					><span>max</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.max}
						oninput={numInput('max')}
					/></label
				>
				<label
					><span>step</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.step}
						oninput={numInput('step')}
					/></label
				>
			</div>
		{:else if dist.kind === 'power'}
			<div class="c-fields">
				<label
					><span title="gamma > 1 crowds the low end, < 1 the high end">γ</span><input
						type="number"
						step="0.05"
						min="0.05"
						max="20"
						disabled={locked}
						value={dist.gamma}
						oninput={numInput('gamma')}
					/></label
				>
				<label
					><span>min</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.min}
						oninput={numInput('min')}
					/></label
				>
				<label
					><span>max</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.max}
						oninput={numInput('max')}
					/></label
				>
				<label
					><span>step</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.step}
						oninput={numInput('step')}
					/></label
				>
			</div>
		{:else if dist.kind === 'bimodal'}
			<div class="c-fields">
				<label
					><span>mean A</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.meanA}
						oninput={numInput('meanA')}
					/></label
				>
				<label
					><span>σ A</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.stdDevA}
						oninput={numInput('stdDevA')}
					/></label
				>
				<label
					><span title="share of rolls drawn from bell A">mix A</span><input
						type="number"
						step="0.05"
						min="0"
						max="1"
						disabled={locked}
						value={dist.mixA}
						oninput={numInput('mixA')}
					/></label
				>
				<label
					><span>mean B</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.meanB}
						oninput={numInput('meanB')}
					/></label
				>
				<label
					><span>σ B</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.stdDevB}
						oninput={numInput('stdDevB')}
					/></label
				>
				<label
					><span>step</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.step}
						oninput={numInput('step')}
					/></label
				>
				<label
					><span>min</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.min}
						oninput={numInput('min')}
					/></label
				>
				<label
					><span>max</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.max}
						oninput={numInput('max')}
					/></label
				>
			</div>
		{:else if dist.kind === 'constant'}
			<div class="c-fields">
				<label
					><span>value</span><input
						type="number"
						step="any"
						disabled={locked}
						value={dist.value}
						oninput={numInput('value')}
					/></label
				>
				<label
					><span>step</span><input
						type="number"
						step="any"
						min="0"
						disabled={locked}
						value={dist.step}
						oninput={numInput('step')}
					/></label
				>
			</div>
		{:else if dist.kind === 'choice'}
			<div class="c-options">
				{#each dist.options as option, i (i)}
					<div class="c-option">
						<input
							type="number"
							step="any"
							disabled={locked}
							value={option.value}
							oninput={setOption(i, 'value')}
							title="value"
						/>
						<span>×</span>
						<input
							type="number"
							step="0.5"
							min="0"
							disabled={locked}
							value={option.weight}
							oninput={setOption(i, 'weight')}
							title="weight"
						/>
						<button
							onclick={removeOption(i)}
							disabled={locked || dist.options.length <= 1}
							title="remove this value">✕</button
						>
					</div>
				{/each}
				<button class="c-add" onclick={addOption} disabled={locked} title="add a value"
					>+ value</button
				>
			</div>
		{/if}
	</div>
</details>

<style>
	.curve-card {
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 6px;
		background: #fff;
	}

	summary {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.45rem;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::before {
		content: '▸';
		font-size: 0.6rem;
		color: var(--muted, #60739f);
	}

	details[open] summary::before {
		content: '▾';
	}

	.c-name {
		font-family: 'mono-bold', monospace;
		font-size: 0.68rem;
	}

	.spark {
		width: 44px;
		height: 14px;
		flex-shrink: 0;
	}

	.spark path {
		fill: none;
		stroke: var(--muted, #60739f);
		stroke-width: 1.2;
	}

	.c-desc {
		margin-left: auto;
		font-size: 0.62rem;
		color: var(--muted, #60739f);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.c-body {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.3rem 0.45rem 0.5rem;
		border-top: 1px solid var(--border, #e1e4e8);
	}

	.c-body.locked .chart {
		pointer-events: none;
		opacity: 0.75;
	}

	.c-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.c-head select {
		flex: 1;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		color: var(--ink, #1a202c);
		font-family: inherit;
		font-size: 0.7rem;
	}

	.c-unit {
		font-size: 0.66rem;
		color: var(--muted, #60739f);
	}

	.chart {
		width: 100%;
		height: auto;
		touch-action: none;
		display: block;
	}

	.axis {
		stroke: var(--border, #e1e4e8);
		stroke-width: 1;
	}

	.hist {
		fill: var(--muted-light, #eef1f6);
		stroke: none;
	}

	.pdf {
		fill: none;
		stroke: var(--ink, #1a202c);
		stroke-width: 1.4;
		stroke-linejoin: round;
	}

	.choice-bar {
		fill: var(--muted, #60739f);
	}

	.bound {
		stroke: var(--muted, #60739f);
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}

	.bound-label {
		font-size: 8px;
		fill: var(--muted, #60739f);
		font-family: inherit;
	}

	.grab {
		fill: transparent;
		cursor: ew-resize;
	}

	.handle {
		fill: #fff;
		stroke: var(--ink, #1a202c);
		stroke-width: 1.5;
		cursor: ew-resize;
	}

	.handle.hollow {
		fill: var(--muted-light, #eef1f6);
		stroke: var(--muted, #60739f);
	}

	.c-stats {
		font-size: 0.62rem;
		color: var(--muted, #60739f);
	}

	.c-fields {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.3rem 0.45rem;
	}

	.c-fields label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.64rem;
		color: var(--muted, #60739f);
	}

	.c-fields span {
		min-width: 2.4rem;
		text-align: right;
	}

	.c-fields input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: 0.08rem 0.2rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		color: var(--ink, #1a202c);
		font-family: inherit;
		font-size: 0.68rem;
	}

	.c-options {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.c-option {
		display: grid;
		grid-template-columns: 1fr auto 4rem auto;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.64rem;
		color: var(--muted, #60739f);
	}

	.c-option input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.08rem 0.2rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		color: var(--ink, #1a202c);
		font-family: inherit;
		font-size: 0.68rem;
	}

	.c-option button,
	.c-add {
		padding: 0.08rem 0.4rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		cursor: pointer;
	}

	.c-add {
		align-self: flex-start;
	}

	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
