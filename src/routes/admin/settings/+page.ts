import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ fetch, parent }) => {
    const { user } = await parent();

    if (!user || !user.permissions.some(p => p.name === 'admin:config:view')) {
        throw error(403, 'Forbidden: You do not have permission to access this page.');
    }

    try {
        const response = await fetch('/api/config/schema');
        if (!response.ok) {
            throw error(response.status, `Failed to load configuration: ${response.statusText}`);
        }
        const configSchema: ConfigSchemaItem[] = await response.json();
        return { configSchema };
    } catch (e) {
        console.error('Error loading config:', e);
        throw error(500, 'Internal Server Error: Could not load configuration.');
    }
};
