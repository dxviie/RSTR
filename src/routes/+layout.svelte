<script>
	import '../app.css';
	import BrandFooter from '$lib/components/BrandFooter.svelte';
</script>

<div class="app-container">
	<header>
		<div class="header-left">
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
			<a href="/" target="_self" aria-label="link to home" class="header-link">
				<span class="wordmark">RSTR</span>
			</a>
			<span class="tagline">raster images to plottable svg</span>
		</div>
		<div class="header-right">
			<a href="/about" target="_self" class="top-link" title="about RSTR">
				?
				<span class="sr-only">Go to about page</span>
			</a>
		</div>
	</header>
	<main>
		<slot></slot>
	</main>
	<footer>
		<BrandFooter />
	</footer>
</div>

<style>
	.app-container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	header {
		background-color: hsl(var(--background));
		border-bottom: 1px solid var(--border-c);
		width: 100%;
		height: 6rem;
		position: fixed;
		padding: 1rem;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		align-self: center;
		gap: 0.6rem;
		z-index: 99;
	}

	.header-left {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.6rem;
	}

	.logo-link {
		display: flex;
		align-items: center;
		border: none;
	}

	.logo {
		height: 26px;
		width: auto;
		color: var(--ink);
	}

	.logo-link:hover .logo {
		opacity: 0.7;
	}

	.header-link {
		border: none;
	}

	.wordmark {
		font-family: 'nudica_monobold', monospace;
		font-size: 1.4rem;
		letter-spacing: 0.08em;
		color: var(--ink);
	}

	.header-link:hover .wordmark {
		color: var(--magenta);
	}

	.tagline {
		font-family: 'argesta_regular', serif;
		color: var(--muted-c);
		font-size: 0.8rem;
	}

	.header-right {
		display: flex;
		align-items: center;
	}

	.top-link {
		font-family: 'nudica_monobold', monospace;
		padding: 0.1rem 0.55rem;
		border: 1px solid var(--border-c);
		border-radius: 999px;
		color: var(--ink);
	}

	.top-link:hover {
		border-color: var(--magenta);
		color: var(--magenta);
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

	main {
		min-height: calc(100vh - 5rem);
		max-width: 1200px;
		padding-top: 6rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	footer {
		width: 100%;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border-c);
	}

	@media (max-width: 600px) {
		.tagline {
			display: none;
		}
	}

	:global(:root) {
		/* d17e.dev house palette */
		--ink: #1a202c;
		--ink-soft: #2d3748;
		--bg-c: #fdfaff;
		--border-c: #e1e4e8;
		--muted-c: #60739f;
		--muted-light: #eef1f6;
		--magenta: #ff2aa6;
	}

	:global(button) {
		font-family: 'nudica_monobold', monospace;
		font-size: medium !important;
		transition: all 0.1s ease;
	}

	:global(button:hover) {
		background-color: var(--muted-light) !important;
		color: var(--ink) !important;
	}

	:global(button:active) {
		transform: translateY(1px);
	}

	:global(body) {
		font-family: 'nudica_monolight', monospace;
		font-size: medium;
	}

	:global(.title) {
		font-family: 'nudica_monobold', monospace;
	}

	:global(.description) {
		font-family: 'argesta_regular', serif;
	}

	:global(a) {
		border-style: dashed;
		border-bottom-width: 1px;
		border-color: var(--muted-c);
	}

	:global(a:hover) {
		border-color: var(--magenta);
	}
</style>
