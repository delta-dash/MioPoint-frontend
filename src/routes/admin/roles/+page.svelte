<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import Modal from '$lib/components/Modal.svelte';

	// --- PROPS ---
	const {
		data
	}: {
		data: { allRoles: Role[]; initialRoleId: number | null; allPermissions: RolePermissions[] };
	} = $props();

	// --- STATE MANAGEMENT (Svelte 5 Runes) ---

	// State for the main editor
	// *** THIS IS THE FIX ***
	// Initialize the state directly from the data provided by the `load` function.
	let selectedRoleId = $state<number | null>(data.initialRoleId);
	let selectedRole = $state<RoleDetail | null>(null);
	let loadingState = $state({
		permissions: false,
		details: false
	});
	let errorState = $state({
		permissions: null as string | null,
		details: null as string | null,
		save: null as string | null
	});
	let isSaving = $state(false);

	// State for the "Create Role" modal
	let showCreateModal = $state(false);
	let isCreating = $state(false);
	let createError = $state<string | null>(null);
	let newRole = $state({
		name: '',
		rank: 1000
	});

	// State for the "Delete Role" modal
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	// --- LOGIC / FUNCTIONS ---

	// Function to handle selecting a role
	function selectRole(role: { id: number; name: string }) {
		selectedRoleId = role.id;
		goto(`?role=${encodeURIComponent(role.name)}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	// Effect to synchronize state FROM the URL for back/forward navigation
	// On initial load, this will just re-affirm the state we already set from props, which is harmless.
	$effect(() => {
		const roleNameFromUrl = $page.url.searchParams.get('role');
		if (roleNameFromUrl) {
			const role = data.allRoles.find((r) => r.name === roleNameFromUrl);
			if (role && role.id !== selectedRoleId) {
				selectedRoleId = role.id;
			} else if (!role) {
				selectedRoleId = null;
				goto('?', { replaceState: true });
			}
		} else {
			// If user navigates to the page without a query param, reset to the default
			if (selectedRoleId !== data.initialRoleId) {
				selectedRoleId = data.initialRoleId;
			}
		}
	});

	// Reactively fetch role details when a new role is selected
	$effect(() => {
		const id = selectedRoleId;
		if (id === null) {
			selectedRole = null;
			return;
		}
		async function fetchRoleDetails(roleId: number) {
			loadingState.details = true;
			errorState.details = null;
			selectedRole = null;
			try {
				const response = await fetch(`/api/roles/${roleId}`);
				if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
				selectedRole = await response.json();
			} catch (e: any) {
				errorState.details = e.message;
			} finally {
				loadingState.details = false;
			}
		}
		fetchRoleDetails(id);
	});

	// A derived Set for efficient O(1) lookups for the permission checkboxes
	const selectedRolePermissionIds = $derived(
		new Set(selectedRole?.permissions.map((p) => p.id) ?? [])
	);

	// Toggles a permission on the local state for the selected role
	function handlePermissionToggle(permission: RolePermissions, checked: boolean) {
		if (!selectedRole) return;
		if (checked) {
			selectedRole.permissions.push(permission);
		} else {
			selectedRole.permissions = selectedRole.permissions.filter((p) => p.id !== permission.id);
		}
	}

	// Handles creating a new role via the modal form
	async function handleCreateRole(e: SubmitEvent) {
		e.preventDefault();
		isCreating = true;
		createError = null;
		try {
			const response = await fetch('/api/roles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newRole.name, rank: newRole.rank })
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.detail || 'Failed to create role.');
			}
			const createdRole = await response.json();
			showCreateModal = false;
			newRole = { name: '', rank: 1000 };
			await invalidateAll();
			selectRole(createdRole);
		} catch (e: any) {
			createError = e.message;
		} finally {
			isCreating = false;
		}
	}

	// Handles saving edits to the currently selected role
	async function handleSave(e: SubmitEvent) {
		e.preventDefault();
		if (!selectedRole) return;
		isSaving = true;
		errorState.save = null;
		try {
			const payload = {
				new_name: selectedRole.name,
				new_rank: selectedRole.rank,
				permissions_to_set: selectedRole.permissions.map((p) => p.id)
			};
			const response = await fetch(`/api/roles/${selectedRole.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.detail || 'Failed to save changes.');
			}
			await invalidateAll();
			goto(`?role=${encodeURIComponent(selectedRole.name)}`, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		} catch (e: any) {
			errorState.save = e.message;
		} finally {
			isSaving = false;
		}
	}

	// Handles deleting the currently selected role after confirmation
	async function handleDeleteRole() {
		if (!selectedRole) return;
		isDeleting = true;
		deleteError = null;
		try {
			const response = await fetch(`/api/roles/${selectedRole.id}`, {
				method: 'DELETE'
			});
			if (!response.ok && response.status !== 204) {
				const errorData = await response.json();
				throw new Error(errorData.detail || 'Failed to delete role.');
			}
			showDeleteModal = false;
			// Navigate to the base URL. This will cause the load function to re-run
			// with no `?role` parameter, and the component will re-initialize
			// with the fresh data from the new `data` prop.
			await goto('?', { replaceState: true, keepFocus: true, noScroll: true });
		} catch (e: any) {
			deleteError = e.message;
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>Role Management</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 p-4 md:p-8">
	<div class="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[350px_1fr]">
		<!-- Roles List Panel -->
		<aside class="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="mb-4 text-xl font-bold text-gray-800">Roles</h2>

			{#if data.allRoles.length > 0}
				<ul class="flex-grow space-y-2">
					{#each data.allRoles as role (role.id)}
						<li>
							<button
								onclick={() => selectRole(role)}
								class="w-full rounded-md border p-3 text-left transition-colors"
								class:bg-blue-600={role.id === selectedRoleId}
								class:text-white={role.id === selectedRoleId}
								class:border-blue-600={role.id === selectedRoleId}
								class:hover:bg-gray-100={role.id !== selectedRoleId}
								class:border-gray-300={role.id !== selectedRoleId}
							>
								<span class="font-semibold">{role.name}</span>
								<span class="ml-2 text-sm opacity-80">(Rank: {role.rank})</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="flex-grow text-gray-500">No roles found.</p>
			{/if}

			<div class="mt-4 border-t pt-4">
				<button
					onclick={() => (showCreateModal = true)}
					class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					+ Create New Role
				</button>
			</div>
		</aside>

		<!-- Main Editor Panel -->
		<main class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			{#if !selectedRoleId}
				<div class="flex h-full items-center justify-center">
					<h2 class="text-2xl text-gray-400">Select a role to begin editing</h2>
				</div>
			{:else if loadingState.details}
				<div class="flex h-full items-center justify-center">
					<p class="text-gray-500">Loading role details...</p>
				</div>
			{:else if errorState.details}
				<div class="flex h-full items-center justify-center">
					<p class="text-red-600">{errorState.details}</p>
				</div>
			{:else if selectedRole}
				<form onsubmit={handleSave} class="flex h-full flex-col">
					<div class="flex-grow space-y-6">
						<h2 class="text-2xl font-bold text-gray-800">
							Editing: <span class="text-blue-600">{selectedRole.name}</span>
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<div>
								<label for="role-name" class="block text-sm font-medium text-gray-700"
									>Role Name</label
								>
								<input
									id="role-name"
									type="text"
									bind:value={selectedRole.name}
									required
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label for="role-rank" class="block text-sm font-medium text-gray-700">Rank</label>
								<input
									id="role-rank"
									type="number"
									bind:value={selectedRole.rank}
									required
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								/>
							</div>
						</div>
						<hr />
						<div>
							<h3 class="text-lg font-semibold text-gray-800">Permissions</h3>
							{#if loadingState.permissions}
								<p class="mt-2 text-gray-500">Loading permissions...</p>
							{:else if errorState.permissions}
								<p class="mt-2 rounded-md bg-red-100 p-2 text-red-700">
									Error: {errorState.permissions}
								</p>
							{:else}
								<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
									{#each data.allPermissions as permission (permission.id)}
										<label
											class="flex cursor-pointer flex-col rounded-lg border p-4 transition-colors"
											class:border-blue-500={selectedRolePermissionIds.has(permission.id)}
											class:bg-blue-50={selectedRolePermissionIds.has(permission.id)}
											class:border-gray-300={!selectedRolePermissionIds.has(permission.id)}
											class:hover:bg-gray-50={!selectedRolePermissionIds.has(permission.id)}
										>
											<div class="flex items-center">
												<input
													type="checkbox"
													class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
													checked={selectedRolePermissionIds.has(permission.id)}
													onchange={(e) =>
														handlePermissionToggle(permission, e.currentTarget.checked)}
												/>
												<span class="ml-3 font-medium text-gray-800">{permission.name}</span>
											</div>
											{#if permission.description}
												<small class="mt-1 text-gray-500">{permission.description}</small>
											{/if}
										</label>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<div class="mt-auto flex items-center justify-between gap-4 pt-6">
						<button
							type="button"
							onclick={() => (showDeleteModal = true)}
							class="inline-flex justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
						>
							Delete Role
						</button>
						<div class="flex items-center gap-4">
							{#if errorState.save}
								<p class="text-sm text-red-600">{errorState.save}</p>
							{/if}
							<button
								type="submit"
								disabled={isSaving}
								class="inline-flex justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
							>
								{isSaving ? 'Saving...' : 'Save Changes'}
							</button>
						</div>
					</div>
				</form>
			{/if}
		</main>
	</div>
</div>

<!-- --- MODALS --- -->

<!-- Create Role Modal -->
<Modal open={showCreateModal} onClose={() => (showCreateModal = false)} title="Create New Role">
	{#snippet children()}
		<form id="create-role-form" onsubmit={handleCreateRole} class="space-y-4">
			<div>
				<label for="new-role-name" class="block text-sm font-medium text-gray-700">Role Name</label>
				<input
					id="new-role-name"
					type="text"
					bind:value={newRole.name}
					required
					placeholder="e.g., Moderator"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-500">Lower numbers have higher priority. Admin is 0.</p>
			</div>
			{#if createError}
				<p class="rounded-md bg-red-50 p-3 text-sm text-red-600">{createError}</p>
			{/if}
		</form>
	{/snippet}
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (showCreateModal = false)}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
		>
			Cancel
		</button>
		<button
			type="submit"
			form="create-role-form"
			disabled={isCreating}
			class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{isCreating ? 'Creating...' : 'Create Role'}
		</button>
	{/snippet}
</Modal>

<!-- Delete Role Confirmation Modal -->
<Modal open={showDeleteModal} onClose={() => (showDeleteModal = false)} title="Confirm Deletion">
	{#snippet children()}
		<p class="text-gray-600">
			Are you sure you want to permanently delete the role
			<strong class="text-gray-900">"{selectedRole?.name}"</strong>?
		</p>
		<p class="mt-2 text-sm text-gray-500">This action cannot be undone.</p>
		{#if deleteError}
			<p class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{deleteError}</p>
		{/if}
	{/snippet}
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (showDeleteModal = false)}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={handleDeleteRole}
			disabled={isDeleting}
			class="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{isDeleting ? 'Deleting...' : 'Confirm Delete'}
		</button>
	{/snippet}
</Modal>
