import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ parent }) => {
    const { user } = await parent();

    if (!user || !user.permissions.some(p => p.name === 'user:view_any')) {
        throw error(403, 'Forbidden: You do not have permission to access this page.');
    }

    return {};
};