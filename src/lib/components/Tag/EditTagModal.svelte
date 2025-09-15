<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import TagForm from './TagForm.svelte';

	let {
		open = $bindable(false),
		mode,
		tag = null,
		loading = false, // --- NEW: Prop to indicate loading state ---
		onsubmit,
		oncancel
	}: {
		open?: boolean;
		mode: 'create' | 'edit';
		tag?: TagDetail | null | undefined;
		loading?: boolean; // --- NEW ---
		onsubmit: (payload: CreateTagPayload | EditTagPayload) => void;
		oncancel: () => void;
	} = $props();

	// A derived value to check for an invalid state (edit mode without a tag, and not loading)
	const isInvalidState = $derived(mode === 'edit' && !tag && !loading);

	// The title now accounts for the loading state first
	const title = $derived.by(() => {
		if (loading) {
			return 'Loading Tag...'; // --- NEW: Title for loading state ---
		}
		if (isInvalidState) {
			return 'Error';
		}
		if (mode === 'create') {
			return 'Create New Tag';
		}
		// We know `tag` is valid here if we are editing
		return `Editing "${tag?.name}"`;
	});

	function handleModalClose() {
		oncancel();
	}
</script>

{#if open}
	<Modal bind:open {title} size="lg" onClose={handleModalClose}>
		<!-- The main content now has three branches: loading, error, or the form -->
		{#if loading}
			<!-- --- NEW: Loading indicator UI --- -->
			<div class="flex h-64 flex-col items-center justify-center gap-4 text-gray-400">
				<svg
					class="h-8 w-8 animate-spin text-blue-400"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<p>Loading details...</p>
			</div>
		{:else if isInvalidState}
			<!-- Error state (unchanged logic, typo fixed) -->
			<div class="flex items-start gap-4 rounded-md bg-red-900/50 p-4 text-red-200" role="alert">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="h-6 w-6 flex-shrink-0 text-red-400"
				>
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<h3 class="font-bold">Invalid Operation</h3>
					<p class="mt-1 text-sm">
						The modal was opened to "edit" a tag, but no tag data was provided. Please close
						this dialog and try again.
					</p>
				</div>
			</div>
		{:else}
			<!-- If state is valid and not loading, render the form -->
			<TagForm {mode} {tag} {onsubmit} {oncancel} />
		{/if}

		<!-- Conditionally render a footer with a close button only for the error state -->
		{#if isInvalidState}
			{#snippet footer()}
				<button
					onclick={oncancel}
					class="rounded-lg bg-gray-600 px-4 py-2 font-bold text-white transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				>
					Close
				</button>
			{/snippet}
		{/if}
	</Modal>
{/if}