<!-- src/routes/+page.svelte -->
<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Search from '$lib/components/Search.svelte';
	import InfiniteScroll from '$lib/components/InfiniteScroll.svelte';
	import { goto, preloadData, pushState, replaceState } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import FilePage from './file/[id]/+page.svelte';
	import { Maximize2 } from 'lucide-svelte';
	import UploadFile from '$lib/components/UploadFile.svelte';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import { searchFiles } from '$lib/searchStore';
	import Pagination from '$lib/components/Pagination.svelte';
	import { page } from '$app/state';

	let { data } = $props();

	// --- UI State ---
	let isInfiniteScroll = $state(false);

	// --- Core State ---
	let isLoading = $state(false);
	let currentQuery = $state<ApiSearchQuery>(data.query);
	let currentChunkData = $state<CardListingResponse | null>(data.initialResults);
	let chunkIndex = $state(0);
	let hasNextChunk = $state(!!data.initialResults.next_cursor);
	let cursorHistory = $state<Array<string | null>>([null, data.initialResults.next_cursor]);
	let displayItems = $state<ApiFileCard[]>(data.initialResults.items);

	// --- Keyboard Navigation State ---
	let selectedIndex = $state(-1);
	let cardWrappers: Array<HTMLDivElement | null> = $state([]);
	let modalUpdateTimeout: ReturnType<typeof setTimeout>;

	// ... (showFileInModal, handleModalKeyDown, handleKeyDown, etc. are unchanged)
	async function showFileInModal(file: ApiFileCard | undefined) {
		if (!file) return;

		const itemIndex = displayItems.findIndex((item) => item.id === file.id);
		if (itemIndex !== -1) {
			selectedIndex = itemIndex;
		}

		const detailUrl = `/file/${file.id}`;
		const result = await preloadData(detailUrl);

		if (result.type === 'loaded' && result.status === 200) {
			const newState = { selected: result.data as any };
			if (!page.state.selected) {
				pushState(detailUrl, newState);
			} else {
				replaceState(detailUrl, newState);
			}
		} else {
			goto(detailUrl);
		}
	}

	function updateModalFromIndex() {
		if (selectedIndex >= 0 && displayItems[selectedIndex]) {
			showFileInModal(displayItems[selectedIndex]);
		}
	}

	function debouncedUpdateModal() {
		clearTimeout(modalUpdateTimeout);
		modalUpdateTimeout = setTimeout(updateModalFromIndex, 80);
	}

	function handleModalKeyDown(e: KeyboardEvent): boolean {
		const controlledKeys = ['ArrowLeft', 'ArrowRight'];
		if (!controlledKeys.includes(e.key)) {
			return false;
		}
		e.preventDefault();

		if (selectedIndex === -1 && displayItems.length > 0) {
			selectedIndex = 0;
			updateModalFromIndex();
			return true;
		}

		const isAtEnd = selectedIndex === displayItems.length - 1;
		const isAtStart = selectedIndex === 0;

		let indexChanged = false;

		switch (e.key) {
			case 'ArrowRight':
				if (isAtEnd && hasNextPage) {
					goToNextPage().then(() => {
						selectedIndex = isInfiniteScroll ? selectedIndex + 1 : 0;
						updateModalFromIndex();
					});
				} else if (!isAtEnd) {
					selectedIndex += 1;
					indexChanged = true;
				}
				break;

			case 'ArrowLeft':
				if (isAtStart && !isFirstPage && !isInfiniteScroll) {
					goToPrevPage().then(() => {
						selectedIndex = displayItems.length - 1;
						updateModalFromIndex();
					});
				} else if (!isAtStart) {
					selectedIndex -= 1;
					indexChanged = true;
				}
				break;
		}

		if (indexChanged) {
			debouncedUpdateModal();
		}

		return true;
	}

	async function handleKeyDown(e: KeyboardEvent) {
		if (page.state.selected) {
			return;
		}

		const target = e.target as HTMLElement;
		if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
			return;
		}
		if (
			selectedIndex === -1 &&
			['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
			displayItems.length > 0
		) {
			e.preventDefault();
			selectedIndex = 0;
			cardWrappers[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			return;
		}
		if (selectedIndex === -1) return;

		e.preventDefault();

		/* const columns = window.innerWidth >= 1024 ? gridColumns : window.innerWidth >= 768 ? 2 : 1;
		const isAtEnd = selectedIndex === displayItems.length - 1;
		const isAtStart = selectedIndex === 0;

		switch (e.key) {
			case 'Enter':
				if (displayItems[selectedIndex]) showFileInModal(displayItems[selectedIndex]);
				break;
			case 'ArrowRight':
				if (isAtEnd && hasNextPage) {
					goToNextPage();
					requestAnimationFrame(() => {
						selectedIndex = isInfiniteScroll ? selectedIndex + 1 : 0;
					});
				} else {
					selectedIndex = Math.min(displayItems.length - 1, selectedIndex + 1);
				}
				break;
			case 'ArrowLeft':
				if (isAtStart && !isFirstPage && !isInfiniteScroll) {
					goToPrevPage();
					requestAnimationFrame(() => {
						selectedIndex = displayItems.length - 1;
					});
				} else {
					selectedIndex = Math.max(0, selectedIndex - 1);
				}
				break;
			case 'ArrowDown':
				if (selectedIndex + columns >= displayItems.length && hasNextPage) {
					goToNextPage();
					requestAnimationFrame(() => {
						selectedIndex = 0;
					});
				} else {
					selectedIndex = Math.min(displayItems.length - 1, selectedIndex + columns);
				}
				break;
			case 'ArrowUp':
				if (selectedIndex - columns < 0 && !isFirstPage && !isInfiniteScroll) {
					goToPrevPage();
					requestAnimationFrame(() => {
						selectedIndex = displayItems.length - 1;
					});
				} else {
					selectedIndex = Math.max(0, selectedIndex - 1);
				}
				break; 
			}
			*/
	}

	$effect(() => {
		if (selectedIndex > -1 && selectedIndex < cardWrappers.length) {
			requestAnimationFrame(() => {
				cardWrappers[selectedIndex]?.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest'
				});
			});
		}
	});

	$effect.pre(() => {
		// Re-run this effect if `isInfiniteScroll` changes to reset the state.
		// It also re-runs if `data` (from props) changes, which happens on navigation.
		data;
		isInfiniteScroll;

		isLoading = false;
		currentQuery = data.query;
		currentChunkData = data.initialResults;
		hasNextChunk = !!data.initialResults.next_cursor;
		cursorHistory = [null, data.initialResults.next_cursor];
		chunkIndex = 0;
		displayItems = data.initialResults.items;
		resetSelection();
	});

	async function _fetchChunkData(
		query: ApiSearchQuery,
		cIndex: number
	): Promise<CardListingResponse> {
		const cursor = cursorHistory[cIndex];
		// The query from the URL should contain the page_size. If not, the backend has a default.
		return await searchFiles({ ...query, cursor: cursor || undefined });
	}

	async function loadDataForChunk(index: number) {
		// --- THE FIX ---
		// This is the single gatekeeper. If a load is already in progress,
		// any other trigger (from scroll, keyboard, etc.) will be ignored here.
		if (isLoading) {
			return;
		}

		if (!isInfiniteScroll) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
		isLoading = true;
		try {
			const newChunk = await _fetchChunkData(currentQuery, index);

			if (isInfiniteScroll) {
				const existingIds = new Set(displayItems.map((i) => i.id));
				const uniqueNewItems = newChunk.items.filter((i) => !existingIds.has(i.id));
				displayItems = [...displayItems, ...uniqueNewItems];
			} else {
				currentChunkData = newChunk; // For hasNextPage logic
				displayItems = newChunk.items;
			}
			hasNextChunk = !!newChunk.next_cursor;
			if (hasNextChunk) {
				cursorHistory[index + 1] = newChunk.next_cursor;
			}
		} catch (error) {
			console.error('Failed to load data for chunk:', error);
			if (!isInfiniteScroll) {
				currentChunkData = { items: [], next_cursor: null, folders: [] };
				displayItems = [];
			}
		} finally {
			isLoading = false;
		}
	}

	function resetSelection() {
		selectedIndex = -1;
		cardWrappers = [];
	}

	// This function now simply determines the next chunk and calls the gatekept function.
	// It doesn't need its own `isLoading` check.
	async function loadMoreItems() {
		if (!hasNextChunk) return;
		const newChunkIndex = chunkIndex + 1;
		chunkIndex = newChunkIndex;
		await loadDataForChunk(newChunkIndex);
	}

	async function goToNextPage() {
		if (isInfiniteScroll) {
			await loadMoreItems();
			return;
		}

		const newChunkIndex = chunkIndex + 1;
		chunkIndex = newChunkIndex;
		await loadDataForChunk(newChunkIndex);
	}

	async function goToPrevPage() {
		if (isInfiniteScroll) return;
		if (chunkIndex > 0) {
			const newChunkIndex = chunkIndex - 1;
			chunkIndex = newChunkIndex;
			await loadDataForChunk(newChunkIndex);
		}
	}

	const isFirstPage = $derived(chunkIndex === 0);
	const hasNextPage = $derived(hasNextChunk);
