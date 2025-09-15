<!-- src/routes/search/+page.svelte -->
<script lang="ts">
	// No longer need onMount here, so we remove it from the import
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import Card from '$lib/components/Card.svelte';
	import { AlertCircleIcon, CheckCircleIcon, UploadCloudIcon } from 'svelte-feather-icons';

	// Define a type for the API response for better autocompletion and safety.
	type SearchResultItem = {
		id: number;
		display_name: string;
		tags: string[];
		scene_id: number | null;
		similarity: string;
		// ... add other fields from your API if needed
	};

	type ApiResponse = {
		search_context: {
			match_type: 'precalculated_similarity' | 'live_clip_search' | 'none';
			query_found_in_db: boolean;
			message?: string;
		};
		results: {
			total: number;
			items: SearchResultItem[];
		};
	};

	// --- Component State ---
	let selectedFile: File | null = null;
	let previewUrl: string | null = null;
	let searchResults: ApiResponse | null = null;
	let isLoading = false;
	let errorMessage: string | null = null;

	// --- Event Handlers ---

	// Processes a file, sets the preview, and resets state.
	function processFile(file: File) {
		if (!file || !file.type.startsWith('image/')) {
			errorMessage = 'Please select a valid image file.';
			return;
		}

		// Clear previous results and errors
		searchResults = null;
		errorMessage = null;

		// Revoke the old object URL to prevent memory leaks
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}

		selectedFile = file;
		previewUrl = URL.createObjectURL(selectedFile);
	}

	// Handles the file input change event
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			processFile(input.files[0]);
		}
	}

	// Handles pasting an image from the clipboard
	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		// Find the first image item in the clipboard
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					event.preventDefault(); // Prevent default paste behavior
					processFile(file);
					break; // Use the first image found
				}
			}
		}
	}

	// Performs the search by calling the backend API
	async function handleSearch() {
		if (!selectedFile) {
			errorMessage = 'Please select an image file first.';
			return;
		}

		isLoading = true;
		errorMessage = null;
		searchResults = null;

		const formData = new FormData();
		formData.append('file', selectedFile);

		try {
			const response = await fetch('/api/search/image?top_k=12', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.detail || 'An unknown error occurred during the search.');
			}

			searchResults = (await response.json()) as ApiResponse;
		} catch (err) {
			if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'An unexpected error occurred.';
			}
			console.error(err);
		} finally {
			isLoading = false;
		}
	}

	// --- Lifecycle Hooks ---

	// We no longer need onMount or a manual removeEventListener.
	// The <svelte:window> element handles this automatically.

	// Clean up the object URL when the component is unmounted
	onDestroy(() => {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
	});

	// --- Helper Computed Values ---

	// Create a user-friendly message from the search context
	$: contextMessage = (() => {
		if (!searchResults?.search_context) return null;
		const { match_type, query_found_in_db } = searchResults.search_context;

		if (match_type === 'precalculated_similarity') {
			return 'Found an exact match in your library. Showing the most similar items.';
		}
		if (match_type === 'live_clip_search' && query_found_in_db) {
			return 'Found an exact match, but showing results from a live similarity search.';
		}
		if (match_type === 'live_clip_search') {
			return 'Query image not in library. Showing results from a live similarity search.';
		}
		return null; // No special message needed for 'none' or other cases
	})();
</script>

<!-- ✅ Add the SSR-safe window event listener here -->
<svelte:window on:paste={handlePaste} />

<div class="container mx-auto p-4 md:p-8">
	<h1 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white">Reverse Image Search</h1>
	<p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
		Upload an image to find visually similar items in your media library.
	</p>

	<!-- Search Panel -->
	<div
		class="flex flex-col rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 md:col-span-1"
	>
		<!-- File Input -->
		<label
			for="file-upload"
			class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-8 text-center transition hover:border-indigo-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-indigo-400 dark:hover:bg-gray-700"
		>
			<svelte:component this={UploadCloudIcon} class="mb-2 h-10 w-10 text-gray-400" />
			<span class="font-semibold text-indigo-600 dark:text-indigo-400">Click to upload</span>
			<span class="text-sm text-gray-500 dark:text-gray-400"
				>or drag & drop or paste image</span
			>
		</label>
		<input id="file-upload" type="file" class="hidden" on:change={handleFileSelect} accept="image/*" />

		<!-- Preview -->
		{#if previewUrl}
			<div transition:fade class="mt-4">
				<p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Preview:</p>
				<img
					src={previewUrl}
					alt="Selected file preview"
					class="max-h-60 w-full rounded-lg object-contain"
				/>
				<p class="mt-2 truncate text-xs text-gray-500" title={selectedFile?.name}>
					{selectedFile?.name}
				</p>
			</div>
		{/if}

		<!-- Search Button -->
		{#if selectedFile}
			<button
				transition:fade={{ duration: 150 }}
				on:click={handleSearch}
				disabled={isLoading}
				class="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-lg font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:focus:ring-offset-gray-900"
			>
				{#if isLoading}
					Searching...
				{:else}
					Search
				{/if}
			</button>
		{/if}
	</div>

	<!-- Divider -->
	<hr class="my-8 border-gray-200 dark:border-gray-700" />

	<!-- Results Section -->
	<div class="min-h-[400px]">
		{#if isLoading}
			<div class="flex h-full items-center justify-center pt-16 text-gray-500">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-t-4 border-gray-200 border-t-indigo-500"
				></div>
			</div>
		{:else if errorMessage}
			<div
				transition:fade
				class="flex items-center rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900/50 dark:text-red-300"
			>
				<svelte:component this={AlertCircleIcon} class="mr-3 h-5 w-5 flex-shrink-0" />
				<div>{errorMessage}</div>
			</div>
		{:else if searchResults}
			<div transition:fade>
				<!-- Search Context Message -->
				{#if contextMessage}
					<div
						class="mb-6 flex items-center rounded-lg bg-blue-100 p-4 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
					>
						<svelte:component this={CheckCircleIcon} class="mr-3 h-5 w-5 flex-shrink-0" />
						<div>{contextMessage}</div>
					</div>
				{/if}

				<!-- Results Grid -->
				{#if searchResults.results.items.length > 0}
					<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">
						Found {searchResults.results.total} results
					</h2>
					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{#each searchResults.results.items as item (item.id + '-' + (item.scene_id || ''))}
							<Card {...item} />
						{/each}
					</div>
				{:else}
					<div
						class="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-600"
					>
						<h3 class="text-xl font-semibold">No Similar Items Found</h3>
						<p class="mt-2">Try uploading a different image.</p>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Initial state before any search is performed -->
			<div
				class="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-600"
			>
				<h3 class="text-xl font-semibold">Search Results Will Appear Here</h3>
				<p class="mt-2">Upload an image and click "Search" to begin.</p>
			</div>
		{/if}
	</div>
</div>