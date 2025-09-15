// File: src/lib/stores/tags.store.svelte.ts

import { fetchWithAuth } from '$lib/services/authapi';

export interface Tag {
    id: number;
    name: string;
}

// The core reactive state object for our store
// This works perfectly in Svelte 5, as long as the file is named `.svelte.ts`
const store = $state({
    tags: [] as TagItem[],
    metaTags: [] as TagItem[],
    isLoading: false,
    error: null as string | null,
    hasFetchedTags: false,
    hasFetchedMetaTags: false
});

/**
 * Initializes the store with preloaded data.
 * This is useful for SSR or when a parent component already has the data.
 * It prevents the store from making a redundant API call.
 */
export function initTags(preloaded: { tags?: TagItem[]; metaTags?: TagItem[] }) {
    if (preloaded.tags && !store.hasFetchedTags) {
        store.tags = preloaded.tags;
        store.hasFetchedTags = true;
    }
    if (preloaded.metaTags && !store.hasFetchedMetaTags) {
        store.metaTags = preloaded.metaTags;
        store.hasFetchedMetaTags = true;
    }
}

/**
 * Fetches all system tags and meta-tags from the API if they haven't been fetched yet.
 * This function is idempotent and safe to call multiple times.
 */
export async function loadTags() {
    // Don't fetch if already loading or if all data is already present
    if (store.isLoading || (store.hasFetchedTags && store.hasFetchedMetaTags)) {
        return;
    }

    store.isLoading = true;
    store.error = null;

    try {
        const promisesToRun = [];

        if (!store.hasFetchedTags) {
            promisesToRun.push(fetchWithAuth<TagItem[]>('/api/tags/tags'));
        }
        if (!store.hasFetchedMetaTags) {
            promisesToRun.push(fetchWithAuth<TagItem[]>('/api/tags/meta_tags'));
        }

        const results = await Promise.all(promisesToRun);

        // Carefully assign results back based on what was fetched
        let resultIndex = 0;
        if (!store.hasFetchedTags) {
            // Corrected typo here: `resulstorets` -> `results`
            store.tags = results[resultIndex++];
            store.hasFetchedTags = true;
        }
        if (!store.hasFetchedMetaTags) {
            store.metaTags = results[resultIndex++];
            store.hasFetchedMetaTags = true;
        }
    } catch (e) {
        console.error('Failed to load system tags:', e);
        store.error = e instanceof Error ? e.message : 'Failed to load system tags.';
    } finally {
        store.isLoading = false;
    }
}

// Export the reactive store object for components to use
export const tagStore = store;