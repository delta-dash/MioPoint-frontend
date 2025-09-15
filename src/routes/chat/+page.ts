// src/routes/chat/+page.ts
import type { PageLoad } from './$types';
import { fetchWithAuth } from '$lib/services/authapi'; // <-- Import your service

// --- Types ---
interface Thread {
    id: number;
    type: string;
    name: string | null;
    picture_url: string | null;
    role: string;
}

interface PublicThread {
    id: number;
    type: string;
    name: string | null;
    picture_url: string | null;
}

export const load: PageLoad = async ({ fetch }) => {
    // We'll use your fetchWithAuth for all API calls.
    // We pass SvelteKit's `fetch` to the `customFetch` parameter.

    const fetchThreads = async () => {
        try {
            // The third argument is SvelteKit's server-aware fetch
            const threads = await fetchWithAuth<Thread[]>('/api/chat/threads', {}, fetch);
            return threads || []; // Ensure it's an array even if API returns null/undefined
        } catch (error) {
            console.error('Error fetching threads in load function:', error);
            // Return an empty array on failure so the page doesn't crash
            return [];
        }
    };

    const fetchPublicThreads = async () => {
        try {
            const publicThreads = await fetchWithAuth<PublicThread[]>('/api/chat/public_threads', {}, fetch);
            return publicThreads || [];
        } catch (error) {
            console.error('Error fetching public threads in load function:', error);
            return [];
        }
    };

    // Run fetches in parallel for performance
    const [threads, publicThreads] = await Promise.all([fetchThreads(), fetchPublicThreads()]);
    
    return {
        threads,
        publicThreads
    };
};