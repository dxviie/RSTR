import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.setTimeout(120000); // 2 minutes
test.use({
	contextOptions: {
		acceptDownloads: true
	}
});

for (let i = 1; i <= 25; i++) {
	const prefix = `${i.toString().padStart(2, '0')}-`;
	const fileName = `${i.toString().padStart(2, '0')}.jpg`;

	test(prefix + ' rasterize and download', async ({ page }) => {
		await page.goto('http://localhost:5173/');
		await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').click();
		await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').press('Shift+ArrowRight');
		await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').press('Shift+ArrowRight');
		await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').fill('127');
		await page.locator('div').filter({ hasText: /^IMAGEresolution$/ }).getByRole('textbox').press('Enter');
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().click();
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().press('Shift+ArrowRight');
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().fill('5');
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').first().press('Enter');
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).click();
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).press('ControlOrMeta+a');
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).fill('.15');
		await page.locator('div').filter({ hasText: /^iterationstolerance$/ }).getByRole('textbox').nth(1).press('Enter');
		await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').click();
		await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').press('ControlOrMeta+a');
		await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').fill('.25');
		await page.locator('div:nth-child(3) > .tp-fldv_c > div:nth-child(2) > .tp-lblv_v > .tp-sldtxtv > .tp-sldtxtv_t > .tp-txtv > .tp-txtv_i').press('Enter');
		const fileInput = await page.locator('input[type="file"]');
		await fileInput.setInputFiles('e2e/static/metro-gif-frames/' + fileName);

		await page.waitForTimeout(5000); // Sleep for 5 seconds (5000 milliseconds)

		let startButton = await page.getByRole('button', { name: 'START' });
		startButton.waitFor({ state: 'visible', enabled: true });
		startButton.click();

		await page.waitForTimeout(5000); // Sleep for 5 seconds (5000 milliseconds)

		const svgDownloadButton = await page.getByRole('button', { name: 'SVG' });
		const pngDownloadButton = await page.getByRole('button', { name: 'PNG' });
		await svgDownloadButton.waitFor({ state: 'visible', enabled: true, timeout: 60 * 60 * 1000 });
		await pngDownloadButton.waitFor({ state: 'visible', enabled: true });
		expect(svgDownloadButton).toBeVisible();
		expect(pngDownloadButton).toBeVisible();


		// Start waiting for the download before clicking the button
		const downloadPromise = page.waitForEvent('download');
		// Click the download button
		await svgDownloadButton.click();
		// Wait for the download to start
		const download = await downloadPromise;
		// Specify where you want to save the file
		const downloadPath = path.join('.', 'downloads', prefix + download.suggestedFilename());
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
		const downloadPath2 = path.join('.', 'downloads', prefix + download2.suggestedFilename());
		// Ensure the directory exists
		await fs.promises.mkdir(path.dirname(downloadPath2), { recursive: true });
		// Save the downloaded file
		await download2.saveAs(downloadPath2);
		console.log(`PNG File saved to: ${downloadPath2}`);
		// You can now use the downloaded file for further testing or verification
		expect(fs.existsSync(downloadPath2)).toBeTruthy();


	});
}