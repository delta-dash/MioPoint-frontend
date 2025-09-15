<script lang="ts">
	import { untrack } from 'svelte';

	// --- Props ---
	const {
		tags,
		fileId,
		canRemove = true, // Provide sensible defaults
		canAdd = true
	}: {
		tags: string[];
		fileId: string | number;
		canRemove?: boolean;
		canAdd?: boolean;
	} = $props();

	// --- State ---
	// Create a local, mutable copy of the tags to allow for immediate UI updates.
	let localTags = $state(tags);
	let isAdding = $state(false);
	let newTagValue = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	// Sync localTags if the 'tags' prop changes from the parent.
	$effect(() => {
		// Use untrack to prevent this effect from re-running when we modify localTags ourselves.
		untrack(() => {
			localTags = tags;
		});
	});

	// --- API Handlers ---

	async function removeTag(tagToRemove: string) {
		if (isLoading) return;
		isLoading = true;
		errorMessage = '';

		try {
			const response = await fetch(`/api/tag/remove/${fileId}/${encodeURIComponent(tagToRemove)}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to remove tag.');
			}

			// Optimistically update the UI
			localTags = localTags.filter((t) => t !== tagToRemove);
		} catch (error) {
			console.error('Error removing tag:', error);
			errorMessage = 'Could not remove tag. Please try again.';
			// Note: In a real app, you might want to revert the optimistic update here.
		} finally {
			isLoading = false;
		}
	}

	async function handleAddTag(event:Event) {
        event.preventDefault();
		const trimmedTag = newTagValue.trim();
		if (!trimmedTag || isLoading) return;

		if (localTags.map(t => t.toLowerCase()).includes(trimmedTag.toLowerCase())) {
			errorMessage = `Tag "${trimmedTag}" already exists.`;
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			// Using POST is more appropriate for adding data.
			// The tag could be sent in the body for more complex scenarios.
			const response = await fetch(`/api/tag/add/${fileId}/${encodeURIComponent(trimmedTag)}`, {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('Failed to add tag.');
			}

			// Optimistically update UI and reset the form
			localTags.push(trimmedTag);
			localTags.sort(); // Optional: keep tags sorted
			newTagValue = '';
			isAdding = false;
		} catch (error) {
			console.error('Error adding tag:', error);
			errorMessage = 'Could not add tag. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	function showAddInput() {
		isAdding = true;
		errorMessage = '';
		// We can auto-focus the input when it appears using an action (not shown for brevity)
	}

	function cancelAdd() {
		isAdding = false;
		newTagValue = '';
		errorMessage = '';
	}

	// --- Helpers ---

	function capitalizeWords(str: string): string {
		return str
			.split(/\s+/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<!-- Display Existing Tags -->
	{#each localTags as tag}
		<span
			class="flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800"
		>
			{capitalizeWords(tag)}
			{#if canRemove}
				<button
					onclick={() => removeTag(tag)}
					disabled={isLoading}
					class="text-indigo-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Remove tag: {tag}"
				>
					<svg
						class="h-3 w-3"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 6L6 18M6 6l12 12"></path>
					</svg>
				</button>
			{/if}
		</span>
	{/each}

	<!-- Add Tag UI -->
	{#if canAdd}
		{#if isAdding}
			<!-- Form for adding a new tag -->
			<form onsubmit={handleAddTag} class="flex items-center gap-1">
				<input
					type="text"
					bind:value={newTagValue}
					placeholder="New tag..."
					disabled={isLoading}
					class="rounded-md border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
					aria-label="New tag name"
				/>
				<button
					type="submit"
					disabled={isLoading || !newTagValue.trim()}
					class="rounded-full bg-green-200 p-1 text-green-800 transition hover:bg-green-300 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
					aria-label="Confirm add tag"
				>
					<!-- Checkmark Icon -->
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				</button>
				<button
					type="button"
					onclick={cancelAdd}
					disabled={isLoading}
					class="rounded-full bg-gray-200 p-1 text-gray-800 transition hover:bg-gray-300 disabled:cursor-not-allowed"
					aria-label="Cancel adding tag"
				>
					<!-- Close Icon -->
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.693a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</form>
		{:else}
			<!-- Button to show the add form -->
			<button
				onclick={showAddInput}
				disabled={isLoading}
				class="flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-600 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
				</svg>
				Add Tag
			</button>
		{/if}
	{/if}
</div>

<!-- Optional: Display error messages -->
{#if errorMessage}
	<p class="mt-2 text-xs text-red-600">{errorMessage}</p>
{/if}