<!-- src/lib/components/Chat/ThreadMessaging.svelte -->
<script lang="ts">
	import { wsStore } from '$lib/wsStore';
	import { tick, untrack } from 'svelte';
	import { fetchWithAuth } from '$lib/services/authapi';

	// --- Props ---
	let { threadId, context = 'thread' }: { threadId: number; context?: 'thread' | 'party' } =
		$props();

	// --- Types ---
	interface Post {
		id: number;
		content: string;
		created_at: string;
		sender_id: number;
		sender_username: string;
		replies: Post[];
	}
	interface Participant {
		id: number;
		username: string;
		role: 'owner' | 'member';
	}
	interface ThreadDetails {
		id: number;
		name: string;
		type: string;
	}

	// --- Internal Reactive State ---
	let messages = $state<Post[]>([]);
	let participants = $state<Participant[]>([]);
	let threadDetails = $state<ThreadDetails | null>(null);
	let chatInput = $state('');
	let chatContainer: HTMLElement | null = $state(null);
	let isLoading = $state(true);
	let isEditingName = $state(false);
	let newThreadName = $state('');
	let amOwner = $state(false);

	// --- API Functions (Pure) ---
	async function fetchThreadDetails(id: number) {
		try {
			const details = await fetchWithAuth<ThreadDetails>(`/api/chat/threads/${id}/details`);
			threadDetails = details;
			if (details) newThreadName = details.name;
		} catch (error) {
			console.error('Error fetching thread details:', error);
		}
	}

	async function fetchMessageHistory(id: number) {
		try {
			const history = await fetchWithAuth<Post[]>(`/api/chat/threads/${id}/posts`);
			messages = history || [];
		} catch (error) {
			console.error('Error fetching message history:', error);
			messages = [];
		} finally {
			isLoading = false;
		}
	}

	async function fetchParticipants(id: number, currentUserId: number | null) {
		try {
			const memberData = await fetchWithAuth<Participant[]>(`/api/chat/threads/${id}/members`);
			participants = memberData || [];
			if (currentUserId === null) {
				amOwner = false;
				return;
			}
			const currentUser = participants.find((p) => p.id === currentUserId);
			amOwner = currentUser?.role === 'owner';
		} catch (error) {
			console.error('Error fetching participants:', error);
			participants = [];
		}
	}

	async function updateThreadName(e: SubmitEvent) {
		e.preventDefault();
		if (!newThreadName.trim() || newThreadName === threadDetails?.name) {
			isEditingName = false;
			return;
		}
		try {
			await fetchWithAuth(`/api/chat/threads/${threadId}/name`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newThreadName })
			});
			if (threadDetails) {
				threadDetails.name = newThreadName;
			}
			isEditingName = false;
		} catch (error) {
			console.error('Error updating thread name:', error);
		}
	}

	// --- WebSocket Action Functions (Now Complete) ---
	function sendChatMessage(e: SubmitEvent) {
		e.preventDefault();
		if (chatInput.trim() === '') return;
		const messageType = context === 'party' ? 'send_message_to_party' : 'send_message_to_thread';
		wsStore.sendMessage({
			type: messageType,
			payload: { content: chatInput, thread_id: threadId }
		});
		chatInput = '';
	}

	function transferOwnership(newOwnerId: number) {
		wsStore.sendMessage({
			type: 'transfer_ownership_in_thread', // Use the generic thread handler
			payload: {
				thread_id: threadId,
				new_owner_id: newOwnerId
			}
		});
	}

	function banUser(userId: number) {
		wsStore.sendMessage({
			type: 'ban_user_from_thread', // Use the generic thread handler
			payload: {
				thread_id: threadId,
				banned_user_id: userId
			}
		});
	}

	// --- Effects & Lifecycle (Corrected) ---
	$effect.root(() => {
		// This effect should only re-run when `threadId` changes.
		const currentThreadId = threadId;

		// If there's no thread ID, there's nothing to do.
		if (!currentThreadId) {
			// Clear out old data if the component remains mounted without a threadId
			messages = [];
			participants = [];
			threadDetails = null;
			amOwner = false;
			return;
		}

		// Define an async function to load all data for the new thread.
		// This keeps the async logic cleanly separated.
		const loadThreadData = async () => {
			isLoading = true;
			// Reset state for the new thread
			messages = [];
			participants = [];
			threadDetails = null;
			amOwner = false;

			// Use `untrack` to get the user ID without creating a dependency on the wsStore.
			// This is crucial to prevent this effect from re-running on every new message.
			const currentUserId = untrack(() => $wsStore.userId);

			// Fetch all data in parallel.
			await Promise.all([
				fetchThreadDetails(currentThreadId),
				fetchMessageHistory(currentThreadId),
				fetchParticipants(currentThreadId, currentUserId)
			]);
			// `isLoading` is set to false inside `fetchMessageHistory`'s finally block.
		};

		// Execute the data loading and subscribe to updates.
		loadThreadData();
		wsStore.sendMessage({
			type: 'subscribe_to_thread_updates',
			payload: { thread_id: currentThreadId }
		});

		// The cleanup function will run when `threadId` changes or the component unmounts.
		return () => {
			wsStore.sendMessage({
				type: 'unsubscribe_from_thread_updates',
				payload: { thread_id: currentThreadId }
			});
		};
	});

	// This separate effect handles incoming messages without re-triggering the subscription.
	$effect(() => {
		const message = $wsStore.lastMessage;
		const currentUserId = $wsStore.userId;
		if (!message || message.payload?.thread_id !== threadId) {
			return;
		}

		const { type, payload } = message;

		switch (type) {
			case 'new_chat_message':
				if (!messages.some((msg) => msg.id === payload.id)) {
					messages = [...messages, payload];
				}
				break;
			case 'thread_posts_updated':
				messages = payload.posts || [];
				break;
			case 'thread_members_updated':
				participants = payload.members || [];
				const currentUser = participants.find((p) => p.id === currentUserId);
				amOwner = currentUser?.role === 'owner';
				break;
			case 'thread_details_updated':
				if (threadDetails) {
					threadDetails.name = payload.name;
				}
				break;
			case 'user_joined_thread':
			case 'user_left_thread':
			case 'ownership_transferred':
			case 'user_banned':
			case 'ownership_changed_broadcast':
				fetchParticipants(threadId, currentUserId);
				break;
		}
	});

	$effect(() => {
		if (messages.length > 0 && !isLoading) {
			tick().then(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			});
		}
	});
