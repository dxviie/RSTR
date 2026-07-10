import { redirect } from '@sveltejs/kit';

// The v2 beta became the main app: /v2 → /studio. Kept so old links and
// bookmarks keep working.
export const load = () => {
	redirect(301, '/studio');
};
