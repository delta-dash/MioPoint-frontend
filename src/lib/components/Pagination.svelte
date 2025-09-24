<!-- src/lib/components/Pagination.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		isFirstPage: boolean;
		hasNextPage: boolean;
		onPrev?: () => void;
		onNext?: () => void;
		children?: Snippet;
		showColumns?: boolean;
	};

	let { isFirstPage, hasNextPage, onPrev, onNext, children, showColumns = true }: Props = $props();
</script>

{#if showColumns}
	<div class="relative lg:flex lg:justify-between">
		<!-- Desktop: Previous Button -->
		<div class="relative hidden w-3 lg:block">
			<button
				onclick={onPrev}
				disabled={isFirstPage}
				aria-label="Previous page"
				class="pointer-events-auto sticky top-1/2 left-0 -ml-8 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-gray-800 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-7 w-7"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
				</svg>
			</button>
		</div>

		<!-- Slotted Content -->
		{#if children}
			<div class="grow">
				{@render children()}
			</div>
		{/if}

		<!-- Desktop: Next Button -->
		<div class="relative hidden w-3 lg:block">
			<button
				onclick={onNext}
				disabled={!hasNextPage}
				aria-label="Next page"
				class="pointer-events-auto sticky top-1/2 right-0 -mr-8 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-gray-800 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-7 w-7"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
			</button>
		</div>

		<!-- Mobile: Bottom Buttons -->
		<div class="mt-8 flex items-center justify-center gap-4 lg:hidden">
			<button
				onclick={onPrev}
				disabled={isFirstPage}
				aria-label="Previous page"
				class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg transition-all hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
			>
				<svg
					xmlns="http://wwww3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-6 w-6"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
				</svg>
			</button>
			<button
				onclick={onNext}
				disabled={!hasNextPage}
				aria-label="Next page"
				class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg transition-all hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-6 w-6"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
			</button>
		</div>
	</div>
{:else if children}
	{@render children()}
{/if}
