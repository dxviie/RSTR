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

// The origin gate matches by shape, not exact strings: vite bumps 5173 to
// the next free port when it's busy, `npm run dev-host` serves the studio
// from a LAN address for phone testing, and 127.0.0.1 is localhost by
// another name — all legitimate studio origins, and an exact-match set
// 403s each of them as an opaque CORS failure at the moment of ordering.
// Allowed: the d17e.dev zone over https (production and any preview
// subdomain), and loopback or private-LAN (RFC 1918) hosts on any port.
const PROD_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*d17e\.dev$/;
const DEV_HOSTNAME_RE =
	/^(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

const isAllowedOrigin = (origin) => {
	if (PROD_ORIGIN_RE.test(origin)) return true;
	let url;
	try {
		url = new URL(origin);
	} catch {
		return false;
	}
	return (
		(url.protocol === 'http:' || url.protocol === 'https:') && DEV_HOSTNAME_RE.test(url.hostname)
	);
};

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
		if (!isAllowedOrigin(origin))
			return new Response(`forbidden origin: ${origin || '(none)'}`, { status: 403 });
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
