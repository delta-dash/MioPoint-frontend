<script lang="ts">
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { Search as SearchIcon, X } from 'lucide-svelte';
	import { searchStore } from '$lib/searchStore'; // <-- 1. IMPORT THE STORE

	// --- CONSTANTS ---
	const advancedSearchOptions = [
		{ key: 'filename', label: 'Filename', type: 'text' },
		{ key: 'file_type', label: 'File Type', type: 'file_type' },
		{ key: 'tags', label: 'Has Tags', type: 'tags' },
		{ key: 'exclude_tags', label: 'Excludes Tags', type: 'tags' },
		{ key: 'meta_tags', label: 'Has Meta Tags', type: 'tags' },
		{ key: 'exclude_meta_tags', label: 'Excludes Meta Tags', type: 'tags' },
		{ key: 'is_encrypted', label: 'Is Encrypted', type: 'boolean' },
		{ key: 'duration_min', label: 'Duration (sec)', type: 'range' },
		{ key: 'folder_id', label: 'Folder ID', type: 'text' },
		{ key: 'page_size', label: 'Page Size', type: 'text' },
		{ key: 'mode', label: 'Search Mode', type: 'mode' }
	] as const;

	const availableFileTypes = [
		{ id: 'image', label: 'Image' },
		{ id: 'video', label: 'Video' },
//		{ id: 'generic', label: 'Generic' },
		{ id: 'text', label: 'Text' }
	];

	// --- INTERNAL UI STATE ---
	let mainSearchTerm = $state('');
	let activeFilters: ActiveFilter[] = $state([]);
	let nextId = $state(0);
	let showOptions = $state(false);

	/**
	 * Helper function to translate a query object into the component's internal UI state.
	 */
	function buildStateFromQuery(query: ApiSearchQuery) {
		const newFilters: ActiveFilter[] = [];
		let idCounter = 0;

		for (const [key, value] of Object.entries(query)) {
			if (key === 'search' || value === undefined || value === null || value === '') continue;

			const option = advancedSearchOptions.find((o) => o.key === key);
			if (!option && key !== 'duration_max') continue;
			if (key === 'duration_max' && newFilters.some((f) => f.key === 'duration_min')) continue;

			const baseOption = option ?? advancedSearchOptions.find((o) => o.key === 'duration_min')!;
			let newFilter: ActiveFilter | null = null;

			switch (baseOption.type) {
				// ... (this entire switch case is unchanged from your last version) ...
				case 'text':
					newFilter = {
						id: idCounter++,
						key: baseOption.key as TextFilter['key'],
						type: 'text',
						value: String(value),
						label: baseOption.label
					};
					break;
				case 'file_type':
					const fileTypes = Array.isArray(value) ? value : String(value).split(',');
					newFilter = {
						id: idCounter++,
						key: 'file_type',
						type: 'file_type',
						value: fileTypes,
						label: baseOption.label
					};
					break;
				case 'tags':
					const tags = Array.isArray(value) ? value : String(value).split(',');
					newFilter = {
						id: idCounter++,
						key: baseOption.key as TagsFilter['key'],
						type: 'tags',
						value: tags,
						label: baseOption.label
					};
					break;
				case 'boolean':
					newFilter = {
						id: idCounter++,
						key: 'is_encrypted',
						type: 'boolean',
						value: value === true || String(value) === 'true',
						label: baseOption.label
					};
					break;
				case 'range':
					newFilter = {
						id: idCounter++,
						key: 'duration_min',
						type: 'range',
						min: query.duration_min ?? null,
						max: query.duration_max ?? null,
						label: baseOption.label
					};
					break;
				case 'mode':
					newFilter = {
						id: idCounter++,
						key: 'mode',
						type: 'mode',
						value: value as ModeFilter['value'],
						label: baseOption.label
					};
					break;
			}
			if (newFilter) newFilters.push(newFilter);
		}

		return {
			mainSearchTerm: query.search || '',
			activeFilters: newFilters,
			nextId: idCounter
		};
	}

	// --- 2. EFFECT TO SYNC UI WITH THE STORE ---
	// This reactive effect subscribes to the central store. Whenever the store's
	// value changes (e.g., from a URL change), this code runs to update the component's UI.
	$effect(() => {
		const query = $searchStore;
		const state = buildStateFromQuery(query);
		mainSearchTerm = state.mainSearchTerm;
		activeFilters = state.activeFilters;
		nextId = state.nextId;
	});

	/**
	 * Builds a new query object from the current UI state and updates the central store.
	 */
	function triggerSearch(e?: Event) {
		e?.preventDefault();
		const query: ApiSearchQuery = {};
		if (mainSearchTerm.trim()) {
			query.search = mainSearchTerm.trim();
		}

		activeFilters.forEach((filter) => {
			switch (filter.type) {
				case 'text':
					if (filter.key === 'folder_id' || filter.key === 'page_size') {
						let numValue = parseInt(filter.value, 10);
						if (!isNaN(numValue) && numValue > 0) {
							if (filter.key === 'page_size' && numValue > 100) {
								numValue = 100;
								filter.value = '100'; // Update UI to reflect capped value
							}
							(query as any)[filter.key] = numValue;
						}
					} else if (filter.value.trim()) {
						(query as any)[filter.key] = filter.value.trim();
					}
					break;
				case 'file_type':
					if (filter.value.length > 0) query[filter.key] = filter.value;
					break;
				case 'tags':
					if (filter.value.length > 0) query[filter.key] = filter.value.join(',');
					break;
				case 'boolean':
					query[filter.key] = filter.value;
					break;
				case 'range':
					if (filter.min !== null && filter.min >= 0) query.duration_min = filter.min;
					if (filter.max !== null && filter.max > 0) query.duration_max = filter.max;
					break;
				case 'mode':
					query[filter.key] = filter.value;
					break;
			}
		});

		showOptions = false;
		// --- 3. THE BIG CHANGE: UPDATE THE STORE ---
		// Instead of emitting an event, we tell the central store about the new query.
		// The store will handle saving, navigation, and notifying all other subscribers.
		searchStore.set(query);
	}

	// --- UI HELPER FUNCTIONS (UNCHANGED) ---
	function addFilter(option: (typeof advancedSearchOptions)[number]) {
		let newFilter: ActiveFilter;
		switch (option.type) {
			case 'text':
				newFilter = {
					id: nextId++,
					key: option.key,
					type: 'text',
					value: '',
					label: option.label
				};
				break;
			case 'file_type':
				newFilter = {
					id: nextId++,
					key: 'file_type',
					type: 'file_type',
					value: [],
					label: option.label
				};
				break;
			case 'tags':
				newFilter = { id: nextId++, key: option.key, type: 'tags', value: [], label: option.label };
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
			case 'mode':
				newFilter = {
					id: nextId++,
					key: 'mode',
					type: 'mode',
					value: 'expanded',
					label: option.label
				};
				break;
		}
		if (!activeFilters.some((f) => f.key === newFilter.key) || newFilter.type === 'tags') {
			activeFilters = [...activeFilters, newFilter];
		}
		showOptions = false;
	}

	function removeFilter(id: number) {
		activeFilters = activeFilters.filter((f) => f.id !== id);
		requestAnimationFrame(() => triggerSearch());
	}

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
			event.preventDefault();
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
		const newTags = pasteData
			.split(/[,\n\t]+/)
			.map((tag) => tag.trim())
			.filter(Boolean);
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
	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (!node.contains(event.target as Node)) {
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

<!-- The entire template remains exactly the same as your original version -->
<div class="relative" use:clickOutside>
	<form
		onsubmit={triggerSearch}
		class="flex w-full flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border bg-white p-2 shadow-sm transition-shadow dark:bg-gray-800"
		class:border-blue-500={showOptions}
		class:shadow-md={showOptions}
		class:border-slate-300={!showOptions}
		class:dark:border-gray-600={!showOptions}
	>
		<div class="flex min-w-0 flex-grow items-center">
			<SearchIcon class="ml-1 h-5 w-5 flex-shrink-0 text-slate-400" />
			<input
				type="search"
				bind:value={mainSearchTerm}
				onfocus={() => (showOptions = true)}
				placeholder="Search or add a filter..."
				class="w-full bg-transparent p-2 text-slate-800 placeholder-slate-400 focus:outline-none dark:text-gray-200 dark:placeholder-gray-500"
			/>
		</div>

		<!-- Rendered active filter pills -->
		{#each activeFilters as filter (filter.id)}
			<!-- Text Filter Pill -->
			{#if filter.type === 'text'}
				<div
					class="flex h-8 items-center gap-1 rounded-full bg-slate-100 whitespace-nowrap text-slate-700 dark:bg-gray-700 dark:text-gray-200"
				>
					<span class="flex-shrink-0 pl-3 text-sm font-medium">{filter.label}:</span>
					<input
						type={filter.key === 'folder_id' || filter.key === 'page_size' ? 'number' : 'text'}
						max={filter.key === 'page_size' ? '100' : undefined}
						min={filter.key === 'page_size' ? '1' : undefined}
						bind:value={filter.value}
						placeholder="type..."
						class="w-32 bg-transparent p-1 text-sm focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-gray-600"
						aria-label="Remove filter"
						><X class="h-4 w-4 text-slate-500 dark:text-gray-400" /></button
					>
				</div>
			{:else if filter.type === 'file_type'}
				<div
					class="flex min-h-8 items-center gap-1 rounded-lg bg-slate-100 py-1 whitespace-nowrap text-slate-700 dark:bg-gray-700 dark:text-gray-200"
				>
					<span class="flex-shrink-0 py-1 pl-3 text-sm font-medium">{filter.label}:</span>
					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-2">
						{#each availableFileTypes as typeOption}
							<label class="flex cursor-pointer items-center gap-1.5 text-sm">
								<input
									type="checkbox"
									value={typeOption.id}
									bind:group={filter.value}
									onchange={triggerSearch}
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:focus:ring-blue-600"
								/>
								{typeOption.label}
							</label>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 self-center rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-gray-600"
						aria-label="Remove filter"
						><X class="h-4 w-4 text-slate-500 dark:text-gray-400" /></button
					>
				</div>
			{:else if filter.type === 'tags'}
				<div
					class="flex min-h-8 items-start gap-1 rounded-lg bg-slate-100 py-1 whitespace-nowrap text-slate-700 dark:bg-gray-700 dark:text-gray-200"
				>
					<span class="flex-shrink-0 py-1 pl-3 text-sm font-medium">{filter.label}:</span>
					<div class="flex flex-wrap items-center gap-1.5 pl-1">
						{#each filter.value as tag (tag)}
							<div
								animate:flip={{ duration: 250 }}
								class="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm dark:bg-gray-600"
							>
								<span>{tag}</span>
								<button
									type="button"
									onclick={() => removeTag(filter, tag)}
									class="hover:text-red-500"
									aria-label="Remove tag"><X class="h-3 w-3" /></button
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
						class="mr-1 self-center rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-gray-600"
						aria-label="Remove filter"
						><X class="h-4 w-4 text-slate-500 dark:text-gray-400" /></button
					>
				</div>
			{:else if filter.type === 'boolean' || filter.type === 'range' || filter.type === 'mode'}
				<div
					class="flex h-8 items-center gap-1 rounded-full bg-slate-100 whitespace-nowrap text-slate-700 dark:bg-gray-700 dark:text-gray-200"
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
							class="w-16 rounded-md border-gray-300 bg-white p-1 text-sm shadow-sm dark:border-gray-500 dark:bg-gray-600"
						/>
						<span class="text-xs text-gray-400">to</span>
						<input
							type="number"
							bind:value={filter.max}
							placeholder="max"
							class="w-16 rounded-md border-gray-300 bg-white p-1 text-sm shadow-sm dark:border-gray-500 dark:bg-gray-600"
						/>
					{:else if filter.type === 'mode'}
						<select
							bind:value={filter.value}
							onchange={triggerSearch}
							class="mx-2 rounded-md border-gray-300 bg-white p-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none dark:border-gray-500 dark:bg-gray-600"
						>
							<option value="expanded">Expanded</option>
							<option value="directory">Directory</option>
							<option value="recursive">Recursive</option>
						</select>
					{/if}
					<button
						type="button"
						onclick={() => removeFilter(filter.id)}
						class="mr-1 rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-gray-600"
						aria-label="Remove filter"
						><X class="h-4 w-4 text-slate-500 dark:text-gray-400" /></button
					>
				</div>
			{/if}
		{/each}

		<div class="ml-auto flex-shrink-0">
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
		<div
			transition:slide={{ duration: 150 }}
			class="absolute top-full left-0 z-20 mt-2 w-full origin-top-right rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-800"
		>
			<p class="px-3 py-2 text-xs font-semibold text-slate-400 uppercase dark:text-gray-500">
				Add a Filter
			</p>
			<ul class="space-y-1">
				{#each advancedSearchOptions as option}
					{@const isAlreadyActive = activeFilters.some(
						(f) => f.key === option.key && f.type !== 'tags'
					)}
					<li>
						<button
							type="button"
							disabled={isAlreadyActive}
							onclick={() => addFilter(option)}
							class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-gray-200 dark:hover:bg-gray-700"
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
