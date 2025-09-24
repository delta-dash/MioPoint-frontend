<script lang="ts">
	import type { Snippet } from 'svelte';

	type Item = { id: number; [key: string]: any };

	interface Props {
		items: Item[];
		item: Snippet<[Item]>;
		gap?: number;
		minColumnWidth?: number;
		mobileBreakpoint?: number;
	}

	let {
		items,
		item: itemSnippet,
		gap = 24, // Corresponds to gap-6 in Tailwind
		minColumnWidth = 250,
		mobileBreakpoint = 640 // Tailwind's `sm` breakpoint
	}: Props = $props();

	let containerEl: HTMLElement | undefined = $state();
	let positions = $state(new Map<Item['id'], { top: number; left: number; width: number }>());
	let containerHeight = $state(0);
	// By always performing a full recalculation, we no longer need to persist column heights in state.
	// This simplifies the logic and fixes bugs related to incremental updates on item resizes.

	// This effect recalculates the layout. It's optimized to perform a full recalculation
	// only when necessary (e.g., on resize or when items are removed) and an incremental
	// update when new items are added, which is common with infinite scrolling.
	$effect(() => {
		if (!containerEl) return;

		if (items.length === 0) {
			positions = new Map();
			containerHeight = 0;
			return;
		}

		let debounceId: ReturnType<typeof setTimeout>;

		const calculateLayout = () => {
			if (!containerEl) return;

			const containerWidth = containerEl.clientWidth;
			if (containerWidth === 0) return; // Avoid calculations if the container isn't visible

			const columnCount =
				window.innerWidth < mobileBreakpoint
					? 1
					: Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)));

			const columnWidth = (containerWidth - (columnCount - 1) * gap) / columnCount;

			// --- Simplified Full Recalculation Logic ---
			// Always perform a full recalculation. This is more robust against race conditions
			// like images loading and changing an item's height after the initial layout.
			const newPositions = new Map<Item['id'], { top: number; left: number; width: number }>();
			const columnHeights = Array(columnCount).fill(0);

			const itemElements = Array.from(
				containerEl.querySelectorAll<HTMLElement>('[data-masonry-item-id]')
			);

			// Guard against race conditions where Svelte hasn't rendered the items yet.
			// The observers will trigger a recalculation once they appear.
			if (itemElements.length !== items.length) {
				return;
			}

			for (const itemEl of itemElements) {
				const idString = itemEl.dataset.masonryItemId;
				if (!idString) continue;

				const id = parseInt(idString, 10);
				if (isNaN(id)) continue;

				itemEl.style.width = `${columnWidth}px`;

				const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
				const top = columnHeights[shortestColumnIndex];
				const left = shortestColumnIndex * (columnWidth + gap);

				newPositions.set(id, { top, left, width: columnWidth });

				const itemHeight = itemEl.offsetHeight;
				columnHeights[shortestColumnIndex] += itemHeight + gap;
			}

			positions = newPositions;
			containerHeight = Math.max(0, Math.max(...columnHeights) - gap);
		};

		const debouncedCalculateLayout = () => {
			clearTimeout(debounceId);
			debounceId = setTimeout(calculateLayout, 50);
		};

		// This observer triggers a layout recalculation when the container or any item changes size.
		const resizeObserver = new ResizeObserver(debouncedCalculateLayout);
		resizeObserver.observe(containerEl);

		// We also need to observe items as they are added to or removed from the DOM.
		const mutationObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLElement && node.dataset.masonryItemId) {
						resizeObserver.observe(node);
					}
				});
				mutation.removedNodes.forEach((node) => {
					if (node instanceof HTMLElement && node.dataset.masonryItemId) {
						resizeObserver.unobserve(node);
					}
				});
			}
			// A change in items requires a layout recalculation.
			debouncedCalculateLayout();
		});
		mutationObserver.observe(containerEl, { childList: true });

		// Initial setup: observe any items already in the DOM and run layout calculation.
		containerEl.querySelectorAll<HTMLElement>('[data-masonry-item-id]').forEach((el) => {
			resizeObserver.observe(el);
		});
		debouncedCalculateLayout();

		return () => {
			clearTimeout(debounceId);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	});
</script>

<div
	bind:this={containerEl}
	class="relative"
	style:height="{containerHeight}px"
	style:transition="height 0.3s ease"
>
	{#each items as item (item.id)}
		{@const pos = positions.get(item.id)}
		<div
			data-masonry-item-id={item.id}
			class="absolute"
			style:top={pos ? pos.top + 'px' : '50%'}
			style:left={pos ? pos.left + 'px' : '50%'}
			style:width="{pos?.width ?? minColumnWidth}px"
			style:opacity={pos ? 1 : 0}
			style:transform={pos ? 'translate(0, 0) scale(1)' : 'translate(-50%, -50%) scale(0.5)'}
			style:transition="top 0.4s ease, left 0.4s ease, opacity 0.4s ease, transform 0.4s ease"
		>
			{@render itemSnippet(item)}
		</div>
	{/each}
</div>
