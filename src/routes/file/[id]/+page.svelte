<script lang="ts">
	// Svelte imports

	// Component imports
	import TagManager from '$lib/components/Tag/TagManager.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import type { Tab } from '$lib/components/Tabs.svelte';
	import VideoPlayer from '$lib/components/File/VideoPlayer.svelte';
	import PdfPreview from '$lib/components/File/PdfPreview.svelte';
	import TextPreview from '$lib/components/File/TextPreview.svelte';
	import ImagePreview from '$lib/components/File/ImagePreview.svelte';
	import SceneList from '$lib/components/File/SceneList.svelte';
	import FileConversion from '$lib/components/File/FileConversion.svelte';
	import FileProperties from '$lib/components/File/FileProperties.svelte';

	// Utilities and Stores
	import { wsStore } from '$lib/wsStore';
	import WatchParty from '$lib/components/File/WatchParty.svelte';
	import AutoTagButton from '$lib/components/AutoTagButton.svelte';

	import { goto } from '$app/navigation';
	import Reactions from '$lib/components/Reactions.svelte';

	// Props from SvelteKit's load function
	let {
		data
	}: {
		data: {
			fileId: number;
			fileDetails: FileDetails;
			mediaSrc: string;
			allSystemTags: TagItem[];
			allSystemMetaTags: TagItem[];
			inviteCode: string | null;
		};
	} = $props();

	// By creating derived values, we ensure that any part of the component
	// that uses them will react when the `data` prop changes. This is a more
	// explicit and robust way to handle reactivity from props.
	let fileId = $derived(data.fileId);
	let fileDetails = $derived(data.fileDetails);
	let mediaSrc = $derived(data.mediaSrc);
	let inviteCode = $derived(data.inviteCode);

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
			return;
		}

		const response = await fetch(`/api/instance/${fileId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			alert('File deleted successfully.');
			goto('/');
		} else {
			const error = await response.json();
			alert(`Failed to delete file: ${error.detail || 'Unknown error'}`);
		}
	}

	// --- UI control state ---
	let isDetailsHidden = $state(false);
	let activeTabId = $state('properties');

	// State shared between components
	let videoElement: HTMLVideoElement | null = $state(null);

	// Derived state
	const isVideo = $derived(fileDetails?.file_type?.startsWith('video'));

	// --- Dynamically generate the list of tabs ---
	const availableTabs: Tab[] = $derived(
		(() => {
			if (!fileDetails) return [];

			const tabs: Tab[] = [{ id: 'properties', label: 'Properties' }];

			//if (data.fileDetails.tags?.length > 0 || data.fileDetails.meta_tags?.length > 0) {
			tabs.push({ id: 'tags', label: 'Tags' });
			//}
			if (fileDetails.transcript) {
				tabs.push({ id: 'transcript', label: 'Transcript' });
			}
			if (fileDetails.scenes?.length > 0 && isVideo) {
				tabs.push({ id: 'scenes', label: 'Scenes' });
			}
			if (fileDetails.file_type === 'video' || fileDetails.file_type === 'image') {
				tabs.push({ id: 'convert', label: 'Convert' });
			}
			tabs.push({ id: 'watch', label: 'Watch Together' });

			return tabs;
		})()
	);

	// --- Effects ---
	// Effect for party leader to change the current file
	$effect(() => {
		const party = $wsStore.party;

		// If the user is the owner of a party and navigates to a new file,
		// tell the server to update the party's current file.
		if (party.isOwner && party.threadId && party.fileId !== fileId) {
			wsStore.sendMessage({
				type: 'change_party_file',
				payload: { newFileId: fileId }
			});
			// The server will broadcast 'party_file_changed', and the wsStore
			// will update its local state, which will trigger navigation for others.
			// We also need to update the leader's local state.
			wsStore.setPartyFile(fileId);
		}
	});
	// Effect for Subscribing to File Page Updates
	// This tells the server we are "watching" this page, so it knows to send us
	// `party_list_updated` events for this specific file.
	const isAuthenticated = $derived($wsStore.isAuthenticated);
	$effect(() => {
		if (fileId && isAuthenticated) {
			wsStore.sendMessage({
				type: 'subscribe_to_file_updates',
				payload: { fileId }
			});

			return () => {
				wsStore.sendMessage({
					type: 'unsubscribe_from_file_updates',
					payload: { fileId }
				});
			};
		}
	});
	// Effect to ensure a valid tab is always selected
	$effect(() => {
		if (availableTabs.length > 0 && !availableTabs.find((tab) => tab.id === activeTabId)) {
			activeTabId = availableTabs[0].id;
		}
	});
</script>

<div class="mx-auto my-8 max-w-7xl rounded-lg bg-white p-8 shadow-lg">
	{#if fileDetails}
		<header class="mb-8 flex items-center justify-between">
			<h1 class="text-3xl font-bold break-all text-slate-800">
				{fileDetails.file_name || `File ID: ${fileId}`}
			</h1>
			<div class="flex shrink-0 items-center gap-2">
				<a
					href={`/api/instance/${fileId}/download`}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
					title="Download the original file"
				>
					Download
				</a>
				<button
					onclick={handleDelete}
					class="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
					title="Delete this file permanently"
				>
					Delete
				</button>
			</div>
		</header>

		<div
			class="grid grid-cols-1 gap-8 transition-all lg:gap-12"
			class:lg:grid-cols-2={!isDetailsHidden}
			class:lg:grid-cols-1={isDetailsHidden}
		>
			<!-- Left Column: Media Preview -->
			<div class="relative">
				<div class=" sticky top-8 self-start">
					{#if isVideo}
						<VideoPlayer {fileId} src={mediaSrc} bind:videoElement bind:isDetailsHidden />
					{:else if fileDetails.file_type?.startsWith('image')}
						<ImagePreview fileData={fileDetails} src={mediaSrc} />
					{:else if fileDetails.file_type === 'pdf'}
						<PdfPreview src={mediaSrc} />
					{:else if fileDetails.file_type === 'text'}
						<TextPreview src={mediaSrc} />
					{:else}
						<div
							class="flex items-center justify-center rounded-md bg-slate-100 p-8 text-slate-500"
						>
							No preview available for this file type.
						</div>
					{/if}

					<!-- Immersive Mode Toggle Button -->
					{#if !isVideo && false}
						<button
							onclick={() => (isDetailsHidden = !isDetailsHidden)}
							class="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none"
							title={isDetailsHidden ? 'Show details' : 'Hide details (Immersive mode)'}
						>
							{#if isDetailsHidden}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path
										d="M3 21l7-7"
									/></svg
								>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><path d="M3 9V3h6" /><path d="M21 15v6h-6" /><path d="M3 3l7 7" /><path
										d="M21 21l-7-7"
									/></svg
								>
							{/if}
						</button>
					{/if}
				</div>
				<div class="m-1">
					<Reactions reactions={fileDetails.reactions} instance_id={fileId} />
				</div>
			</div>

			<!-- Right Column: Details (Managed by the Tabs component) -->
			{#if !isDetailsHidden}
				<div class="details-container flex min-h-0 flex-col">
					<Tabs tabs={availableTabs} {activeTabId} onTabChange={(id) => (activeTabId = id)}>
						{#snippet content(id)}
							<div class="flex-grow overflow-y-auto pr-2">
								{#if id === 'properties'}
									<FileProperties fileData={fileDetails} />
								{:else if id === 'tags'}
									<AutoTagButton id={fileDetails.id} />
									<section>
										<h2 class="mb-4 text-2xl font-semibold text-slate-700">File Tags</h2>
										<div class="flex flex-wrap gap-2">
											<TagManager
												tags={fileDetails.tags}
												metaTags={fileDetails.meta_tags}
												fileId={fileDetails.id}
											/>
										</div>
									</section>
								{:else if id === 'transcript'}
									<section>
										<h2 class="mb-4 text-2xl font-semibold text-slate-700">Full Transcript</h2>
										<p
											class="rounded-r-md border-l-4 border-slate-300 bg-slate-50 p-4 whitespace-pre-wrap"
										>
											{fileDetails.transcript}
										</p>
									</section>
								{:else if id === 'scenes'}
									<SceneList scenes={fileDetails.scenes} {videoElement} />
								{:else if id === 'convert'}
									<FileConversion fileId={fileDetails.id} fileType={fileDetails.file_type} />
								{:else if id === 'watch'}
									<WatchParty fileId={fileDetails.id} {inviteCode} />
								{/if}
							</div>
						{/snippet}
					</Tabs>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-center text-yellow-700">
			<strong class="font-semibold">No Data:</strong> Could not find details for this file.
		</div>
	{/if}
</div>

<style>
	:global(::cue) {
		color: white;
		background: transparent;
		text-shadow:
			2px 0 2px black,
			-2px 0 2px black,
			0 2px 2px black,
			0 -2px 2px black;
		font-size: 1.1em;
	}
</style>
