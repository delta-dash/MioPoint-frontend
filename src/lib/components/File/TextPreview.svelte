<script lang="ts">
	let { src }: { src: string } = $props();
	let textContent = $state('');
	let error = $state('');
	let isLoading = $state(true);

	$effect(() => {
		// Rerun when src changes
		const currentSrc = src;
		isLoading = true;
		error = '';
		textContent = '';

		async function fetchText() {
			try {
				const response = await fetch(currentSrc);
				if (!response.ok) {
					throw new Error(`Failed to load file: ${response.statusText} (${response.status})`);
				}
				textContent = await response.text();
			} catch (e: any) {
				error = e.message;
				console.error('Failed to fetch text content:', e);
			} finally {
				isLoading = false;
			}
		}

		fetchText();
	});
</script>

<div class="max-h-[80vh] overflow-auto rounded-md bg-slate-50 p-4">
	{#if isLoading}
		<p class="animate-pulse text-slate-500">Loading text content...</p>
	{:else if error}
		<div class="text-center text-red-600">
			<p class="font-semibold">Error</p>
			<p>{error}</p>
		</div>
	{:else}
		<pre class="whitespace-pre-wrap text-sm text-slate-800">{textContent}</pre>
	{/if}
</div>