</script>

<div class="grid h-[600px] grid-cols-1 gap-6 md:grid-cols-3">
	<!-- Chat Area -->
	<div
		class="flex flex-col overflow-auto rounded-lg border border-slate-200 bg-white p-6 shadow-md md:col-span-2"
	>
		<div class="mb-4 border-b pb-2">
			{#if isEditingName}
				<form onsubmit={updateThreadName} class="flex gap-2">
					<input
						type="text"
						bind:value={newThreadName}
						class="flex-grow rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
					<button type="submit" class="rounded-md bg-green-500 px-3 py-1 text-white">Save</button>
					<button
						type="button"
						onclick={() => (isEditingName = false)}
						class="rounded-md bg-gray-300 px-3 py-1">Cancel</button
					>
				</form>
			{:else}
				<div class="flex items-center justify-between">
					<h2 class="text-2xl font-semibold text-slate-700">
						{threadDetails?.name || `Thread #${threadId}`}
					</h2>
					{#if amOwner}
						<button
							onclick={() => (isEditingName = true)}
							class="text-sm text-blue-600 hover:underline"
						>
							Edit
						</button>
					{/if}
				</div>
			{/if}
		</div>

		{#if isLoading}
			<p class="text-center text-slate-500">Loading messages...</p>
		{:else}
			<div
				bind:this={chatContainer}
				class="min-h-0 flex-grow space-y-3 overflow-y-auto rounded-md bg-slate-50 p-3"
			>
				{#each messages as msg (msg.id)}
					<div>
						<span class="text-sm font-bold text-slate-600">{msg.sender_username}:</span>
						<p class="break-words text-slate-800">{msg.content}</p>
					</div>
				{:else}
					<p class="text-center italic text-slate-400">No messages yet. Be the first to post!</p>
				{/each}
			</div>
			<form onsubmit={sendChatMessage} class="mt-4 flex gap-2">
				<input
					type="text"
					bind:value={chatInput}
					placeholder="Type a message..."
					class="flex-grow rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
				<button
					type="submit"
					class="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={chatInput.trim() === ''}>Send</button
				>
			</form>
		{/if}
	</div>
	<!-- Participants Area -->
	<div
		class="flex flex-col overflow-auto rounded-lg border border-slate-200 bg-white p-6 shadow-md md:col-span-1"
	>
		<h3 class="mb-2 border-b pb-2 text-lg font-semibold text-slate-800">
			Participants ({participants.length})
		</h3>
		<ul class="space-y-2 overflow-y-auto">
			{#each participants as p (p.id)}
				<li class="flex items-center justify-between rounded bg-slate-50 p-2">
					<div>
						<span class="font-medium text-slate-800">{p.username}</span>
						{#if p.role === 'owner'}
							<span
								class="ml-2 rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-800"
								>Owner</span
							>
						{/if}
					</div>
					{#if amOwner && p.id !== $wsStore.userId}
						<div class="flex gap-2">
							<button
								onclick={() => transferOwnership(p.id)}
								class="text-xs text-blue-600 hover:underline">Make Owner</button
							>
							<button onclick={() => banUser(p.id)} class="text-xs text-red-600 hover:underline"
								>Ban</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
</div>
