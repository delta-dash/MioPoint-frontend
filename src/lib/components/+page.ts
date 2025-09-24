import type { PageLoad } from './$types';
import { searchFiles } from '../../media';
import type { ApiSearchQuery } from '../../app';

export const load: PageLoad = async ({ fetch, url }) => {
    const query: ApiSearchQuery = {};

    // Extract all known query parameters from the URL.
    // This is a robust way to handle multiple values for file_type and other params.
    query.search = url.searchParams.get('search') || undefined;
    query.filename = url.searchParams.get('filename') || undefined;
    query.tags = url.search_params.get('tags') || undefined;
    query.exclude_tags = url.searchParams.get('exclude_tags') || undefined;
    query.meta_tags = url.searchParams.get('meta_tags') || undefined;
    query.exclude_meta_tags = url.searchParams.get('exclude_meta_tags') || undefined;

    const fileTypes = url.searchParams.getAll('file_type');
    if (fileTypes.length > 0) {
        query.file_type = fileTypes;
    }

    if (url.searchParams.has('is_encrypted')) {
        query.is_encrypted = url.searchParams.get('is_encrypted') === 'true';
    }
    if (url.searchParams.has('duration_min')) {
        const min = parseInt(url.searchParams.get('duration_min') || '', 10);
        if (!isNaN(min)) query.duration_min = min;
    }
    if (url.searchParams.has('duration_max')) {
        const max = parseInt(url.searchParams.get('duration_max') || '', 10);
        if (!isNaN(max)) query.duration_max = max;
    }
    if (url.searchParams.has('folder_id')) {
        const folderId = parseInt(url.searchParams.get('folder_id') || '', 10);
        if (!isNaN(folderId)) query.folder_id = folderId;
    }
    query.mode = (url.searchParams.get('mode') as ApiSearchQuery['mode']) || 'expanded';

    // Fetch initial results using the constructed query
    const searchResults = await searchFiles({ ...query, page_size: 24 }, fetch);

    return {
        query, // Pass the current query to the page for the "load more" function
        initialResults: searchResults
    };
};