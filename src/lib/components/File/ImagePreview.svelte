<!-- src/lib/components/ImagePreview.svelte -->
<script lang="ts">
	import { crossfade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { tick } from 'svelte';
	import { panzoom } from '$lib/actions/panzoom';

	

	let { fileData, src }: { fileData: FileDetails; src: string } = $props();

	// --- State for Modal and UI ---
	let isViewerOpen = $state(false);
	let resetKey = $state(0); // Used to reset the panzoom state
	let isManipulating = $state(false); // True while panning/zooming
	let isHoveringImage = $state(false); // True when mouse is over image
	const areControlsHidden = $derived(isManipulating || isHoveringImage);

	// --- Accessibility State ---
	let modalElement: HTMLDivElement | null = $state(null);
	let previouslyFocusedElement: HTMLElement | null = $state(null);

	// --- Transitions ---
	const [send, receive] = crossfade({
		duration: 400,
		easing: quintOut
	});

	// --- Functions ---
	function openViewer() {
		previouslyFocusedElement = document.activeElement as HTMLElement;
		resetKey++;
		isViewerOpen = true;
	}

	function closeViewer() {
		isViewerOpen = false;
		previouslyFocusedElement?.focus();
	}

	function resetView() {
		resetKey++;
	}

	// --- Event Handlers ---
	function handleKeydown(event: KeyboardEvent) {
		if (isViewerOpen && event.key === 'Escape') {
			closeViewer();
		}
	}

	function handleMediaKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openViewer();
		}
	}

	// Focus the modal when it opens for accessibility
	$effect(() => {
		if (isViewerOpen) {
			tick().then(() => {
				modalElement?.focus();
			});
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- The preview that is always visible on the page -->
{#if !isViewerOpen}
	<div class="media-container">
		<div
			class="flex cursor-pointer items-center justify-center rounded-md bg-black"
			role="button"
			tabindex="0"
			onclick={openViewer}
			onkeydown={handleMediaKeyPress}
		>
			<img
				{src}
				alt={fileData.file_name ?? 'Image file'}
				class="max-h-full max-w-full object-contain"
				in:receive={{ key: fileData.id }}
				out:send={{ key: fileData.id }}
			/>
		</div>
	</div>
{/if}

<!-- The modal, which only appears when isViewerOpen is true -->
{#if isViewerOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		id="media-viewer-modal"
		bind:this={modalElement}
		onclick={(event) => event.target === event.currentTarget && closeViewer()}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="relative inline-block" onclick={(e) => e.stopPropagation()}>
			{#key resetKey}
				<img
					{src}
					alt="Full-size view"
					class="block max-h-[90vh] max-w-[90vw]"
					in:receive={{ key: fileData.id }}
					out:send={{ key: fileData.id }}
					use:panzoom
					onpanstart={() => (isManipulating = true)}
					onpanend={() => (isManipulating = false)}
					onimageenter={() => (isHoveringImage = true)}
					onimageleave={() => (isHoveringImage = false)}
				/>
			{/key}

			<!-- UI Controls -->
			<div
				class="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-md bg-gray-900/80 px-4 py-2 text-white transition-opacity"
				class:opacity-0={areControlsHidden}
				class:pointer-events-none={areControlsHidden}
			>
				<button onclick={resetView} class="transition-transform hover:scale-110" title="Reset view">
					⟳ Reset
				</button>
				<span class="hidden text-sm opacity-80 sm:inline"
					>Use scroll wheel to zoom, click & drag to pan</span
				>
			</div>
			<button
				onclick={closeViewer}
				class="absolute top-4 right-4 text-4xl font-bold text-white transition-opacity"
				class:opacity-0={areControlsHidden}
				class:pointer-events-none={areControlsHidden}
				aria-label="Close viewer"
			>
				&times;
			</button>
			<div
				class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-gray-900/80 px-4 py-2 text-white transition-opacity"
				class:opacity-0={areControlsHidden}
				class:pointer-events-none={areControlsHidden}
			>
				Press <kbd class="rounded border border-gray-500 bg-gray-700 px-2 py-1 font-mono text-sm"
					>Esc</kbd
				> to close.
			</div>
		</div>
	</div>
{/if}