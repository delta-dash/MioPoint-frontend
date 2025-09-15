<!-- src/routes/admin/visibility/+page.svelte -->
<script lang="ts">
	import { fetchWithAuth } from '$lib/services/authapi';
	import Modal from '$lib/components/Modal.svelte';
	import { slide } from 'svelte/transition';
	import { untrack } from 'svelte';

	// --- Component State ---
	let allRoles: Role[] = $state([]);
	let allTags: TagItem[] = $state([]);
	let allMetaTags: TagItem[] = $state([]);
	let isLoading = $state({ initial: true, action: false });
	let feedback = $state<{ type: 'error' | 'success'; message: string } | null>(null);

	// --- Global Action State ---
	let globalSelectedRoleId: number | undefined = $state();

	// --- Tag Action State ---
	let tagActionType: 'tags' | 'meta_tags' = $state('tags');
	let tagBasedSelectedRoleId: number | undefined = $state();
	let selectedTagNames: string[] = $state([]);
	let tagSearchTerm = $state(''); // New: State for the tag search input

	// --- Modal State ---
	let isModalOpen = $state(false);
	let modalContent = $state({
		title: '',
		body: '',
		onConfirm: async () => {} // The action to run when confirmed
	});

	// --- Derived State ---
	const globalRole = $derived(allRoles.find((r) => r.id === globalSelectedRoleId));
	const tagBasedRole = $derived(allRoles.find((r) => r.id === tagBasedSelectedRoleId));
	// New: Derived state for filtered tags based on the search term
	const filteredTags = $derived(
		allTags.filter((tag) => tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()))
	);
	const filteredMetaTags = $derived(
		allMetaTags.filter((tag) => tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase()))
	);

	// --- Data Loading Effect ---
	$effect(() => {
		async function loadInitialData() {
			try {
				const [rolesRes, tagsRes, metaTagsRes] = await Promise.all([
					fetchWithAuth<Role[]>('/api/roles'),
					fetchWithAuth<TagItem[]>('/api/tags/tags'),
					fetchWithAuth<TagItem[]>('/api/tags/meta_tags')
				]);
				allRoles = rolesRes.sort((a, b) => a.name.localeCompare(b.name));
				allTags = tagsRes.sort((a, b) => a.name.localeCompare(b.name));
				allMetaTags = metaTagsRes.sort((a, b) => a.name.localeCompare(b.name));
			} catch (error) {
				setFeedback(
					'error',
					error instanceof Error ? error.message : 'Failed to load initial data.'
				);
			} finally {
				isLoading.initial = false;
			}
		}
		loadInitialData();
	});

	// --- UI Effects ---
	$effect(() => {
		// By reading tagActionType, this effect re-runs whenever it changes.
		tagActionType;
		// Reset selected tags and search when switching between 'tags' and 'meta_tags'
		untrack(() => {
			selectedTagNames = [];
			tagSearchTerm = '';
		});
	});

	// --- Helper Functions ---
	function setFeedback(type: 'error' | 'success', message: string, duration = 5000) {
		feedback = { type, message };
		setTimeout(() => {
			// Only clear the feedback if it hasn't been replaced by a newer one
			if (feedback?.message === message) {
				feedback = null;
			}
		}, duration);
	}

	function showConfirmation(title: string, body: string, confirmAction: () => Promise<void>) {
		modalContent = { title, body, onConfirm: confirmAction };
		isModalOpen = true;
	}

	async function handleConfirm() {
		if (isLoading.action) return;
		isLoading.action = true;
		try {
			await modalContent.onConfirm();
		} catch (error) {
			setFeedback('error', error instanceof Error ? error.message : 'An unknown error occurred.');
		} finally {
			isLoading.action = false;
			isModalOpen = false;
		}
	}

	// --- Action Preparers ---
	function prepareGlobalAdd() {
		if (!globalRole) return;
		showConfirmation(
			'Confirm Global Role Addition',
			`Are you sure you want to add the role "${globalRole.name}" to the visibility list of ALL files? This action affects every file in the system.`,
			async () => {
				await fetchWithAuth('/api/files/visibility/global', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },

					body: JSON.stringify({ role_id: globalRole.id })
				});
				setFeedback('success', `Successfully added role "${globalRole.name}" to all files.`);
			}
		);
	}

	function prepareGlobalRemove() {
		if (!globalRole) return;
		showConfirmation(
			'Confirm Global Role Removal',
			`Are you sure you want to remove the role "${globalRole.name}" from the visibility list of ALL files? This could restrict access for many users.`,
			async () => {
				await fetchWithAuth('/api/files/visibility/global', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },

					body: JSON.stringify({ role_id: globalRole.id })
				});
				setFeedback('success', `Successfully removed role "${globalRole.name}" from all files.`);
			}
		);
	}

	function prepareTagBasedAction(action: 'add' | 'remove') {
		if (!tagBasedRole || selectedTagNames.length === 0) return;

		const actionText = action === 'add' ? 'add' : 'remove';
		const method = action === 'add' ? 'POST' : 'DELETE';

		showConfirmation(
			`Confirm Tag-Based Role ${actionText === 'add' ? 'Addition' : 'Removal'}`,
			`Are you sure you want to ${actionText} the role "${tagBasedRole.name}" for all files tagged with: ${selectedTagNames.join(', ')}?`,
			async () => {
				await fetchWithAuth(`/api/files/visibility/by-tag`, {
					method,
					headers: { 'Content-Type': 'application/json' },

					body: JSON.stringify({
						role_id: tagBasedRole.id,
						tags: selectedTagNames,
						tag_type: tagActionType
					})
				});
				setFeedback(
					'success',
					`Successfully performed action for role "${tagBasedRole.name}" on ${selectedTagNames.length} tag(s).`
				);
				selectedTagNames = []; // Clear selection on success
			}
		);
	}
