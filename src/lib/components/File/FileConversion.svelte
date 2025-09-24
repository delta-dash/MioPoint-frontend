<!-- src/lib/components/File/FileConversion.svelte -->
<script lang="ts">
	import { fetchWithAuth } from '$lib/services/authapi';

	type TaskStatus = {
		status: 'processing' | 'completed' | 'error' | 'ready';
		progress: number;
		message: string;
		ingest_source: string;
	};

	let { fileId, fileType }: { fileId: number; fileType: string } = $props();

	let activeTask = $state<TaskStatus | null>(null);
	let pollInterval: number | undefined = $state(undefined);

	async function checkStatus() {
		try {
			const res = await fetchWithAuth<TaskStatus>(`/api/instance/${fileId}/status`);

			if (res.status !== 'ready') {
				activeTask = res;
			} else {
				// If a task was completed, keep showing its final state until acknowledged.
				// Otherwise, clear the task if the backend says it's ready.
				if (activeTask?.status !== 'completed' && activeTask?.status !== 'error') {
					activeTask = null;
				}

				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = undefined;
				}
			}

			// Stop polling if the task is finished.
			if (activeTask && (activeTask.status === 'completed' || activeTask.status === 'error')) {
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = undefined;
				}
			}
		} catch (e) {
			console.error('Failed to fetch conversion status', e);
			activeTask = {
				status: 'error',
				progress: 0,
				message: 'Failed to fetch status.',
				ingest_source: 'unknown'
			};
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = undefined;
			}
		}
	}

	async function handleConvert(options: { video_codec?: string; image_format?: string }) {
		// Provide immediate feedback while waiting for the API call
		activeTask = {
			status: 'processing',
			progress: 0,
			message: 'Scheduling conversion...',
			ingest_source: 'conversion'
		};

		try {
			await fetchWithAuth(`/api/instance/${fileId}/convert`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(options)
			});

			if (!pollInterval) {
				pollInterval = window.setInterval(checkStatus, 3000);
			}
			// Immediately check status to get the initial "processing" state
			checkStatus();
		} catch (e) {
			activeTask = {
				status: 'error',
				progress: 0,
				message: e instanceof Error ? e.message : 'An unexpected error occurred.',
				ingest_source: 'conversion'
			};
		}
	}

	$effect(() => {
		checkStatus(); // Initial status check on component load
		return () => {
			if (pollInterval) clearInterval(pollInterval); // Cleanup on destroy
		};
	});

	const videoCodecs = [
		{ id: 'libx264', name: 'H.264 (MP4)' },
		{ id: 'libx265', name: 'H.265/HEVC (MP4)' },
		{ id: 'libvpx', name: 'VP8 (WebM)' },
		{ id: 'libvpx-vp9', name: 'VP9 (WebM)' },
		{ id: 'libaom-av1', name: 'AV1 (WebM/MKV)' },
		{ id: 'prores_ks', name: 'ProRes (MOV)' }
	];

	const imageFormats = [
		{ id: 'jpeg', name: 'JPEG' },
		{ id: 'png', name: 'PNG' },
		{ id: 'webp', name: 'WebP' }
	];
	const isConversionRunning = $derived(
		activeTask?.ingest_source === 'conversion' && activeTask.status === 'processing'
	);
</script>

<section>
	<h2 class="mb-4 text-2xl font-semibold text-slate-700">Convert Media</h2>

	<div class="space-y-4">
		<p class="text-sm text-slate-600">
			Convert this file to a different format. The converted file will be added to your library as a
			new item.
		</p>
		{#if fileType === 'video'}
			<h3 class="font-medium text-slate-800">Video Codecs</h3>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each videoCodecs as codec}
					<button
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => handleConvert({ video_codec: codec.id })}
						disabled={isConversionRunning}
					>
						Convert to {codec.name}
					</button>
				{/each}
			</div>
		{:else if fileType === 'image'}
			<h3 class="font-medium text-slate-800">Image Formats</h3>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each imageFormats as format}
					<button
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => handleConvert({ image_format: format.id })}
						disabled={isConversionRunning}
					>
						Convert to {format.name}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if activeTask}
		<div class="mt-6 border-t border-slate-200 pt-6">
			<div class="flex items-center justify-between">
				<h3 class="font-medium text-slate-800">
					Active Task: <span class="capitalize">{activeTask.ingest_source}</span>
				</h3>
				<button
					onclick={checkStatus}
					class="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-200"
					title="Refresh status"
				>
					Refresh
				</button>
			</div>
			<div class="status-display mt-4 space-y-3">
				<div class="flex items-center justify-between">
					<span class="font-medium text-slate-700 capitalize">{activeTask.status}...</span>
					<span class="text-sm font-semibold text-slate-800">{activeTask.progress.toFixed(0)}%</span
					>
				</div>
				<div class="h-2.5 w-full rounded-full bg-slate-200">
					<div
						class="h-2.5 rounded-full transition-all"
						class:bg-blue-600={activeTask.ingest_source === 'conversion'}
						class:bg-yellow-500={activeTask.ingest_source === 'transcoding'}
						class:bg-purple-500={activeTask.ingest_source === 'retagging'}
						class:bg-red-600={activeTask.status === 'error'}
						style="width: {activeTask.progress}%"
					></div>
				</div>
				<p class="text-sm text-slate-500">{activeTask.message}</p>

				{#if activeTask.status === 'completed' || activeTask.status === 'error'}
					<button
						class="mt-4 rounded-md bg-slate-200 px-3 py-1 text-sm text-slate-800 hover:bg-slate-300"
						onclick={() => (activeTask = null)}
					>
						{activeTask.status === 'completed' ? 'Acknowledge' : 'Try Again'}
					</button>
				{/if}
			</div>
		</div>
	{/if}
</section>
