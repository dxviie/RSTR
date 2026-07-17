// The origin gate is the part of the worker that fails in the wild —
// bumped vite ports, LAN dev via `npm run dev-host`, lookalike domains —
// so the tests enumerate its edge: every shape of legitimate studio
// origin, and the near-misses that must stay outside. The upload gates
// (content address, size, rate limits) are covered below with the studio's
// own client behavior in mind: every rejection must stay CORS-readable so
// the studio can fall back to the manual attach step.
import { describe, expect, it } from 'vitest';
import worker from './index.js';

const WORKER_URL = 'https://rstr-order-upload.test.workers.dev';
const SVG = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';

// the studio keys uploads by the first 12 hex chars of the body's SHA-256 —
// derive the fixture's key the same way instead of hardcoding a stale hash
const designHashOf = async (text) => {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 12);
};
const HASH = await designHashOf(SVG);

const bucketStub = () => {
	const puts = [];
	return { puts, put: async (key, value, opts) => void puts.push({ key, value, opts }) };
};

const putRequest = (origin, { path = `/orders/${HASH}`, body = SVG, headers = {} } = {}) =>
	new Request(`${WORKER_URL}${path}`, {
		method: 'PUT',
		body,
		duplex: 'half',
		headers: {
			...(origin ? { origin } : {}),
			'content-type': 'image/svg+xml',
			// undici does not surface an implicit content-length on the server
			// side the way the Workers runtime does — declare it like a browser
			'content-length': String(new TextEncoder().encode(body).byteLength),
			'x-rstr-name': 'rstr-plot.svg',
			...headers
		}
	});

const preflight = (origin) =>
	new Request(`${WORKER_URL}/orders/${HASH}`, { method: 'OPTIONS', headers: { origin } });

const ALLOWED = [
	'https://rstr.d17e.dev',
	'https://d17e.dev',
	'https://preview.rstr.d17e.dev',
	'http://localhost:5173',
	// vite bumps to the next free port when 5173 is busy
	'http://localhost:5174',
	'http://localhost:4173',
	'https://localhost:5173',
	'http://127.0.0.1:5173',
	'http://[::1]:5173',
	// `npm run dev-host`: the studio open on a phone via the LAN
	'http://192.168.1.23:5173',
	'http://10.0.0.5:5199',
	'http://172.20.0.5:5173'
];

const FORBIDDEN = [
	'https://evil.example',
	// production is https-only
	'http://rstr.d17e.dev',
	// suffix lookalike
	'https://rstr.d17e.dev.evil.example',
	// no dot before the zone
	'https://evild17e.dev',
	// LAN-shaped prefix on a public host
	'http://192.168.1.23.evil.example:5173',
	// just past the 172.16/12 private block
	'http://172.32.0.1:5173',
	// sandboxed iframe / opaque origin
	'null'
];

describe('origin gate', () => {
	it.each(ALLOWED)('lets %s preflight and upload', async (origin) => {
		const env = { FILES: bucketStub() };

		const pre = await worker.fetch(preflight(origin), env);
		expect(pre.status).toBe(204);
		expect(pre.headers.get('access-control-allow-origin')).toBe(origin);

		const put = await worker.fetch(putRequest(origin), env);
		expect(put.status).toBe(200);
		expect(put.headers.get('access-control-allow-origin')).toBe(origin);
		await expect(put.json()).resolves.toEqual({ ok: true, design: HASH });
		expect(env.FILES.puts).toHaveLength(1);
		expect(env.FILES.puts[0].key).toBe(`orders/${HASH}.svg`);
	});

	it.each(FORBIDDEN)('rejects %s without CORS headers', async (origin) => {
		const env = { FILES: bucketStub() };
		const response = await worker.fetch(putRequest(origin), env);
		expect(response.status).toBe(403);
		expect(response.headers.get('access-control-allow-origin')).toBeNull();
		expect(env.FILES.puts).toHaveLength(0);
	});

	it('rejects a request with no origin at all', async () => {
		const response = await worker.fetch(putRequest(''), { FILES: bucketStub() });
		expect(response.status).toBe(403);
		await expect(response.text()).resolves.toContain('(none)');
	});
});

