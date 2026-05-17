import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const rememberMe = formData.get('rememberMe') === 'on';

		try {
			await auth.api.signInEmail({
				body: { email, password, rememberMe }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Login gagal' });
			}
			return fail(500, { message: 'Terjadi kesalahan' });
		}

		return redirect(302, '/dashboard');
	}
};
