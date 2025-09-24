<script lang="ts">
	import { fetchWithAuth } from '$lib/services/authapi';
	import FeedbackToast from '$lib/components/FeedbackToast.svelte';

	// --- Props ---
	// Use $bindable() to allow two-way binding with the parent component's state.
	// This ensures that when we update the reactions here, the parent's data is also updated.
	let {
		instance_id,
		reactions = $bindable()
	}: {
		instance_id: number;
		reactions: ReactionSummary[];
	} = $props();

	// --- State ---
	// Track which reaction buttons are currently in a loading state to prevent double-clicks.
	let isLoading = $state(new Set<number>());
	let feedback = $state<{ type: 'error' | 'success'; message: string } | null>(null);

	// --- Helper Functions ---
	function setFeedback(type: 'error' | 'success', message: string, duration = 5000) {
		feedback = { type, message };
		setTimeout(() => {
			// Only clear the feedback if it hasn't been replaced by a newer one
			if (feedback?.message === message) {
				feedback = null;
			}
		}, duration);
	}

	async function toggleReaction(reaction: ReactionSummary) {
		if (isLoading.has(reaction.id)) {
			return; // Prevent multiple requests for the same reaction
		}

		isLoading.add(reaction.id);

		// Deep copy the current state for potential rollback on error
		const originalReactions = JSON.parse(JSON.stringify(reactions));
		const hadReacted = reaction.reacted_by_user;

		// --- 1. Optimistic Update ---
		// This makes the UI feel instantaneous. We update the local state before the API call.
		const reactionIndex = reactions.findIndex((r) => r.id === reaction.id);
		if (reactionIndex !== -1) {
			const updatedReaction = { ...reactions[reactionIndex] };
			if (hadReacted) {
				updatedReaction.count--;
				updatedReaction.reacted_by_user = false;
			} else {
				updatedReaction.count++;
				updatedReaction.reacted_by_user = true;
			}
			// Create a new array to trigger Svelte's reactivity
			const newReactions = [...reactions];
			newReactions[reactionIndex] = updatedReaction;
			reactions = newReactions;
		}

		// --- 2. API Call ---
		try {
			const method = hadReacted ? 'DELETE' : 'POST';
			// The API returns the new, correct state of all reactions for the instance.
			const serverReactions = await fetchWithAuth<ReactionSummary[]>(
				`/api/instance/${instance_id}/reactions/${reaction.id}`,
				{
					method: method,
					headers: { 'Content-Type': 'application/json' }
				}
			);

			// --- 3. Sync with Authoritative Server Response ---
			// If server returns new state, update. If it returns 204 (null), optimistic update is fine.
			if (serverReactions) {
				reactions = serverReactions;
			}
		} catch (error) {
			// --- 4. Rollback on Error ---
			setFeedback('error', error instanceof Error ? error.message : String(error));
			reactions = originalReactions; // Revert to the state before the optimistic update.
		} finally {
			isLoading.delete(reaction.id);
		}
	}
</script>

<div class="reaction-bar">
	{#each reactions as reaction (reaction.id)}
		<button
			class="reaction-button"
			class:reacted={reaction.reacted_by_user}
			class:loading={isLoading.has(reaction.id)}
			onclick={() => toggleReaction(reaction)}
			disabled={isLoading.has(reaction.id)}
			title={reaction.label}
		>
			{#if reaction.emoji}
				<span class="emoji">{reaction.emoji}</span>
			{:else if reaction.image_path}
				<img src={reaction.image_path} alt={reaction.label} class="icon" />
			{/if}
			<span class="count">{reaction.count}</span>
		</button>
	{/each}
</div>

<FeedbackToast {feedback} />

<style>
	.reaction-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.reaction-button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.6rem;
		border-radius: 9999px;
		border: 1px solid hsl(210 10% 80%);
		background-color: hsl(210 10% 96%);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		user-select: none;
	}
	.reaction-button:hover:not(:disabled) {
		border-color: hsl(210 100% 50%);
	}
	.reaction-button.reacted {
		background-color: hsl(210 100% 92%);
		border-color: hsl(210 100% 50%);
		color: hsl(210 100% 30%);
		font-weight: 600;
	}
	.reaction-button.loading {
		opacity: 0.6;
		cursor: wait;
	}
	.emoji {
		font-size: 1rem;
		line-height: 1;
	}
	.icon {
		width: 1rem;
		height: 1rem;
	}
	.count {
		font-variant-numeric: tabular-nums;
		min-width: 1ch;
		text-align: left;
	}
</style>
