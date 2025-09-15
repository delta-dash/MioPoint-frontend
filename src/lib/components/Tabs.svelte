<!-- src/lib/components/Tabs.svelte -->
<script lang="ts">
	import type { Snippet } from "svelte";

	// --- TYPE DEFINITIONS ---

	/** Defines the shape of a single tab object. */
	export interface Tab {
		id: string; // A unique identifier for the tab
		label: string; // The text to display on the tab
	}

	// --- PROPS ---

	let {
		tabs,
		activeTabId,
		onTabChange,
		content
	}: {
		tabs: Tab[] | (() => Tab[]); // <-- The corrected type
		activeTabId: string;
		onTabChange: (id: string) => void;
		content: Snippet<[id: string]>; // For the #snippet content
	} = $props();

	// --- AND HERE ---
	// We create an internal derived value to "normalize" the input.
	// If `tabs` is a function (a signal), we call it to get its value.
	// If it's already an array, we just use it.
	// This ensures `resolvedTabs` is always a reactive array.
	const resolvedTabs = $derived(typeof tabs === 'function' ? tabs() : tabs);
</script>

<!--
  A simple, reusable tab navigation component.
  It's a "controlled component": the parent dictates the active tab via `activeTabId`
  and listens for user clicks via the `onTabChange` callback.
  The parent also provides the content for each tab via the `content` snippet.
-->
<div class="h-full w-full">
	<!-- Tab Navigation -->
	<div class="border-b border-gray-700">
		<nav class="-mb-px flex space-x-6" aria-label="Tabs">
			{#each resolvedTabs as tab (tab.id)}
				<button
					onclick={() => onTabChange(tab.id)}
					class="whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none {activeTabId ===
					tab.id
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}"
					aria-current={activeTabId === tab.id ? 'page' : undefined}
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Tab Content Area -->
	<div class="mt-4 flex-grow flex flex-col min-h-0 h-full">
		{@render content( activeTabId )}
	</div>
</div>