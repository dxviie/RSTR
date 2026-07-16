<script lang="ts">
	// Shared top bar for every page. Self-contained (colors, fonts, resets)
	// so it renders identically inside the landing page, the site chrome and
	// the fixed studio/prep app shells.
	//
	// - the D17E logo always links out to d17e.dev
	// - the RSTR wordmark always links home to the landing page
	// - the landing variant shows a single "launch the app" call to action;
	//   every other page gets the studio / prep / classic switcher (+ help)
	//   with the active page highlighted
	const {
		variant = 'app',
		active = null,
		sub = '',
		tagline = ''
	}: {
		variant?: 'landing' | 'app';
		active?: 'studio' | 'prep' | 'classic' | 'help' | null;
		sub?: string;
		tagline?: string;
	} = $props();
</script>

<header class="topbar">
	<a class="logo-link" href="https://d17e.dev" title="d17e.dev">
		<svg
			class="logo"
			role="img"
			aria-label="D17E logo"
			viewBox="0 0 1046 447"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g transform="matrix(1.2778,0,0,0.628916,-169.768,-154.959)">
				<path
					d="M930.998,957.001L930.998,957.183L132.86,957.183L132.86,246.391L930.998,246.391L930.998,246.802L951.958,246.802L951.958,957.001L930.998,957.001ZM399.748,807.315L517.675,807.315L517.675,734.622L477.603,734.622L477.603,400.234L441.538,400.234L441.538,417.68C441.538,444.431 436.099,452.573 422.647,452.573L401.18,452.573L401.18,522.358L441.252,522.358L441.252,734.622L399.748,734.622L399.748,807.315ZM586.656,807.315L627.3,807.315L706.3,475.253L706.3,400.234L566.047,400.234L566.047,472.345L665.655,472.345L586.656,801.499L586.656,807.315ZM208.261,807.315L268.083,807.315C326.76,807.315 354.238,728.806 354.238,627.036L354.238,580.513C354.238,478.742 326.76,400.234 268.083,400.234L208.261,400.234L208.261,807.315ZM245.471,734.622L245.471,472.927L268.083,472.927C306.438,472.927 317.028,516.543 317.028,580.513L317.028,627.036C317.028,691.006 306.438,734.622 268.083,734.622L245.471,734.622ZM750.665,807.315L876.606,807.315L876.606,735.785L787.875,735.785L787.875,632.852L867.733,632.852L867.733,561.903L787.875,561.903L787.875,471.764L876.606,471.764L876.606,400.234L750.665,400.234L750.665,807.315Z"
					fill="currentColor"
				/>
			</g>
		</svg>
	</a>
	<a class="wordmark-link" href="/" title="RSTR home">
		<span class="wordmark"
			>RSTR{#if sub}<span class="wordmark-sub">·{sub}</span>{/if}</span
		>
	</a>
	{#if tagline}
		<span class="tagline">{tagline}</span>
	{/if}
	<div class="spacer"></div>
	{#if variant === 'landing'}
		<a class="top-cta" href="/studio">launch RSTR</a>
	{:else}
		<nav class="top-nav" aria-label="RSTR tools">
			<a class="top-link" class:active={active === 'studio'} href="/studio">studio</a>
			<a
				class="top-link"
				class:active={active === 'prep'}
				href="/prep"
				title="prep — decorate an exported SVG for plotting">prep</a
			>
			<a
				class="top-link"
				class:active={active === 'classic'}
				href="/classic"
				title="the original RSTR">classic</a
			>
			<a
				class="top-link help"
				class:active={active === 'help'}
				href="/help"
				title="help — all settings and features explained"
			>
				?<span class="sr-only">help</span>
			</a>
		</nav>
	{/if}
</header>

<style>
	.topbar {
		/* d17e.dev palette, self-contained */
		--tb-ink: #1a202c;
		--tb-ink-soft: #2d3748;
		--tb-bg: #fdfaff;
		--tb-border: #e1e4e8;
		--tb-muted: #60739f;
		--tb-muted-light: #eef1f6;

		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 1rem;
		border-bottom: 1px solid var(--tb-border);
		background: var(--tb-bg);
		color: var(--tb-ink);
		font-size: 1rem;
	}

	/* neutralize the global dashed-link styling inside the bar */
	.topbar a {
		border: none;
		color: var(--tb-ink);
	}

	.logo-link {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.logo {
		height: 26px;
		width: auto;
		color: var(--tb-ink);
	}

	.logo-link:hover .logo {
		opacity: 0.7;
	}

	.wordmark-link {
		flex-shrink: 0;
	}

	.wordmark {
		font-family: 'nudica_monobold', monospace;
		font-size: 1.15rem;
		letter-spacing: 0.08em;
	}

	.wordmark-link:hover .wordmark {
		color: #ff2aa6;
	}

	.wordmark-sub {
		color: var(--tb-muted);
	}

	.tagline {
		font-family: 'argesta_regular', serif;
		color: var(--tb-muted);
		font-size: 0.8rem;
	}

	.spacer {
		flex: 1;
	}

	.top-nav {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.topbar .top-link {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.75rem;
		padding: 0.15rem 0.6rem;
		border: 1px solid var(--tb-border);
		border-radius: 999px;
		white-space: nowrap;
		transition:
			border-color 0.1s ease,
			background 0.1s ease;
	}

	.topbar .top-link:hover {
		border-color: var(--tb-ink);
		background: var(--tb-muted-light);
	}

	.topbar .top-link.active {
		background: var(--tb-ink);
		border-color: var(--tb-ink);
		color: var(--tb-bg);
	}

	.topbar .top-cta {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.75rem;
		padding: 0.25rem 0.8rem;
		border: 1px solid var(--tb-ink);
		border-radius: 999px;
		background: var(--tb-ink);
		color: var(--tb-bg);
		white-space: nowrap;
		transition: background 0.1s ease;
	}

	.topbar .top-cta:hover {
		background: var(--tb-ink-soft);
		color: #fff;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* mobile: drop the tagline, tighten the row so the switcher always fits */
	@media (max-width: 720px) {
		.tagline,
		.wordmark-sub {
			display: none;
		}
	}

	@media (max-width: 420px) {
		.topbar {
			gap: 0.4rem;
			padding: 0.4rem 0.6rem;
		}

		.topbar .top-link {
			padding: 0.15rem 0.45rem;
		}

		.wordmark {
			font-size: 1rem;
		}
	}
</style>
