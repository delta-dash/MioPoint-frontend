<script lang="ts">
	import { tick } from 'svelte';
	import type { Action } from 'svelte/action';
	import type { Snippet } from 'svelte';

	type PortalTarget = string | HTMLElement;

	// Props are now defined with $props
	let { target = 'body', children } = $props<{
		target?: PortalTarget;
		children: Snippet;
	}>();

	/**
	 * A Svelte Action that moves the given element to a specified target in the DOM.
	 *
	 * @param {HTMLElement} el The element the action is applied to.
	 * @param {PortalTarget} target DOM Element or CSS Selector to move the element to.
	 */
	const portal: Action<HTMLElement, PortalTarget | undefined> = (el, target) => {
		let targetEl: HTMLElement;

		async function update(newTarget: PortalTarget = 'body') {
			if (typeof newTarget === 'string') {
				const foundEl = document.querySelector<HTMLElement>(newTarget);
				if (foundEl) {
					targetEl = foundEl;
				} else {
					// Wait for the next DOM update and try again
					await tick();
					const foundElAfterTick = document.querySelector<HTMLElement>(newTarget);
					if (foundElAfterTick) {
						targetEl = foundElAfterTick;
					} else {
						throw new Error(`No element found matching css selector: "${newTarget}"`);
					}
				}
			} else if (newTarget instanceof HTMLElement) {
				targetEl = newTarget;
			} else {
				throw new TypeError(
					`Unknown portal target type: ${
						newTarget === null ? 'null' : typeof newTarget
					}. Allowed types: string (CSS selector) or HTMLElement.`
				);
			}

			// 1. Move the element to its new parent
			targetEl.appendChild(el);
			
			// 2. *** THIS IS THE CRUCIAL FIX ***
			// After the element is in its final destination, make it visible.
			el.hidden = false;
		}

		function destroy() {
			// Only remove the element if it's still parented
			if (el.parentNode) {
				el.parentNode.removeChild(el);
			}
		}

		update(target);

		return {
			update,
			destroy
		};
	};
</script>

<!-- 
  The div starts hidden to prevent a flash of content in the original location
  before the `portal` action moves it.
-->
<div use:portal={target} hidden>
	<!-- Slots are replaced by rendering the `children` snippet -->
	{@render children()}
</div>