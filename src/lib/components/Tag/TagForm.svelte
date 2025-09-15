<script lang="ts">
	// --- TYPE DEFINITIONS (Assume these are available globally or imported) ---
	type FormMode = 'create' | 'edit';
	
	type Events = {
		onsubmit: (payload: CreateTagPayload | EditTagPayload) => void;
		oncancel: () => void;
	};

	// --- PROPS ---
	const {
		mode,
		tag = null,
		onsubmit,
		oncancel
	}: { mode: FormMode; tag?: TagDetail | null } & Events = $props();

	// --- COMPONENT STATE ---
	// Holds the current state of the form fields
	let form = $state({
		name: '',
		aliasOf: '',
		isProtectionTag: false,
		parents: [] as TagReference[] // This is the new, single source of truth for parents
	});

	// A separate state for the UI input used to add a new parent
	let newParentName = $state('');

	// Stores the original state of the tag to detect changes for the PATCH payload
	let initialTagState = {
		name: '',
		aliasOf: '',
		parents: [] as TagReference[]
	};

	// --- LOGIC ---

	// This effect initializes or resets the form when props change
	$effect(() => {
		if (mode === 'edit' && tag) {
			// Populate form for editing
			form.name = tag.name;
			form.aliasOf = tag.canonical_tag?.name ?? '';
			form.isProtectionTag = tag.is_protection_tag;
			// Make a deep copy for manipulation and comparison
			form.parents = JSON.parse(JSON.stringify(tag.parents));

			// Store the initial state for comparison on submit
			initialTagState.name = tag.name;
			initialTagState.aliasOf = tag.canonical_tag?.name ?? '';
			initialTagState.parents = JSON.parse(JSON.stringify(tag.parents));
		} else {
			// Reset form for creation
			form.name = '';
			form.aliasOf = '';
			form.isProtectionTag = false;
			form.parents = [];
			newParentName = '';
			initialTagState = { name: '', aliasOf: '', parents: [] };
		}
	});

	function addParent() {
		const trimmedName = newParentName.trim();
		if (trimmedName && !form.parents.some((p) => p.name === trimmedName)) {
			// Add the new parent. Since we don't have an ID, use a placeholder.
			// The backend will resolve it by name.
			form.parents.push({ id: -1, name: trimmedName });
			form.parents = form.parents; // Trigger reactivity
			newParentName = ''; // Clear the input
		}
	}

	function removeParent(parentToRemove: TagReference) {
		form.parents = form.parents.filter((p) => p.name !== parentToRemove.name);
	}

	function handleSubmit(event: Event) {
		event.preventDefault(); // Prevent default form submission
		if (!onsubmit) return;

		if (mode === 'create') {
			const payload: CreateTagPayload = {
				name: form.name.trim(),
				is_protection_tag: form.isProtectionTag
			};
			if (form.parents.length > 0) {
				payload.parents = form.parents.map((p) => p.name);
			}
			if (form.aliasOf.trim()) {
				payload.alias_of = form.aliasOf.trim();
			}
			onsubmit(payload);
		} else if (mode === 'edit') {
			// For PATCH, we only send fields that have changed.
			const payload: EditTagPayload = {};

			// Check if name changed
			if (form.name.trim() !== initialTagState.name) {
				payload.name = form.name.trim();
			}

			// Check if alias changed
			if (form.aliasOf.trim() !== initialTagState.aliasOf) {
				payload.alias_of = form.aliasOf.trim() || null; // Send null to remove alias
			}

			// Check if parent list changed by comparing the names
			const initialParentNames = initialTagState.parents.map((p) => p.name).sort();
			const currentParentNames = form.parents.map((p) => p.name).sort();
			// A simple way to compare sorted string arrays without a library
			if (JSON.stringify(initialParentNames) !== JSON.stringify(currentParentNames)) {
				payload.parents = form.parents.map((p) => p.name);
			}

			// Note: is_protection_tag edit is not in your current backend model, but could be added here if needed.

			onsubmit(payload);
		}
	}
</script>

<form onsubmit={handleSubmit} class="animate-fade-in space-y-6">
	<!-- Tag Name -->
	<div>
		<label for="tagName" class="block text-sm font-medium text-gray-300">Tag Name</label>
		<input
			id="tagName"
			type="text"
			bind:value={form.name}
			required
			class="mt-1 block w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</div>

	<!-- Parent Management (New UI) -->
	<div>
		<!-- A11Y FIX: Added for="addParentInput" to associate with the input below -->
		<label for="addParentInput" class="block text-sm font-medium text-gray-300">Parents</label>
		<!-- List of current parent pills -->
		<div class="mt-2 flex min-h-[42px] flex-wrap gap-2 rounded-lg border border-gray-600 bg-gray-700 p-2">
			{#if form.parents.length === 0}
				<span class="p-2 text-sm text-gray-400">No parents assigned.</span>
			{/if}
			{#each form.parents as parent (parent.name)}
				<span class="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white">
					{parent.name}
					<button
						type="button"
						onclick={() => removeParent(parent)}
						class="flex items-center justify-center rounded-full text-blue-200 transition-colors hover:bg-black/20 hover:text-white"
						aria-label="Remove {parent.name}"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</span>
			{/each}
		</div>
		<!-- Input to add a new parent -->
		<div class="mt-2 flex gap-2">
			<!-- A11Y FIX: Added id="addParentInput" to be associated with the label above -->
			<input
				id="addParentInput"
				type="text"
				bind:value={newParentName}
				onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addParent())}
				placeholder="Type a parent name to add"
				class="block w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<button
				type="button"
				onclick={addParent}
				class="flex-shrink-0 rounded-lg bg-gray-600 px-4 py-2 font-bold text-white transition-colors hover:bg-gray-500"
			>
				Add
			</button>
		</div>
	</div>

	<!-- Alias -->
	<div>
		<label for="aliasOf" class="block text-sm font-medium text-gray-300">
			Alias Of (Canonical Tag Name)
		</label>
		<input
			id="aliasOf"
			type="text"
			bind:value={form.aliasOf}
			placeholder="Leave empty if not an alias"
			class="mt-1 block w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
		<p class="mt-1 text-xs text-gray-400">Setting this will override any parents.</p>
	</div>

	<!-- Protection Tag (Create only) -->
	{#if mode === 'create'}
		<div class="flex items-center">
			<input
				id="isProtectionTag"
				type="checkbox"
				bind:checked={form.isProtectionTag}
				class="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
			/>
			<label for="isProtectionTag" class="ml-2 block text-sm text-gray-300">Is Protection Tag</label>
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex gap-4 border-t border-gray-700 pt-4">
		<button
			type="submit"
			class="rounded-lg bg-green-600 px-6 py-2 font-bold text-white transition-colors hover:bg-green-700"
		>
			{mode === 'create' ? 'Create Tag' : 'Save Changes'}
		</button>
		<button
			type="button"
			onclick={oncancel}
			class="rounded-lg bg-gray-600 px-4 py-2 font-bold text-white transition-colors hover:bg-gray-700"
		>
			Cancel
		</button>
	</div>
</form>

<style>
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(5px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.animate-fade-in {
		animation: fade-in 0.3s ease-out forwards;
	}
</style>