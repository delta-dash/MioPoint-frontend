<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { wsStore } from '$lib/wsStore';

	let { children } = $props();

	$effect(() => {
		if (!$wsStore.isConnected) {
			wsStore.connect();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>



<div class="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
	<Sidebar />

	<!-- 2. Add `overflow-y-auto` to make this div scrollable on the Y-axis -->
	<!--    Add `p-8` or some padding so content isn't flush against the edges -->
	<main class="flex-grow overflow-y-auto">
		{@render children?.()}
	</main>
</div>

