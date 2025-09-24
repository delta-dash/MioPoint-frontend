<!-- src/lib/components/File/WatchParty.svelte -->
<script lang="ts">
	import { wsStore } from '$lib/wsStore';
	import { fetchWithAuth } from '$lib/services/authapi';
	import ThreadMessaging from '$lib/components/Chat/ThreadMessaging.svelte';
	import { goto } from '$app/navigation';
	import PartyIndicator from '../PartyIndicator.svelte';
	import { partyIndicatorStore } from '$lib/partyIndicatorStore';

	// --- Props ---
	let {
		fileId, // The ID of the file this component is currently rendered on
		inviteCode = null // The ID of the file this component is currently rendered on
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
	// The user is in a party if the store has a threadId. This is now independent of the current file.
	const isInAParty = $derived($wsStore.party.threadId !== null);

	async function createAndJoinParty() {
		isCreatingParty = true;
		try {
			// API call is still specific to the file where the party is created
			const newParty = await fetchWithAuth<WatchParty>(
				`/api/chat/watch-parties/for-instance/${fileId}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }, // Corrected from for-file to for-instance
					body: JSON.stringify({ name: 'Watch Party' })
				}
			);

			// If the API call was successful, we get the new party details back.
			// This is our confirmation that we have created and joined the party.
			if (newParty && newParty.id) {
				// Update the global store. The user is now the owner.
				// The server will respond to the join message with `joined_watch_party_success`,
				// which will set the party state in the wsStore, including the isOwner flag.
				joinWatchParty(newParty.invite_code);
			} else {
				throw new Error('Failed to get party details from server after creation.');
			}
		} catch (error) {
			console.error('Error creating watch party:', error);
			alert('Could not create the party. Please try again.');
		} finally {
			isCreatingParty = false;
		}
	}

	async function fetchActiveParties() {
		try {
			isLoadingParties = true;
			const parties = await fetchWithAuth<WatchParty[]>( // Corrected from for-file to for-instance
				`/api/chat/watch-parties/for-instance/${fileId}`
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
		// The server will respond with `joined_watch_party_success` which will update the store
		wsStore.sendMessage({
			type: 'join_watch_party',
			payload: { invite_code: code }
		});
	}

	function leaveWatchParty() {
		// This is now a fully destructive action, leaving the party for good.
		wsStore.sendMessage({ type: 'leave_watch_party' });
		// The server will respond with `watch_party_left`, which the store will handle
		// to clear the local party state.
	}

	// --- Lifecycle & Initial Data Load ---
	fetchActiveParties();

	// --- Effects ---
	// Effect to handle joining via invite code in URL
	$effect(() => {
		if (inviteCode && $wsStore.isAuthenticated && !isInAParty && !hasAttemptedInitialJoin) {
			hasAttemptedInitialJoin = true;
			joinWatchParty(inviteCode);
		}
	});

	// Effect to react to specific WebSocket messages relevant to the party list
	$effect(() => {
		const lastMessage = $wsStore.lastMessage;
		if (!lastMessage) return;

		const { type, payload } = lastMessage;

		switch (type) {
			case 'watch_party_left':
				// Someone left a party, refetch the list to get updated member counts.
				fetchActiveParties();
				break;
			case 'party_list_updated':
				// The server pushed an updated list of parties for this file.
				if (payload.fileId === fileId && payload.parties) {
					activeParties = payload.parties;
					isLoadingParties = false;
				}
				break;
			case 'join_watch_party_failed':
				alert('Could not join the watch party. It might have been disbanded.');
				fetchActiveParties();
				break;
			case 'user_banned':
				// A user was banned from a party on this file page. If it was us,
				// our party state is already cleared by the store. We should refetch
				// the list to show we're no longer in it.
				const currentUserId = $wsStore.userId;
				if (payload.banned_user_id === currentUserId) {
					fetchActiveParties();
				}
				break;
			case 'joined_watch_party_success':
				// The wsStore has updated the party state. Now, set alwaysFollow to true.
				partyIndicatorStore.setAlwaysFollow(true);
				break;
		}
	});
</script>

<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-md">
	<h2 class="mb-4 text-2xl font-semibold text-slate-700">Watch Together</h2>
	<PartyIndicator docked={true} priority={1} />
	{#if !$wsStore.isAuthenticated}
		<p class="text-center text-slate-500">Please log in to use Watch Together.</p>
	{:else if isInAParty}
		<div class="flex h-full flex-col">
			<!-- The ThreadMessaging component now gets its threadId from the global store -->
			<ThreadMessaging threadId={$wsStore.party.threadId!} context={'party'} />

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
