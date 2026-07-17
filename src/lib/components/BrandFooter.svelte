<script lang="ts">
	const { align = 'center' }: { align?: 'center' | 'right' } = $props();
</script>

<div class="brand-footer {align}">
	<p class="made">
		made with <span class="heart" role="img" aria-label="love">&hearts;</span> by
		<a href="https://www.d17e.dev" target="_blank" rel="noopener">D17E</a>
	</p>
	<p class="line">KvK - 87650770</p>
	<p class="line">BTW - NL004463884B92</p>
</div>

<style>
	/* self-contained brand colors so the footer renders the same inside the
	   v2 app shell, the landing page and the root layout */
	.brand-footer {
		--bf-ink: #1a202c;
		--bf-muted: #60739f;
		--bf-magenta: #ff2aa6;

		font-family: 'mono-light', monospace;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--bf-muted);
		text-align: center;
		padding: 0.5rem 0;
	}

	.brand-footer.right {
		text-align: right;
	}

	.brand-footer p {
		margin: 0;
	}

	.made {
		color: var(--bf-ink);
	}

	.heart {
		color: var(--bf-magenta);
	}

	.brand-footer a {
		color: var(--bf-ink);
		border: none;
		border-bottom: 1px dashed var(--bf-muted);
	}

	.brand-footer a:hover {
		border-bottom-color: var(--bf-magenta);
		color: var(--bf-magenta);
	}
</style>
