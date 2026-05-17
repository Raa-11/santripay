import { setContext, getContext } from 'svelte';

export class AuthState {
	user = $state<{
		id: string;
		name: string;
		email: string;
		avatar?: string;
	} | null>(null);

	constructor(initialUser: any | (() => any)) {
		if (typeof initialUser === 'function') {
			this.user = initialUser();
		} else {
			this.user = initialUser;
		}
	}

	updateUser(newData: any) {
		this.user = { ...this.user, ...newData };
	}
}

const AUTH_KEY = Symbol('auth');

export function setAuthContext(initialUser: any | (() => any)) {
	return setContext(AUTH_KEY, new AuthState(initialUser));
}

export function getAuthContext() {
	return getContext<AuthState>(AUTH_KEY);
}
