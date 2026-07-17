import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),

		// Content-Security-Policy, emitted by Kit itself (it nonces/hashes its
		// own inline scripts). The app's external surface is deliberately tiny —
		// keep this list in sync when it changes:
		//   script/connect  https://umami.d17e.dev   self-hosted analytics
		//   connect         …workers.dev             order upload (ORDER_UPLOAD_ENDPOINT
		//                                            in src/lib/rstr2/orderUpload.ts)
		//   frame           https://tally.so         embedded order form
		//   blob:           image/video previews and exports built in-browser
		//   style-src 'unsafe-inline': Svelte transitions inject inline <style>
		//   elements and the UI leans on style="" attributes — both need it.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', 'https://umami.d17e.dev'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'blob:', 'data:'],
				'media-src': ['self', 'blob:'],
				'font-src': ['self'],
				'connect-src': [
					'self',
					'https://umami.d17e.dev',
					'https://rstr-order-upload.david-cloudflare-862.workers.dev'
				],
				'frame-src': ['https://tally.so'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
