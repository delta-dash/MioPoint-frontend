<!-- /src/lib/components/Chat/CreateGroupModal.svelte -->
<script lang="ts">
	import Modal from '../Modal.svelte'; // Make sure this path is correct
	import { fetchWithAuth } from '$lib/services/authapi';
	import { user } from '$lib/userstore';

	// A simple type definition for a user object
	type User = {
		id: number;
		username: string;
	};

	// --- Props ---
	let {
		open = $bindable(false),
		onCreate
	}: {
		open?: boolean;
		onCreate: (details: { name: string; isPublic: boolean; participants: number[] }) => void;
	} = $props();

	// --- Internal Reactive State ---
	let groupName = $state('');
	let isPublic = $state(false);
	let participants = $state<User[]>([]);
	let searchQuery = $state('');
	let searchResults = $state<User[]>([]);
	let isLoadingSearch = $state(false);

	// Reset the component's state each time the modal is opened
	$effect(() => {
		if (open && $user) {
			groupName = '';
			isPublic = false;
			participants = [$user];
			searchQuery = '';
			searchResults = [];
		}
	});

	async function searchUsers() {
		if (searchQuery.trim().length < 2) {
			searchResults = [];
			return;
		}
		isLoadingSearch = true;
		try {
			const users = await fetchWithAuth<User[]>(`/api/users/search?username=${searchQuery}`);
			// Filter out users already in the participants list
			const existingParticipantIds = participants.map((p) => p.id);
			searchResults = users.filter((u) => !existingParticipantIds.includes(u.id));
		} catch (error) {
			console.error('Error searching users:', error);
		} finally {
			isLoadingSearch = false;
		}
	}

	function addParticipant(user: User) {
		participants.push(user);
		searchResults = searchResults.filter((u) => u.id !== user.id);
		searchQuery = ''; // Clear search after selection
		searchResults = [];
	}

	function removeParticipant(userId: number) {
		if (userId === $user?.id) return; // Cannot remove self
		participants = participants.filter((p) => p.id !== userId);
	}

	function createGroup() {
		if (groupName.trim() === '') {
			alert('Group name cannot be empty.');
			return;
		}
		const participantIds = participants.map((p) => p.id);
		onCreate({ name: groupName, isPublic, participants: participantIds });
	}
</script>

<Modal bind:open title="Create New Group">
	<!-- Main body content goes into the default 'children' snippet -->
	{#snippet children()}
		<div class="flex flex-col gap-4">
			<div>
				<label for="groupName" class="block text-sm font-medium text-gray-700">Group Name</label>
				<input
					type="text"
					id="groupName"
					bind:value={groupName}
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				/>
			</div>

			<label class="flex items-center">
				<input
					type="checkbox"
					bind:checked={isPublic}
					class="focus:ring-opacity-50 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200"
				/>
				<span class="ml-2 text-sm text-gray-700">Public Group</span>
			</label>

			<div>
				<label for="userSearch" class="block text-sm font-medium text-gray-700"
					>Add Participants</label
				>
				<input
					type="text"
					id="userSearch"
					bind:value={searchQuery}
					oninput={searchUsers}
					placeholder="Search by username"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
				/>
				{#if isLoadingSearch}
					<p class="mt-1 text-sm text-gray-500">Searching...</p>
				{/if}
				{#if searchResults.length > 0}
					<ul class="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-300">
						{#each searchResults as user}
							<li
								class="cursor-pointer p-2 hover:bg-gray-100"
								onclick={() => addParticipant(user)}
								onkeydown={(e) => e.key === 'Enter' && addParticipant(user)}
								role="button"
								tabindex="0"
							>
								{user.username}
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div>
				<h3 class="text-base font-medium">Participants ({participants.length})</h3>
				<ul class="mt-2 max-h-32 space-y-1 overflow-y-auto">
					{#each participants as p}
						<li class="flex items-center justify-between rounded bg-gray-100 p-1.5">
							<span class="text-sm font-medium">{p.username}</span>
							{#if p.id !== $user?.id}
								<button
									onclick={() => removeParticipant(p.id)}
									class="text-red-500 hover:text-red-700"
									aria-label="Remove {p.username}"
								>
									&times;
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/snippet}

	<!-- Action buttons go into the 'footer' snippet -->
	{#snippet footer()}
		<button
			onclick={() => (open = false)}
			class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
		>
			Cancel
		</button>
		<button
			onclick={createGroup}
			class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>
			Create Group
		</button>
	{/snippet}
</Modal>
