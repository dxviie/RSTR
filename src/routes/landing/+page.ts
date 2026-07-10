import { redirect } from '@sveltejs/kit';

// The landing page moved to the root.
export const load = () => {
	redirect(301, '/');
};
