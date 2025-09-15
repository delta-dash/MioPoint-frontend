<script lang="ts">
	import { navigating } from '$app/state';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import Tabs from '$lib/components/Tabs.svelte';
	import EditTagModal from '$lib/components/Tag/EditTagModal.svelte';
	import * as api from '$lib/TagManager/tagapi.ts';
	import type { PageData } from './$types';

	// --- PROPS ---
	// Data is now passed directly from the `load` function.
	let { data }: { data: PageData } = $props();

	// --- LOCAL UI STATE ---
	let searchQuery = $state('');

	// --- MODAL STATE ---
	let isModalOpen = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	// We use a local state for the modal's tag to avoid directly mutating the `data` prop
	let tagForModal = $state(data.tagForModal);
	let isModalLoading = $state(false);
	let formError = $state<string | null>(null);

	// --- DERIVED STATE ---
	const filteredTags = $derived(
		(data.allTags || []).filter((tag) =>
			tag.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	interface Tab {
		id: string;
		label: string;
	}
	const TABS: Tab[] = [
		{ id: 'tags', label: 'Tags' },
		{ id: 'meta_tags', label: 'Meta Tags' }
	];

	// --- ASYNC OPERATIONS ---
	async function handleFormSubmit(payload: CreateTagPayload | EditTagPayload) {
		formError = null;
		try {
			if (modalMode === 'create') {
				await api.createTag(data.activeTabId, payload as CreateTagPayload);
			} else if (modalMode === 'edit' && tagForModal) {
				if (Object.keys(payload).length > 0) {
					await api.updateTag(data.activeTabId, tagForModal.id, payload as EditTagPayload);
				}
			}
			closeModal();
			// Invalidate tells SvelteKit to re-run the `load` function to get fresh data.
			// No manual fetching needed!
			goto(window.location.href, { invalidateAll: true });
		} catch (e: any) {
			formError = `Failed to save tag: ${e.message}`;
		}
	}

	// --- NAVIGATION & MODAL CONTROL ---

	function handleTabChange(id: string) {
		// Instead of fetching, we just navigate. SvelteKit's router and `load` function do the rest.
		goto(`?tab=${id}`, { keepFocus: true, noScroll: true });
	}

	function openCreateModal() {
		modalMode = 'create';
		tagForModal = null;
		isModalOpen = true;
		goto(`?tab=${data.activeTabId}`, { keepFocus: true, noScroll: true });
	}

	async function openEditModal(tag: TagItem) {
		// Navigate to update the URL. This will trigger the `load` function to re-run
		// and fetch the details for the modal.
		goto(`?tab=${data.activeTabId}&tag=${encodeURIComponent(tag.name)}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	function closeModal() {
		isModalOpen = false;
		// Navigate to clear the `?tag=` param from the URL.
		goto(`?tab=${data.activeTabId}`, { keepFocus: true, noScroll: true });
	}

	// --- EFFECTS ---
	// This effect syncs the modal's state with the data from the `load` function.
	// It runs whenever navigation happens (e.g., URL changes, back/forward button).
	$effect(() => {
		tagForModal = data.tagForModal;
		if (data.tagForModal) {
			modalMode = 'edit';
			isModalOpen = true;
			isModalLoading = false; // Data is already loaded
		} else {
			// If user is not actively creating, close the modal.
			if (modalMode !== 'create') {
				isModalOpen = false;
			}
		}
	});

	// A separate effect to show the modal is "loading" between navigation start and data arrival.
	$effect(() => {
		if (navigating && navigating.to?.url.searchParams.has('tag')) {
			isModalLoading = true;
			isModalOpen = true; // Open the modal shell immediately
		}
	});
</script>

<div class="min-h-screen bg-gray-900 p-4 font-sans text-gray-200 md:p-8">
	<main class="mx-auto max-w-7xl">
		<h1 class="mb-6 text-4xl font-bold text-white">Tag Management</h1>

		{#if data.error || formError}
			<div transition:slide class="mb-4 rounded-lg bg-red-800 p-4 text-red-100" role="alert">
				<p><strong class="font-bold">Error:</strong> {data.error || formError}</p>
			</div>
		{/if}

		<div class="rounded-lg bg-gray-800 p-4 shadow-xl md:p-6">
			<!-- Controls Header -->
			<div class="mb-4 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search tags..."
					class="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none md:w-auto md:flex-grow"
				/>
				<button
					onclick={openCreateModal}
					class="flex-shrink-0 rounded-lg bg-green-600 px-4 py-2 font-bold text-white transition-colors hover:bg-green-700"
				>
					Create New Tag
				</button>
			</div>

			<!-- Tabs & Grid -->
			<Tabs tabs={TABS} activeTabId={data.activeTabId} onTabChange={handleTabChange}>
				{#snippet content(id)}
					<div class="mt-4">
						{#if !data.allTags && !data.error}
							<p class="py-16 text-center text-gray-400">Loading tags...</p>
						{:else if filteredTags.length > 0}
							<div
								class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
							>
								{#each filteredTags as tag (tag.id)}
									<div
										class="flex items-center justify-between rounded-lg bg-gray-700/50 p-3 shadow transition-colors hover:bg-gray-700"
									>
										<span class="truncate font-medium" title={tag.name}>{tag.name}</span>
										<button
											onclick={() => openEditModal(tag)}
											class="flex-shrink-0 rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
											aria-label="Edit {tag.name}"
										>
											Edit
										</button>
									</div>
								{/each}
							</div>
						{:else if searchQuery}
							<p class="py-16 text-center text-gray-400">
								No tags found for "{searchQuery}".
							</p>
						{:else}
							<p class="py-16 text-center text-gray-400">No tags in this category.</p>
						{/if}
					</div>
				{/snippet}
			</Tabs>
		</div>
	</main>

	<!-- Modal for Creating and Editing Tags -->
	<EditTagModal
		bind:open={isModalOpen}
		mode={modalMode}
		tag={tagForModal}
		loading={isModalLoading}
		onsubmit={handleFormSubmit}
		oncancel={closeModal}
	/>
</div>