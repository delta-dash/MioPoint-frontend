<!-- src/routes/+page.svelte -->
<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Search from '$lib/components/Search.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { goto, preloadData, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { prefetchStore } from '$lib/stores/prefetchStore';
	import { fetchWithAuth } from '$lib/services/authapi';
	import Modal from '$lib/components/Modal.svelte';
	import { page as pageStore } from '$app/state';
	import FilePage from './file/[id]/+page.svelte';
	import { Maximize2 } from 'lucide-svelte';
	import UploadFile from '$lib/components/UploadFile.svelte';
	// --- Configurable State ---
	let itemsPerView = $state(9);
	let gridColumns = $state(3);
	let isInfiniteScroll = $state(false);

	let gridLayoutClass = $derived(
		gridColumns === 2 ? 'size-large' : gridColumns === 3 ? 'size-medium' : 'size-small'
	);

	// --- Core State ---
	let itemsPerFetch = $derived(itemsPerView * 2);
	let isLoading = $state(true);
	let currentQuery = $state<ApiSearchQuery>({});
	let displayItems = $state<ApiFileCard[]>([]);
	let currentChunkData = $state<PaginatedFileResponse | null>(null);
	let chunkIndex = $state(0);
	let viewInChunk = $state(0);
	let hasNextChunk = $state(true);
	let cursorHistory = $state<Array<string | null>>([null]);

	// --- Keyboard Navigation State ---
	let selectedIndex = $state(-1);
	let cardWrappers: Array<HTMLDivElement | null> = $state([]);

	// --- Infinite Scroll Sentinel ---
	let sentinel: HTMLDivElement | null = $state(null);
	let modalUpdateTimeout: ReturnType<typeof setTimeout>;

	// --- Core Modal Logic ---
	// src/routes/+page.svelte

	// --- 1. REVISE `showFileInModal` to sync the index ---
	async function showFileInModal(file: ApiFileCard | undefined) {
		if (!file) return;

		// Sync the index, as it's our source of truth
		const itemIndex = displayItems.findIndex((item) => item.id === file.id);
		if (itemIndex !== -1) {
			selectedIndex = itemIndex;
		}

		const detailUrl = `/file/${file.id}`;
		const result = await preloadData(detailUrl);

		if (result.type === 'loaded' && result.status === 200) {
			const newState = { selected: result.data };
			if (!page.state.selected) {
				pushState(detailUrl, newState);
			} else {
				replaceState(detailUrl, newState);
			}
			
		} else {
			goto(detailUrl);
		}
	}

	// --- 2. ADD a new reactive `$effect` to sync the modal with the index ---
	function updateModalFromIndex() {
		if (selectedIndex >= 0 && displayItems[selectedIndex]) {
			showFileInModal(displayItems[selectedIndex]);
		}
	}

	function debouncedUpdateModal() {
		clearTimeout(modalUpdateTimeout);
		// Use a much shorter, more responsive timeout. 80ms is a good value.
		modalUpdateTimeout = setTimeout(updateModalFromIndex, 80);
	}

	// --- 3. SIMPLIFY the modal keyboard handler ---
	function handleModalKeyDown(e: KeyboardEvent): boolean {
		const controlledKeys = ['ArrowLeft', 'ArrowRight'];
		if (!controlledKeys.includes(e.key)) {
			return false;
		}
		e.preventDefault();

		if (selectedIndex === -1 && displayItems.length > 0) {
			selectedIndex = 0;
			updateModalFromIndex(); // First selection should be immediate
			return true;
		}

		const isAtEnd = selectedIndex === displayItems.length - 1;
		const isAtStart = selectedIndex === 0;

		let indexChanged = false; // Flag to track if we need a debounced update

		switch (e.key) {
			case 'ArrowRight':
				if (isAtEnd && hasNextPage) {
					// At the end of a page: load new data, then update immediately
					goToNextPage().then(() => {
						selectedIndex = isInfiniteScroll ? selectedIndex + 1 : 0;
						updateModalFromIndex();
					});
				} else if (!isAtEnd) {
					// Standard navigation: just change the index
					selectedIndex += 1;
					indexChanged = true;
				}
				break;

			case 'ArrowLeft':
				if (isAtStart && !isFirstPage && !isInfiniteScroll) {
					// At the start of a page: load new data, then update immediately
					goToPrevPage().then(() => {
						selectedIndex = displayItems.length - 1;
						updateModalFromIndex();
					});
				} else if (!isAtStart) {
					// Standard navigation: just change the index
					selectedIndex -= 1;
					indexChanged = true;
				}
				break;
		}

		// If the index changed from a standard navigation, trigger the debounced update
		if (indexChanged) {
			debouncedUpdateModal();
		}

		return true;
	}

	// --- Your existing grid `handleKeyDown` and other functions remain the same ---
	// No changes needed for handleKeyDown, _fetchChunkData, loadDataForChunk, etc.
	// ... (rest of your existing script)
	// --- REFACTORED: Centralized Keyboard Handler is now simpler ---
	async function handleKeyDown(e: KeyboardEvent) {
		// --- A: MODAL IS OPEN (HIGHEST PRIORITY) ---
		// We no longer need logic here. The Modal component and its `onKeyDown` prop handle it.
		// We just need to stop the grid navigation logic from running.
		if (page.state.selected) {
			return;
		}

		// --- B: GRID NAVIGATION ---
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

		const columns = window.innerWidth >= 1024 ? gridColumns : window.innerWidth >= 768 ? 2 : 1;
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
					selectedIndex = Math.max(0, selectedIndex - columns);
				}
				break;
		}
	}

	// --- Effects and Data Fetching (NO CHANGES IN THIS SECTION) ---
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

	async function _fetchChunkData(
		query: ApiSearchQuery,
		cIndex: number
	): Promise<PaginatedFileResponse> {
		const params = new URLSearchParams();
		Object.entries(query).forEach(([key, value]) => {
			if (value !== undefined && value !== null && String(value).trim() !== '') {
				params.append(key, String(value));
			}
		});
		params.append('page_size', String(itemsPerFetch));
		const cursor = cursorHistory[cIndex];
		if (cursor) {
			params.append('cursor', cursor);
		}
		const url = `/api/cards?${params.toString()}`;
		return await fetchWithAuth(url);
	}

	async function loadDataForChunk(index: number) {
		if (!isInfiniteScroll) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
		isLoading = true;
		try {
			const newChunk = await _fetchChunkData(currentQuery, index);
			//console.log(newChunk);
			
			if (isInfiniteScroll) {
				displayItems = [...displayItems, ...newChunk.items];
			} else {
				currentChunkData = newChunk;
			}
			hasNextChunk = !!newChunk.next_cursor;
			if (hasNextChunk) {
				cursorHistory[index + 1] = newChunk.next_cursor;
			}
		} catch (error) {
			console.error('Failed to load data for chunk:', error);
			if (!isInfiniteScroll) {
				currentChunkData = { items: [], next_cursor: null };
			}
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (isInfiniteScroll || !currentChunkData) return;
		const start = viewInChunk * itemsPerView;
		const end = start + itemsPerView;
		displayItems = currentChunkData.items.slice(start, end);
	});

	$effect(() => {
		if (!isInfiniteScroll || !sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isLoading && hasNextPage) {
					goToNextPage();
				}
			},
			{ threshold: 0.1 }
		);
		observer.observe(sentinel);
		return () => {
			observer.disconnect();
		};
	});

	$effect.root(() => {
		loadDataForChunk(0);
	});

	let isInitialConfigRun = true;
	$effect(() => {
		if (isInitialConfigRun) {
			isInitialConfigRun = false;
			return;
		}
		handleSearch(currentQuery);
	});

	// --- Utility functions for state management (NO CHANGES IN THIS SECTION) ---
	function resetStateForSearch() {
		resetSelection();
		chunkIndex = 0;
		viewInChunk = 0;
		cursorHistory = [null];
		displayItems = [];
		currentChunkData = null;
		prefetchStore.clear();
	}

	function resetSelection() {
		selectedIndex = -1;
		cardWrappers = [];
	}

	function handleSearch(query: ApiSearchQuery) {
		resetStateForSearch();
		currentQuery = query;
		loadDataForChunk(0);
	}

	async function goToNextPage() {
		if (isInfiniteScroll) {
			if (hasNextChunk && !isLoading) {
				const newChunkIndex = chunkIndex + 1;
				chunkIndex = newChunkIndex;
				await loadDataForChunk(newChunkIndex);
			}
			return;
		}
		if (viewInChunk === 0 && currentChunkData && currentChunkData.items.length > itemsPerView) {
			viewInChunk = 1;
		} else if (hasNextChunk && !isLoading) {
			const newChunkIndex = chunkIndex + 1;
			chunkIndex = newChunkIndex;
			viewInChunk = 0;
			await loadDataForChunk(newChunkIndex);
		}
	}

	async function goToPrevPage() {
		if (isInfiniteScroll) return;
		if (viewInChunk === 1) {
			viewInChunk = 0;
		} else if (chunkIndex > 0 && !isLoading) {
			const newChunkIndex = chunkIndex - 1;
			chunkIndex = newChunkIndex;
			viewInChunk = 1;
			await loadDataForChunk(newChunkIndex);
		}
	}

	const isFirstPage = $derived(chunkIndex === 0 && viewInChunk === 0);
	const hasNextPage = $derived(
		isInfiniteScroll
			? hasNextChunk
			: (viewInChunk === 0 && currentChunkData && currentChunkData.items.length > itemsPerView) ||
					(viewInChunk === 1 && hasNextChunk)
	);
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if pageStore.state.selected}
	<!-- THE CHANGE: Pass the custom keyboard handler to the modal -->
	<Modal
		open={pageStore.state.selected != null}
		onClose={() => history.back()}
		onkeydown={handleModalKeyDown}
	>
		{#snippet header()}
			<div class="w-full flex justify-end space-x-reverse space-x-4  ">
				<div class="grow"></div>
				<button
					onclick={() => goto(`/file/${pageStore.state.selected.fileDetails.id}`)}
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
			<FilePage data={pageStore.state.selected} />
		{/snippet}
	</Modal>
{/if}

<div class="min-h-screen">
	<main class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 divide-y-4">
		<div class="bg-white p-4 rounded-xl ">
			<div class="shrink">

				<UploadFile/>
			</div>
		</div>
				<div
			class="sticky top-4 z-10 mb-12 flex flex-col items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-md ring-1 ring-gray-900/5 sm:flex-row"
		>
			
			<div class="w-full flex-grow sm:max-w-sm">
				<Search onsearch={handleSearch} />
			</div>

			<div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end">
				<div class="flex items-center gap-2">
					<label for="items-per-page" class="text-sm font-medium text-gray-600">Amount:</label>
					<select
						id="items-per-page"
						bind:value={itemsPerView}
						class="rounded-md border-gray-300 py-1.5 pr-8 pl-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value={3}>3</option>
						<option value={6}>6</option>
						<option value={9}>9</option>
						<option value={12}>12</option>
					</select>
				</div>
				<div class="flex items-center gap-2">
					<label for="grid-columns" class="text-sm font-medium text-gray-600">Size:</label>
					<select
						id="grid-columns"
						bind:value={gridColumns}
						class="rounded-md border-gray-300 py-1.5 pr-8 pl-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value={2}>Large</option>
						<option value={3}>Medium</option>
						<option value={4}>Small</option>
					</select>
				</div>
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

		<div class="relative mt-12" role="grid" aria-label="File results">
			{#if !isInfiniteScroll && !isLoading && (displayItems.length > 0 || !isFirstPage)}
				<Pagination {isFirstPage} {hasNextPage} onPrev={goToPrevPage} onNext={goToNextPage} />
			{/if}

			<div
				class="card-grid grid min-h-[124rem] gap-8
           md:min-h-[68rem] lg:min-h-[40rem] {gridLayoutClass}"
			>
				{#if isLoading && displayItems.length === 0}
					{#each Array(itemsPerView) as _}
						<div class="h-48 animate-pulse rounded-lg bg-gray-200 p-4 shadow-md"></div>
					{/each}
				{:else}
					{#each displayItems as file, i (file.id)}
						<div
							class="group"
							bind:this={cardWrappers[i]}
							role="gridcell"
							aria-selected={i === selectedIndex}
							onclick={() => showFileInModal(file)}
							onkeydown={(e) => e.key === 'Enter' && showFileInModal(file)}
						>
							<Card {...file} isSelected={i === selectedIndex} />
						</div>
					{/each}
				{/if}
			</div>

			{#if isInfiniteScroll}
				{#if isLoading && displayItems.length > 0}
					<div class="mt-8 text-center text-gray-500">Loading more...</div>
				{/if}
				{#if hasNextPage}
					<div bind:this={sentinel} class="h-10"></div>
				{/if}
			{/if}

			{#if !isLoading && displayItems.length === 0}
				<div class="mt-8 text-center text-gray-500 italic md:col-span-2 lg:col-span-3">
					<p class="text-xl">🤔</p>
					<p>No files match your query. Try a different search!</p>
				</div>
			{/if}
		</div>
	</main>
</div>

<style>
	/* All styles remain exactly the same */
	.card-grid {
		grid-template-columns: repeat(1, minmax(0, 1fr));
		--card-frame-height: 14rem;
	}
	.card-grid.size-large {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		--card-frame-height: 24rem;
	}
	.card-grid.size-medium {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		--card-frame-height: 16rem;
	}
	.card-grid.size-small {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		--card-frame-height: 12rem;
	}
	@media (max-width: 1023px) {
		.card-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			--card-frame-height: 16rem;
		}
		.card-grid.size-large {
			--card-frame-height: 24rem;
		}
	}
	@media (max-width: 767px) {
		.card-grid {
			grid-template-columns: repeat(1, minmax(0, 1fr));
			--card-frame-height: 14rem;
		}
		.card-grid.size-large {
			--card-frame-height: 20rem;
		}
		.card-grid.size-medium {
			--card-frame-height: 14rem;
		}
		.card-grid.size-small {
			--card-frame-height: 12rem;
		}
	}
</style>
