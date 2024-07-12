<script lang="ts">
	import { Pane } from 'tweakpane';
	import { config, configActions } from '$lib/config.svelte.ts';
	import Button from './components/ui/button/button.svelte';
	import {
		rstrState,
		getActionsForStatus,
		type RstrAction,
		type RstrActionType,
		loadingImage,
		imageLoaded
	} from '$lib/fsm.svelte';

	let container: HTMLDivElement;
	let fileInput: HTMLInputElement;

	let pane: Pane | null = null;
	let paneConfig = { ...config };

	let actionButtonLabel = $state('--');
	let actionButtonAction: null | RstrAction = null;
	let actionButtonEnabled = $state(true);
	let selectImageButtonEnabled = $state(true);
	let configEnabled = $state(true);

	$effect(() => {
		if (rstrState.status) {
			const actions = getActionsForStatus(rstrState.status);
			selectImageButtonEnabled =
				actions.find((action) => action.type === ('input' as RstrActionType)) !== undefined;
			actionButtonEnabled = rstrState.status !== 'loading' && rstrState.status !== 'exporting';
			actions.forEach((action) => {
				if (action.type === 'button') {
					actionButtonAction = action;
					actionButtonLabel = action.label;
				}
			});
			configEnabled = rstrState.status === 'config' || rstrState.status === 'done';
			if (pane) {
				pane.disabled = !configEnabled;
			}
			console.debug(
				'updating state actions',
				actions,
				rstrState.status,
				selectImageButtonEnabled,
				actionButtonEnabled,
				configEnabled
			);
		}
	});

	const handleActionButtonClick = () => {
		if (actionButtonAction) {
			actionButtonAction.action();
		}
	};

	$effect(() => {
		pane = new Pane({ container: container });

		const gridFolder = pane.addFolder({ title: 'GRID' });
		gridFolder.addBinding(paneConfig, 'resolution', { min: 10, max: 100, step: 1 });
		gridFolder.addBinding(paneConfig, 'iterations', { min: 1, max: 20, step: 1 });
		gridFolder.addBinding(paneConfig, 'tolerance', { min: 0, max: 1, step: 0.01 });

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

	function handleSelectFileClicked(event: Event) {
		if (fileInput) fileInput.click();
		loadingImage.action();
	}

	function handleFileSelected(event: Event) {
		console.log('handleFileSelected');
		if (!event.target) return;
		const input = event.target as HTMLInputElement;
		if (!input.files) return;
		const file = input.files[0];
		if (file) {
			console.log('File selected:', file.name);
			configActions.update({ file: file });
			// Handle the file here (e.g., upload it, process it, etc.)
		} else {
			imageLoaded.action();
		}
	}
</script>

<div class="config-container">
	<Button
		class="w-full font-bold"
		on:click={handleSelectFileClicked}
		disabled={!selectImageButtonEnabled}>SELECT IMAGE</Button
	>

	<Button
		class="w-full font-bold"
		on:click={() => handleActionButtonClick()}
		disabled={!actionButtonEnabled}>{actionButtonLabel}</Button
	>

	<div id="tweakpane-container" class="tweakpane-container" bind:this={container}></div>

	<input
		type="file"
		accept="image/*"
		style="display: none;"
		bind:this={fileInput}
		onchange={handleFileSelected}
		onabort={() => imageLoaded.action()}
		onerror={() => imageLoaded.action()}
		oncancel={() => imageLoaded.action()}
	/>
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
		font-size: 0.9rem; /* Slightly larger for titles */
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
			font-size: large !important; /* Adjusted for mobile */
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
