<script lang="ts">
	// 1. Import your fetchWithAuth function
	import { fetchWithAuth } from '$lib/services/authapi';

	let isUploading = $state(false);
	let isDragging = $state(false);

	async function handleFileUpload(files: FileList | null) {
		if (!files || files.length === 0) {
			return;
		}
		isUploading = true;

		const uploadPromises = Array.from(files).map(async (file) => {
			const formData = new FormData();
			formData.append('file', file); // 'file' matches the name in your FastAPI endpoint

			try {
				// 2. Call fetchWithAuth with the correct method and body
				// The type argument <{ status: string; detail: string }> is optional but good practice.
				const response = await fetchWithAuth<{ status: string; detail: string }>('/api/files/upload', {
					method: 'POST',
					body: formData
				});

				console.log(`Upload successful for ${file.name}:`, response.detail);
				// You could add a success notification here if you like
			} catch (error: any) {
				console.error(`Failed to upload ${file.name}:`, error);
				// The error from fetchWithAuth will already be a user-friendly message
				alert(`Failed to upload ${file.name}: ${error.message}`);
			}
		});

		try {
			await Promise.all(uploadPromises);
		} finally {
			isUploading = false;
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		handleFileUpload(input.files);
		// Reset file input to allow uploading the same file again
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const files = event.dataTransfer?.files;
		if (files) {
			handleFileUpload(files);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}
</script>



<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="w-fit my-0 mx-auto flex justify-center items-center p-8 border-2 border-dashed rounded-lg transition-colors duration-200 ease-in-out
    {isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
    {isUploading ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer'}"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<label for="file-input" class="flex flex-col items-center gap-3 text-center {isUploading ? 'pointer-events-none' : ''}">
		<svg
			class="w-12 h-12 text-gray-400 transition-transform duration-200 {isDragging ? 'transform -translate-y-1' : ''}"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline
				points="17 8 12 3 7 8"
			></polyline><line x1="12" x2="12" y1="3" y2="15"></line>
		</svg>
		<span class="font-sans text-gray-600">
			{#if isUploading}
				Uploading...
			{:else if isDragging}
				Drop files to upload
			{:else}
				<span class="text-indigo-600 font-semibold">Choose a file</span> or drag it here
			{/if}
		</span>
	</label>
	<input id="file-input" type="file" onchange={handleFileSelect} multiple disabled={isUploading} class="hidden" />
</div>