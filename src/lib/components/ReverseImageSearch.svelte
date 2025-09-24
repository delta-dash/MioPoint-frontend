<!-- src/lib/components/ReverseImageSearch.svelte -->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import Card from '$lib/components/Card.svelte';
	import { AlertCircle, CheckCircle, UploadCloud } from 'lucide-svelte';

	type SearchResultItem = ApiFileCard & {
		tags: string[];
		scene_id: number | null;
		similarity: string;
	};

	type ApiResponse = {
		match_type: 'precalculated_similarity' | 'live_clip_search' | 'none';
		query_found_in_db: boolean;
		message?: string;
		results: SearchResultItem[];
	};

	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let searchResults = $state<ApiResponse | null>(null);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);

	function processFile(file: File) {
		if (!file || !file.type.startsWith('image/')) {
			errorMessage = 'Please select a valid image file.';
			return;
		}
		searchResults = null;
		errorMessage = null;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		selectedFile = file;
		previewUrl = URL.createObjectURL(selectedFile);
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			processFile(input.files[0]);
		}
	}

	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					event.preventDefault();
					processFile(file);
					break;
				}
			}
		}
	}

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

	$effect(() => {
		const url = previewUrl;
		return () => {
			if (url) {
				URL.revokeObjectURL(url);
			}
		};
	});

	const contextMessage = $derived.by(() => {
		if (!searchResults) return null;
		const { match_type, query_found_in_db } = searchResults;
		if (match_type === 'precalculated_similarity') {
			return 'Found an exact match in your library. Showing the most similar items.';
		}
		if (match_type === 'live_clip_search' && query_found_in_db) {
			return 'Found an exact match, but showing results from a live similarity search.';
		}
		if (match_type === 'live_clip_search') {
			return 'Query image not in library. Showing results from a live similarity search.';
		}
		return null;
	});
</script>

<svelte:window on:paste={handlePaste} />

<div
	class="flex flex-col rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
>
	<label
		for="file-upload"
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-8 text-center transition hover:border-indigo-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-indigo-400 dark:hover:bg-gray-700"
	>
		<UploadCloud class="mb-2 h-10 w-10 text-gray-400" />
		<span class="font-semibold text-indigo-600 dark:text-indigo-400">Click to upload</span>
		<span class="text-sm text-gray-500 dark:text-gray-400">or drag & drop or paste image</span>
	</label>
	<input id="file-upload" type="file" class="hidden" onchange={handleFileSelect} accept="image/*" />

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

	{#if selectedFile}
		<button
			transition:fade={{ duration: 150 }}
			onclick={handleSearch}
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

<hr class="my-8 border-gray-200 dark:border-gray-700" />

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
			<AlertCircle class="mr-3 h-5 w-5 flex-shrink-0" />
			<div>{errorMessage}</div>
		</div>
	{:else if searchResults}
		<div transition:fade>
			{#if contextMessage}
				<div
					class="mb-6 flex items-center rounded-lg bg-blue-100 p-4 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
				>
					<CheckCircle class="mr-3 h-5 w-5 flex-shrink-0" />
					<div>{contextMessage}</div>
				</div>
			{/if}

			{#if searchResults.results.length > 0}
				<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">
					Found {searchResults.results.length} results
				</h2>
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each searchResults.results as item (item.id + '-' + (item.scene_id || ''))}
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
		<div
			class="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500 dark:border-gray-600"
		>
			<h3 class="text-xl font-semibold">Search Results Will Appear Here</h3>
			<p class="mt-2">Upload an image and click "Search" to begin.</p>
		</div>
	{/if}
</div>
