// src/routes/file/[id]/+page.ts 
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { fetchWithAuth } from '$lib/services/authapi';

export const load: PageLoad = async ({ params, fetch, url }) => {
    const instanceId = params.id;
    const inviteCode = url.searchParams.get('invite');

    // Define a type for the raw API response, which has tag names as strings.
    // This helps us safely handle the data transformation.
    type ApiFileDetails = Omit<FileDetails, 'tags' | 'meta_tags'> & {
        tags: string[];
        meta_tags: string[];
    };

    // Promise.all is great for parallel fetching
    const [apiFileDetails, allSystemTags, allSystemMetaTags] = await Promise.all([
        fetchWithAuth<ApiFileDetails>(`/api/instance/${instanceId}`, {}, fetch),
        fetchWithAuth<TagItem[]>('/api/tags/tags', {}, fetch),
        fetchWithAuth<TagItem[]>('/api/tags/meta_tags', {}, fetch)
    ]);

    if (!apiFileDetails) {
        throw error(404, 'File not found or you do not have access.');
    }

    // Create lookup maps for efficient mapping from tag name to TagItem object.
    const allTagsMap = new Map((allSystemTags || []).map((tag) => [tag.name, tag]));
    const allMetaTagsMap = new Map((allSystemMetaTags || []).map((tag) => [tag.name, tag]));

    // Transform the raw API details into the rich data structure the app components expect.
    const fileDetails: FileDetails = {
        ...apiFileDetails,
        tags: apiFileDetails.tags
            .map((name) => allTagsMap.get(name))
            .filter((tag): tag is TagItem => !!tag), // Filter out any tags not found in the map
        meta_tags: apiFileDetails.meta_tags
            .map((name) => allMetaTagsMap.get(name))
            .filter((tag): tag is TagItem => !!tag)
    };

    // Determine the correct media source URL based on file type and web-readiness
    let mediaSrc: string;
    if (fileDetails.file_type === 'video' && !fileDetails.is_webready) {
        // Use the streaming endpoint for non-web-ready videos that require live transcoding
        mediaSrc = `/api/instance/${instanceId}/stream`;
    } else if (fileDetails.file_type === 'text' || fileDetails.file_type === 'pdf') {
        // Use the view endpoint for text-based files to handle large files and decryption
        mediaSrc = `/api/instance/${instanceId}/view`;
    } else {
        // Use the standard media endpoint for images, audio, and web-ready videos
        mediaSrc = `/api/instance/${instanceId}/media`;
    }


    return {
        fileId: fileDetails.id,
        fileDetails, // This is now the transformed object with TagItem[]
        mediaSrc,
        allSystemTags,
        allSystemMetaTags,
        inviteCode // This will be null if not present in the URL
    };
};