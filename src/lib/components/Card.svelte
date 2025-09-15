<!-- src/lib/components/Card.svelte -->
<script lang="ts">
	import { goto, preloadData, pushState } from '$app/navigation';

	// --- Component Properties ---
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

	// --- Derived Values ---
	const thumbnailUrl = scene_id ? `/api/scene/${scene_id}/thumbnail` : `/api/${id}/thumbnail`;
	const detailUrl = `/file/${id}`;
	const similarityPercent = similarity ? (parseFloat(similarity) * 100).toFixed(1) + '%' : null;

	/**
	 * Handles clicks to open the file in the modal view.
	 */
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
		<!--
      THE FIX: Key Changes Below
      1. Replaced `aspect-video` with a FIXED HEIGHT class like `h-56` (224px).
         You can change this to `h-48` (192px), `h-64` (256px), etc. to get the size you want.
      2. Added `flex items-center justify-center` to perfectly center the image
         inside this new fixed-height container.
    -->
		<div
			class="card-frame flex w-full items-center justify-center bg-white p-2 dark:bg-gray-800"
		>
			<!--
        3. The `object-contain` is now correct. It will ensure the image fits
           without being cropped, and the parent's flex properties will handle the alignment.
        4. The `h-full` and `w-full` on the image now mean "be at MOST the full size of the container".
      -->
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
			class="absolute top-2 right-2 rounded-full bg-green-600/90 px-3 py-1 text-sm font-bold text-white shadow-lg"
			title="Similarity Score"
		>
			{similarityPercent}
		</div>
	{/if}
</a>

<style>
	.card-frame {
		/* Use the variable defined by the parent, or default to 16rem (256px) */
		height: var(--card-frame-height, 16rem);
		transition: height 0.2s ease-in-out; /* Optional: smooth height transition */
	}
</style>