/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE = `rstr-${version}`;

// sample/test images are big and only used in dev — no point precaching them
const SKIP_PRECACHE = ['/test-rstr.png', '/bbrasa-imp.png', '/knest-imp.png', '/rstr-og.png'];

// Precache the app shell, not the marketing weight: the landing gallery is
// ~22 MB across its responsive variants and only a subset ever shows — the
// runtime network-first handler below still caches those on demand. And
// '_'-prefixed files (_headers & co) are host control files that Pages-style
// hosts don't serve; one failed fetch would abort the whole install.
const precache = (file: string): boolean =>
	!SKIP_PRECACHE.includes(file) && !file.startsWith('/gallery/') && !file.startsWith('/_');

const ASSETS = [
	...build, // the app itself
	...files.filter(precache) // the app shell part of `static`
];

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache().then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches().then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== sw.location.origin) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// build & static files are immutable per version — serve straight from cache
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// everything else: network first, cache as fallback so the app keeps
		// working offline once it has been visited
		try {
			const response = await fetch(event.request);
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch (err) {
			const cached = await cache.match(event.request);
			if (cached) return cached;
			throw err;
		}
	}

	event.respondWith(respond());
});
