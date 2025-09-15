<!-- src/routes/chat/+page.svelte -->
<script lang="ts">
	import ThreadMessaging from '$lib/components/Chat/ThreadMessaging.svelte';
	import CreateGroupModal from '$lib/components/Chat/CreateGroupModal.svelte';
	import { invalidateAll } from '$app/navigation'; // SvelteKit's way to re-run load functions

	// --- Props from load function ---
	// The `threads` and `publicThreads` data now comes from +page.ts
	// The props are automatically reactive in Svelte 5.
	let {
		data
	}: {
		data: { threads: Thread[]; publicThreads: PublicThread[] };
	} = $props();

	// --- Local UI State ---
	let selectedThreadId = $state<number | null>(null);
	let showCreateGroupModal = $state(false);

	// The `isLoading` and `isLoadingPublic` states are no longer needed,
	// as the `load` function blocks rendering until the data is ready.

	// --- API Functions (now only for mutations/actions) ---
	// We no longer need fetchThreads or fetchPublicThreads here.
	// We import SvelteKit's `fetch` which can be used for POST/PUT requests
	import { browser } from '$app/environment';
	import { fetchWithAuth } from '$lib/services/authapi';

	async function joinThread(threadId: number) {
		try {
			// No customFetch needed here, it runs in the browser
			await fetchWithAuth(`/api/chat/threads/${threadId}/join`, { method: 'POST' });
			await invalidateAll(); // Re-run the `load` function to get fresh data
		} catch (error) {
			console.error(`Error joining thread ${threadId}:`, error);
			alert('Failed to join thread.');
		}
	}

	async function leaveThread(threadId: number) {
		try {
			await fetchWithAuth(`/api/chat/threads/${threadId}/leave`, { method: 'POST' });
			if (selectedThreadId === threadId) {
				selectedThreadId = null;
			}
			await invalidateAll();
		} catch (error) {
			console.error(`Error leaving thread ${threadId}:`, error);
			alert('Failed to leave thread.');
		}
	}

	async function handleCreateGroup(details: {
		name: string;
		isPublic: boolean;
		participants: number[];
	}) {
		const { name, isPublic, participants } = details;
		try {
			const newThread = await fetchWithAuth<{ thread_id: number }>('/api/chat/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name,
					type: isPublic ? 'public_group' : 'group',
					participant_ids: participants
				})
			});

			if (newThread && newThread.thread_id) {
				showCreateGroupModal = false;
				await invalidateAll();
				selectThread(newThread.thread_id);
			}
		} catch (error) {
			console.error('Error creating new thread:', error);
			alert('Failed to create new group thread.');
		}
	}

	// --- Helper Functions ---
	function selectThread(threadId: number) {
		selectedThreadId = threadId;
	}

	function isMemberOf(threadId: number) {
		return data.threads.some((t) => t.id === threadId);
	}
</script>

<div class="rounded-4xl bg-white p-4 md:p-8 m-4">

<div class="container mx-auto ">
	<h1 class="mb-6 text-3xl font-bold">Conversations</h1>
	<div class="grid grid-cols-1 gap-6 md:grid-cols-4">
		<div class="md:col-span-1">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold">My Threads</h2>
				<button
					onclick={() => (showCreateGroupModal = true)}
					class="rounded-md bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
				>
					New Group
				</button>
			</div>
			<!-- The loading state is gone. The component won't render until data is available. -->
			{#if data.threads.length === 0}
				<p>No conversations yet. Join a public one or create a new one!</p>
			{:else}
				<ul class="space-y-2">
					{#each data.threads as thread (thread.id)}
						<li
							class="flex items-center justify-between rounded-md p-2"
							class:bg-blue-100={selectedThreadId === thread.id}
						>
							<button onclick={() => selectThread(thread.id)} class="flex-grow text-left">
								{thread.name || `Thread #${thread.id}`}
							</button>
							{#if thread.type === 'public_group' && thread.role !== 'owner'}
								<button
									onclick={() => leaveThread(thread.id)}
									class="ml-2 rounded-md bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
								>
									Leave
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-8">
				<h2 class="mb-4 text-xl font-semibold">Public Threads</h2>
				{#if data.publicThreads.length === 0}
					<p>No public threads available.</p>
				{:else}
					<ul class="space-y-2">
						{#each data.publicThreads as thread (thread.id)}
							{#if !isMemberOf(thread.id)}
								<li class="flex items-center justify-between rounded-md p-2">
									<span>{thread.name || `Thread #${thread.id}`}</span>
									<button
										onclick={() => joinThread(thread.id)}
										class="ml-2 rounded-md bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
									>
										Join
									</button>
								</li>
							{/if}
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		<div class="md:col-span-3">
			{#if selectedThreadId}
				<ThreadMessaging threadId={selectedThreadId} />
			{:else}
				<div
					class="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300"
				>
					<p class="text-slate-500">Select a thread to start messaging.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
</div>

<CreateGroupModal bind:open={showCreateGroupModal} onCreate={handleCreateGroup} />
