// File: src/routes/+layout.ts
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';
import { checkSession } from '$lib/services/authapi';
import { user } from '$lib/userstore';
import { get } from 'svelte/store';

// This load function will run on the server for the first page load,
// and on the client for subsequent navigations.
export const load: LayoutLoad = async ({ fetch }) => {
	// If we're in the browser and the user store is already populated,
	// we don't need to fetch the user again on every navigation.
	if (browser && get(user)) {
		return {
			user: get(user)
		};
	}

	// On the server, or on the first client-side load, check the session.
	// The `checkSession` function will make an API call to get the user profile
	// if a valid HttpOnly cookie is present. It will then populate our store.
	await checkSession(fetch);

	// Return the user from the store. It will be null if the session check failed.
	return {
		user: get(user)
	};
};
export const prerender = true;
