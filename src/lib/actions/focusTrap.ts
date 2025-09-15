// src/lib/actions/focusTrap.ts (or similar)
export function focusTrap(node: HTMLElement) {
    const focusableElements =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function handleKeydown(event: KeyboardEvent) {
        if (event.key !== 'Tab') return;

        const focusables = Array.from(node.querySelectorAll < HTMLElement > (focusableElements));
        if (focusables.length === 0) return;

        const firstFocusable = focusables[0];
        const lastFocusable = focusables[focusables.length - 1];

        if (event.shiftKey) {
            // If Shift+Tab on the first element, wrap to the last
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                event.preventDefault();
            }
        } else {
            // If Tab on the last element, wrap to the first
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                event.preventDefault();
            }
        }
    }

    document.addEventListener('keydown', handleKeydown);

    return {
        destroy() {
            document.removeEventListener('keydown', handleKeydown);
        }
    };
}