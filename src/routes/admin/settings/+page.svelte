<script lang="ts">
	import { fetchWithAuth } from '$lib/services/authapi';
	let { data } = $props();
	let message = $state<string | null>(null);
	let isError = $state(false);

	// Create a derived state that groups configuration items by category
	const groupedConfig = $derived.by(() => {
		const groups: { [category: string]: ConfigSchemaItem[] } = {};
		// Use data.configSchema directly, which is reactive via $props
		for (const item of data.configSchema) {
			const category = item.category || 'Uncategorized';
			if (!groups[category]) {
				groups[category] = [];
			}
			groups[category].push(item);
		}
		// Return as an array of [key, value] pairs, sorted for consistent UI
		return Object.entries(groups).sort(([catA], [catB]) => catA.localeCompare(catB));
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		message = null;
		isError = false;

		const updates: { [key: string]: any } = {};
		for (const item of data.configSchema) {
			let value = item.value;
			if (item.type === 'bool') {
				// Coerce boolean to 1 or 0 for the backend
				value = value ? 1 : 0;
			} else if (item.type === 'int') {
				value = parseInt(String(value), 10);
			} else if (item.type === 'float') {
				value = parseFloat(String(value));
			}
			// For string-based types (str, list_path, etc.), the value is already correct from bind:value
			updates[item.name] = value;
		}

		try {
			const result = await fetchWithAuth<{status_code?:number, message?:string}>('/api/config', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updates)
			});

			message = result?.message || 'Configuration updated successfully!';
			isError = false;
			// The local state is already updated via two-way binding.
			// A full page reload or re-fetch could be done here if server-side
			// value transformation was a concern.
		} catch (error) {
			message = error instanceof Error ? error.message : 'Failed to update configuration.';
			isError = true;
		}
	}
</script>

<div class="mx-auto mt-12 mb-12 max-w-4xl rounded-lg border border-gray-300 bg-white p-8 shadow-md">
	<h1 class="mb-8 text-center text-3xl font-bold text-gray-800">Admin Settings</h1>

	{#if message}
		<p
			class="mb-6 rounded-md p-3 {isError
				? 'border border-red-400 bg-red-100 text-red-700'
				: 'border border-green-400 bg-green-100 text-green-700'}"
		>
			{message}
		</p>
	{/if}

	<form onsubmit={handleSubmit}>
		{#each groupedConfig as [category, items] (category)}
			<div class="mb-8">
				<h2 class="mt-6 mb-4 border-b pb-2 text-2xl font-semibold text-gray-700">{category}</h2>
				{#each items as item (item.name)}
					<div class="mb-6 grid grid-cols-1 items-start gap-4 md:grid-cols-3">
						<div class="md:col-span-1">
							<label for={item.name} class="block font-bold text-gray-800"
								>{item.name.replaceAll('_', ' ')}</label
							>
							<p class="mt-1 text-xs text-gray-500">{item.description}</p>
						</div>
						<div class="md:col-span-2">
							{#if item.type === 'bool'}
								<label class="flex cursor-pointer items-center">
									<input
										type="checkbox"
										id={item.name}
										bind:checked={item.value}
										class="form-checkbox h-5 w-5 text-blue-600"
									/>
									<span class="ml-2 text-gray-700">{item.value ? 'Enabled' : 'Disabled'}</span>
								</label>
							{:else if item.type === 'int' || item.type === 'float'}
								<input
									type="number"
									id={item.name}
									bind:value={item.value}
									step={item.type === 'float' ? '0.1' : '1'}
									class="w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
								/>
							{:else}
								<!-- Handles str, list_str, list_path, etc. -->
								<input
									type="text"
									id={item.name}
									bind:value={item.value}
									class="w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
								/>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/each}

		<button
			type="submit"
			class="focus:shadow-outline w-full rounded bg-blue-600 px-6 py-3 text-lg font-bold text-white hover:bg-blue-700 focus:outline-none"
		>
			Save Settings
		</button>
	</form>
</div>
