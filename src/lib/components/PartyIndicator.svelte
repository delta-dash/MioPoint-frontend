<script lang="ts">
	import { wsStore } from '$lib/wsStore';
	import { partyIndicatorStore } from '$lib/partyIndicatorStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		PartyPopper,
		LogOut,
		Clapperboard,
		Minimize2,
		Maximize2,
		Pin,
		PinOff
	} from 'lucide-svelte';
	import { fetchWithAuth } from '$lib/services/authapi';

	// --- Props ---
	let { docked = false, priority = 0 } = $props();

	// --- Derived State ---
	const isInAParty = $derived($wsStore.party.threadId !== null);
	const partyFileId = $derived($wsStore.party.fileId);
	const alwaysFollowParty = $derived($partyIndicatorStore.alwaysFollow);

	// --- Local State ---
	let partyFileName = $state<string | null>(null); // Use $state for Svelte 5 reactivity
	let lastKnownPartyFileId: number | null = $wsStore.party.fileId;
	let isLoadingFileName = $state(false);
	let minimized = $state(false);

	// --- Derived State from URL ---
	const currentPageFileId = $derived.by(() => {
		const match = page.url.pathname.match(/^\/file\/(\d+)/);
		return match ? parseInt(match[1], 10) : null;
	});

	const isActivelyInParty = $derived(isInAParty && partyFileId === currentPageFileId);

	// --- Instance ID ---
	const instanceId = Symbol('party-indicator');

	// --- Component Registry ---
	$effect(() => {
		partyIndicatorStore.register(instanceId, priority);
		return () => {
			partyIndicatorStore.unregister(instanceId);
		};
	});

	// --- Visibility Logic ---
	const highestPriority = $derived(
		$partyIndicatorStore.registry.size > 0
			? Math.max(...$partyIndicatorStore.registry.values())
			: -Infinity
	);

	// Render if this instance has the highest priority.
	// If multiple have the same highest priority, they will all render.
	const shouldRender = $derived(priority >= highestPriority);

	// --- API Calls ---
	async function fetchFileName(fileId: number) {
		if (!fileId) {
			partyFileName = null;
			return;
		}
		isLoadingFileName = true;
		try {
			// Assumes a GET endpoint exists at /api/file/{id} to fetch file details.
			const details = await fetchWithAuth<FileDetails>(`/api/instance/${fileId}`);
			partyFileName = details ? details.file_name : `File ID: ${fileId}`;
		} catch (error) {
			console.error('Failed to fetch party file name:', error);
			partyFileName = `File ID: ${fileId}`;
		} finally {
			isLoadingFileName = false;
		}
	}

	function toggleAlwaysFollow() {
		const shouldFollow = !alwaysFollowParty;
		partyIndicatorStore.setAlwaysFollow(shouldFollow);

		// If we are turning it ON and we are not currently on the party page, navigate.
		if (shouldFollow && !isActivelyInParty && partyFileId) {
			goto(`/file/${partyFileId}`, { replaceState: true });
		}
	}

	// --- WebSocket Functions ---
	function leaveWatchParty() {
		if (confirm('Are you sure you want to leave the watch party?')) {
			wsStore.sendMessage({ type: 'leave_watch_party' });
		}
	}

	// --- Effects ---
	$effect(() => {
		if (partyFileId) {
			fetchFileName(partyFileId);
		} else {
			partyFileName = null;
		}
	});

	// This effect handles navigation for followers. It uses `$effect.pre` to run
	// *before* the main `$effect` above, which solves a race condition where the
	// `isActivelyInPartyOnThisTab` state might be updated before we can check it.
	$effect.pre(() => {
		const { threadId, fileId, isOwner } = $wsStore.party;
		if (!threadId || isOwner || !fileId) return;

		const partyFileChanged = fileId !== lastKnownPartyFileId;

		if (partyFileChanged) {
			// Per user request, navigation is now only triggered if the "always follow" pin is active.
			if (alwaysFollowParty) {
				goto(`/file/${fileId}`, { replaceState: true });
			}
		}

		lastKnownPartyFileId = fileId;
	});
</script>