</script>

<svelte:head>
	<title>Bulk Visibility Management</title>
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
	<h1 class="mb-6 border-b pb-4 text-3xl font-bold text-gray-800">
		Bulk File Visibility Management
	</h1>

	{#if isLoading.initial}
		<div class="text-center text-gray-500">
			<p>Loading initial data...</p>
		</div>
	{:else}
		<!-- Global Actions Card -->
		<div class="mb-8 rounded-lg bg-white p-6 shadow-md">
			<h2 class="mb-4 border-b pb-3 text-xl font-semibold text-gray-700">Global Actions</h2>
			<p class="mb-4 text-sm text-gray-600">
				Apply or remove a role from <span class="font-bold">every file</span> in the system. Use with
				caution.
			</p>
			<div class="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
				<div class="md:col-span-1">
					<label for="global-role-select" class="block text-sm font-medium text-gray-700"
						>Select Role</label
					>
					<select
						id="global-role-select"
						bind:value={globalSelectedRoleId}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					>
						<option value={undefined}>-- Please select a role --</option>
						{#each allRoles as role (role.id)}
							<option value={role.id}>{role.name}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-wrap gap-4 md:col-span-2">
					<button
						onclick={prepareGlobalAdd}
						disabled={!globalSelectedRoleId || isLoading.action}
						class="flex-grow justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
					>
						Add to All Files
					</button>
					<button
						onclick={prepareGlobalRemove}
						disabled={!globalSelectedRoleId || isLoading.action}
						class="flex-grow justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
					>
						Remove from All Files
					</button>
				</div>
			</div>
		</div>

		<!-- Tag-Based Actions Card -->
		<div class="rounded-lg bg-white p-6 shadow-md">
			<h2 class="mb-4 border-b pb-3 text-xl font-semibold text-gray-700">Tag-Based Actions</h2>
			<p class="mb-4 text-sm text-gray-600">
				Apply or remove a role from all files that have a specific set of tags.
			</p>

			<!-- Tag Type Selector -->
			<div class="mb-4 flex border-b">
				<button
					onclick={() => (tagActionType = 'tags')}
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
					class:border-indigo-500={tagActionType === 'tags'}
					class:text-indigo-600={tagActionType === 'tags'}
					class:border-transparent={tagActionType !== 'tags'}
					class:text-gray-500={tagActionType !== 'tags'}
					class:hover:text-gray-700={tagActionType !== 'tags'}
					class:hover:border-gray-300={tagActionType !== 'tags'}
				>
					By Regular Tags
				</button>
				<button
					onclick={() => (tagActionType = 'meta_tags')}
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
					class:border-indigo-500={tagActionType === 'meta_tags'}
					class:text-indigo-600={tagActionType === 'meta_tags'}
					class:border-transparent={tagActionType !== 'meta_tags'}
					class:text-gray-500={tagActionType !== 'meta_tags'}
					class:hover:text-gray-700={tagActionType !== 'meta_tags'}
					class:hover:border-gray-300={tagActionType !== 'meta_tags'}
				>
					By Meta Tags
				</button>
			</div>

			<div class="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
				<!-- Tag Selector -->
				<div>
					<label class="mb-2 block text-sm font-medium text-gray-700">Select Tags</label>
					<!-- New: Search Input -->
					<input
						type="search"
						bind:value={tagSearchTerm}
						placeholder="Search tags..."
						class="mb-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					/>
					<div class="h-64 overflow-y-auto rounded-md border bg-gray-50 p-2">
						{#if tagActionType === 'tags'}
							<!-- Changed: Loop over filteredTags -->
							{#each filteredTags as tag (tag.id)}
								<label
									class="flex cursor-pointer items-center space-x-3 rounded p-1.5 hover:bg-gray-100"
								>
									<input
										type="checkbox"
										bind:group={selectedTagNames}
										value={tag.name}
										class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
									/>
									<span class="text-sm text-gray-800">{tag.name}</span>
								</label>
							{:else}
								<p class="p-2 text-sm text-gray-500">
									{#if allTags.length === 0}
										No regular tags found.
									{:else}
										No tags match your search.
									{/if}
								</p>
							{/each}
						{:else}
							<!-- Changed: Loop over filteredMetaTags -->
							{#each filteredMetaTags as tag (tag.id)}
								<label
									class="flex cursor-pointer items-center space-x-3 rounded p-1.5 hover:bg-gray-100"
								>
									<input
										type="checkbox"
										bind:group={selectedTagNames}
										value={tag.name}
										class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
									/>
									<span class="text-sm text-gray-800">{tag.name}</span>
								</label>
							{:else}
								<p class="p-2 text-sm text-gray-500">
									{#if allMetaTags.length === 0}
										No meta tags found.
									{:else}
										No tags match your search.
									{/if}
								</p>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Role and Actions -->
				<div class="space-y-4">
					<div>
						<label for="tag-role-select" class="block text-sm font-medium text-gray-700"
							>Select Role to Apply</label
						>
						<select
							id="tag-role-select"
							bind:value={tagBasedSelectedRoleId}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
						>
							<option value={undefined}>-- Please select a role --</option>
							{#each allRoles as role (role.id)}
								<option value={role.id}>{role.name}</option>
							{/each}
						</select>
					</div>
					<div class="border-t pt-4">
						<p class="mb-2 text-sm text-gray-600">
							Selected Tags:
							<span class="font-semibold text-gray-800"
								>{selectedTagNames.length > 0 ? selectedTagNames.join(', ') : 'None'}</span
							>
						</p>
						<div class="flex flex-wrap gap-4">
							<button
								onclick={() => prepareTagBasedAction('add')}
								disabled={!tagBasedSelectedRoleId ||
									selectedTagNames.length === 0 ||
									isLoading.action}
								class="flex-grow justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
							>
								Add Role
							</button>
							<button
								onclick={() => prepareTagBasedAction('remove')}
								disabled={!tagBasedSelectedRoleId ||
									selectedTagNames.length === 0 ||
									isLoading.action}
								class="flex-grow justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
							>
								Remove Role
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Feedback "Toast" Notification -->
{#if feedback}
	<div
		transition:slide={{ duration: 300 }}
		class="fixed right-4 bottom-4 z-50 max-w-sm rounded-lg p-4 text-sm font-medium shadow-lg"
		class:bg-red-100={feedback.type === 'error'}
		class:text-red-800={feedback.type === 'error'}
		class:border-red-300={feedback.type === 'error'}
		class:bg-green-100={feedback.type === 'success'}
		class:text-green-800={feedback.type === 'success'}
		class:border-green-300={feedback.type === 'success'}
		role="alert"
	>
		{feedback.message}
	</div>
{/if}

<!-- Confirmation Modal -->
<Modal open={isModalOpen} onClose={() => (isModalOpen = false)} title={modalContent.title}>
	{#snippet children()}
		<p class="text-sm text-gray-600">{modalContent.body}</p>
	{/snippet}
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (isModalOpen = false)}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
			>Cancel</button
		>
		<button
			type="button"
			onclick={handleConfirm}
			disabled={isLoading.action}
			class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{#if isLoading.action}
				Processing...
			{:else}
				Confirm
			{/if}
		</button>
	{/snippet}
</Modal>