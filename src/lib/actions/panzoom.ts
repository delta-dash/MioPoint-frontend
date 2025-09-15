// src/lib/actions/panzoom.ts

/**
 * A Svelte action for pan and zoom functionality on an HTML element.
 *
 * Dispatches the following custom events:
 * - `panstart`: When the user starts panning.
 * - `panend`: When the user stops panning.
 * - `imageenter`: When the mouse enters the element.
 * - `imageleave`: When the mouse leaves the element.
 */
export function panzoom(node: HTMLElement) {
    let x = 0;
    let y = 0;
    let scale = 1;

    // Use a type assertion to ensure TypeScript knows about the `passive` property,
    // bypassing potential tsconfig issues. This is crucial for event.preventDefault()
    // to work correctly on the 'wheel' event in modern browsers and Svelte 5.
    const wheelEventOptions = { passive: false } as AddEventListenerOptions;

    function updateTransform() {
        // Applies the current transformation to the element's style.
        node.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }

    function handleWheel(event: WheelEvent) {
        event.preventDefault();

        const rect = node.getBoundingClientRect();

        // Get the mouse position relative to the viewport.
        const viewportMouseX = event.clientX;
        const viewportMouseY = event.clientY;

        // Calculate the mouse's position ON THE IMAGE before the zoom,
        // taking into account the current pan (x, y) and zoom (scale).
        // This gives us a stable "normalized" point on the unscaled image.
        const pointX = (viewportMouseX - rect.left) / scale;
        const pointY = (viewportMouseY - rect.top) / scale;

        // Calculate the new scale, clamped within a min/max range.
        const scaleFactor = 0.1;
        const delta = -Math.sign(event.deltaY);
        const newScale = scale * (1 + delta * scaleFactor);
        const clampedScale = Math.max(0.5, Math.min(newScale, 5));
        if (clampedScale === scale) return; // No change, do nothing.

        // Calculate the new pan (x, y) values. The goal is to adjust
        // the pan so that the "normalized" point we calculated earlier
        // ends up back under the mouse cursor after the new scale is applied.
        x += viewportMouseX - rect.left - pointX * clampedScale;
        y += viewportMouseY - rect.top - pointY * clampedScale;

        scale = clampedScale;
        updateTransform();
    }

    let isPanning = false;
    let startX = 0;
    let startY = 0;

    function handlePointerDown(event: PointerEvent) {
        event.preventDefault();
        isPanning = true;
        startX = event.clientX - x;
        startY = event.clientY - y;
        node.style.cursor = 'grabbing';
        node.setPointerCapture(event.pointerId);
        node.dispatchEvent(new CustomEvent('panstart'));
    }

    function handlePointerMove(event: PointerEvent) {
        if (!isPanning) return;
        x = event.clientX - startX;
        y = event.clientY - startY;
        updateTransform();
    }

    function handlePointerUp(event: PointerEvent) {
        if (!isPanning) return;
        isPanning = false;
        node.style.cursor = 'grab';
        node.releasePointerCapture(event.pointerId);
        node.dispatchEvent(new CustomEvent('panend'));
    }

    // Handlers for dispatching hover state to the component
    function handleMouseEnter() {
        node.dispatchEvent(new CustomEvent('imageenter'));
    }

    function handleMouseLeave() {
        node.dispatchEvent(new CustomEvent('imageleave'));
    }

    // --- Initial Setup ---
    node.style.transformOrigin = '0 0';
    node.style.cursor = 'grab';
    updateTransform();

    // --- Add all event listeners ---
    node.addEventListener('wheel', handleWheel, wheelEventOptions);
    node.addEventListener('pointerdown', handlePointerDown);
    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerup', handlePointerUp);
    node.addEventListener('pointercancel', handlePointerUp); // Treat cancel like pointer up
    node.addEventListener('mouseenter', handleMouseEnter);
    node.addEventListener('mouseleave', handleMouseLeave);

    return {
        /**
         * Svelte calls this method when the element is removed from the DOM.
         * It's crucial to clean up all event listeners to prevent memory leaks.
         */
        destroy() {
            node.removeEventListener('wheel', handleWheel, wheelEventOptions);
            node.removeEventListener('pointerdown', handlePointerDown);
            node.removeEventListener('pointermove', handlePointerMove);
            node.removeEventListener('pointerup', handlePointerUp);
            node.removeEventListener('pointercancel', handlePointerUp);
            node.removeEventListener('mouseenter', handleMouseEnter);
            node.removeEventListener('mouseleave', handleMouseLeave);
        }
    };
}