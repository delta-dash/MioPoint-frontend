<!-- src/lib/components/RoleManager.svelte -->

<script lang="ts">
	// --- IMPORTS ---
	import { untrack } from 'svelte';
	import { user } from '$lib/userstore.js';
	import Modal from '$lib/components/Modal.svelte';
	import Portal from '$lib/components/Portal.svelte';
	import { fetchWithAuth } from '$lib/services/authapi';

	// --- Props ---
	const {
		roles,
		entityId,
		entityType,
		canRemove = true,
		canAdd = true,
		canEdit = true,
		allRoles
	}: {
		roles: Role[]; // UPDATED: Now expects an array of Role objects
		entityId: number;
		entityType: 'user' | 'file';
		canRemove?: boolean;
		canAdd?: boolean;
		canEdit?: boolean;
		allRoles?: Role[];
	} = $props();

	// --- State ---
	let localRoles = $state(roles);
	let isLoading = $state(false);
	let generalErrorMessage = $state('');
	let modalErrorMessage = $state('');
	let allSystemRoles = $state<Role[]>([]);
	let rolesLoading = $state(true);
	let searchTerm = $state('');
	let showRolePicker = $state(false);
	let showCreateModal = $state(false);
	let newRole = $state({ name: '', rank: 1000 });

	// --- State for Portal Positioning ---
	let triggerButtonEl: HTMLButtonElement | undefined = $state();
	let dropdownStyle = $state('');

	// --- Derived State ---
	const hasManageRolesPermission = $derived(
		($user?.permissions.some((p) => p.name === 'user:manage_roles') ?? false) ||
			($user?.permissions.some((p) => p.name === 'file:edit') ?? false)
	);

	const filteredRoles = $derived(() => {
		if (!searchTerm.trim()) return allSystemRoles;
		const lowerCaseSearch = searchTerm.toLowerCase();
		return allSystemRoles.filter((role) => role.name.toLowerCase().includes(lowerCaseSearch));
	});

	// --- Effects ---

	// Data Fetching
	$effect(() => {
		async function fetchAllRoles() {
			try {
				allSystemRoles = await fetchWithAuth('/api/roles');
			} catch (e) {
				console.error(e);
				generalErrorMessage = e instanceof Error ? e.message : 'Could not load roles.';
			} finally {
				rolesLoading = false;
			}
		}

		if (allRoles) {
			allSystemRoles = allRoles;
			rolesLoading = false;
		} else if (hasManageRolesPermission) {
			fetchAllRoles();
		} else {
			rolesLoading = false;
			allSystemRoles = [];
		}
	});

	// Sync localRoles if the parent prop changes
	$effect(() => {
		untrack(() => {
			localRoles = roles;
		});
	});

	// Dynamically position the portal
	$effect(() => {
		if (showRolePicker && triggerButtonEl) {
			const rect = triggerButtonEl.getBoundingClientRect();
			const top = rect.bottom + window.scrollY + 4;
			const left = rect.left + window.scrollX;
			const minWidth = rect.width;

			dropdownStyle = `position: absolute; top: ${top}px; left: ${left}px; min-width: ${minWidth}px; z-index: 50;`;

			const close = () => (showRolePicker = false);
			window.addEventListener('scroll', close, { capture: true, once: true });
			window.addEventListener('resize', close, { once: true });

			return () => {
				window.removeEventListener('scroll', close, { capture: true });
				window.removeEventListener('resize', close);
			};
		}
	});

	// --- Svelte Action for "Click Outside" ---
	function clickOutside(node: HTMLElement, callback: () => void) {
		const handleClick = (event: MouseEvent) => {
			if (node && !node.contains(event.target as Node)) callback();
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	// --- API Handlers ---

	// NEW: Centralized handler for updating file visibility roles (which requires a full list)
	async function updateFileRoles(newRoles: Role[]) {
		if (isLoading) return;
		isLoading = true;
		generalErrorMessage = '';
		const originalRoles = localRoles; // Store for rollback
		localRoles = newRoles; // Optimistic update

		const role_ids = newRoles.map((r) => r.id);

		try {
			await fetchWithAuth(`/api/file/${entityId}/visibility`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role_ids })
			});
			localRoles.sort((a, b) => a.name.localeCompare(b.name));
		} catch (error) {
			generalErrorMessage = error instanceof Error ? error.message : 'Could not update visibility.';
			localRoles = originalRoles; // Rollback on failure
		} finally {
			isLoading = false;
		}
	}

	async function assignRole(roleId: number, roleName: string) {
		showRolePicker = false;
		if (isLoading) return;

		// MODIFIED: Handle file role assignment
		if (entityType === 'file') {
			const newRole = allSystemRoles.find((r) => r.id === roleId);
			if (newRole && !localRoles.some((r) => r.id === newRole.id)) {
				const newRolesList = [...localRoles, newRole];
				await updateFileRoles(newRolesList);
			}
			return;
		}

		// --- User-specific logic remains ---
		isLoading = true;
		generalErrorMessage = '';
		try {
			await fetchWithAuth(`/api/role/add/${entityId}/${roleId}`, { method: 'POST' });
			const addedRole = allSystemRoles.find((r) => r.id === roleId);
			if (addedRole) {
				localRoles.push(addedRole);
				localRoles.sort((a, b) => a.name.localeCompare(b.name));
			}
		} catch (error) {
			generalErrorMessage = error instanceof Error ? error.message : 'Could not assign role.';
		} finally {
			isLoading = false;
		}
	}

	async function removeRole(roleToRemove: Role) {
		if (isLoading) return;

		// MODIFIED: Handle file role removal
		if (entityType === 'file') {
			const newRolesList = localRoles.filter((r) => r.id !== roleToRemove.id);
			await updateFileRoles(newRolesList);
			return;
		}

		// --- User-specific logic remains ---
		isLoading = true;
		generalErrorMessage = '';
		try {
			await fetchWithAuth(`/api/role/rmv/${entityId}/${roleToRemove.id}`, { method: 'DELETE' });
			localRoles = localRoles.filter((r) => r.id !== roleToRemove.id);
		} catch (error) {
			generalErrorMessage = error instanceof Error ? error.message : 'Could not remove role.';
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateAndAssignRole(event: Event) {
		event.preventDefault();
		if (!newRole.name.trim() || isLoading) return;
		isLoading = true;
		modalErrorMessage = '';
		try {
			const newRoleData: Role = await fetchWithAuth('/api/roles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newRole.name.trim(), rank: newRole.rank })
			});
			allSystemRoles.push(newRoleData);
			allSystemRoles.sort((a, b) => a.rank - b.rank);
			await assignRole(newRoleData.id, newRoleData.name); // This will delegate correctly
			showCreateModal = false;
			newRole = { name: '', rank: 1000 };
		} catch (error) {
			modalErrorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
		} finally {
			isLoading = false;
		}
	}

	function openCreateModal() {
		showRolePicker = false;
		showCreateModal = true;
		modalErrorMessage = '';
		newRole = { name: '', rank: 1000 };
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<!-- Display Existing Roles -->
	{#each localRoles as role (role.id)}
		<span
			class="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
		>
			{role.name}
			{#if hasManageRolesPermission}
				<!-- MODIFIED: Edit link only appears for users, not files -->
				{#if canEdit && entityType === 'user'}
					<a
						href={`/admin/roles?role=${encodeURIComponent(role.name)}`}
						aria-label="Edit role"
						class="text-blue-400 transition-colors hover:text-blue-600"
					>
						<svg
							class="h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							stroke-width="2"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"
							></path></svg
						>
					</a>
				{/if}
				{#if canRemove}
					<button
						onclick={() => removeRole(role)}
						disabled={isLoading}
						class="text-blue-400 transition-colors hover:text-red-500 disabled:opacity-50"
						aria-label="Remove role"
					>
						<svg
							class="h-3 w-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg
						>
					</button>
				{/if}
			{/if}
		</span>
	{/each}

	<!-- Add Role UI with Search Dropdown -->
	{#if canAdd && hasManageRolesPermission}
		<div class="relative">
			<button
				bind:this={triggerButtonEl}
				onclick={() => (showRolePicker = !showRolePicker)}
				disabled={isLoading}
				class="flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-600 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
					><path
						fill-rule="evenodd"
						d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
						clip-rule="evenodd"
					/></svg
				>
				Add Role
			</button>

			<!-- Dropdown wrapped in Portal for robust positioning -->
			{#if showRolePicker}
				<Portal>
					{#snippet children()}
						<div
							style={dropdownStyle}
							use:clickOutside={() => (showRolePicker = false)}
							class="ring-opacity-5 w-56 rounded-md bg-white shadow-lg ring-1 ring-black focus:outline-none"
							role="menu"
							aria-orientation="vertical"
						>
							<div class="p-2">
								<input
									type="text"
									bind:value={searchTerm}
									placeholder="Search roles..."
									class="w-full rounded-md border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
								/>
							</div>
							<ul class="max-h-48 overflow-y-auto">
								{#if rolesLoading}
									<li class="px-3 py-2 text-sm text-gray-500">Loading...</li>
								{:else}
									{#each filteredRoles() as role (role.id)}
										<li>
											<button
												onclick={() => assignRole(role.id, role.name)}
												class="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
											>
												{role.name}
											</button>
										</li>
									{:else}
										<li class="px-3 py-2 text-sm text-gray-500">No matching roles found.</li>
									{/each}
								{/if}
							</ul>
							<div class="border-t">
								<button
									onclick={openCreateModal}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-indigo-600 hover:bg-gray-100"
								>
									<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"
										><path
											d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"
										/></svg
									>
									Create New Role
								</button>
							</div>
						</div>
					{/snippet}
				</Portal>
			{/if}
		</div>
	{/if}
</div>

<!-- Display general error messages -->
{#if generalErrorMessage}
	<p class="mt-2 text-xs text-red-600">{generalErrorMessage}</p>
{/if}

<!-- MODAL for Creating a New Role -->
<Modal
	open={showCreateModal}
	onClose={() => (showCreateModal = false)}
	title="Create and Assign New Role"
>
	{#snippet children()}
		<form id="create-role-form" onsubmit={handleCreateAndAssignRole} class="space-y-4">
			<div>
				<label for="new-role-name" class="block text-sm font-medium text-gray-700"
					>New Role Name</label
				>
				<input
					id="new-role-name"
					type="text"
					bind:value={newRole.name}
					required
					placeholder="e.g., Editor"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="new-role-rank" class="block text-sm font-medium text-gray-700">Rank</label>
				<input
					id="new-role-rank"
					type="number"
					bind:value={newRole.rank}
					required
					min="0"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Lower numbers have higher priority (e.g., Admin is 0).
				</p>
			</div>
			{#if modalErrorMessage}
				<p class="rounded-md bg-red-50 p-3 text-sm text-red-600">{modalErrorMessage}</p>
			{/if}
		</form>
	{/snippet}

	{#snippet footer()}
		<button
			type="button"
			onclick={() => (showCreateModal = false)}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
			>Cancel</button
		>
		<button
			type="submit"
			form="create-role-form"
			disabled={isLoading || !newRole.name.trim()}
			class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{isLoading ? 'Processing...' : 'Create & Assign'}
		</button>
	{/snippet}
</Modal>