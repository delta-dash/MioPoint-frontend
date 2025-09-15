<!-- src/lib/components/Pagination.svelte (Corrected with `position: sticky`) -->
<script lang="ts">
	type Props = {
		isFirstPage: boolean;
		hasNextPage: boolean;
		onPrev?: () => void;
		onNext?: () => void;
	};

	let { isFirstPage, hasNextPage, onPrev, onNext }: Props = $props();
</script>

<!--
  This component uses `position: sticky` to achieve the desired effect.
  - The parent container (in page.svelte) MUST have `position: relative`.
  - This wrapper becomes 'sticky' when it hits the vertical middle of the viewport.
  - It will only remain sticky while its parent container is visible on screen.
-->

<!-- ======================================================= -->
<!-- ==     DESKTOP STICKY PAGINATION (md+)               == -->
<!-- ======================================================= -->

<!-- 
  The sticky container:
  - `sticky`: Enables the sticky positioning behavior.
  - `top-1/2`: It will "stick" to the vertical middle of the screen.
  - `inset-x-0`: Makes the container span the full width of its parent (`position: relative` is required on the parent). This is crucial for positioning the buttons at the edges.
  - `h-0`: It takes up no vertical space in the document flow.
  - `z-30`: Ensures it's on top of other content.
  - `pointer-events-none`: This is the magic trick. It makes this full-width container "invisible" to the mouse, so you can still click and interact with the content *underneath* it.
-->
<div class="sticky top-1/2 inset-x-0 z-30 hidden h-0 md:block pointer-events-none">
	<!-- 
    Previous Button:
    - `pointer-events-auto`: We re-enable pointer events just for the button itself, so it can be clicked.
  -->
	<button
		onclick={onPrev}
		disabled={isFirstPage}
		aria-label="Previous page"
		class="absolute bottom-0 left-0 -ml-4 flex h-14 w-14 -translate-x-full items-center justify-center rounded-full bg-white/70 text-gray-800 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 lg:-ml-8 pointer-events-auto"
	>
		<!-- Heroicon: chevron-left -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="h-7 w-7"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
		</svg>
	</button>

	<!-- 
    Next Button:
    - `pointer-events-auto`: Also re-enabling clicks for this button.
  -->
	<button
		onclick={onNext}
		disabled={!hasNextPage}
		aria-label="Next page"
		class="absolute right-0 bottom-0 -mr-4 flex h-14 w-14 translate-x-full items-center justify-center rounded-full bg-white/70 text-gray-800 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 lg:-mr-8 pointer-events-auto"
	>
		<!-- Heroicon: chevron-right -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="h-7 w-7"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
		</svg>
	</button>
</div>

<!-- ======================================================= -->
<!-- ==     MOBILE STATIC PAGINATION (<md) (Unchanged)   == -->
<!-- ======================================================= -->
<div class="mt-8 flex items-center justify-between md:hidden">
	<button
		onclick={onPrev}
		disabled={isFirstPage}
		class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white p-2 text-gray-700 shadow-md ring-1 ring-gray-200 transition-all ring-inset hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
		aria-label="Previous page"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="h-6 w-6"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
		</svg>
	</button>
	<button
		onclick={onNext}
		disabled={!hasNextPage}
		class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white p-2 text-gray-700 shadow-md ring-1 ring-gray-200 transition-all ring-inset hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
		aria-label="Next page"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="h-6 w-6"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
		</svg>
	</button>
</div>