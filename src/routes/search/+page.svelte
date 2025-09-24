<!-- src/routes/search/+page.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import Search from '$lib/components/Search.svelte';
	import Card from '$lib/components/Card.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import ReverseImageSearch from '$lib/components/ReverseImageSearch.svelte';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import type { Tab } from '$lib/components/Tabs.svelte';

	// 1. IMPORT the centralized store.
	import { searchFiles , searchStore} from '$lib/searchStore';

	// The `data` prop is passed from the `load` function in `+page.ts`.
	const { data } = $props();

	// 2. INITIALIZE the store with the page's URL.
	// This syncs the store's state with what the server rendered or the current URL.
	// This should only happen once when the component is created.
	searchStore.initialize(page.url);

	// --- LOCAL DISPLAY STATE ---
	// This state is for *displaying* the results, not for the search query itself.
	let items = $state(data.initialResults.items);
	let folders = $state(data.initialResults.folders);
	let nextCursor = $state(data.initialResults.next_cursor);
	let isLoadingMore = $state(false);

	let activeTabId = $state('media');
	const TABS: Tab[] = [
		{ id: 'media', label: 'Media Search' },
		{ id: 'image', label: 'Image Search' }
	];

	// --- REACTIVE DATA SYNC ---
	// This effect is the crucial link. When the `searchStore` updates the URL,
	// the `load` function re-runs, a new `data` object arrives, and this effect
	// updates our local display state to match.
	$effect(() => {
		items = data.initialResults.items;
		folders = data.initialResults.folders;
		nextCursor = data.initialResults.next_cursor;
	});

	// --- USER ACTIONS ---

	// The `handleSearch` function is no longer needed here!
	// The Search component interacts directly with the searchStore.

	/** Fetches the next page of results for the current query. */
	async function loadMore() {
		if (!nextCursor || isLoadingMore) return;
		isLoadingMore = true;

		try {
			// Use the query from the current page data for consistency.
			const query = data.query;
			const newResults = await searchFiles({ ...query, cursor: nextCursor });

			items = [...items, ...newResults.items];
			// Folders are typically only on the first page, so we don't append.
			nextCursor = newResults.next_cursor;
		} catch (error) {
			console.error('Failed to load more results:', error);
		} finally {
			isLoadingMore = false;
		}
	}
</script>




<div class="container mx-auto p-4 md:p-8">
	<h1 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white">Search</h1>
	<p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
		Find files by text, filters, or by uploading a similar image.
	</p>

	<Tabs tabs={TABS} {activeTabId} onTabChange={(id) => (activeTabId = id)}>
		{#snippet content(id)}
			{#if id === 'media'}
				<div class="pt-8">
					<div class="sticky top-4 z-30 mb-8">
						<!-- 3. SIMPLIFIED: The Search component no longer needs any props. -->
						<Search />
					</div>

					<!-- Folder Grid -->
					{#if folders && folders.length > 0}
						<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">Folders</h2>
						<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
							{#each folders as folder (folder.id)}
								<a
									href={`/search?folder_id=${folder.id}&mode=directory`}
									class="flex flex-col items-center gap-2 rounded-lg p-4 text-center text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
								>
									<svg
										class="h-16 w-16 text-yellow-500"
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="currentColor"
									>
										<path
											d="M4 4C4 3.44772 4.44772 3 5 3H9.58579C9.851 3 10.1054 3.10536 10.2929 3.29289L12 5H19C19.5523 5 20 5.44772 20 6V18C20 18.5523 19.5523 19 19 19H5C4.44772 19 4 18.5523 4 18V4Z"
										/>
									</svg>
									<span class="font-medium break-all">{folder.name}</span>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Results Section -->
					{#if items.length > 0}
						<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">Files</h2>
						<MasonryGrid {items} gap={24} minColumnWidth={280}>
							{#snippet item(cardItem)}
								<Card {...cardItem} />
							{/snippet}
						</MasonryGrid>
					{:else if folders && folders.length > 0}
						<div
							class="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-600"
						>
							<h3 class="text-xl font-semibold">No Files Here</h3>
							<p class="mt-2">This folder is empty. Select a subfolder to continue browsing.</p>
						</div>
					{:else if !isLoadingMore}
						<!-- This message now correctly shows when the load function returns no results -->
						<div
							class="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-600"
						>
							<h3 class="text-xl font-semibold">No Results Found</h3>
							<p class="mt-2">Try adjusting your search terms or filters.</p>
						</div>
					{/if}

					<!-- Load More Button -->
					{#if nextCursor}
						<div class="mt-12 text-center">
							<button
								onclick={loadMore}
								disabled={isLoadingMore}
								class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
							>
								{isLoadingMore ? 'Loading...' : 'Load More'}
							</button>
						</div>
					{/if}
				</div>
			{:else if id === 'image'}
				<div class="pt-8">
					<ReverseImageSearch />
				</div>
			{/if}
		{/snippet}
	</Tabs>
</div>