import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { user } from '$lib/userstore.js';
import { get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/authapi';


export const load: PageLoad = async ({ url, fetch, parent }) => {
    const { user } = await parent();

    if (!user || !user.permissions.some(p => p.name === 'user:manage_roles')) {
        throw error(403, 'Forbidden: You do not have permission to access this page.');
    }



    try {
        // Check the store's VALUE, not the store itself
        //console.log(get(UserProfile));


        let allRoles = await fetchWithAuth<Role[]>(`/api/roles`, {}, fetch);

        const roleNameFromUrl = url.searchParams.get('role');

        let initialRoleId: number | null = null;

        // 3. If a role name is present in the URL, find the matching role.
        if (roleNameFromUrl) {
            // Use a case-insensitive find for better UX
            const initialRole = allRoles.find(
                (role: any) => role.name.toLowerCase() === roleNameFromUrl.toLowerCase()
            );
            // If we found a match, get its ID.
            if (initialRole) {
                initialRoleId = initialRole.id;
            }
        } else {
            if (allRoles && allRoles.length) {
                initialRoleId = allRoles[0].id
            }
        }
        let allPermissions = await fetchWithAuth('/api/permissions', {}, fetch);
        // 4. Return the list of all roles AND the initial ID to select.
        return {
            allRoles,
            initialRoleId
            , allPermissions
        };

    } catch (err: any) {
        console.error(err);
        throw error(err.status, err.body)
    }
};