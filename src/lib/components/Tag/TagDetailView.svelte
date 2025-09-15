<script lang="ts">
	/**
	 * Type definition for the component's event callbacks.
	 * In Svelte 5, the keys must match the prop names, including the 'on' prefix.
	 * e.g., on:delete -> ondelete: () => void
	 */
	type Events = {
		onedit: () => void;
		ondelete: () => void;
		onselect: (tag: TagReference) => void;
	};

	/**
	 * This component accepts the tag data and a set of optional callback functions.
	 * Using `Partial<Events>` makes it so the parent doesn't have to provide every callback.
	 */
	let { tag, onedit, ondelete, onselect }: { tag: TagDetail } & Partial<Events> = $props();

	/**
	 * A helper function to call the `onselect` callback when a related tag is clicked.
	 * This allows the parent component to handle navigation.
	 */
	function selectRelatedTag(relatedTag: TagReference) {
		// Avoid triggering a navigation event if the user clicks the current tag's name
		if (relatedTag.id !== tag.id) {
			// Call the 'onselect' prop directly if it was provided by the parent.
			onselect?.(relatedTag);
		}
	}
	$inspect(tag);
</script>

<!-- Main container for displaying tag details -->
<div class="animate-fade-in space-y-4">
	<div>
		<h3 class="text-sm font-semibold text-gray-400">ID</h3>
		<p>{tag.id}</p>
	</div>

	<!-- Section for the canonical tag if this tag is an alias -->
	{#if tag.is_alias && tag.canonical_tag}
		<div>
			<h3 class="text-sm font-semibold text-gray-400">Alias Of</h3>
			<button
				onclick={() => selectRelatedTag(tag.canonical_tag!)}
				class="mr-2 inline-block rounded-full bg-indigo-600 px-2.5 py-0.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-none"
				title="Click to view '{tag.canonical_tag.name}'"
			>
				{tag.canonical_tag.name}
			</button>
		</div>
	{/if}

	<!-- Section for other tags that are aliases of this tag -->
    <div>
        <h3 class="text-sm font-semibold text-gray-400">Aliases</h3>
        <div class="mt-1 flex flex-wrap gap-2">
                {#if tag.aliases.length > 0}
				{#each tag.aliases as alias (alias.id)}
					<button
						onclick={() => selectRelatedTag(alias)}
						class="mr-2 inline-block rounded-full bg-gray-600 px-2.5 py-0.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-none"
						title="Click to view '{alias.name}'"
					>
						{alias.name}
					</button>
				{/each}
               
				
                {/if}
			</div>
		</div>

	<!-- Section for parent tags -->
	<div>
		<h3 class="text-sm font-semibold text-gray-400">Parents</h3>
		<div class="mt-1 flex flex-wrap gap-2">
			{#if tag.parents.length > 0}
				{#each tag.parents as parent (parent.id)}
					<button
						onclick={() => selectRelatedTag(parent)}
						class="mr-2 inline-block rounded-full bg-purple-600 px-2.5 py-0.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-none"
						title="Click to view '{parent.name}'"
					>
						{parent.name}
					</button>
				{/each}
                {:else}
				0
			{/if}
		</div>
	</div>

	<!-- Section for child tags -->
	<div>
		<h3 class="text-sm font-semibold text-gray-400">Children</h3>
		<div class="mt-1 flex flex-wrap gap-2">
			{#if tag.children.length > 0}
				{#each tag.children as child (child.id)}
					<button
						onclick={() => selectRelatedTag(child)}
						class="mr-2 inline-block rounded-full bg-teal-600 px-2.5 py-0.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-none"
						title="Click to view '{child.name}'"
					>
						{child.name}
					</button>
				{/each}
			{:else}
				0
			{/if}
		</div>
	</div>

	<div>
		<h3 class="text-sm font-semibold text-gray-400">Status</h3>
		<p class="font-medium text-yellow-400">
			{tag.is_protection_tag ? 'This is a protection tag.' : 'This tag does not protect.'}
		</p>
	</div>
</div>

<!-- Action buttons at the bottom -->
<div class="mt-8 flex gap-4 border-t border-gray-700 pt-6">
	<button
		onclick={onedit}
		class="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700"
	>
		Edit
	</button>
	<button
		onclick={ondelete}
		class="rounded-lg bg-red-700 px-4 py-2 font-bold text-white transition-colors hover:bg-red-800"
	>
		Delete
	</button>
</div>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in {
		animation: fade-in 0.3s ease-out forwards;
	}
</style>
