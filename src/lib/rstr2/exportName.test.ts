import { describe, it, expect } from 'vitest';
import { fileSlug, buildExportName } from './exportName';

describe('fileSlug', () => {
	it('drops the extension and lowercases', () => {
		expect(fileSlug('Photo.JPG')).toBe('photo');
	});

	it('strips a leading path (sample images start with /)', () => {
		expect(fileSlug('/bbrasa-imp.png')).toBe('bbrasa-imp');
		expect(fileSlug('C:\\Users\\me\\My Pic.png')).toBe('my-pic');
	});

	it('collapses unsafe characters to single dashes and trims them', () => {
		expect(fileSlug('My Photo (2).jpeg')).toBe('my-photo-2');
		expect(fileSlug('a  b__c.png')).toBe('a-b__c');
	});

	it('only strips the final extension, keeping earlier dots as dashes', () => {
		expect(fileSlug('foo.bar.png')).toBe('foo-bar');
	});

	it('caps the length', () => {
		expect(fileSlug('x'.repeat(200) + '.png').length).toBe(60);
	});

	it('returns empty for a name with no usable characters', () => {
		expect(fileSlug('北京.png')).toBe('');
		expect(fileSlug('')).toBe('');
	});
});

describe('buildExportName', () => {
	const stamp = '2026-07-10T11-30-00';

	it('folds the source name and suffix in', () => {
		expect(buildExportName('cat.png', 'seq', 'zip', stamp)).toBe(`rstr-cat-seq-${stamp}.zip`);
	});

	it('drops an empty suffix', () => {
		expect(buildExportName('cat.png', '', 'svg', stamp)).toBe(`rstr-cat-${stamp}.svg`);
	});

	it('falls back to the plain rstr-<stamp> shape when there is no name', () => {
		expect(buildExportName('', '', 'png', stamp)).toBe(`rstr-${stamp}.png`);
		expect(buildExportName('北京.png', 'seq', 'zip', stamp)).toBe(`rstr-seq-${stamp}.zip`);
	});
});
