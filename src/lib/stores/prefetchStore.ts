import { writable } from 'svelte/store';

function createPrefetchStore() {
    const { subscribe, set, update } = writable(new Map<number, PageData>());

    return {
        subscribe,

        /**
         * Asynchronously fetches data and adds it to the cache if not already present.
         * Used for pre-loading pages on hover.
         * @param pageIndex The index of the page to prefetch.
         * @param fetcher A function that returns a Promise resolving to PageData.
         */
        prefetch: async (pageIndex: number, fetcher: () => Promise<PageData>) => {
            let isCached = false;
            update((cache) => {
                isCached = cache.has(pageIndex);
                return cache;
            });

            if (isCached) return;

            try {
                const data = await fetcher();
                update((cache) => cache.set(pageIndex, data));
            } catch (error) {
                console.error(`Prefetch failed for page index ${pageIndex}:`, error);
            }
        },

        /**
         * Explicitly sets data for a page index in the cache.
         * Used to store data after a successful network fetch.
         * @param pageIndex The index of the page to set.
         * @param data The PageData to cache.
         */
        set: (pageIndex: number, data: PageData) => {
            update((cache) => cache.set(pageIndex, data));
        },

        /**
         * Retrieves an item from the cache.
         * @param pageIndex The index of the page to retrieve.
         * @returns The cached PageData or undefined if not found.
         */
        get: (pageIndex: number): PageData | undefined => {
            let data: PageData | undefined;
            update((cache) => {
                data = cache.get(pageIndex);
                return cache;
            });
            return data;
        },

        /**
         * Clears the entire cache.
         */
        clear: () => {
            set(new Map<number, PageData>());
        }
    };
}
export const prefetchStore = createPrefetchStore();
