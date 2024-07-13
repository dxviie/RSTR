<script lang="ts">
	import { Pane } from 'tweakpane';
	import { config, configActions } from '$lib/config.svelte.ts';
	import {
		rstrState,
		loadingImage,
		imageLoaded
	} from '$lib/fsm.svelte';

	let container: HTMLDivElement;

	let pane: Pane | null = null;
	let paneConfig = { ...config };

	let configEnabled = $state(true);

	$effect(() => {
		if (rstrState.status) {
			configEnabled = rstrState.status === 'config' || rstrState.status === 'done';
			if (pane) {
				pane.disabled = !configEnabled;
			}
			console.debug(
				'updating config',
				configEnabled
			);
		}
	});

	$effect(() => {
		pane = new Pane({ container: container });

		const baseFolder = pane.addFolder({ title: 'IMAGE' });
		baseFolder.addBinding(paneConfig, 'resolution', { min: 10, max: 100, step: 1 });

		const groupingFolder = pane.addFolder({ title: 'GROUPING' });
		groupingFolder.addBinding(paneConfig, 'iterations', { min: 1, max: 20, step: 1 });
		groupingFolder.addBinding(paneConfig, 'tolerance', { min: 0, max: 1, step: 0.01 });

		const hatchingFolder = pane.addFolder({ title: 'FILL' });
		hatchingFolder.addBinding(paneConfig, 'blockLineCount', { min: 1, max: 50, step: 1 });

		// Listen for changes and emit the updated config
		pane.on('change', () => {
			configActions.update({ ...paneConfig });
		});

		return () => {
			if (pane) pane.dispose();
		};
	});
</script>

<div class="config-container">

	<div id="tweakpane-container" class="tweakpane-container" bind:this={container}></div>

</div>

<style>
	.config-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tweakpane-container {
		margin-top: 1rem;
	}

	:global(.tweakpane-container div) {
      font-size: 1.1rem !important;
      line-height: 1.25rem;
      font-weight: 700;
	}

	/* Target the main Tweakpane container */
	:global(#tweakpane-container .tp-dfwv) {
		font-family: Bitter, serif; /* Change to your preferred font */
      font-size: 0.875rem;
      line-height: 1.25rem;
			font-weight: 700;
	}

	:global(*) {
      --bld-br: 5px;
	}

	/* Target input elements */
	:global(#tweakpane-container .tp-txtv_i) {
		font-family: Bitter, serif; /* Change to your preferred font */
		font-size: 12px;
	}

	/* Target labels */
	:global(#tweakpane-container .tp-lblv_l) {
		font-family: Poppins, sans-serif; /* Change to your preferred font */
		font-size: 0.95rem !important;
			font-weight: 100;
	}

	/* Target folder buttons */
  :global(#tweakpane-container .tp-fldv_b) {
		height: 2.2rem;
			border-radius: 10px 10px 0 0;
  }

	/* Target folder titles */
	:global(#tweakpane-container .tp-fldv_t) {
		font-family: Bitter, serif; /* Change to your preferred font */
		font-size: 0.875rem !important; /* Slightly larger for titles */
		font-weight: bold;
		text-align: center;
	}

	/* Target Tweakpane buttons */
	:global(#tweakpane-container .tp-btnv_b) {
		font-family: Bitter, serif; /* Change to your preferred font */
		/* Add any other button-specific styles you want */
		font-weight: bold;
		/* You might also want to adjust padding or other properties */
		padding: 6px 8px;
	}

	/* If you want to style the button text specifically */
	:global(#tweakpane-container .tp-btnv_t) {
		font-family: Bitter, serif; /* Change to your preferred font */
		font-size: 1rem;
		line-height: 1.5;
		height: 2rem;
	}

	/* Increase height for all main control containers */
	:global(#tweakpane-container .tp-rotv_c) {
		--tp-base-height: 400px !important; /* Adjust this value as needed */
	}

	/* Adjust input fields */
	:global(#tweakpane-container .tp-txtv_i) {
		height: 30px !important; /* Adjust as needed */
	}

	/* Adjust sliders */
	:global(#tweakpane-container .tp-sldv_i) {
		height: 30px !important; /* Adjust as needed */
	}

	/* Adjust buttons */
	:global(#tweakpane-container .tp-btnv_b) {
		height: 40px !important; /* Adjust as needed */
		line-height: 40px !important; /* To vertically center text */
	}

	/* Adjust dropdown menus */
	:global(#tweakpane-container .tp-lstv_s) {
		height: 30px !important; /* Adjust as needed */
	}

	/* Adjust checkbox size */
	:global(#tweakpane-container .tp-ckbv_i) {
		width: 20px !important; /* Adjust as needed */
		height: 20px !important; /* Adjust as needed */
	}

	/* Adjust the vertical spacing between controls if needed */
	:global(#tweakpane-container .tp-rotv_c > *:not(:first-child)) {
		margin-top: 8px !important; /* Adjust as needed */
	}

	@media screen and (max-width: 480px) {
		.tweakpane-container {
			font-size: medium !important; /* Smaller font size for mobile */
		}

		:global(.tweakpane-container div) {
			/*font-size: large !important; !* Adjusted for mobile *!*/
		}

		:global(#tweakpane-container .tp-dfwv),
		:global(#tweakpane-container .tp-txtv_i),
		:global(#tweakpane-container .tp-btnv_b),
		:global(#tweakpane-container .tp-btnv_t) {
			font-size: 12px; /* Smaller font size for mobile */
		}

		:global(#tweakpane-container .tp-lblv_l) {
			font-size: 0.9rem; /* Adjusted for mobile */
		}

		:global(#tweakpane-container .tp-fldv_t) {
			font-size: 1rem; /* Adjusted for mobile */
		}
	}
</style>
