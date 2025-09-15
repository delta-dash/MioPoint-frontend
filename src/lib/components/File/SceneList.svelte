<!-- src/lib/components/SceneList.svelte -->
<script lang="ts">
	import { timecodeToSeconds } from '$lib/utils/formatters';

	// Define the shape of a scene for clarity
	type Scene = {
		id: number;
		start_timecode: string;
		end_timecode: string;
		transcript: string | null;
		tags: string[] | null;
	};

	let {
		scenes,
		videoElement
	}: {
		scenes: Scene[];
		videoElement: HTMLVideoElement | null;
	} = $props();

	let sceneFilterText = $state('');

	const filteredScenes = $derived(
		(() => {
			if (!scenes) return [];

			const terms = sceneFilterText.trim().toLowerCase().split(/\s+/).filter(Boolean);
			if (terms.length === 0) {
				return scenes.map((scene) => ({
					...scene,
					tags: scene.tags?.map((tag) => ({ text: tag, isMatch: false })) ?? []
				}));
			}

			const includeTags = terms.filter((t) => !t.startsWith('-'));
			const excludeTags = terms.filter((t) => t.startsWith('-')).map((t) => t.slice(1));

			let result = scenes;

			if (includeTags.length > 0) {
				result = result.filter((scene) =>
					includeTags.every((includeTag) =>
						scene.tags?.some((tag) => tag.toLowerCase().includes(includeTag))
					)
				);
			}

			if (excludeTags.length > 0) {
				result = result.filter(
					(scene) =>
						!excludeTags.some((excludeTag) =>
							scene.tags?.some((tag) => tag.toLowerCase().includes(excludeTag))
						)
				);
			}

			return result.map((scene) => ({
				...scene,
				tags:
					scene.tags?.map((tag) => ({
						text: tag,
						isMatch: includeTags.some((includeTag) => tag.toLowerCase().includes(includeTag))
					})) ?? []
			}));
		})()
	);

	function jumpToScene(scene: { start_timecode: string }) {
		if (videoElement) {
			videoElement.currentTime = timecodeToSeconds(scene.start_timecode);
			videoElement.play();
		}
	}
</script>

<section>
	<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-2xl font-semibold text-slate-700">Scenes</h2>
		<input
			type="text"
			bind:value={sceneFilterText}
			placeholder="Filter... (e.g., car -explosion)"
			class="rounded-md border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
		/>
	</div>

	{#if filteredScenes.length > 0}
		<div class="flex flex-col gap-6">
			{#each filteredScenes as scene (scene.id)}
				<div
					class="cursor-pointer rounded-lg border border-slate-200 p-6 transition-all hover:border-blue-300 hover:shadow-md"
					onclick={() => jumpToScene(scene)}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') jumpToScene(scene);
					}}
				>
					<h3 class="mb-2 text-lg font-semibold text-slate-600">
						Scene ({scene.start_timecode} - {scene.end_timecode})
					</h3>
					{#if scene.transcript}
						<p class="mb-4 whitespace-pre-wrap text-slate-600">{scene.transcript}</p>
					{/if}
					{#if scene.tags?.length > 0}
						<div class="mt-4 flex flex-wrap gap-2">
							{#each scene.tags as tagObject}
								<span
									class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors {tagObject.isMatch
										? 'bg-yellow-300 font-semibold text-yellow-900'
										: 'bg-blue-100 text-blue-800'}"
								>
									{tagObject.text}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="rounded-md bg-slate-50 p-4 text-center text-slate-500">
			No scenes match your filter "{sceneFilterText}".
		</p>
	{/if}
</section>