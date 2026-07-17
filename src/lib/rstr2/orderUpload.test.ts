import { describe, it, expect, vi, afterEach } from 'vitest';
import { orderUploadUrl, uploadOrderSvg, ORDER_UPLOAD_ENDPOINT } from './orderUpload';

afterEach(() => vi.unstubAllGlobals());

describe('orderUploadUrl', () => {
	it('keys the upload by the design fingerprint', () => {
		expect(orderUploadUrl('abc123def456')).toBe(`${ORDER_UPLOAD_ENDPOINT}/orders/abc123def456`);
	});
});

describe('uploadOrderSvg', () => {
	it('PUTs the svg and resolves true on a confirmed write', async () => {
		const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
			async () => new Response('{"ok":true}', { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);
		await expect(uploadOrderSvg('<svg/>', 'abc123def456', 'rstr-test.svg')).resolves.toBe(true);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(`${ORDER_UPLOAD_ENDPOINT}/orders/abc123def456`);
		expect(init.method).toBe('PUT');
		expect(init.body).toBe('<svg/>');
		expect((init.headers as Record<string, string>)['x-rstr-name']).toBe('rstr-test.svg');
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('resolves false when the worker rejects the file', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('too large', { status: 413 }))
		);
		await expect(uploadOrderSvg('<svg/>', 'abc123def456', 'x.svg')).resolves.toBe(false);
	});

	it('resolves false on network failure instead of throwing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			})
		);
		await expect(uploadOrderSvg('<svg/>', 'abc123def456', 'x.svg')).resolves.toBe(false);
	});
});
