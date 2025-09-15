<script lang="ts">
	import { fetchWithAuth } from '$lib/services/authapi';

	let { id } = $props<{ id: number }>();
	let isLoading = $state(false);

	async function requestTags() {
		if (isLoading) return;
		isLoading = true;
		try {
			const response = await fetchWithAuth<{ status: string; message: string }>(
                `/api/files/${id}/auto-tag`,
                { method: 'POST' }
            );
			alert(response.message || 'Auto-tagging process started.');
			console.log('Auto-tagging response:', response);
		} catch (error: any) {
			console.error('Failed to start auto-tagging:', error);
			alert(`Failed to start auto-tagging: ${error.message}`);
		} finally {
			isLoading = false;
		}
	}
</script>

<button
	onclick={requestTags}
	disabled={isLoading}
	class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-indigo-500 hover:bg-indigo-400 transition ease-in-out duration-150 disabled:cursor-not-allowed disabled:opacity-60"
>
	{#if isLoading}
		<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
		Processing...
	{:else}
		Auto-tag
	{/if}
</button>