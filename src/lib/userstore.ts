import { writable } from 'svelte/store';

// This store will only hold the user's profile information.
// Tokens will be handled securely by the browser as HttpOnly cookies.
export const user = writable<UserProfile | null>(null);
