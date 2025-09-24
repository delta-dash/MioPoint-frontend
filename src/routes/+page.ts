// src/routes/search/+page.ts
import type { PageLoad } from './$types';
import { getLocalStorageQuery, parseUrlToQuery, searchFiles } from '$lib/searchStore';
import { browser } from '$app/environment';

export const load: PageLoad = async ({ fetch, url }) => {

    let query: ApiSearchQuery = {}; // Declare query outside the if/else block
    if (url.searchParams.size) {

        query = parseUrlToQuery(url);

    }
    else if (browser) {
        query = getLocalStorageQuery() // Ensure query is initialized even if localStorage is empty
    }

    const searchResults = await searchFiles({ ...query }, fetch);


    return {
        query,
        initialResults: searchResults
    };
};