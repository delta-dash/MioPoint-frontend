// File: src/routes/your-route/+page.ts
// THIS FILE REQUIRES NO CHANGES

import type { PageLoad } from './$types';
import * as api from '$lib/TagManager/tagapi'; // This now uses fetchWithAuth internally
import { error } from '@sveltejs/kit';

const VALID_TABS: TagType[] = ['tags', 'meta_tags'];

export const load: PageLoad = async ({ url, fetch, parent }) => { // The `fetch` here is passed down
    const { user } = await parent();

    if (!user || !user.permissions.some(p => p.name === 'tag:edit')) {
        throw error(403, 'Forbidden: You do not have permission to access this page.');
    }

    const tabFromUrl = url.searchParams.get('tab') as TagType | null;
    const activeTabId: TagType = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'tags';
    const tagNameToOpen = url.searchParams.get('tag');

    try {
        // This call now automatically handles auth!
        const allTags: TagItem[] = (await api.getTagList(activeTabId, fetch)).sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        let tagForModal: TagDetail | null = null;

        if (tagNameToOpen) {
            const tagToFind = allTags.find((t) => t.name === tagNameToOpen);
            if (tagToFind) {
                // This call also automatically handles auth!
                tagForModal = await api.getTagDetails(activeTabId, tagToFind.id, fetch);
            }
        }

        return {
            allTags,
            activeTabId,
            tagForModal,
            error: null
        };
    } catch (e: any) {
        return {
            allTags: [],
            activeTabId,
            tagForModal: null,
            error: `Failed to load tag data: ${e.message}`
        };
    }
};