<!-- Modal.svelte -->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import Portal from './Portal.svelte';
	import { focusTrap } from '$lib/actions/focusTrap';

	type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

	let {
		open = $bindable(false),
		onClose = () => {
			open = false;
		},
		title = 'Dialog',
		size = 'md',
		closeOnBackdropClick = true,
		panelClass = '',
		// --- CHANGE 1: Rename the prop to all lowercase ---
		onkeydown,
		children,
		header,
		footer
	}: {
		open?: boolean;
		onClose?: () => void;
		title?: string;
		size?: ModalSize;
		closeOnBackdropClick?: boolean;
		panelClass?: string;
		// --- CHANGE 1.1: Update the type definition ---
		onkeydown?: (event: KeyboardEvent) => boolean | void;
		children: Snippet;
		header?: Snippet;
		footer?: Snippet;
	} = $props();

	let dialogEl: HTMLElement;

	const sizeClasses: Record<ModalSize, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		full: 'max-w-full'
	};

	// --- CHANGE 2: Create a local keydown handler for the modal itself ---
	function handleLocalKeyDown(e: KeyboardEvent) {
		// First, give the parent's custom handler priority.
		if (onkeydown) {
			const wasHandled = onkeydown(e);
			// If the parent handler returns true, it means it took care of the event.
			if (wasHandled) {
				return; // Stop processing here.
			}
		}

		// If the event was not handled by the parent, run the modal's default logic.
		if (e.key === 'Escape') {
			onClose();
		}
	}

	// --- CHANGE 3: Simplify the effect. No more window event listener! ---
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
			// Focus the dialog so it can receive keydown events.
			dialogEl?.focus();
		}

		// Cleanup function
		return () => {
			document.body.style.overflow = '';
		};
	});

	function handleBackdropClick() {
		if (closeOnBackdropClick) {
			onClose();
		}
	}
</script>

<Portal>
	{#if open}
		<div
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
			onclick={handleBackdropClick}
			role="presentation"
		>
			<div
				bind:this={dialogEl}
				use:focusTrap
				class="relative m-4 flex max-h-[90vh] flex-col rounded-lg bg-white shadow-xl {panelClass}"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
				tabindex="-1"
				onkeydown={handleLocalKeyDown}
			>
				<!-- Header -->
				<div class="flex flex-shrink-0 items-center justify-between border-b p-4">
					{#if header}
						{@render header()}
					{:else}
						<h3 id="modal-title" class="text-xl font-semibold text-gray-800">{title}</h3>
						<button
							onclick={onClose}
							class="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
							aria-label="Close modal"
						>
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					{/if}
				</div>

				<!-- Body -->
				<div class="flex-grow overflow-y-auto p-6">
					{@render children()}
				</div>

				<!-- Footer -->
				{#if footer}
					<div class="flex flex-shrink-0 items-center justify-end gap-3 border-t p-4">
						{@render footer()}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</Portal>