{#if isInAParty && shouldRender}
	{#if docked}
		<!-- Docked Version -->
		<div class="flex w-full flex-col gap-2 rounded-lg bg-gray-200 p-2 text-sm dark:bg-gray-700">
			{#if isActivelyInParty}
				<!-- Docked: Active -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
						<PartyPopper class="h-5 w-5 text-yellow-400" />
						<span>In Party</span>
					</div>
					<div class="flex">
						<button
							onclick={toggleAlwaysFollow}
							class={`rounded-full p-1.5 transition 
		${
			alwaysFollowParty
				? 'bg-green-500/20 text-green-300 hover:bg-green-500/40'
				: 'text-purple-300 hover:bg-purple-600/50'
		}`}
							title={alwaysFollowParty ? 'Auto-navigation is ON' : 'Auto-navigation is OFF'}
						>
							<!-- icon or text here -->
							{#if alwaysFollowParty}
								<Pin class="h-4 w-4" />
							{:else}
								<PinOff class="h-4 w-4" />
							{/if}
						</button>
						<button
							onclick={leaveWatchParty}
							class="rounded-full p-1 text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
							title="Leave Party"
						>
							<LogOut class="h-4 w-4" />
						</button>
					</div>
				</div>
				{#if partyFileId}
					<a
						href={`/file/${partyFileId}`}
						class="flex items-center gap-2 truncate rounded-md bg-slate-600/50 px-2 py-1 text-cyan-300 transition hover:bg-slate-600"
						title={partyFileName || 'Loading...'}
					>
						<Clapperboard class="h-5 w-5 flex-shrink-0" />
						<span class="truncate">
							{isLoadingFileName ? 'Loading...' : partyFileName || `File #${partyFileId}`}
						</span>
					</a>
				{/if}
			{:else}
				<!-- Docked: On Break -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 font-semibold text-purple-300">
						<PartyPopper class="h-5 w-5" />
						<span>On Break</span>
					</div>
					<div class="flex items-center gap-1">
						<button
							onclick={toggleAlwaysFollow}
							class={`rounded-full p-1.5 transition 
		${
			alwaysFollowParty
				? 'bg-green-500/20 text-green-300 hover:bg-green-500/40'
				: 'text-purple-300 hover:bg-purple-600/50'
		}`}
							title={alwaysFollowParty ? 'Auto-navigation is ON' : 'Auto-navigation is OFF'}
						>
							<!-- icon or text here -->
							{#if alwaysFollowParty}
								<Pin class="h-4 w-4" />
							{:else}
								<PinOff class="h-4 w-4" />
							{/if}
						</button>
						<button
							onclick={leaveWatchParty}
							class="rounded-full p-1 text-purple-300 transition hover:bg-purple-600/50 hover:text-white"
							title="Leave Party"
						>
							<LogOut class="h-4 w-4" />
						</button>
					</div>
				</div>
				<a
					href={`/file/${partyFileId}`}
					class="flex items-center justify-center gap-2 rounded-md bg-cyan-500/20 px-3 py-1 font-bold text-cyan-200 transition hover:bg-cyan-500/40"
					title="Return to the party's current file"
				>
					<Clapperboard class="h-5 w-5" />
					<span>Rejoin</span>
				</a>
			{/if}
		</div>
	{:else}
		<!-- Floating Version -->
		{#if minimized}
			<!-- Floating: Minimized -->
			<button
				onclick={() => (minimized = false)}
				class="absolute bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-2xl ring-1 ring-black/10 transition hover:bg-slate-700"
				title="Show Party Controls"
			>
				<PartyPopper class="h-5 w-5 text-yellow-400" />
				<span class="font-semibold">Party</span>
				<Maximize2 class="h-4 w-4" />
			</button>
		{:else}
			<!-- Floating: Expanded (Original Component) -->
			{#if isActivelyInParty}
				<div
					class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 transform items-center gap-4 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-2xl ring-1 ring-black/10"
				>
					<button
						onclick={() => (minimized = true)}
						class="absolute -top-2 -right-2 rounded-full bg-slate-600 p-1 text-white transition hover:bg-slate-500"
						title="Minimize"
					>
						<Minimize2 class="h-4 w-4" />
					</button>
					<div class="flex items-center gap-2">
						<PartyPopper class="h-5 w-5 text-yellow-400" />
						<span class="font-semibold">In Party</span>
					</div>
					<div class="h-6 w-px bg-slate-600" />
					{#if partyFileId}
						<a
							href={`/file/${partyFileId}`}
							class="flex items-center gap-2 truncate rounded-md px-2 py-1 text-cyan-300 transition hover:bg-slate-700"
							title={partyFileName || 'Loading...'}
						>
							<Clapperboard class="h-5 w-5" />
							<span class="max-w-[200px] truncate">
								{isLoadingFileName ? 'Loading...' : partyFileName || `File #${partyFileId}`}
							</span>
						</a>
					{/if}
					<div class="h-6 w-px bg-slate-600" />

					<button
						onclick={leaveWatchParty}
						class="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 font-bold text-red-300 transition hover:bg-red-500/40 hover:text-red-200"
						title="Leave Party"
					>
						<LogOut class="h-4 w-4" />
						<span>Leave</span>
					</button>
				</div>
			{:else}
				<div
					class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 transform items-center gap-4 rounded-full bg-purple-800 px-4 py-2 text-sm text-white shadow-2xl ring-1 ring-black/10"
				>
					<button
						onclick={() => (minimized = true)}
						class="absolute -top-2 -right-2 rounded-full bg-purple-600 p-1 text-white transition hover:bg-purple-500"
						title="Minimize"
					>
						<Minimize2 class="h-4 w-4" />
					</button>
					<span class="font-semibold">On Break</span>
					<a
						href={`/file/${partyFileId}`}
						class="flex items-center gap-2 rounded-md bg-cyan-500/20 px-3 py-1 font-bold text-cyan-200 transition hover:bg-cyan-500/40"
						title="Return to the party's current file"
					>
						<Clapperboard class="h-5 w-5" />
						<span>Rejoin</span>
					</a>
					<button
						onclick={toggleAlwaysFollow}
						class="flex items-center gap-1 rounded-full px-2 py-1 transition"
						class:text-green-400={alwaysFollowParty}
						class:hover:bg-green-700={alwaysFollowParty}
						class:text-purple-300={!alwaysFollowParty}
						class:hover:bg-purple-700={!alwaysFollowParty}
						title={alwaysFollowParty
							? 'Always follow party file (Click to disable)'
							: 'Follow party file only when active (Click to enable)'}
					>
						{#if alwaysFollowParty}
							<Pin class="h-4 w-4" />
						{:else}
							<PinOff class="h-4 w-4" />
						{/if}
					</button>
					<button
						onclick={leaveWatchParty}
						class="flex items-center gap-1 rounded-full px-2 py-1 text-purple-300 transition hover:bg-purple-700 hover:text-white"
						title="Leave Party"
					>
						<LogOut class="h-4 w-4" />
					</button>
				</div>
			{/if}
		{/if}
	{/if}
{/if}
