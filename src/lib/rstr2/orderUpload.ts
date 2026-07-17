// Silent order-file upload: the studio sends the exported SVG to the plot
// queue (a Cloudflare Worker in front of an R2 bucket, see
// workers/order-upload) right before the order form opens. This is the
// primary way the file reaches me — no download step involved. Best-effort
// by design: when the upload can't complete (endpoint down, blocked, slow
// network) the studio downloads the file instead and the order form keeps
// its manual attach step — the `upload` hidden field tells it which face to
// show.

/** The upload Worker. Deployed from workers/order-upload in this repo. */
export const ORDER_UPLOAD_ENDPOINT = 'https://rstr-order-upload.david-cloudflare-862.workers.dev';

/** Give slow connections a real chance but never hold the order hostage. */
export const ORDER_UPLOAD_TIMEOUT_MS = 12000;

/** Where a design's file lives: keyed by the 12-hex design fingerprint. */
export const orderUploadUrl = (designHash: string): string =>
	`${ORDER_UPLOAD_ENDPOINT}/orders/${designHash}`;

/**
 * PUT the SVG into the plot queue. Resolves true only when the worker
 * confirmed the write; false on any failure (timeout, network error,
 * rejection) — the caller then leaves the form's manual attach step in place.
 */
export const uploadOrderSvg = async (
	svg: string,
	designHash: string,
	fileName: string
): Promise<boolean> => {
	try {
		const response = await fetch(orderUploadUrl(designHash), {
			method: 'PUT',
			body: svg,
			headers: { 'content-type': 'image/svg+xml', 'x-rstr-name': fileName },
			signal: AbortSignal.timeout(ORDER_UPLOAD_TIMEOUT_MS)
		});
		return response.ok;
	} catch {
		return false;
	}
};
