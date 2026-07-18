<script lang="ts">
	// The rng debug panel — a dev-only control surface for the studio dice.
	// Profiles (per-parameter distributions + pick weights) are edited here,
	// persisted under a dev localStorage key, and whatever profile is active
	// is exactly what the user-facing randomize button rolls. Not linked from
	// any UI an end user sees: it mounts in dev builds or behind ?rngdebug.
	import CurveEditor from './CurveEditor.svelte';
	import WeightsEditor from './WeightsEditor.svelte';
	import {
		defaultRngProfile,
		DEFAULT_RNG_PROFILE_ID,
		LAYER_OVERRIDE_KEYS,
		type LayerOverrideKey,
		type RngProfile
	} from '$lib/rstr2/randomize';
	import { isBuiltinRngProfileId } from '$lib/rstr2/rngBuiltinProfiles';
	import { harmonySetSwatches } from '$lib/rstr2/inkColors';
	import {
		CURVE_GROUPS,
		CURVE_META,
		LAYER_OVERRIDE_LABELS,
		nextProfileId,
		parseRngProfileFile,
		RNG_CURVE_KEYS,
		rngProfileToCode,
		serializeRngProfile
	} from '$lib/rstr2/rngProfiles';
	import { isSeeded, randomSeed, RNG_SOURCE_KINDS, RNG_SOURCE_LABELS } from '$lib/rstr2/rngSources';
	import {
		activeRngProfile,
		hydrateRngDebug,
		persistRngDebug,
		restartRngSequence,
		rngDebug
	} from '$lib/rstr2/rngRuntime.svelte';
	import { CHANNEL_LABELS, type LayerChannel, type LayerConfig } from '$lib/rstr2/layers';
	import type { Rstr2Settings } from '$lib/rstr2/presets';

	const {
		onclose,
		onroll,
		onapplysettings
	}: {
		onclose: () => void;
		onroll: () => void;
		onapplysettings: (settings: Rstr2Settings) => void;
	} = $props();

	hydrateRngDebug();

	const profile = $derived(activeRngProfile());
	const locked = $derived(isBuiltinRngProfileId(profile.id));
	const seeded = $derived(isSeeded(rngDebug.setup.source.kind));

	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	const note = (message: string) => {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 4000);
	};

	// ─── profile management ──────────────────────────────────────────────────

	const uniqueName = (base: string): string => {
		const names = new Set(rngDebug.setup.profiles.map((entry) => entry.name));
		if (!names.has(base)) return base;
		let n = 2;
		while (names.has(`${base} ${n}`)) n++;
		return `${base} ${n}`;
	};

	const addProfile = (from?: RngProfile) => {
		const copy: RngProfile = JSON.parse(JSON.stringify(from ?? defaultRngProfile()));
		copy.id = nextProfileId();
		copy.name = uniqueName(from ? `${from.name} copy` : 'new profile');
		rngDebug.setup.profiles.push(copy);
		rngDebug.setup.activeProfileId = copy.id;
		persistRngDebug();
	};

	const deleteActive = () => {
		if (locked) return;
		const id = profile.id;
		rngDebug.setup.profiles = rngDebug.setup.profiles.filter((entry) => entry.id !== id);
		rngDebug.setup.activeProfileId = DEFAULT_RNG_PROFILE_ID;
		persistRngDebug();
		note('profile deleted — back on built-in');
	};

	const selectProfile = (event: Event) => {
		rngDebug.setup.activeProfileId = (event.currentTarget as HTMLSelectElement).value;
		persistRngDebug();
	};

	const renameActive = (event: Event) => {
		if (locked) return;
		const name = (event.currentTarget as HTMLInputElement).value.trim();
		if (!name) return;
		profile.name = name;
		persistRngDebug();
	};

	const exportActive = () => {
		const json = serializeRngProfile(JSON.parse(JSON.stringify(profile)));
		const slug = profile.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'profile';
		const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `rstr-rng-profile-${slug}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	let fileInput: HTMLInputElement | undefined = $state();

	const importProfile = (files: FileList | null | undefined) => {
		const file = files?.[0];
		if (!file) return;
		file.text().then((text) => {
			const parsed = parseRngProfileFile(text);
			if (!parsed) {
				note(`could not read ${file.name} — not an rng profile file?`);
				return;
			}
			// imported files never collide with existing ids or the shipped ones
			if (
				isBuiltinRngProfileId(parsed.id) ||
				rngDebug.setup.profiles.some((entry) => entry.id === parsed.id)
			) {
				parsed.id = nextProfileId();
			}
			parsed.name = uniqueName(parsed.name);
			rngDebug.setup.profiles.push(parsed);
			rngDebug.setup.activeProfileId = parsed.id;
			persistRngDebug();
			note(`imported ${file.name}`);
		});
	};

	const copyCode = () => {
		const code = rngProfileToCode(JSON.parse(JSON.stringify(profile)));
		navigator.clipboard
			.writeText(code)
			.then(() => note('TypeScript literal copied — register it in rngBuiltinProfiles.ts'))
			.catch(() => note('clipboard blocked — export .json instead'));
	};

	// ─── rng source ──────────────────────────────────────────────────────────

	const setSourceKind = (event: Event) => {
		rngDebug.setup.source.kind = (event.currentTarget as HTMLSelectElement)
			.value as (typeof RNG_SOURCE_KINDS)[number];
		restartRngSequence();
		persistRngDebug();
	};

	const setSeed = (event: Event) => {
		const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (!Number.isFinite(raw)) return;
		rngDebug.setup.source.seed = raw >>> 0;
		restartRngSequence();
		persistRngDebug();
	};

	const newSeed = () => {
		rngDebug.setup.source.seed = randomSeed();
		restartRngSequence();
		persistRngDebug();
	};

	const restartSequence = () => {
		restartRngSequence();
		note(`sequence restarted from seed ${rngDebug.setup.source.seed}`);
	};

	// ─── curve + weight edits ────────────────────────────────────────────────

	const groupKeys = (group: (typeof CURVE_GROUPS)[number]) =>
		RNG_CURVE_KEYS.filter((key) => CURVE_META[key].group === group);

	const setWeight =
		(list: 'algorithmWeights' | 'channelWeights') => (value: string, weight: number) => {
			if (locked) return;
			const entry = profile[list].find((option) => option.value === value);
			if (!entry) return;
			entry.weight = weight;
			persistRngDebug();
		};

	// ─── colors ──────────────────────────────────────────────────────────────

	const setAccentRate = (event: Event) => {
		if (locked) return;
		const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (!Number.isFinite(raw)) return;
		profile.colors.accentRate = Math.min(1, Math.max(0, raw));
		persistRngDebug();
	};

	const setHarmonyWeight = (value: string, weight: number) => {
		if (locked) return;
		const entry = profile.colors.harmonyWeights.find((option) => option.value === value);
		if (!entry) return;
		entry.weight = weight;
		persistRngDebug();
	};

	// ─── layer overrides ─────────────────────────────────────────────────────

	const setOverrideChance = (key: LayerOverrideKey) => (event: Event) => {
		if (locked) return;
		const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
		if (!Number.isFinite(raw)) return;
		profile.layerOverrideChances[key] = Math.min(1, Math.max(0, raw));
		persistRngDebug();
	};

	// summary of one logged roll, terse enough for a row
	const rollSummary = (settings: Rstr2Settings): string =>
		`${settings.params.algorithm} · ${settings.layers.length} layer${settings.layers.length === 1 ? '' : 's'} · res ${settings.params.resolution}`;

	// the non-null overrides of a logged layer, for the chip tooltip
	const overrideSummary = (layer: LayerConfig): string => {
		const parts = LAYER_OVERRIDE_KEYS.filter((key) => layer[key] !== null).map(
			(key) => `${LAYER_OVERRIDE_LABELS[key]} ${layer[key]}`
		);
		return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
	};

	const ROLLED_PARAM_KEYS = [
		'algorithm',
		'resolution',
		'smoothing',
		'tolerance',
		'minRegionSize',
		'slicCellSize',
		'slicCompactness',
		'penWidthMm',
		'spacingMinMm',
		'spacingMaxMm',
		'hatchThreshold',
		'hatchGamma',
		'inkBoost'
	] as const;
</script>

<div class="rng-panel" role="dialog" aria-label="rng debug panel">
	<header>
		<span class="title">🎲 rng debug</span>
		<span class="dev-tag">dev tool</span>
		<button class="close" onclick={onclose} title="close the rng debug panel">✕</button>
	</header>

	<div class="body">
		<!-- ─── profile ─────────────────────────────────────────────────── -->
		<section>
			<div class="s-title">profile</div>
			<div class="row">
				<select
					value={rngDebug.setup.activeProfileId}
					onchange={selectProfile}
					title="the active rng profile — this is what the randomize dice rolls"
				>
					{#each rngDebug.setup.profiles as entry (entry.id)}
						<option value={entry.id}
							>{entry.name}{isBuiltinRngProfileId(entry.id) ? ' (shipped)' : ''}</option
						>
					{/each}
				</select>
			</div>
			<div class="row">
				<input
					type="text"
					disabled={locked}
					value={profile.name}
					onchange={renameActive}
					title={locked ? 'the built-in profile cannot be renamed' : 'rename this profile'}
				/>
			</div>
			<div class="row btns">
				<button onclick={() => addProfile()} title="new profile from the shipped defaults"
					>+ new</button
				>
				<button onclick={() => addProfile(profile)} title="duplicate the active profile"
					>⧉ duplicate</button
				>
				<button onclick={deleteActive} disabled={locked} title="delete the active profile"
					>✕ delete</button
				>
			</div>
			<div class="row btns">
				<button onclick={exportActive} title="download the active profile as JSON">↓ export</button>
				<button onclick={() => fileInput?.click()} title="import a profile JSON file"
					>↑ import</button
				>
				<button
					onclick={copyCode}
					title="copy the active profile as a TypeScript literal — the graduation path into randomize.ts"
					>⌗ copy as code</button
				>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				hidden
				onchange={(event) => {
					importProfile(event.currentTarget.files);
					event.currentTarget.value = '';
				}}
			/>
			{#if locked}
				<div class="hint">
					shipped profiles (rngBuiltinProfiles.ts) stay read-only — duplicate one to start tweaking
				</div>
			{/if}
			{#if notice}<div class="notice">{notice}</div>{/if}
		</section>

		<!-- ─── rng source ──────────────────────────────────────────────── -->
		<section>
			<div class="s-title">rng source</div>
			<div class="row">
				<select
					value={rngDebug.setup.source.kind}
					onchange={setSourceKind}
					title="the raw random stream feeding every distribution"
				>
					{#each RNG_SOURCE_KINDS as kind (kind)}
						<option value={kind}>{RNG_SOURCE_LABELS[kind]}</option>
					{/each}
				</select>
			</div>
			{#if seeded}
				<div class="row seed-row">
					<span class="lbl">seed</span>
					<input
						type="number"
						min="0"
						step="1"
						value={rngDebug.setup.source.seed}
						onchange={setSeed}
						title="32-bit seed — the same seed replays the same sequence of rolls"
					/>
					<button onclick={newSeed} title="pick a fresh random seed">⚄ new</button>
					<button
						onclick={restartSequence}
						title="restart the roll sequence from this seed — the next rolls replay from the top"
						>↺ restart</button
					>
				</div>
				<div class="hint">
					seeded: the dice replays the exact same run of rolls after every restart — good for
					comparing curve tweaks on identical rolls
				</div>
			{:else}
				<div class="hint">
					unseeded: every roll is fresh — pick a seeded source to make rolls replayable
				</div>
			{/if}
		</section>

		<!-- ─── roll ────────────────────────────────────────────────────── -->
		<section>
			<div class="s-title">roll</div>
			<button
				class="roll-btn"
				onclick={onroll}
				title="roll the studio dice with the active profile and source"
			>
				🎲 roll &amp; apply
			</button>
			<div class="hint">
				same as the dice in the presets panel — honours its “stick to built-in presets” toggle
			</div>
			{#if rngDebug.log.length > 0}
				<div class="log">
					{#each rngDebug.log as entry (entry.id)}
						<details class="log-entry">
							<summary>
								<span class="log-id">#{entry.id}</span>
								<span class="log-at">{entry.at}</span>
								<span
									class="log-sum"
									title={`${entry.profileName} · ${entry.sourceLabel}${entry.stickToPresets ? ' · stick to presets' : ''}`}
									>{rollSummary(entry.settings)}</span
								>
								<button
									class="log-apply"
									title="re-apply this roll's settings"
									onclick={(event) => {
										event.preventDefault();
										onapplysettings(entry.settings);
									}}>↩ apply</button
								>
							</summary>
							<div class="log-detail">
								<div class="log-meta">
									{entry.profileName} · {entry.sourceLabel}{entry.stickToPresets
										? ' · stick to presets'
										: ''}
								</div>
								<table>
									<tbody>
										{#each ROLLED_PARAM_KEYS as key (key)}
											<tr><td>{key}</td><td>{entry.settings.params[key]}</td></tr>
										{/each}
									</tbody>
								</table>
								<div class="log-layers">
									{#each entry.settings.layers as layer (layer.id)}
										<span
											class="chip"
											title={`${layer.name} · ${layer.channel} · ${layer.angleMin}°–${layer.angleMax}°${overrideSummary(layer)}`}
										>
											<i style={`background:${layer.color}`}></i>{layer.channel}
										</span>
									{/each}
								</div>
							</div>
						</details>
					{/each}
				</div>
			{/if}
		</section>

		<!-- ─── curves ──────────────────────────────────────────────────── -->
		<section>
			<div class="s-title">curves — {profile.name}</div>
			{#each CURVE_GROUPS as group (group)}
				<div class="g-title">{group}</div>
				{#each groupKeys(group) as key (profile.id + key)}
					<CurveEditor
						label={CURVE_META[key].label}
						meta={CURVE_META[key]}
						dist={profile.curves[key]}
						{locked}
						onchange={(dist) => {
							profile.curves[key] = dist;
							persistRngDebug();
						}}
					/>
				{/each}
			{/each}
		</section>

		<!-- ─── weighted picks ──────────────────────────────────────────── -->
		<section>
			<div class="s-title">weighted picks — {profile.name}</div>
			<div class="g-title">segmentation algorithm</div>
			<WeightsEditor
				entries={profile.algorithmWeights}
				{locked}
				onchange={setWeight('algorithmWeights')}
			/>
			<div class="g-title">layer channels</div>
			<WeightsEditor
				entries={profile.channelWeights}
				labelOf={(value) => CHANNEL_LABELS[value as LayerChannel] ?? value}
				{locked}
				onchange={setWeight('channelWeights')}
			/>
		</section>

		<!-- ─── colors ──────────────────────────────────────────────────── -->
		<section>
			<div class="s-title">colors — {profile.name}</div>
			<div class="row chance-row">
				<span class="lbl">accent rate</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					disabled={locked}
					value={profile.colors.accentRate}
					oninput={setAccentRate}
					title="chance a roll reserves one layer for a vibrant accent-shelf ink"
				/>
				<input
					type="number"
					min="0"
					max="1"
					step="0.05"
					disabled={locked}
					value={profile.colors.accentRate}
					oninput={setAccentRate}
					title="chance a roll reserves one layer for a vibrant accent-shelf ink"
				/>
			</div>
			<div class="hint">
				share of rolls that give one layer a vibrant Diamine Forever accent ink (shipped: 0.75; 0
				turns the accent shelf off)
			</div>
			<div class="g-title">harmony sets — the family combinations a palette can draw from</div>
			<WeightsEditor
				entries={profile.colors.harmonyWeights}
				swatchesOf={harmonySetSwatches}
				{locked}
				onchange={setHarmonyWeight}
			/>
		</section>

		<!-- ─── layer overrides ─────────────────────────────────────────── -->
		<section>
			<div class="s-title">layer overrides — {profile.name}</div>
			<div class="hint">
				chance that a rolled layer gets its own value for a field instead of inheriting the global —
				values sample the same curves as the globals; shipped: 0 (layers always inherit). only free
				rolls — “stick to built-in presets” never rolls overrides
			</div>
			{#each LAYER_OVERRIDE_KEYS as key (key)}
				<div class="row chance-row">
					<span class="lbl">{LAYER_OVERRIDE_LABELS[key]}</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						disabled={locked}
						value={profile.layerOverrideChances[key]}
						oninput={setOverrideChance(key)}
						title={`chance a layer rolls its own ${LAYER_OVERRIDE_LABELS[key]}`}
					/>
					<input
						type="number"
						min="0"
						max="1"
						step="0.05"
						disabled={locked}
						value={profile.layerOverrideChances[key]}
						oninput={setOverrideChance(key)}
						title={`chance a layer rolls its own ${LAYER_OVERRIDE_LABELS[key]}`}
					/>
				</div>
			{/each}
		</section>

		<div class="foot">
			profiles + source live in <code>localStorage["rstr:dev:rng"]</code> — the dice falls back to the
			shipped defaults when that key is absent
		</div>
	</div>
</div>

<style>
	.rng-panel {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: min(430px, 100vw);
		z-index: 450;
		display: flex;
		flex-direction: column;
		background: var(--bg, #fdfaff);
		color: var(--ink, #1a202c);
		border-right: 1px solid var(--border, #e1e4e8);
		box-shadow: 6px 0 24px rgba(26, 32, 44, 0.14);
		font-size: 0.72rem;
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--border, #e1e4e8);
	}

	.title {
		font-family: 'mono-bold', monospace;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.dev-tag {
		font-size: 0.6rem;
		color: var(--muted, #60739f);
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 3px;
		padding: 0 0.3rem;
	}

	.close {
		margin-left: auto;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		padding: 0.05rem 0.4rem;
		cursor: pointer;
	}

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	section + section {
		border-top: 1px solid var(--border, #e1e4e8);
		padding-top: 0.75rem;
	}

	.s-title {
		font-family: 'mono-bold', monospace;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.g-title {
		font-size: 0.64rem;
		color: var(--muted, #60739f);
		margin-top: 0.2rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.row select,
	.row input[type='text'],
	.row input[type='number'] {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		color: var(--ink, #1a202c);
		font-family: inherit;
		font-size: 0.72rem;
	}

	.row.btns button,
	.seed-row button {
		flex: 1;
		padding: 0.2rem 0.3rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
		cursor: pointer;
		white-space: nowrap;
	}

	.seed-row button {
		flex: 0 0 auto;
	}

	.seed-row .lbl,
	.chance-row .lbl {
		color: var(--muted, #60739f);
		white-space: nowrap;
	}

	.chance-row .lbl {
		flex: 0 0 6.2rem;
	}

	.chance-row input[type='range'] {
		flex: 1;
		min-width: 0;
		accent-color: var(--ink, #1a202c);
	}

	.chance-row input[type='number'] {
		flex: 0 0 4rem;
	}

	button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.hint {
		font-size: 0.62rem;
		color: var(--muted, #60739f);
		line-height: 1.35;
	}

	.notice {
		font-size: 0.64rem;
		color: var(--ink, #1a202c);
		background: var(--muted-light, #eef1f6);
		border-radius: 4px;
		padding: 0.2rem 0.35rem;
	}

	.roll-btn {
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--ink, #1a202c);
		border-radius: 4px;
		background: #fff;
		cursor: pointer;
	}

	.log {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-height: 14rem;
		overflow-y: auto;
	}

	.log-entry {
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 4px;
		background: #fff;
	}

	.log-entry summary {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.3rem;
		cursor: pointer;
		list-style: none;
	}

	.log-entry summary::-webkit-details-marker {
		display: none;
	}

	.log-id {
		font-family: 'mono-bold', monospace;
		font-size: 0.62rem;
	}

	.log-at {
		font-size: 0.6rem;
		color: var(--muted, #60739f);
	}

	.log-sum {
		flex: 1;
		font-size: 0.62rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.log-apply {
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 3px;
		background: #fff;
		padding: 0 0.3rem;
		cursor: pointer;
		font-size: 0.6rem;
	}

	.log-detail {
		border-top: 1px solid var(--border, #e1e4e8);
		padding: 0.3rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.log-meta {
		font-size: 0.6rem;
		color: var(--muted, #60739f);
	}

	.log-detail table {
		font-size: 0.62rem;
		border-collapse: collapse;
	}

	.log-detail td {
		padding: 0.05rem 0.5rem 0.05rem 0;
		color: var(--ink, #1a202c);
	}

	.log-detail td:first-child {
		color: var(--muted, #60739f);
	}

	.log-layers {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--border, #e1e4e8);
		border-radius: 3px;
		padding: 0.05rem 0.3rem;
		font-size: 0.6rem;
	}

	.chip i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 2px;
		display: inline-block;
	}

	.foot {
		font-size: 0.6rem;
		color: var(--muted, #60739f);
		border-top: 1px solid var(--border, #e1e4e8);
		padding-top: 0.5rem;
		line-height: 1.4;
	}

	.foot code {
		font-size: 0.58rem;
	}
</style>
