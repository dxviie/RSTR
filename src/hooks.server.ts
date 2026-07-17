import type { Handle } from '@sveltejs/kit';

// Security headers for every server-rendered response. Cloudflare Pages
// applies static/_headers to static assets only — never to these function
// responses — so the documents get the same set here. CSP itself is
// emitted by Kit (kit.csp in svelte.config.js).
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};
