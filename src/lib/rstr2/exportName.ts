// Export file-name helpers. The downloaded artwork files fold in the name of
// the input image/video so an export is traceable back to its source, e.g.
// `rstr-my-photo-2026-07-10T11-30-00.svg`. Kept pure (no component state) so
// the sanitization edge cases can be unit-tested.

/** A filesystem-safe slug of a source file name: no path, no extension. */
export const fileSlug = (name: string): string =>
	name
		.replace(/^.*[/\\]/, '') // strip any leading path (sample images are '/x.png')
		.replace(/\.[^.]+$/, '') // strip the extension
		.replace(/[^a-zA-Z0-9-_]+/g, '-') // collapse anything unsafe to a single dash
		.replace(/^-+|-+$/g, '') // trim leading/trailing dashes
		.slice(0, 60)
		.toLowerCase();

/**
 * `rstr-<source>-<suffix>-<stamp>.<ext>`, with the source and suffix dropped
 * when empty — so a source with no usable name still yields the old
 * `rstr-<stamp>.<ext>` shape.
 */
export const buildExportName = (
	sourceName: string,
	suffix: string,
	ext: string,
	stamp: string
): string => {
	const slug = fileSlug(sourceName);
	return `rstr${slug ? `-${slug}` : ''}${suffix ? `-${suffix}` : ''}-${stamp}.${ext}`;
};
