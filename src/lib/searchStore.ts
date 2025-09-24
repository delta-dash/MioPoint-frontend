import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { fetchWithAuth } from './services/authapi';


const SAVED_SEARCH_KEY = 'saved-search-query';

// --- CONFIGURATION CONSTANTS (Declare these at the top of the file) ---
// By placing these here, they are available to all functions in this module.

/** Define which keys from the ApiSearchQuery can have multiple values in the URL. */
const multiValueKeys: (keyof ApiSearchQuery)[] = ['file_type'];

/** Define which keys should be parsed as integers from the URL string. */
const integerKeys: (keyof ApiSearchQuery)[] = ['duration_min', 'duration_max', 'folder_id', 'page_size'];

/** Define which keys should be parsed as booleans from the URL string. */
const booleanKeys: (keyof ApiSearchQuery)[] = ['is_encrypted'];


// --- THE PARSER FUNCTION (Uses the constants declared above) ---

/**
 * A pure, schema-aware helper function to parse a URL object into our ApiSearchQuery type.
 * This function correctly handles multi-value fields and type conversions.
 */
export function parseUrlToQuery(url: URL): ApiSearchQuery {
    const query: ApiSearchQuery = {};
    const params = url.searchParams;
    // Iterate over unique keys to avoid processing the same key multiple times.
    const uniqueKeys = new Set(params.keys());

    for (const key of uniqueKeys) {
        // --- 1. Handle Multi-Value Keys ---
        if (multiValueKeys.includes(key as keyof ApiSearchQuery)) {
            const values = params.getAll(key).filter(Boolean); // Get all values and remove empty strings
            if (values.length > 0) {
                (query as any)[key] = values;
            }
            continue; // Move to the next key
        }

        // --- 2. Handle Single-Value Keys ---
        const value = params.get(key);
        if (value === null || value === '') {
            continue;
        }

        // --- 3. Handle Type Conversions for Single-Value Keys ---
        if (integerKeys.includes(key as keyof ApiSearchQuery)) {
            const num = parseInt(value, 10);
            if (!isNaN(num)) {
                (query as any)[key] = num;
            }
        } else if (booleanKeys.includes(key as keyof ApiSearchQuery)) {
            // Only 'true' is considered true.
            (query as any)[key] = value.toLowerCase() === 'true';
        } else {
            // Default to string
            (query as any)[key] = value;
        }
    }
    return query;
}

/**
 * A pure helper function to save a query to localStorage.
 */
function saveQueryToStorage(query: ApiSearchQuery) {
    if (!browser) return;
    localStorage.setItem(SAVED_SEARCH_KEY, JSON.stringify(query));
}

/**
 * Creates our custom search store.
 */
export function getLocalStorageQuery(): ApiSearchQuery {
    const savedQueryJSON = localStorage.getItem(SAVED_SEARCH_KEY);
    if (savedQueryJSON) {
        try {
            return JSON.parse(savedQueryJSON);
        } catch {
        }
    }
    return {}
}

function createSearchStore() {
    const { subscribe, set: setStoreValue } = writable<ApiSearchQuery>({});

    /**
     * Initializes the store's state. This should be called once from a layout or page.
     * It determines the initial query based on the URL or falls back to localStorage.
     */
    function initialize(url: URL) {
        let initialQuery: ApiSearchQuery = {};
        if (url.search) {
            // Priority 1: If the URL has search params, it is the source of truth.
            initialQuery = parseUrlToQuery(url);
        } else if (browser) {
            // Priority 2: If no URL params, check for a previously saved search.
            initialQuery = getLocalStorageQuery()

        }
        setStoreValue(initialQuery);
    }

    /**
     * The main function to update the search state.
     * It saves the query, updates the URL, and notifies all subscribers.
     * The `load` functions will automatically re-run because the URL changes.
     */
    function set(query: ApiSearchQuery, route?: string) {
        saveQueryToStorage(query);
        setStoreValue(query);

        const targetRoute = route ?? (browser ? window.location.pathname : '/search');
        // Build the search params for the URL
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                    // Correctly append each item for multi-value keys
                    value.forEach(item => params.append(key, String(item)));
                } else {
                    // Set single value keys
                    params.set(key, String(value));
                }
            }
        }

        const queryString = params.toString();
        const finalRoute = queryString ? `${targetRoute}?${queryString}` : targetRoute;

        // Navigate to the new URL. Use replaceState to avoid polluting browser history.
        goto(finalRoute, { keepFocus: true, noScroll: true, replaceState: true });
    }

    return {
        subscribe,
        initialize,
        set
    };
}

export const searchStore = createSearchStore();
/**
 * Fetches a list of file cards from the API based on search criteria.
 *
 * @param query - An object containing search parameters.
 * @param customFetch - An optional fetch function, useful for SvelteKit's `load` functions.
 * @returns A promise that resolves to the API response.
 */
export async function searchFiles(
    query: ApiSearchQuery,
    customFetch?: typeof fetch
): Promise<CardListingResponse> {

    const params = new URLSearchParams();

    // Loop through the query object and append non-null/undefined/empty values to the params
    for (const key in query) {
        const value = query[key as keyof ApiSearchQuery];
        if (value !== null && value !== undefined && value !== '') {
            if (Array.isArray(value)) {
                // For array values like file_type, append each item separately
                value.forEach((item) => params.append(key, item));
            } else {
                params.append(key, String(value));
            }
        }
    }

    return await fetchWithAuth(`/api/cards?${params.toString()}`, {}, customFetch);
}