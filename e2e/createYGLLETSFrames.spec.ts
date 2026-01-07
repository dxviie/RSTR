import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.setTimeout(3600000); // 1 hour
test.use({
	contextOptions: {
		acceptDownloads: true
	}
});

const files = [
	'ygllets-arial-black.png',
	'ygllets-nudica-bold.png',
	'happy-2026.png',
	'ygllets-nudica-bold-tulips.png'
];

interface ParameterConfig {
	start: number;
	end: number;
	easing: string;
}

interface ParameterFrame {
	resolution: number;
	iterations: number;
	tolerance: number;
}

type EasingFunction = (t: number) => number;

function generateParameterSequence(
	resolutionConfig: ParameterConfig,
	iterationsConfig: ParameterConfig,
	toleranceConfig: ParameterConfig,
	duration: number,
	fps: number = 30
): ParameterFrame[] {
	const frames = duration * fps;
	const sequence: ParameterFrame[] = [];

	// Easing functions
	const easingFunctions: Record<string, EasingFunction> = {
		linear: (t: number): number => t,
		easeInQuad: (t: number): number => t * t,
		easeOutQuad: (t: number): number => t * (2 - t),
		easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
		easeInCubic: (t: number): number => t * t * t,
		easeOutCubic: (t: number): number => (--t) * t * t + 1,
		easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
		easeInExpo: (t: number): number => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
		easeOutExpo: (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
		step: (t: number): number => Math.floor(t * 5) / 4
	};

	// Interpolate value based on easing function
	function interpolate(config: ParameterConfig, frameIndex: number): number {
		const { start, end, easing } = config;
		const progress = frameIndex / (frames - 1);
		const easingFunction = easingFunctions[easing] || easingFunctions.linear;
		const easedProgress = easingFunction(progress);
		return start + (end - start) * easedProgress;
	}

	// Generate sequence
	for (let i = 0; i < frames; i++) {
		sequence.push({
			resolution: interpolate(resolutionConfig, i),
			iterations: Math.round(interpolate(iterationsConfig, i)),
			tolerance: interpolate(toleranceConfig, i)
		});
	}

	return sequence;
}

test.describe('Create YGLLETS Frames', () => {
		let frames = generateParameterSequence({ start: 20, end: 127, easing: 'linear' }, {
			start: 1,
			end: 10,
			easing: 'easeInOutQuad'
		}, { start: 1, end: 0, easing: 'easeInOutQuad' }, 15);
		console.log('calculated frames:', frames.length);
		for (let i = 0; i < frames.length; i++) {
			const prefix = `${i.toString().padStart(4, '0')}`;

			test(prefix + ' rasterize and download', async ({ page }) => {
				await page.goto('http://localhost:5173/');
				await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').click();
				await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').press('Shift+ArrowRight');
				await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').press('Shift+ArrowRight');
				await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').fill(`${Math.round(frames[i].resolution)}`);
				await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').press('Enter');
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().click();
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().press('Shift+ArrowRight');
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().fill(`${Math.round(frames[i].iterations)}`);
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().press('Enter');
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).click();
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).press('ControlOrMeta+a');
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).fill(`${frames[i].tolerance}`);
				await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).press('Enter');
				await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').click();
				await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').press('ControlOrMeta+a');
				await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').fill('1');
				await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').press('Enter');
				const fileInput = await page.locator('input[type="file"]');
				await fileInput.setInputFiles('e2e/static/ygllets/' + files[2]);

				await page.waitForTimeout(5000); // Sleep for 5 seconds (5000 milliseconds)

				let startButton = await page.getByRole('button', { name: 'START' });
				startButton.waitFor({ state: 'visible' });
				startButton.click();

				await page.waitForTimeout(5000); // Sleep for 5 seconds (5000 milliseconds)

				const svgDownloadButton = await page.getByRole('button', { name: 'SVG' });
				const pngDownloadButton = await page.getByRole('button', { name: 'PNG' });
				await svgDownloadButton.waitFor({ state: 'visible', timeout: 60 * 60 * 1000 });
				await pngDownloadButton.waitFor({ state: 'visible' });
				expect(svgDownloadButton).toBeVisible();
				expect(pngDownloadButton).toBeVisible();


				// Start waiting for the download before clicking the button
				const downloadPromise = page.waitForEvent('download');
				// Click the download button
				await svgDownloadButton.click();
				// Wait for the download to start
				const download = await downloadPromise;
				// Specify where you want to save the file
				const downloadPath = path.join('.', 'downloads', prefix + '.svg');
				// Ensure the directory exists
				await fs.promises.mkdir(path.dirname(downloadPath), { recursive: true });
				// Save the downloaded file
				await download.saveAs(downloadPath);
				console.log(`SVG File saved to: ${downloadPath}`);
				// You can now use the downloaded file for further testing or verification
				expect(fs.existsSync(downloadPath)).toBeTruthy();

				// Start waiting for the download before clicking the button
				const downloadPromise2 = page.waitForEvent('download');
				// Click the download button
				await pngDownloadButton.click();
				// Wait for the download to start
				const download2 = await downloadPromise2;
				// Specify where you want to save the file
				const downloadPath2 = path.join('.', 'downloads', prefix + '.png');
				// Ensure the directory exists
				await fs.promises.mkdir(path.dirname(downloadPath2), { recursive: true });
				// Save the downloaded file
				await download2.saveAs(downloadPath2);
				console.log(`PNG File saved to: ${downloadPath2}`);
				// You can now use the downloaded file for further testing or verification
				expect(fs.existsSync(downloadPath2)).toBeTruthy();
			});
		}
	}
);