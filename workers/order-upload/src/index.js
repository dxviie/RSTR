// rstr-order-upload — receives the plot SVG for an order and stores it in R2.
//
// The studio PUTs the exported SVG here right before opening the order form,
// keyed by the same 12-hex design fingerprint it sends to Tally as the
// `design` hidden field. That is the whole join: a submission's `design`
// value names its file at orders/<hash>.svg in the bucket. Same design, same
// key — retries and repeat orders overwrite identical content instead of
// piling up copies.
//
// This is deliberately not authenticated (the studio is a public static
// site, so any secret it held would be public too). The guardrails are:
// browser cross-site abuse dies on the origin allowlist, and anything else
// is bounded by the size cap, the strict key shape, the SVG sniff, and
// idempotent keys.

const ALLOWED_ORIGINS = new Set([
	'https://rstr.d17e.dev',
	// vite dev + preview
	'http://localhost:5173',
	'http://localhost:5199',
	'http://localhost:4173'
]);

/** Generous for dense A3 plots; far below the Worker request-body limit. */
const MAX_BYTES = 30 * 1024 * 1024;

const KEY_RE = /^\/orders\/([0-9a-f]{12})$/;

const corsHeaders = (origin) => ({
	'access-control-allow-origin': origin,
	'access-control-allow-methods': 'PUT, OPTIONS',
	'access-control-allow-headers': 'content-type,x-rstr-name',
	'access-control-max-age': '86400',
	vary: 'origin'
});

export default {
	async fetch(request, env) {
		const origin = request.headers.get('origin') ?? '';
		if (!ALLOWED_ORIGINS.has(origin)) return new Response('forbidden origin', { status: 403 });
		const cors = corsHeaders(origin);
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
		if (request.method !== 'PUT')
			return new Response('method not allowed', { status: 405, headers: cors });

		const match = new URL(request.url).pathname.match(KEY_RE);
		if (!match) return new Response('bad path', { status: 400, headers: cors });

		if (Number(request.headers.get('content-length') ?? '0') > MAX_BYTES)
			return new Response('too large', { status: 413, headers: cors });
		const body = await request.arrayBuffer();
		if (body.byteLength === 0 || body.byteLength > MAX_BYTES)
			return new Response('bad size', { status: 413, headers: cors });

		// cheap sanity check that this is our kind of file. RSTR exports open
		// with a multi-line settings comment, so strip comments from a generous
		// window before expecting the svg/xml opener.
		const raw = new TextDecoder().decode(body.slice(0, 65536));
		const head = raw
			.replace(/<!--[\s\S]*?-->/g, '')
			.trimStart()
			.toLowerCase();
		if (!head.startsWith('<?xml') && !head.startsWith('<svg'))
			return new Response('not an svg', { status: 415, headers: cors });

		const name = (request.headers.get('x-rstr-name') ?? '').slice(0, 120);
		await env.FILES.put(`orders/${match[1]}.svg`, body, {
			httpMetadata: { contentType: 'image/svg+xml' },
			customMetadata: { name, receivedAt: new Date().toISOString() }
		});
		return new Response(JSON.stringify({ ok: true, design: match[1] }), {
			status: 200,
			headers: { ...cors, 'content-type': 'application/json' }
		});
	}
};
