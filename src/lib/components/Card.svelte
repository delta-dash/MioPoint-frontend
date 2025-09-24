<!-- src/lib/components/Card.svelte -->
<script lang="ts">
	// This component is designed to display a file instance.
	// It can be a regular file from a listing, or a result from a reverse image search.
	import { goto, preloadData, pushState } from '$app/navigation';

	const {
		id,
		scene_id = null,
		similarity = null,
		preload = true,
		isSelected = false, // Controls the blue selection ring
		class: className = ''
	}: {
		id: number;
		scene_id?: number | null;
		similarity?: string | null;
		preload?: boolean;
		isSelected?: boolean;
		class?: string;
	} = $props();

	// --- CORRECTED THUMBNAIL URL ---
	// The backend route for instance thumbnails is now /api/instance/{instance_id}/thumbnail.
	// The scene thumbnail route is assumed to be /api/scene/{scene_id}/thumbnail for now,
	// as it appears to be used by the reverse image search results.
	const thumbnailUrl = scene_id
		? `/api/scene/${scene_id}/thumbnail`
		: `/api/instance/${id}/thumbnail`;

	const detailUrl = scene_id ? `/file/${id}?scene=${scene_id}` : `/file/${id}`;

	const similarityPercent = similarity ? (parseFloat(similarity) * 100).toFixed(1) + '%' : null;
	async function loadFileData(e: MouseEvent) {
		const target = e.currentTarget as HTMLAnchorElement;

		if (innerWidth < 640 || e.shiftKey || e.ctrlKey || e.metaKey || e.button === 1 || !preload) {
			return;
		}

		e.preventDefault();
		const result = await preloadData(target.href);

		if (result.type === 'loaded' && result.status === 200) {
			pushState(target.href, { selected: result.data });
		} else {
			console.error('Preload failed, falling back to goto()', result);
			goto(target.href);
		}
	}
</script>

<a
	href={detailUrl}
	onmousedown={loadFileData}
	class={'relative block rounded-xl transition ' + className}
	class:ring-4={isSelected}
	class:ring-offset-2={isSelected}
	class:ring-blue-500={isSelected}
	class:dark:ring-blue-400={isSelected}
	class:dark:ring-offset-gray-900={isSelected}
>
	<div
		class="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md transition-all group-hover:-translate-y-1 group-hover:shadow-xl dark:bg-gray-800"
	>
		<div class="card-frame flex w-full items-center justify-center bg-white sm:p-0 p-2 dark:bg-gray-800">
			<img
				class="h-full w-full rounded-md object-contain"
				src={thumbnailUrl}
				loading="lazy"
				alt="View Details"
			/>
		</div>
	</div>

	<!-- Similarity Badge (Overlay) -->
	{#if similarityPercent}
		<div
			class="absolute right-2 top-2 rounded-full bg-green-600/90 px-3 py-1 text-sm font-bold text-white shadow-lg"
			title="Similarity Score"
		>
			{similarityPercent}
		</div>
	{/if}
</a>
