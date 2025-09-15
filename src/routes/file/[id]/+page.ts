// src/routes/file/[id]/+page.ts 
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { fetchWithAuth } from '$lib/services/authapi';

export const load: PageLoad = async ({ params, fetch, url }) => { // <-- Add 'url'
    const fileId = params.id;

    // --- ADDED: Read the invite code from the URL query string ---
    const inviteCode = url.searchParams.get('invite');

    // Promise.all is great for parallel fetching
    const [fileData, allSystemTags, allSystemMetaTags] = await Promise.all([
        fetchWithAuth<FileDetails>(`/api/file/${fileId}`, {}, fetch),
        fetchWithAuth('/api/tags/tags', {}, fetch),
        fetchWithAuth('/api/tags/meta_tags', {}, fetch)
    ]);

    const fileDetails = fileData; // fileData is already the file details object

    let videoSrc = `/api/${fileId}/media`;
    if (fileDetails.transcoded_path) {
        videoSrc = `/api/${fileId}/media`; // Always use v3-combined, it will serve transcoded if available
    }

    return {
        fileId: parseInt(fileId, 10), // Ensure fileId is a number
        fileDetails,
        videoSrc,
        allSystemTags,
        allSystemMetaTags,
        // --- ADDED: Pass the invite code to the page component ---
        inviteCode // This will be null if not present in the URL
    };
};