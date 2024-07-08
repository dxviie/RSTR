<script>
	import { onMount } from 'svelte';
	import { Pane } from 'tweakpane';
	import { config } from '$lib/config.svelte.ts';

	let fileInput;

	let paneConfig = { ...config.value };

	function handleFileSelect(event) {
		const file = event.target.files[0];
		if (file) {
			console.log('File selected:', file.name);
			config.update({file: file});
			// Handle the file here (e.g., upload it, process it, etc.)
		}
	}

	onMount(() => {
		const pane = new Pane({
			container: document.getElementById('tweakpane-container')
		});

		pane.addButton({ title: 'Select File...' }).on('click', () => {
			console.log('Select File...');
			fileInput.click();
		});

		const gridFolder = pane.addFolder({ title: 'Grid' });
		gridFolder.addBinding(paneConfig, 'resolution', { min: 1, max: 200, step: 1 });
		gridFolder.addBinding(paneConfig, 'iterations', { min: 1, max: 20, step: 1 });
		gridFolder.addBinding(paneConfig, 'tolerance', { min: 0, max: 1, step: 0.01 });

		const hatchingFolder = pane.addFolder({ title: 'Fill' });
		hatchingFolder.addBinding(paneConfig, 'blockLineCount', { min: 1, max: 50, step: 1 });

		// Listen for changes and emit the updated config
		pane.on('change', () => {
			config.update({ ...paneConfig });
		});

		return () => {
			pane.dispose();
		};
	});
</script>

<div>
	<div id="tweakpane-container" class="tweakpane-container"></div>
	<input
		type="file"
		accept="image/*"
		style="display: none;"
		bind:this={fileInput}
		on:change={handleFileSelect}
	/>
	<h1>
		{config.value.tolerance}
	</h1>
</div>

<style>
    .tweakpane-container {
				font-size: large !important;
		}

    .tweakpane-container div {
				font-size: x-large !important;
        /*position: fixed;*/
        /*top: 10px;*/
        /*right: 10px;*/
        /*z-index: 1000;*/
    }

    /* Target the main Tweakpane container */
    :global(#tweakpane-container .tp-dfwv) {
        font-family: Bitter, serif; /* Change to your preferred font */
        font-size: 14px; /* Adjust the size as needed */
    }

    /* Target input elements */
    :global(#tweakpane-container .tp-txtv_i) {
        font-family: Bitter, serif; /* Change to your preferred font */
        font-size: 14px;
    }

    /* Target labels */
    :global(#tweakpane-container .tp-lblv_l) {
        font-family: Poppins, sans-serif; /* Change to your preferred font */
        font-size: 1rem;
    }

    /* Target folder titles */
    :global(#tweakpane-container .tp-fldv_t) {
        font-family: Bitter, serif; /* Change to your preferred font */
        font-size: 1.1rem; /* Slightly larger for titles */
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
        font-size: 1.2rem;
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
</style>