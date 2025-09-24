<script lang="ts">
	import { untrack } from 'svelte';
	import { user } from '$lib/userstore.ts';
	import Modal from '$lib/components/Modal.svelte';
	import { fetchWithAuth } from '$lib/services/authapi';
	import Portal from '$lib/components/Portal.svelte';

	// --- Type Definitions ---
	type TagType = 'tags' | 'meta_tags';

	// --- Props ---
	const {
		tags,
		metaTags, // NEW PROP
		fileId,
		allSystemTags: preloadedTags, // Renamed for clarity
		allSystemMetaTags: preloadedMetaTags // NEW PROP
	}: {
		tags: TagItem[];
		metaTags: TagItem[]; // NEW
		fileId: string | number;
		allSystemTags?: TagItem[]; // Optional pre-fetched list
		allSystemMetaTags?: TagItem[]; // Optional pre-fetched list
	} = $props();

	// --- Permissions ---
	const hasTagEditPermission = $derived(
		$user?.permissions.some((p) => p.name === 'tag:edit') ?? false
	);

	// --- State (now duplicated for both types) ---
	let localTags = $state(tags);
	let localMetaTags = $state(metaTags);

	let isLoading = $state(false);
	let generalErrorMessage = $state('');
	let modalErrorMessage = $state('');

	// System-wide tag lists
	let allSystemTags = $state<TagItem[]>([]);
	let allSystemMetaTags = $state<TagItem[]>([]);
	let tagsLoading = $state(true);

	// UI State
	let tagSearchTerm = $state('');
	let metaTagSearchTerm = $state('');
	let showTagPicker = $state(false);
	let showMetaTagPicker = $state(false);

	// Shared Modal State
	let showCreateModal = $state(false);
	let newTag = $state({ name: '' });
	let tagTypeForCreation = $state<TagType>('tags');

	// Positioning for portal-based pickers
	let pickerStyle = $state('');
	let tagTriggerBtn: HTMLButtonElement;
	let metaTagTriggerBtn: HTMLButtonElement;

	// --- Derived State (now one for each type) ---
	const filteredSystemTags = $derived(() => {
		if (!tagSearchTerm.trim()) return allSystemTags;
		const lowerCaseSearch = tagSearchTerm.toLowerCase();
		return allSystemTags.filter((tag) => tag.name.toLowerCase().includes(lowerCaseSearch));
	});

	const filteredSystemMetaTags = $derived(() => {
		if (!metaTagSearchTerm.trim()) return allSystemMetaTags;
		const lowerCaseSearch = metaTagSearchTerm.toLowerCase();
		return allSystemMetaTags.filter((tag) => tag.name.toLowerCase().includes(lowerCaseSearch));
	});

	// --- Data Fetching (now fetches both types) ---
	$effect(() => {
		async function fetchAllSystemItems(type: TagType, preloaded?: TagItem[]) {
			if (preloaded) {
				return preloaded;
			}
			if (hasTagEditPermission) {
				try {
					return await fetchWithAuth<TagItem[]>(`/api/tags/${type}`);
				} catch (e) {
					console.error(`Could not load ${type}:`, e);
					generalErrorMessage = e instanceof Error ? e.message : `Could not load ${type}.`;
					return [];
				}
			}
			return [];
		}

		async function loadAll() {
			tagsLoading = true;
			const [tagsResult, metaTagsResult] = await Promise.all([
				fetchAllSystemItems('tags', preloadedTags),
				fetchAllSystemItems('meta_tags', preloadedMetaTags)
			]);
			allSystemTags = tagsResult;
			allSystemMetaTags = metaTagsResult;
			tagsLoading = false;
		}

		loadAll();
	});

	// Sync local state if parent props change. This ensures that when navigating
	// between files in the modal, the TagManager displays the tags for the new file.
	$effect(() => {
		localTags = tags;
	});
	$effect(() => {
		localMetaTags = metaTags;
	});

	// --- Svelte Action for "Click Outside" ---
	function clickOutside(
		node: HTMLElement,
		options: { callback: () => void; ignore?: HTMLElement }
	) {
		const { callback, ignore } = options;
		const handleClick = (event: MouseEvent) => {
			const target = event.target as Node;
			if (node && !node.contains(target) && (!ignore || !ignore.contains(target))) {
				callback();
			}
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	// --- GENERALIZED API Handlers ---

	/** Core logic to assign an item. Throws on error. Does not manage loading state. */
	async function _performAssignItem(itemToAssign: TagItem, itemType: TagType) {
		const localList = itemType === 'tags' ? localTags : localMetaTags;
		if (localList.some((t) => t.id === itemToAssign.id)) {
			throw new Error(`"${itemToAssign.name}" is already assigned.`);
		}

		await fetchWithAuth(`/api/tags/${itemType}/instance/${fileId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tags: [itemToAssign.id] })
		});

		// Optimistically update UI
		localList.push(itemToAssign);
		localList.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** UI handler for assigning an existing item from a picker. Manages its own loading state. */
	async function assignItem(itemToAssign: TagItem, itemType: TagType) {
		if (isLoading) return;
		isLoading = true;
		generalErrorMessage = '';
		try {
			await _performAssignItem(itemToAssign, itemType);
		} catch (error) {
			generalErrorMessage =
				error instanceof Error ? error.message : `Could not assign ${itemToAssign.name}.`;
		} finally {
			isLoading = false;
			if (itemType === 'tags') showTagPicker = false;
			else showMetaTagPicker = false;
		}
	}

	async function removeItem(itemToRemove: TagItem, itemType: TagType) {
		if (isLoading) return;
		isLoading = true;
		generalErrorMessage = '';
		try {
			await fetchWithAuth(`/api/tags/${itemType}/instance/${fileId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tags: [itemToRemove.id] })
			});

			if (itemType === 'tags') {
				localTags = localTags.filter((t) => t.id !== itemToRemove.id);
			} else {
				localMetaTags = localMetaTags.filter((t) => t.id !== itemToRemove.id);
			}
		} catch (error) {
			generalErrorMessage =
				error instanceof Error ? error.message : `Could not remove ${itemType}.`;
		} finally {
			isLoading = false;
		}
	}

	/** UI handler for the "Create & Assign" modal. Manages its own loading state. */
	async function handleCreateAndAssignItem(event: Event) {
		event.preventDefault();
		const trimmedName = newTag.name.trim();
		if (!trimmedName || isLoading) return;
		isLoading = true;
		modalErrorMessage = '';
		try {
			// Step 1: Create the new tag
			const newItemData: TagItem = await fetchWithAuth(`/api/tags/${tagTypeForCreation}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmedName })
			});

			const systemList = tagTypeForCreation === 'tags' ? allSystemTags : allSystemMetaTags;
			systemList.push(newItemData);
			systemList.sort((a, b) => a.name.localeCompare(b.name));

			// Step 2: Assign the newly created tag
			await _performAssignItem(newItemData, tagTypeForCreation);

			showCreateModal = false;
			newTag = { name: '' };
		} catch (error) {
			modalErrorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
		} finally {
			isLoading = false;
		}
	}

	function openCreateModal(itemType: TagType) {
		tagTypeForCreation = itemType;
		showTagPicker = false;
		showMetaTagPicker = false;
		showCreateModal = true;
		modalErrorMessage = '';
		newTag = { name: '' };
	}

	// --- UI Handlers for Pickers ---

	function calculatePickerPosition(triggerElement: HTMLButtonElement): string {
		const rect = triggerElement.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		// Estimate max dropdown height in pixels.
		// max-h-48 (192px) + search bar (~40px) + create button (~35px) = ~270px.
		const estimatedDropdownHeight = 280;
		// w-56 is 14rem = 224px.
		const dropdownWidth = 224;

		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;

		let topStyle = `top: ${rect.bottom + 4}px;`;

		// If not enough space below, and more space above, render it upwards.
		if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
			// Position the bottom of the dropdown just above the button
			topStyle = `bottom: ${viewportHeight - rect.top + 4}px;`;
		}

		let leftStyle = `left: ${rect.left}px;`;
		// If it overflows on the right, align it to the right edge of the screen.
		if (rect.left + dropdownWidth > viewportWidth) {
			leftStyle = `right: 8px; left: auto;`; // 8px padding from the edge
		}

		return `position: fixed; ${topStyle} ${leftStyle} z-index: 50;`;
	}

	function toggleTagPicker(event: MouseEvent) {
		if (showTagPicker) {
			showTagPicker = false;
			return;
		}
		const button = event.currentTarget as HTMLButtonElement;
		pickerStyle = calculatePickerPosition(button);
		showTagPicker = true;
		showMetaTagPicker = false; // Close other picker
	}

	function toggleMetaTagPicker(event: MouseEvent) {
		if (showMetaTagPicker) {
			showMetaTagPicker = false;
			return;
		}
		const button = event.currentTarget as HTMLButtonElement;
		pickerStyle = calculatePickerPosition(button);
		showMetaTagPicker = true;
		showTagPicker = false; // Close other picker
	}

	// --- Helpers ---
	function capitalizeWords(str: string): string {
		return str
			.split(/\s+/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
</script>

<div class="space-y-4">
	<!-- =================== TAGS SECTION =================== -->
	<div>
		<h4 class="mb-2 text-sm font-semibold text-gray-600">Tags</h4>
		<div class="flex flex-wrap items-center gap-2">
			{#each localTags as tag (tag.id)}
				<span
					class="flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800"
				>
					{capitalizeWords(tag.name)}
					{#if hasTagEditPermission}
						<button
							onclick={() => removeItem(tag, 'tags')}
							disabled={isLoading}
							class="text-indigo-400 transition-colors hover:text-red-500 disabled:opacity-50"
							aria-label="Remove tag: {tag.name}"
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
				</span>
			{/each}

			{#if hasTagEditPermission}
				<div>
					<button
						bind:this={tagTriggerBtn}
						onclick={toggleTagPicker}
						disabled={isLoading}
						class="flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-600 hover:text-gray-800 disabled:opacity-50"
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
							><path
								fill-rule="evenodd"
								d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
								clip-rule="evenodd"
							/></svg
						>
						Add Tag
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if showTagPicker}
		<Portal>
			<div
				style={pickerStyle}
				use:clickOutside={{ callback: () => (showTagPicker = false), ignore: tagTriggerBtn }}
				class="ring-opacity-5 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black focus:outline-none"
			>
				<div class="p-2">
					<input
						type="text"
						bind:value={tagSearchTerm}
						placeholder="Search tags..."
						class="w-full rounded-md border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<ul class="max-h-48 overflow-y-auto">
					{#if tagsLoading}<li class="px-3 py-2 text-sm text-gray-500">Loading...</li>
					{:else}
						{#each filteredSystemTags() as tag (tag.id)}
							<li>
								<button
									onclick={() => assignItem(tag, 'tags')}
									class="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
									>{capitalizeWords(tag.name)}</button
								>
							</li>
						{:else}<li class="px-3 py-2 text-sm text-gray-500">No matching tags found.</li>{/each}
					{/if}
				</ul>
				<div class="border-t">
					<button
						onclick={() => openCreateModal('tags')}
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-indigo-600 hover:bg-gray-100"
						><svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"
							><path
								d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"
							/></svg
						>Create New Tag</button
					>
				</div>
			</div>
		</Portal>
	{/if}

	<!-- =================== META TAGS SECTION =================== -->
	<div>
		<h4 class="mb-2 text-sm font-semibold text-gray-600">Meta Tags</h4>
		<div class="flex flex-wrap items-center gap-2">
			{#each localMetaTags as tag (tag.id)}
				<span
					class="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800"
				>
					{capitalizeWords(tag.name)}
					{#if hasTagEditPermission}
						<button
							onclick={() => removeItem(tag, 'meta_tags')}
							disabled={isLoading}
							class="text-green-400 transition-colors hover:text-red-500 disabled:opacity-50"
							aria-label="Remove meta tag: {tag.name}"
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
				</span>
			{/each}

			{#if hasTagEditPermission}
				<div>
					<button
						bind:this={metaTagTriggerBtn}
						onclick={toggleMetaTagPicker}
						disabled={isLoading}
						class="flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-600 hover:text-gray-800 disabled:opacity-50"
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"
							><path
								fill-rule="evenodd"
								d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
								clip-rule="evenodd"
							/></svg
						>
						Add Meta Tag
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

{#if showMetaTagPicker}
	<Portal>
		<div
			style={pickerStyle}
			use:clickOutside={{ callback: () => (showMetaTagPicker = false), ignore: metaTagTriggerBtn }}
			class="ring-opacity-5 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black focus:outline-none"
		>
			<div class="p-2">
				<input
					type="text"
					bind:value={metaTagSearchTerm}
					placeholder="Search meta tags..."
					class="w-full rounded-md border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-green-500 focus:ring-green-500"
				/>
			</div>
			<ul class="max-h-48 overflow-y-auto">
				{#if tagsLoading}<li class="px-3 py-2 text-sm text-gray-500">Loading...</li>
				{:else}
					{#each filteredSystemMetaTags() as tag (tag.id)}
						<li>
							<button
								onclick={() => assignItem(tag, 'meta_tags')}
								class="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
								>{capitalizeWords(tag.name)}</button
							>
						</li>
					{:else}<li class="px-3 py-2 text-sm text-gray-500">No matching meta tags.</li>{/each}
				{/if}
			</ul>
			<div class="border-t">
				<button
					onclick={() => openCreateModal('meta_tags')}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-green-600 hover:bg-gray-100"
					><svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"
						><path
							d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"
						/></svg
					>Create New Meta Tag</button
				>
			</div>
		</div>
	</Portal>
{/if}

<!-- Display general error messages -->
{#if generalErrorMessage}
	<p class="mt-2 text-xs text-red-600">{generalErrorMessage}</p>
{/if}

<!-- SHARED MODAL for Creating a New Tag / Meta Tag -->
{#if showCreateModal}
	<Modal
		open={showCreateModal}
		onClose={() => (showCreateModal = false)}
		title="Create and Assign New {tagTypeForCreation === 'tags' ? 'Tag' : 'Meta Tag'}"
	>
		{#snippet children()}
			<form id="create-item-form" onsubmit={handleCreateAndAssignItem} class="space-y-4">
				<div>
					<label for="new-item-name" class="block text-sm font-medium text-gray-700">New Name</label
					>
					<input
						id="new-item-name"
						type="text"
						bind:value={newTag.name}
						required
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				{#if modalErrorMessage}<p class="rounded-md bg-red-50 p-3 text-sm text-red-600">
						{modalErrorMessage}
					</p>{/if}
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
				form="create-item-form"
				disabled={isLoading || !newTag.name.trim()}
				class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:bg-gray-400"
			>
				{isLoading ? 'Processing...' : 'Create & Assign'}
			</button>
		{/snippet}
	</Modal>
{/if}