describe('rejections the studio must be able to read', () => {
	const origin = 'http://localhost:5173';

	it('CORS-tags a malformed key', async () => {
		const response = await worker.fetch(putRequest(origin, { path: '/orders/not-a-hash' }), {
			FILES: bucketStub()
		});
		expect(response.status).toBe(400);
		expect(response.headers.get('access-control-allow-origin')).toBe(origin);
	});

	it('CORS-tags a non-svg body', async () => {
		const body = '%PDF-1.4 not an svg';
		const response = await worker.fetch(
			putRequest(origin, { path: `/orders/${await designHashOf(body)}`, body }),
			{ FILES: bucketStub() }
		);
		expect(response.status).toBe(415);
		expect(response.headers.get('access-control-allow-origin')).toBe(origin);
	});

	it('CORS-tags an empty body', async () => {
		const response = await worker.fetch(putRequest(origin, { body: '' }), {
			FILES: bucketStub()
		});
		expect(response.status).toBe(413);
		expect(response.headers.get('access-control-allow-origin')).toBe(origin);
	});

	it('CORS-tags a missing content-length', async () => {
		const request = new Request(`${WORKER_URL}/orders/${HASH}`, {
			method: 'PUT',
			body: SVG,
			duplex: 'half',
			headers: { origin, 'content-type': 'image/svg+xml' }
		});
		const env = { FILES: bucketStub() };
		const response = await worker.fetch(request, env);
		expect(response.status).toBe(411);
		expect(response.headers.get('access-control-allow-origin')).toBe(origin);
		expect(env.FILES.puts).toHaveLength(0);
	});
});

describe('content address', () => {
	const origin = 'https://rstr.d17e.dev';

	it('refuses a body that does not hash to its key', async () => {
		const env = { FILES: bucketStub() };
		const response = await worker.fetch(putRequest(origin, { path: '/orders/aaaaaaaaaaaa' }), env);
		expect(response.status).toBe(422);
		expect(response.headers.get('access-control-allow-origin')).toBe(origin);
		expect(env.FILES.puts).toHaveLength(0);
	});

	it('stores the customer file name on the object, control chars stripped', async () => {
		const env = { FILES: bucketStub() };
		await worker.fetch(putRequest(origin, { headers: { 'x-rstr-name': 'rstr\tplot.svg' } }), env);
		expect(env.FILES.puts[0].opts.customMetadata.name).toBe('rstrplot.svg');
	});
});

describe('rate limits', () => {
	const origin = 'https://rstr.d17e.dev';
	const limiter = (success) => {
		const keys = [];
		return { keys, limit: async ({ key }) => (keys.push(key), { success }) };
	};

	it('passes when both limiters approve, keyed by connecting IP', async () => {
		const env = { FILES: bucketStub(), RATE_IP: limiter(true), RATE_GLOBAL: limiter(true) };
		const response = await worker.fetch(
			putRequest(origin, { headers: { 'cf-connecting-ip': '203.0.113.7' } }),
			env
		);
		expect(response.status).toBe(200);
		expect(env.RATE_IP.keys).toEqual(['203.0.113.7']);
		expect(env.RATE_GLOBAL.keys).toEqual(['all']);
	});

	it('429s with retry-after when the IP budget is spent, before touching R2', async () => {
		const env = { FILES: bucketStub(), RATE_IP: limiter(false), RATE_GLOBAL: limiter(true) };
		const response = await worker.fetch(putRequest(origin), env);
		expect(response.status).toBe(429);
		expect(response.headers.get('retry-after')).toBe('60');
		expect(response.headers.get('access-control-allow-origin')).toBe(origin);
		expect(env.FILES.puts).toHaveLength(0);
	});

	it('429s when the global budget is spent', async () => {
		const env = { FILES: bucketStub(), RATE_IP: limiter(true), RATE_GLOBAL: limiter(false) };
		const response = await worker.fetch(putRequest(origin), env);
		expect(response.status).toBe(429);
		expect(env.FILES.puts).toHaveLength(0);
	});

	it('does not spend budget on preflights', async () => {
		const rate = limiter(true);
		const env = { FILES: bucketStub(), RATE_IP: rate, RATE_GLOBAL: rate };
		const response = await worker.fetch(preflight(origin), env);
		expect(response.status).toBe(204);
		expect(rate.keys).toHaveLength(0);
	});

	it('fails open when the bindings are absent', async () => {
		const env = { FILES: bucketStub() };
		const response = await worker.fetch(putRequest(origin), env);
		expect(response.status).toBe(200);
		expect(env.FILES.puts).toHaveLength(1);
	});
});
