// File: $lib/services/authapi.ts
import { browser } from '$app/environment';
import { user } from '$lib/userstore';

// --- STATE ---

// This promise is used to prevent multiple token refresh requests from firing simultaneously.
let refreshPromise: Promise<Response> | null = null;

// --- PUBLIC API ---

/**
 * Checks if a user session is active by trying to fetch the user profile.
 * This should be called when the application loads (e.g., in a root +layout.ts).
 * It relies on the browser sending a valid HttpOnly auth cookie.
 */
export async function checkSession(customFetch?: typeof fetch) {
	try {
		const profile = await getMyProfile(customFetch);
		user.set(profile);
	} catch (error) {
		// This is expected if the user is not logged in. Clear the store.
		user.set(null);
	}
}

/**
 * Registers a new user.
 * @param username - The desired username.
 * @param password - The desired password.
 * @returns The newly created user's profile.
 * @throws If registration fails (e.g., username taken).
 */
export async function register(username: string, password: string): Promise<void> {
	const response = await fetch('/api/auth/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});

	const data: UserProfile = await response.json();

	if (!response.ok) {
		throw new Error((data as any).detail || 'Registration failed');
	}

	// The backend automatically logs the user in and sets cookies.
	// We just need to update our store with the returned profile.
	user.set(data);
}

/**
 * Logs in a user. On success, the backend is expected to set HttpOnly cookies.
 * After logging in, it fetches the user's profile to populate the store.
 * @param username - The user's username.
 * @param password - The user's password.
 * @throws If login fails (e.g., invalid credentials).
 */
export async function login(username: string, password: string): Promise<void> {
	const formData = new URLSearchParams();
	formData.append('username', username);
	formData.append('password', password);

	const response = await fetch('/api/auth/token', {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.detail || 'Login failed');
	}

	// After successful login, the cookies are set. Now fetch the user profile.
	const profile = await getMyProfile();
	user.set(profile);
}

/**
 * Logs out the current user by calling the backend logout endpoint,
 * which should clear the HttpOnly cookies.
 */
export async function logout() {
	try {
		await fetchWithAuth('/api/auth/logout', { method: 'POST' });
	} finally {
		// Always clear the user store and redirect, even if the logout call fails.
		user.set(null);
		if (browser) {
			window.location.href = '/login';
		}
	}
}

/**
 * Fetches the current user's profile.
 * Relies on the browser sending the correct auth cookie.
 * @param customFetch - Optional fetch for SvelteKit `load` functions.
 */
export async function getMyProfile(customFetch?: typeof fetch): Promise<UserProfile> {
	return await fetchWithAuth<UserProfile>('/api/auth/me', {}, customFetch);
}

/**
 * A wrapper around fetch that automatically handles cookie-based auth and token refreshing.
 * @param url - The URL to fetch.
 * @param options - Standard RequestInit options.
 * @param customFetch - Optional fetch for SvelteKit `load` functions.
 * @returns The JSON response from the API.
 */
export async function fetchWithAuth<T>(
	url: string,
	options: RequestInit = {},
	customFetch?: typeof fetch
): Promise<T> {
	const doFetch = customFetch ?? fetch;

	// Ensure credentials (cookies) are always included.
	const fetchOptions: RequestInit = {
		...options,
		credentials: 'include'
	};

	let response = await doFetch(url, fetchOptions);

	if (response.status === 401) {
		// If a refresh isn't already in progress, start one.
		if (!refreshPromise) {
			console.log('Auth token expired or missing. Attempting to refresh...');
			refreshPromise = doFetch('/api/auth/refresh_token', {
				method: 'POST',
				credentials: 'include'
			});
		}

		try {
			// Wait for the single refresh operation to complete.
			const refreshResponse = await refreshPromise;

			if (refreshResponse.ok) {
				console.log('Token refreshed successfully. Retrying original request...');
				// The cookie is now updated, so retry the original request.
				response = await doFetch(url, fetchOptions);
			} else {
				// Refresh failed. The user is truly logged out.
				throw new Error('Session expired. Please log in again.');
			}
		} finally {
			// Clear the promise so the next 401 can trigger a new refresh.
			refreshPromise = null;
		}
	}

	// If the response is still not OK after potential retry, throw an error.
	if (!response.ok) {
		let error: Error;
		try {
			const errorData = await response.json();
			error = new Error(errorData.detail || `Request failed with status ${response.status}`);
		} catch (e) {
			const errorText = await response.text();
			error = new Error(errorText || `Request failed with status ${response.status}`);
		}
		throw error;
	}

	if (response.status === 204) {
		return null as T;
	}

	return response.json();
}