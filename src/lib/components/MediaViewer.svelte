<script lang="ts">
	// Svelte 5: Use $props and $state for component properties and reactive state.
	const { fileId }:{ fileId: string|number } = $props();

	/**
	 * Defines the possible states of the media viewer.
	 * - loading: Initial check is in progress.
	 * - converting: Video is being processed on the server.
	 * - ready: Video is available for playback.
	 * - error: An error occurred at any stage.
	 */
	type Status = 'loading' | 'converting' | 'ready' | 'error';

	let status = $state<Status>('loading');
	let progress = $state(0);
	let videoSrc = $state('');
	let errorMessage = $state('');

	// $effect runs when the component mounts and re-runs if `fileId` changes.
	// The returned function is a cleanup function, running when the component is unmounted
	// or before the effect re-runs.
	$effect(() => {
		// Store the interval ID so we can clear it later.
		let pollInterval: ReturnType<typeof setInterval> | null = null;

		/**
		 * Initiates the server-side conversion and starts polling for status updates.
		 */
		const startConversionPolling = () => {
			// 1. Send a POST request to start the conversion.
			//    This is a "fire-and-forget" call; we don't wait for it to finish.
			fetch(`/api/files/${fileId}/convert`, { method: 'POST' }).catch((err) => {
				console.error('Failed to start conversion request:', err);
				status = 'error';
				errorMessage = 'Could not start the video conversion process.';
				if (pollInterval) clearInterval(pollInterval);
			});

			// 2. Start polling the status endpoint periodically.
			pollInterval = setInterval(async () => {
				try {
					const response = await fetch(`/api/files/${fileId}/status`);
					if (!response.ok) {
						throw new Error(`Status check failed with status: ${response.status}`);
					}

					const data = await response.json();

					if (data.status === 'converting') {
						status = 'converting'; // Ensure status is set correctly.
						progress = data.progress || 0;
					} else if (data.status === 'ready') {
						if (pollInterval) clearInterval(pollInterval);
						progress = 100;
						// Give the user a moment to see the "Complete!" status.
						setTimeout(() => {
							// Re-run the initial load function to get the final video URL.
							loadMediaContent();
						}, 500);
					} else if (data.status === 'failed') {
						// Handle explicit failure from the backend.
						throw new Error(data.message || 'Conversion failed on the server.');
					}
				} catch (error: any) {
					console.error('Error polling for status:', error);
					if (pollInterval) clearInterval(pollInterval);
					status = 'error';
					errorMessage = error.message || 'An error occurred during conversion.';
				}
			}, 1500); // Poll every 1.5 seconds.
		};

		/**
		 * Fetches the media file. This function determines if the file is
		 * ready for playback or if it requires conversion.
		 */
		const loadMediaContent = async () => {
			status = 'loading';
			// Clear any previous polling interval when this function is called.
			if (pollInterval) clearInterval(pollInterval);

			try {
				const response = await fetch(`/api/${fileId}/media`);

				if (response.status === 409) {
					// HTTP 409 Conflict: Our special status for "Conversion Required".
					status = 'converting';
					startConversionPolling();
				} else if (response.ok) {
					// HTTP 200 OK: The file is ready to be played.
					status = 'ready';
					videoSrc = response.url; // The fetch response.url is the final URL of the resource.
				} else {
					// Handle other HTTP errors (e.g., 404 Not Found, 500 Server Error).
					throw new Error(`Could not load media file. Server responded with ${response.status}.`);
				}
			} catch (error: any) {
				console.error('Error loading media:', error);
				status = 'error';
				errorMessage = error.message;
			}
		};

		// --- Start the process ---
		// This is called initially when the component mounts and whenever `fileId` changes.
		loadMediaContent();

		// --- Cleanup ---
		// This function is returned by the effect and runs when the component is destroyed
		// or before the effect runs again, preventing memory leaks from the interval.
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
		};
	});
</script>

<div class="media-container flex min-h-[300px] items-center justify-center">
	{#if status === 'loading'}
		<div class="flex flex-col items-center justify-center p-8 text-center">
			<div class="spinner" ></div>
			<p class="mt-4 text-slate-500">Loading media...</p>
		</div>
	{:else if status === 'converting'}
		<div
			class="conversion-status w-full rounded-lg border border-slate-200 bg-slate-50 p-6 text-center"
		>
			<h3 class="text-xl font-semibold text-slate-700">Preparing Video...</h3>
			<p class="my-2 text-slate-600">This video is being converted to a web-friendly format.</p>
			<div class="progress-bar my-4 h-4 w-full overflow-hidden rounded-full bg-slate-200">
				<div
					class="progress-bar-inner h-full rounded-full bg-blue-500 transition-all duration-300 ease-linear"
					style="width: {progress}%"
				></div>
			</div>
			<span class="font-mono text-sm font-semibold text-slate-700">
				{progress < 100 ? `${Math.round(progress)}%` : 'Complete!'}
			</span>
		</div>
	{:else if status === 'ready'}
		<video {src} controls autoplay class="aspect-video w-full rounded-md shadow-md">
			Your browser does not support the video tag.
		</video>
	{:else if status === 'error'}
		<div
			class="w-full rounded-md border border-red-300 bg-red-50 p-4 text-center text-red-700"
			role="alert"
		>
			<strong class="font-semibold">Error:</strong>
			{errorMessage}
		</div>
	{/if}
</div>

<!-- This style block contains CSS that is difficult to achieve with utility classes alone. -->
<style>
	.spinner {
		width: 36px;
		height: 36px;
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-left-color: #3b82f6; /* Corresponds to Tailwind's blue-500 */
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
