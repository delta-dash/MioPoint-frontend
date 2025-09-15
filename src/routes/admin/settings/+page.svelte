<script lang="ts">
    let { data } = $props();
    let configItems = $state(data.configSchema);
    let message = $state<string | null>(null);
    let isError = $state(false);

    // Helper function to convert value to correct type for boolean inputs
    function getBooleanValue(value: any): boolean {
        return value === 1 || value === '1' || value === true;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        message = null;
        isError = false;

        const updates: { [key: string]: any } = {};
        for (const item of configItems) {
            let value = item.value;
            if (item.type === 'bool') {
                value = value ? 1 : 0;
            } else if (item.type === 'int') {
                value = parseInt(value, 10);
            }
            updates[item.name] = value;
        }

        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (response.ok) {
            const result = await response.json();
            message = result.message || 'Configuration updated successfully!';
            isError = false;
            // Optionally, you might want to refetch the schema to get the updated values
            // For now, we'll just show the success message.
        } else {
            const errorData = await response.json();
            message = errorData.detail || 'Failed to update configuration.';
            isError = true;
        }
    }
</script>

<div class="max-w-3xl mx-auto mt-12 p-6 border border-gray-300 rounded-lg shadow-md bg-white">
    <h1 class="text-center text-3xl font-bold text-gray-800 mb-8">Admin Settings</h1>

    {#if message}
        <p class="p-3 mb-4 rounded-md {isError ? 'bg-red-100 text-red-700 border border-red-400' : 'bg-green-100 text-green-700 border border-green-400'}">
            {message}
        </p>
    {/if}

    <form onsubmit={handleSubmit}>
        {#each configItems as item (item.name)}
            <div class="mb-4">
                <label for={item.name} class="block text-gray-700 text-sm font-bold mb-2">{item.description || item.name}:</label>
                {#if item.type === 'bool'}
                    <input type="checkbox" id={item.name} bind:checked={item.value} class="mr-2 leading-tight" />
                {:else if item.type === 'int'}
                    <input type="number" id={item.name} bind:value={item.value} class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                {:else}
                    <input type="text" id={item.name} bind:value={item.value} class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                {/if}
            </div>
        {/each}

        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full">
            Save Settings
        </button>
    </form>
</div>
