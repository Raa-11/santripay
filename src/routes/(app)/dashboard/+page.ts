import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/dashboard');
	return res.json();
};
