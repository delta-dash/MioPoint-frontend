// src/lib/TagManager/tagapi.ts

import { fetchWithAuth } from '$lib/services/authapi'; // Import the new authentication wrapper

// A base URL constant makes it easier to manage API paths.
const BASE_URL = '/api/tags';

/**
 * Fetches a list of tags for a given type using the authentication wrapper.
 * This function is designed to be used in SvelteKit's `load` function.
 *
 * @param type - The category of tags to fetch ('tags' or 'meta_tags').
 * @param customFetch - Optional fetch provided by SvelteKit's `load` event for SSR.
 * @returns A promise that resolves to an array of tags.
 */
export function getTagList(
    type: TagType,
    customFetch?: typeof fetch
): Promise<TagItem[]> {
    // Pass the customFetch argument directly to fetchWithAuth.
    return fetchWithAuth<TagItem[]>(`${BASE_URL}/${type}`, { method: 'GET' }, customFetch);
}

/**
 * Fetches the detailed information for a single tag using the authentication wrapper.
 * This function is also designed to be used in SvelteKit's `load` function.
 *
 * @param type - The category of the tag.
 * @param id - The ID of the tag.
 * @param customFetch - Optional fetch provided by SvelteKit's `load` event for SSR.
 * @returns A promise that resolves to the detailed tag object.
 */
export function getTagDetails(
    type: TagType,
    id: number,
    customFetch?: typeof fetch
): Promise<TagDetail> {
    // The original API path included `/id/`, adjust if necessary.
    // This version assumes a more RESTful path like `/api/tags/tags/123`.
    return fetchWithAuth<TagDetail>(`${BASE_URL}/${type}/id/${id}`, { method: 'GET' }, customFetch);
}

/**
 * Creates a new tag using the authentication wrapper.
 * This function is intended for client-side use (e.g., from a form).
 *
 * @param type - The category of the new tag.
 * @param payload - The data for the new tag.
 * @returns A promise that resolves to the newly created tag object.
 */
export function createTag(type: TagType, payload: CreateTagPayload): Promise<TagDetail> {
    const options: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };
    // No customFetch is passed, so fetchWithAuth will use the browser's default fetch.
    return fetchWithAuth<TagDetail>(`${BASE_URL}/${type}`, options);
}

/**
 * Updates an existing tag using the authentication wrapper.
 * This function is intended for client-side use.
 *
 * @param type - The category of the tag to update.
 * @param id - The ID of the tag to update.
 * @param payload - The data to update.
 * @returns A promise that resolves to the updated tag object.
 */
export function updateTag(
    type: TagType,
    id: number,
    payload: EditTagPayload
): Promise<TagDetail> {
    const options: RequestInit = {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };
    return fetchWithAuth<TagDetail>(`${BASE_URL}/${type}/${id}`, options);
}

/**
 * Deletes a tag using the authentication wrapper.
 * This function is intended for client-side use.
 *
 * @param type - The category of the tag to delete.
 * @param id - The ID of the tag to delete.
 * @returns A promise that resolves when the operation is complete.
 */
export function deleteTag(type: TagType, id: number): Promise<void> {
    const options: RequestInit = {
        method: 'DELETE'
    };
    // fetchWithAuth handles 204 No Content responses correctly.
    return fetchWithAuth<void>(`${BASE_URL}/${type}/${id}`, options);
}