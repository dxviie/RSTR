import { redirect } from '@sveltejs/kit';

// The about page folded into the landing page (story) and /help (settings).
export const load = () => {
	redirect(301, '/help');
};
