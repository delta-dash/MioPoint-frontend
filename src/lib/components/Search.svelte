<!-- src/lib/components/Search.svelte -->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	// --- TYPE DEFINITIONS (MODIFIED) ---
	type FilterKey = keyof ApiSearchQuery;
	interface BaseFilter {
		id: number;
		key: FilterKey;
		label: string;
	}
	interface TextFilter extends BaseFilter {
		type: 'text';
		key: 'filename'; // 'file_type' is now its own type
		value: string;
	}
	// --- NEW: FileTypeFilter definition ---
	interface FileTypeFilter extends BaseFilter {
		type: 'file_type';
		key: 'file_type';
		value: string[]; // It holds an array of selected types
	}
	interface TagsFilter extends BaseFilter {
		type: 'tags';
		key: 'tags' | 'exclude_tags' | 'meta_tags' | 'exclude_meta_tags';
		value: string[];
	}
	interface BooleanFilter extends BaseFilter {
		type: 'boolean';
		key: 'is_encrypted';
		value: boolean;
	}
	interface RangeFilter extends BaseFilter {
		type: 'range';
		key: 'duration_min';
		min: number | null;
		max: number | null;
	}
	// --- MODIFIED: Add FileTypeFilter to the union type ---
	type ActiveFilter = TextFilter | TagsFilter | BooleanFilter | RangeFilter | FileTypeFilter;
	type Props = { onsearch: (query: ApiSearchQuery) => void };

	// --- PROPS & STATE ---
	let { onsearch }: Props = $props();

	let mainSearchTerm = $state('');
	let activeFilters = $state<ActiveFilter[]>([]);
	let showOptions = $state(false);
	let nextId = $state(0);

	// --- MODIFIED: Update advancedSearchOptions ---
	const advancedSearchOptions = [
		{ key: 'filename', label: 'Filename', type: 'text' },
		{ key: 'file_type', label: 'File Type', type: 'file_type' }, // Changed type to 'file_type'
		{ key: 'tags', label: 'Has Tags', type: 'tags' },
		{ key: 'exclude_tags', label: 'Excludes Tags', type: 'tags' },
		{ key: 'meta_tags', label: 'Has Meta Tags', type: 'tags' },
		{ key: 'exclude_meta_tags', label: 'Excludes Meta Tags', type: 'tags' },
		{ key: 'is_encrypted', label: 'Is Encrypted', type: 'boolean' },
		{ key: 'duration_min', label: 'Duration (sec)', type: 'range' }
	];

	// Available file types for the checkbox UI
	const availableFileTypes = [
		{ id: 'image', label: 'Image' },
		{ id: 'video', label: 'Video' },
		{ id: 'audio', label: 'Audio' },
		{ id: 'document', label: 'Document' }
	];

	// --- CORE LOGIC ---
	function triggerSearch(e?: SubmitEvent|Event & { currentTarget: EventTarget & HTMLInputElement; }) {
		e?.preventDefault();
		const query: ApiSearchQuery = {};
		if (mainSearchTerm.trim()) {
			query.search = mainSearchTerm.trim();
		}
		activeFilters.forEach((filter) => {
			switch (filter.type) {
				case 'text':
					if (filter.value.trim()) query[filter.key] = filter.value.trim();
					break;
				// --- MODIFIED: Handle file_type filter ---
				case 'file_type':
					// The parent component's fetch logic will handle converting this array
					// into multiple query parameters.
					if (filter.value.length > 0) query[filter.key] = filter.value;
					break;
				case 'tags':
					if (filter.value.length > 0) query[filter.key] = filter.value.join(',');
					break;
				case 'boolean':
					query[filter.key] = filter.value;
					break;
				case 'range':
					if (filter.min !== null && filter.min > 0) query.duration_min = filter.min;
					if (filter.max !== null && filter.max > 0) query.duration_max = filter.max;
					break;
			}
		});
		showOptions = false; // Hide dropdown on search
		onsearch(query);
	}

	function addFilter(option: (typeof advancedSearchOptions)[0]) {
		let newFilter: ActiveFilter;
		switch (option.type) {
			case 'text':
				newFilter = {
					id: nextId++,
					key: option.key as TextFilter['key'],
					type: 'text',
					value: '',
					label: option.label
				};
				break;
			// --- MODIFIED: Handle adding a new file_type filter ---
			case 'file_type':
				newFilter = {
					id: nextId++,
					key: 'file_type',
					type: 'file_type',
					value: [], // Start with an empty array
					label: option.label
				};
				break;
			case 'tags':
				newFilter = {
					id: nextId++,
					key: option.key as TagsFilter['key'],
					type: 'tags',
					value: [],
					label: option.label
				};
				break;
			case 'boolean':
				newFilter = {
					id: nextId++,
					key: 'is_encrypted',
					type: 'boolean',
					value: true,
					label: option.label
				};
				break;
			case 'range':
				newFilter = {
					id: nextId++,
					key: 'duration_min',
					type: 'range',
					min: null,
					max: null,
					label: option.label
				};
				break;
			default:
				throw new Error(`Unsupported filter type`);
		}
		// Prevent adding multiple filters of the same key for non-tag types
		if (!activeFilters.some((f) => f.key === newFilter.key) || newFilter.type === 'tags') {
			activeFilters.push(newFilter);
		}
		showOptions = false;
	}

	function removeFilter(id: number) {
		activeFilters = activeFilters.filter((f) => f.id !== id);
		// Use requestAnimationFrame to ensure the DOM has updated before triggering the search
		requestAnimationFrame(() => triggerSearch());
	}

	// --- TAG-SPECIFIC HANDLERS (Unchanged) ---
	function handleTagInput(event: Event, filter: TagsFilter) {
		const input = event.target as HTMLInputElement;
		const value = input.value;
		if (value.endsWith(',')) {
			const newTag = value.slice(0, -1).trim();
			if (newTag && !filter.value.includes(newTag)) {
				filter.value = [...filter.value, newTag];
			}
			input.value = '';
		}
	}
	function handleTagKeyDown(event: KeyboardEvent, filter: TagsFilter) {
		const input = event.target as HTMLInputElement;
		if (event.key === 'Enter') {
			const newTag = input.value.trim();
			if (newTag && !filter.value.includes(newTag)) {
				filter.value = [...filter.value, newTag];
			}
			input.value = '';
		} else if (event.key === 'Backspace' && input.value === '') {
			filter.value = filter.value.slice(0, -1);
		}
	}
	function handleTagPaste(event: ClipboardEvent, filter: TagsFilter) {
		event.preventDefault();
		const pasteData = event.clipboardData?.getData('text') || '';
		if (!pasteData) return;
		const newTags = pasteData
			.split(/[,\n\t]+/)
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
		if (newTags.length > 0) {
			const combined = new Set([...filter.value, ...newTags]);
			filter.value = Array.from(combined);
		}
	}
	function removeTag(filter: TagsFilter, tagToRemove: string) {
		filter.value = filter.value.filter((t) => t !== tagToRemove);
		triggerSearch();
	}
	function toggleBooleanFilter(filter: BooleanFilter) {
		filter.value = !filter.value;
		triggerSearch();
	}

	// --- UTILITY ACTION (Unchanged) ---
	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
				showOptions = false;
			}
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}
</script>

