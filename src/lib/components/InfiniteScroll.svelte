<!-- src/lib/components/InfiniteScroll.svelte -->
<script lang="ts">
	import { dev } from '$app/environment';
	import { tick } from 'svelte';

	let {
		hasNextPage,
		isLoading,
		onLoadMore
	}: {
		hasNextPage: boolean;
		isLoading: boolean;
		onLoadMore: () => Promise<void>;
	} = $props();

	let sentinel: HTMLDivElement | null = $state(null);
	let isBusy = $state(false);
	let isSentinelVisible = $state(false);

	async function triggerLoad() {
		if (isBusy || isLoading || !hasNextPage) {
			return;
		}
		isBusy = true;
		try {
			await onLoadMore();
		} finally {
			isBusy = false;
		}
	}

	function checkAndLoad() {
		if (!sentinel || !hasNextPage) return;

		const rect = sentinel.getBoundingClientRect();
		isSentinelVisible = rect.top > 0 && rect.top <= window.innerHeight;

		if (isSentinelVisible) {
			triggerLoad();
		}
	}

	// TRIGGER 1: User Scrolling
	$effect(() => {
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					checkAndLoad();
				} else {
					isSentinelVisible = false;
				}
			},
			{
				rootMargin: '0px 0px 300px 0px'
			}
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	// TRIGGER 2: Content Loading
	$effect(() => {
		if (isLoading) return;
		tick().then(checkAndLoad);
	});
</script>

{#if isLoading}
	<div class="mt-8 text-center text-gray-500">Loading more...</div>
{/if}

{#if hasNextPage}
	{#if dev}
		<div
			bind:this={sentinel}
			aria-hidden="true"
			class={`mt-4 flex w-full items-center justify-center p-4 font-mono transition-all duration-300
			${
				isSentinelVisible
					? 'border-green-500/40 bg-green-500/10 text-gray-800'
					: 'border-red-500/30 bg-red-500/10 text-gray-600'
			}`}
		>
			{isSentinelVisible ? '✅ VISIBLE' : '⛔️ HIDDEN'}
		</div>
	{:else}
		<div bind:this={sentinel} aria-hidden="true" class="h-1"></div>
	{/if}
{/if}
