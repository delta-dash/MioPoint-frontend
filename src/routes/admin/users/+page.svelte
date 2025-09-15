<script lang="ts">

	// NEW: Import the RoleManager component
	import RoleManager from '$lib/components/RoleManager.svelte';
	import { fetchWithAuth } from '$lib/services/authapi';

	// --- Component State using Svelte 5 Runes ---
	let users = $state<UserProfile[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	// NEW: State to hold the list of all available roles in the system
	let allSystemRoles = $state<Role[]>([]);

	// --- Data Fetching Effect (UPDATED) ---
	$effect(() => {
		async function loadData() {
			isLoading = true;
			error = null;
			try {
				// NEW: Use Promise.all to fetch users and all roles concurrently for better performance
				const [userList, allRolesList] = await Promise.all([
					fetchWithAuth<UserProfile[]>('/api/admin/users'),
					fetchWithAuth<Role[]>('/api/roles') // This endpoint should return all possible roles
				]);
				users = userList;
				allSystemRoles = allRolesList;
			} catch (e: any) {
				error = e.message;
			} finally {
				isLoading = false;
			}
		}
		loadData();
	});

	// --- Event Handler for Toggling User Status (no changes needed) ---
	async function toggleUserStatus(userToUpdate: UserProfile) {
		const userIndex = users.findIndex((u) => u.id === userToUpdate.id);
		if (userIndex === -1) return;
		const originalStatus = users[userIndex].is_active;
		const newStatus = !originalStatus;

		try {
			users[userIndex].is_active = newStatus; // Optimistic update
			const updatedUser = await fetchWithAuth<UserProfile>(`/api/admin/${userToUpdate.id}/status`, {
				method: 'PATCH',
				body: JSON.stringify({ is_active: newStatus })
			});
			users[userIndex] = updatedUser; // Sync with server response
		} catch (e: any) {
			users[userIndex].is_active = originalStatus; // Revert on error
			alert(`Failed to update user status: ${e.message}`);
		}
	}
</script>

<div class="mx-auto max-w-7xl p-4 md:p-6">
	<!-- Increased max-width for more space -->
	<h1 class="mb-6 text-center text-2xl font-bold text-gray-800 md:text-3xl">User Management</h1>

	{#if isLoading}
		<p class="py-8 text-center text-gray-500">Loading users...</p>
	{:else if error}
		<div class="rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
			<strong class="font-bold">Error:</strong>
			<span class="block sm:inline">{error}</span>
		</div>
	{:else}
		<div class="overflow-x-auto shadow-md sm:rounded-lg">
			<table class="min-w-full divide-y divide-gray-200 bg-white">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>ID</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Username</th
						>
						<!-- NEW: Added a new column for Roles -->
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Roles</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Status</th
						>
						<th
							class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Actions</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200">
					{#each users as user (user.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900"
								>{user.id}</td
							>
							<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-600">{user.username}</td>

							<!-- NEW: Added a new table cell to render the RoleManager component -->
							<td class="px-6 py-4 text-sm text-gray-600">
								{#if !user.is_guest}
									<RoleManager
										entityId={user.id}
										entityType={'user'}
										roles={user.roles}
										allRoles={allSystemRoles}
									/>
								{:else}
									<span class="text-xs text-gray-400 italic">N/A</span>
								{/if}
							</td>

							<td class="px-6 py-4 whitespace-nowrap">
								<span
									class="inline-flex rounded-full px-2 text-xs leading-5 font-semibold"
									class:bg-green-100={user.is_active}
									class:text-green-800={user.is_active}
									class:bg-red-100={!user.is_active}
									class:text-red-800={!user.is_active}
								>
									{user.is_active ? 'Active' : 'Banned'}
								</span>
							</td>
							<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
								{#if !user.is_guest}
									<button
										class="rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors"
										class:text-white={true}
										class:bg-red-600={user.is_active}
										class:hover:bg-red-700={user.is_active}
										class:bg-green-600={!user.is_active}
										class:hover:bg-green-700={!user.is_active}
										onclick={() => toggleUserStatus(user)}
									>
										{user.is_active ? 'Ban' : 'Unban'}
									</button>
								{:else}
									<span class="text-xs text-gray-400 italic">Guest User</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