<div class="relative" use:clickOutside>
	<form
		onsubmit={triggerSearch}
		class="flex w-full flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border bg-white p-2 shadow-sm transition-shadow"
		class:border-blue-500={showOptions}
		class:shadow-md={showOptions}
		class:border-slate-300={!showOptions}
	>
		<div class="flex min-w-0 flex-grow items-center">
			<svg
				class="ml-1 h-5 w-5 flex-shrink-0 text-slate-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/></svg
			>
			<input
				type="search"
				bind:value={mainSearchTerm}
				onfocus={() => (showOptions = true)}
				placeholder="Search or add a filter..."
				class="w-full bg-transparent p-2 text-slate-800 placeholder-slate-400 focus:outline-none"
			/>
		</div>

		<!-- Rendered active filter pills -->
		{#each activeFilters as filter (filter.id)}
			<!-- Text Filter Pill -->
			{#if filter.type === 'text'}
				<!-- ... (unchanged) ... -->
				<div
					class="flex h-8 items-center gap-1 rounded-full bg-slate-100 whitespace-nowrap text-slate-700"
				>
					<span class="flex-shrink-0 pl-3 text-sm font-medium">{filter.label}:</span>
					<input
						type="text"
						bind:value={filter.value}
						placeholder="type..."
						class="w-32 bg-transparent p-1 text-sm focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 rounded-full p-1 transition-colors hover:bg-slate-200"
						aria-label="Remove filter"
						><svg
							class="h-4 w-4 text-slate-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/></svg
						></button
					>
				</div>
			<!-- --- NEW: File Type Filter Pill --- -->
			{:else if filter.type === 'file_type'}
				<div
					class="flex min-h-8 items-center gap-1 rounded-lg bg-slate-100 py-1 whitespace-nowrap text-slate-700"
				>
					<span class="flex-shrink-0 py-1 pl-3 text-sm font-medium">{filter.label}:</span>
					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-2">
						{#each availableFileTypes as typeOption}
							<label class="flex items-center gap-1.5 cursor-pointer text-sm">
								<input
									type="checkbox"
									value={typeOption.id}
									bind:group={filter.value}
									onchange={triggerSearch}
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								{typeOption.label}
							</label>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 self-center rounded-full p-1 transition-colors hover:bg-slate-200"
						aria-label="Remove filter"
						><svg
							class="h-4 w-4 text-slate-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/></svg
						></button
					>
				</div>
			{:else if filter.type === 'tags'}
				<!-- ... (unchanged) ... -->
				<div
					class="flex min-h-8 items-start gap-1 rounded-lg bg-slate-100 py-1 whitespace-nowrap text-slate-700"
				>
					<span class="flex-shrink-0 py-1 pl-3 text-sm font-medium">{filter.label}:</span>
					<div class="flex flex-wrap items-center gap-1.5 pl-1">
						{#each filter.value as tag (tag)}
							<div
								animate:flip={{ duration: 250 }}
								class="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm"
							>
								<span>{tag}</span>
								<button
									type="button"
									onclick={() => removeTag(filter, tag)}
									class="hover:text-red-500"
									aria-label="Remove tag"
									><svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/></svg
									></button
								>
							</div>
						{/each}
						<input
							type="text"
							oninput={(e) => handleTagInput(e, filter)}
							onkeydown={(e) => handleTagKeyDown(e, filter)}
							onpaste={(e) => handleTagPaste(e, filter)}
							placeholder="add..."
							class="w-24 bg-transparent p-1 text-sm focus:outline-none"
						/>
					</div>
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 self-center rounded-full p-1 transition-colors hover:bg-slate-200"
						aria-label="Remove filter"
						><svg
							class="h-4 w-4 text-slate-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/></svg
						></button
					>
				</div>
			{:else if filter.type === 'boolean' || filter.type === 'range'}
				<!-- ... (unchanged) ... -->
				<div
					class="flex h-8 items-center gap-1 rounded-full bg-slate-100 whitespace-nowrap text-slate-700"
				>
					<span class="flex-shrink-0 pl-3 text-sm font-medium">{filter.label}:</span>
					{#if filter.type === 'boolean'}
						<button
							type="button"
							onclick={() => toggleBooleanFilter(filter)}
							class="mx-2 rounded px-2 py-0.5 text-xs font-bold"
							class:bg-green-500={filter.value}
							class:text-white={filter.value}
							class:bg-red-200={!filter.value}
							class:text-red-800={!filter.value}
						>
							{filter.value ? 'YES' : 'NO'}
						</button>
					{:else if filter.type === 'range'}
						<input
							type="number"
							bind:value={filter.min}
							placeholder="min"
							class="w-16 rounded-md border-gray-300 bg-white p-1 text-sm shadow-sm"
						/>
						<span class="text-xs text-gray-400">to</span>
						<input
							type="number"
							bind:value={filter.max}
							placeholder="max"
							class="w-16 rounded-md border-gray-300 bg-white p-1 text-sm shadow-sm"
						/>
					{/if}
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 rounded-full p-1 transition-colors hover:bg-slate-200"
						aria-label="Remove filter"
						><svg
							class="h-4 w-4 text-slate-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/></svg
						></button
					>
				</div>
			{/if}
		{/each}

		<div class="ml-auto flex-shrink-0">
			<!-- ... (unchanged) ... -->
			<button
				type="submit"
				class="flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
				aria-label="Trigger Search"
			>
				Search
			</button>
		</div>
	</form>

	{#if showOptions}
		<!-- ... (unchanged) ... -->
		<div
			transition:slide={{ duration: 150 }}
			class="absolute top-full left-0 z-20 mt-2 w-full origin-top-right rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
		>
			<p class="px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Add a Filter</p>
			<ul class="space-y-1">
				{#each advancedSearchOptions as option}
					{@const isAlreadyActive = activeFilters.some(f => f.key === option.key && f.type !== 'tags')}
					<li>
						<button
							type="button"
							disabled={isAlreadyActive}
							onclick={() => addFilter(option)}
							class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
							class:opacity-50={isAlreadyActive}
							class:cursor-not-allowed={isAlreadyActive}
						>
							<span>{option.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>