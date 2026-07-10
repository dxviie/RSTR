<script>
	import '../app.css';

	let { children } = $props();
</script>

{@render children?.()}

<style>
	/* The root layout is a bare pass-through: every page brings its own
	   chrome (TopBar / footer, or the fixed studio & prep app shells), so
	   nothing scrollable ever sits behind them. Only app-wide styles live
	   here. */

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
