<!-- src/lib/components/File/WatchParty.svelte -->
<script lang="ts">
	import { wsStore } from '$lib/wsStore';
	import { onDestroy } from 'svelte';
	import { fetchWithAuth } from '$lib/services/authapi';
	import ThreadMessaging from '$lib/components/Chat/ThreadMessaging.svelte';

	// --- Props ---
	let {
		fileId,
		inviteCode = null
	}: { fileId: number; inviteCode?: string | null } = $props();

	// --- Types ---
	interface WatchParty {
		id: number; // This is the thread_id
		name: string;
		invite_code: string;
		member_count: number;
	}

	// --- Reactive State ---
	let activeParties = $state<WatchParty[]>([]);
	let isLoadingParties = $state(true);
	let isCreatingParty = $state(false);
	let hasAttemptedInitialJoin = $state(false);

	// --- Derived State ---
	const isInThisParty = $derived(
		$wsStore.currentParty.fileId === fileId && $wsStore.currentParty.threadId !== null
	);

	// ✅ --- FIX IS HERE ---
	async function createAndJoinParty() {
		isCreatingParty = true;
		try {
			const newParty = await fetchWithAuth<WatchParty>(
				`/api/chat/watch-parties/for-file/${fileId}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: 'Watch Party' })
				}
			);

			// If the API call was successful, we get the new party details back.
			// This is our confirmation that we have created and joined the party.
			if (newParty && newParty.id) {
				// Directly update the store. This will make `isInThisParty` true
				// and switch the view to the chat interface.
				wsStore.setParty({ threadId: newParty.id, fileId: fileId });

				// The call to joinWatchParty() is no longer needed for the creator,
				// as the backend already adds them upon creation.
			} else {
				throw new Error('Failed to get party details from server after creation.');
			}
		} catch (error) {
			console.error('Error creating watch party:', error);
			// Optionally, show an alert to the user here.
			alert('Could not create the party. Please try again.');
		} finally {
			isCreatingParty = false;
		}
	}

	async function fetchActiveParties() {
		try {
			isLoadingParties = true;
			const parties = await fetchWithAuth<WatchParty[]>(
				`/api/chat/watch-parties/for-file/${fileId}`
			);
			activeParties = parties || [];
		} catch (error) {
			console.error('Error fetching active parties:', error);
			activeParties = [];
		} finally {
			isLoadingParties = false;
		}
	}

	// --- WebSocket Functions ---
	function joinWatchParty(code: string) {
		if (!code) return;
		wsStore.sendMessage({
			type: 'join_watch_party',
			payload: { invite_code: code }
		});
	}

	function leaveWatchParty() {
		wsStore.sendMessage({ type: 'leave_watch_party' });
	}

	// --- Lifecycle & Initial Data Load ---
	fetchActiveParties();

	// --- Effects ---
	$effect(() => {
		if (inviteCode && $wsStore.isAuthenticated && !isInThisParty && !hasAttemptedInitialJoin) {
			hasAttemptedInitialJoin = true;
			joinWatchParty(inviteCode);
		}
	});

	const unsubscribeWs = wsStore.subscribe((store) => {
		if (!store.lastMessage) return;
		const { type, payload } = store.lastMessage;

		switch (type) {
			case 'watch_party_left':
				fetchActiveParties();
				break;
			case 'party_list_updated':
				if (payload.fileId === fileId) {
					fetchActiveParties();
				}
				break;
			case 'join_watch_party_failed':
				alert(
					'Could not join the watch party. It might have been disbanded. Refreshing party list.'
				);
				fetchActiveParties();
				break;
			case 'user_banned':
				if (payload.banned_user_id === $wsStore.userId) {
					fetchActiveParties();
				}
				break;
		}
	});

	onDestroy(() => {
		unsubscribeWs();
		if ($wsStore.currentParty.fileId === fileId) {
			leaveWatchParty();
		}
	});
</script>
<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-md">
	<h2 class="mb-4 text-2xl font-semibold text-slate-700">Watch Together</h2>

	{#if !$wsStore.isAuthenticated}
		<p class="text-center text-slate-500">Please log in to use Watch Together.</p>
	{:else if isInThisParty}
		<div class="flex h-full flex-col">
			<ThreadMessaging threadId={$wsStore.currentParty.threadId!} context={'party'}/>

			<button
				onclick={leaveWatchParty}
				class="mt-4 w-full rounded-md bg-red-500 px-4 py-2 font-bold text-white transition hover:bg-red-600"
			>
				Leave Party
			</button>
		</div>
	{:else}
		<!-- UI for creating/joining (unchanged) -->
		<div class="flex flex-col gap-4">
			<button
				onclick={createAndJoinParty}
				disabled={isCreatingParty}
				class="w-full rounded-md bg-green-500 px-4 py-2 font-bold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-green-300"
			>
				{isCreatingParty ? 'Starting Party...' : 'Start a Party for this Video'}
			</button>

			<div class="mt-4 border-t pt-4">
				<h3 class="mb-3 text-lg font-semibold text-slate-600">Join an Existing Party</h3>
				{#if isLoadingParties}
					<p class="text-center text-slate-500">Loading parties...</p>
				{:else if activeParties.length > 0}
					<ul class="space-y-3">
						{#each activeParties as party (party.id)}
							<li class="flex items-center justify-between rounded-md bg-slate-50 p-3 shadow-sm">
								<div>
									<p class="font-semibold text-slate-800">{party.name}</p>
									<p class="text-sm text-slate-500">{party.member_count} watching</p>
								</div>
								<button
									onclick={() => joinWatchParty(party.invite_code)}
									class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
								>
									Join
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-center text-slate-500 italic">
						No other parties are active for this video. Be the first to start one!
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
