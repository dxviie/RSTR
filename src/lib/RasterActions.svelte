<script lang="ts">
import Button from './components/ui/button/button.svelte';
import {
	exported,
	exporting,
	getActionsForStatus,
	imageLoaded,
	loadingImage,
	type RstrAction,
	type RstrActionType,
	rstrState
} from '$lib/fsm.svelte.js';
import { configActions } from '$lib/config.svelte.ts';

let fileInput: HTMLInputElement;
let actionButtonLabel = $state('--');
let actionButtonAction: null | RstrAction = null;
let actionButtonEnabled = $state(true);
let selectImageButtonEnabled = $state(true);

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
		console.debug(
			'updating actions',
			actions,
			rstrState.status,
			selectImageButtonEnabled,
			actionButtonEnabled
		);
	}
});

const handleActionButtonClick = () => {
	if (actionButtonAction) {
		actionButtonAction.action();
	}
};

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

const handleExportSVG = () => {
	console.debug('exporting svg');
	exporting.action();
	if (spinner) spinner.style.display = 'block';
	setTimeout(() => {
		const svg = rstr?.project.exportSVG({ asString: true }) as string;
		if (!svg) {
			console.error('could not export svg');
			return;
		}
		const blob = new Blob([svg], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = getFrameFileName('svg');
		a.click();
		URL.revokeObjectURL(url);
		exported.action();
		if (spinner) spinner.style.display = 'none';
		console.debug('exported svg');
	}, 100);
};

const handleSaveImage = () => {
	console.debug('saving image');
	exporting.action();
	if (spinner) spinner.style.display = 'block';
	setTimeout(() => {
		downloadFrame();
		exported.action();
		if (spinner) spinner.style.display = 'none';
		console.debug('saved image');
	}, 100);
};

export function downloadFrame() {
	if (!canvas) {
		return;
	}
	var tempCanvas = document.createElement('canvas');
	tempCanvas.width = canvas.width;
	tempCanvas.height = canvas.height;

	const ctx = tempCanvas.getContext('2d');
	if (!ctx) {
		console.warn('Could not get 2d context');
		return;
	}

	// Fill the temp canvas with white background
	ctx.fillStyle = '#ffffff'; // Set color to white
	ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

	// Draw the original canvas onto the temp canvas
	ctx.drawImage(canvas, 0, 0);

	// Load and draw the watermark
	var watermark = new Image();
	watermark.src = 'watermark.png'; // Path to your watermark image
	watermark.onload = function () {
		// Set the desired width and height for the watermark
		var scale = 0.5; // Example scale factor (50%)
		var watermarkWidth = watermark.width * scale;
		var watermarkHeight = watermark.height * scale;

		// Position the watermark at the bottom right corner, adjust as needed
		var x = tempCanvas.width - watermarkWidth - 10; // 10px padding from right
		var y = tempCanvas.height - watermarkHeight - 10; // 10px padding from bottom

		ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);

		// Convert the canvas to a Blob
		tempCanvas.toBlob(function (blob) {
			// Create an object URL for the blob
			var url = URL.createObjectURL(blob);

			// Create a temporary link to trigger the download
			var downloadLink = document.createElement('a');
			downloadLink.download = getFrameFileName('png');
			downloadLink.href = url;
			downloadLink.target = '_blank';
			downloadLink.click();
			downloadLink.remove();
		});
	};
}

const getFrameFileName = (ext: string) => {
	const now = new Date();
	const timestamp = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}-${now.getHours()}${now.getMinutes()}`;
	return `rstr.d17e.dev-${timestamp}.${ext}`;
};
</script>

<div class="actions-container">

	<Button
		class="font-bold"
		on:click={handleSelectFileClicked}
		disabled={!selectImageButtonEnabled}>SELECT IMAGE</Button
	>

	<Button
		class="font-bold"
		on:click={() => handleActionButtonClick()}
		disabled={!actionButtonEnabled}>{actionButtonLabel}</Button
	>

	{#if rstrState.status === 'done'}
		<Button class="font-bold" on:click={handleExportSVG}>EXPORT SVG</Button>
		<Button class="font-bold" on:click={handleSaveImage}>SAVE IMAGE</Button>
	{/if}

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
	.actions-container {
			width: 100%;
			justify-content: center;
		display: flex;
		flex-direction: row;
		gap: 1rem;
	}
</style>