</script>

<!-- The rest of your template remains exactly the same -->
<svelte:window on:keydown={handleKeyDown} />

{#if page.state.selected}
	<Modal
		open={page.state.selected != null}
		onClose={() => history.back()}
		onkeydown={handleModalKeyDown}
	>
		{#snippet header()}
			<div class="flex w-full justify-end space-x-4 space-x-reverse">
				<div class="grow"></div>
				<button
					onclick={() => goto(`/file/${page.state.selected.fileDetails.id}`)}
					class="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
					aria-label="Close modal"
				>
					<Maximize2 />
				</button>
				<button
					onclick={() => history.back()}
					class="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
					aria-label="Close modal"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		{/snippet}
		{#snippet children()}
			<FilePage data={page.state.selected} />
		{/snippet}
	</Modal>
{/if}

<div class="min-h-screen">
	<main class="mx-auto max-w-7xl divide-y-4 p-4 sm:p-6 lg:p-8">
		<div class="rounded-xl bg-white p-4">
			<div class="shrink">
				<UploadFile />
			</div>
		</div>

		<div
			class="sticky top-4 z-10 mb-12 flex gap-4 rounded-xl bg-white p-4 shadow-md ring-1 ring-gray-900/5 sm:flex-row"
		>
			<div class="w-full flex-grow">
				<Search />
			</div>
			<div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end">
				<div class="flex items-center gap-2">
					<label for="infinite-scroll" class="text-sm font-medium text-gray-600"> Infinite: </label>
					<button
						type="button"
						role="switch"
						aria-checked={isInfiniteScroll}
						onclick={() => (isInfiniteScroll = !isInfiniteScroll)}
						class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none"
						class:bg-blue-600={isInfiniteScroll}
						class:bg-gray-200={!isInfiniteScroll}
					>
						<span
							class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
							class:translate-x-5={isInfiniteScroll}
							class:translate-x-0={!isInfiniteScroll}
						/>
					</button>
				</div>
			</div>
		</div>

		<Pagination
			{isFirstPage}
			{hasNextPage}
			onPrev={goToPrevPage}
			onNext={goToNextPage}
			showColumns={!isInfiniteScroll && !isLoading && (displayItems.length > 0 || !isFirstPage)}
		>
			<div class="relative mt-12" role="grid" aria-label="File results">
				<div class="relative min-h-[40rem]">
					{#if isLoading && displayItems.length === 0}
						<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
							{#each Array(18) as _}
								<div class="h-48 animate-pulse rounded-lg bg-gray-200"></div>
							{/each}
						</div>
					{:else if displayItems.length > 0}
						<MasonryGrid items={displayItems} gap={32} minColumnWidth={280}>
							{#snippet item(item)}
								<Card {...item} />
							{/snippet}
						</MasonryGrid>
					{/if}
				</div>

				{#if isInfiniteScroll}
					<InfiniteScroll {hasNextPage} {isLoading} onLoadMore={loadMoreItems} />
				{/if}

				{#if !isLoading && displayItems.length === 0}
					<div class="mt-8 text-center text-gray-500 italic">
						<p class="text-xl">🤔</p>
						<p>No files match your query. Try a different search!</p>
					</div>
				{/if}
			</div>
		</Pagination>
	</main>
</div>
