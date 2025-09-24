<!-- src/lib/components/File/VideoPlayer.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { wsStore } from '$lib/wsStore';
	import { tick, untrack } from 'svelte';
	import { Settings } from 'lucide-svelte';
	import { browser } from '$app/environment';

	interface SubtitleTrack {
		index: number;
		language: string;
		title: string;
	}

	// --- PROPS ---
	let {
		fileId,
		src: initialSrc,
		videoElement: videoElementProp = $bindable(),
		isDetailsHidden = $bindable(false)
	}: {
		fileId: number;
		src: string;
		videoElement?: HTMLVideoElement | null;
		isDetailsHidden?: boolean;
	} = $props();
	const amOwner = $derived($wsStore.party.isOwner && $wsStore.party.fileId === fileId);

	// --- INTERNAL STATE ---
	let sources = $state<Array<string | null>>([initialSrc, null]);
	let activePlayerIndex = $state(0);
	let videoA: HTMLVideoElement | null = $state(null);
	let videoB: HTMLVideoElement | null = $state(null);
	let subtitles = $state<SubtitleTrack[]>([]);
	let preferredTrackLabels = $state<string[]>([]);
	let activeTrackIndex = $state(-1);
	let autoplayEnabled = $state(true); // Default value
	let isConfigOpen = $state(false);
	let configButton: HTMLButtonElement | null = $state(null);
	let configDropdown: HTMLDivElement | null = $state(null);

	// --- DERIVED STATE ---
	let activeVideoElement = $derived<HTMLVideoElement | null>(
		activePlayerIndex === 0 ? videoA : videoB
	);

	// --- REAL-TIME SYNC STATE ---
	let isApplyingUpdate = $state(false);
	let throttleTimeout: any = null;

	// --- LOCALSTORAGE & SETTINGS ---
	const AUTOPLAY_STORAGE_KEY = 'videoPlayer.autoplayEnabled';
	const PREFERRED_TRACK_LABELS_KEY = 'videoPlayer.preferredTrackLabels';

	onMount(() => {
		// Load settings from localStorage on client-side mount
		const savedAutoplay = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
		if (savedAutoplay !== null) {
			autoplayEnabled = JSON.parse(savedAutoplay);
		}

		const savedLabels = localStorage.getItem(PREFERRED_TRACK_LABELS_KEY);
		if (savedLabels) {
			try {
				const parsed = JSON.parse(savedLabels);
				if (Array.isArray(parsed)) {
					preferredTrackLabels = parsed;
				}
			} catch {
				// Ignore parsing errors, default to empty array
			}
		}
	});

	// Save settings to localStorage whenever they change
	$effect(() => {
		if (browser) {
			localStorage.setItem(AUTOPLAY_STORAGE_KEY, JSON.stringify(autoplayEnabled));
		}
	});
	$effect(() => {
		if (browser) {
			localStorage.setItem(PREFERRED_TRACK_LABELS_KEY, JSON.stringify(preferredTrackLabels));
		}
	});

	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (
				node &&
				!node.contains(event.target as Node) &&
				!configButton?.contains(event.target as Node)
			) {
				isConfigOpen = false;
			}
		};
		document.addEventListener('click', handleClick, true);
		return { destroy: () => document.removeEventListener('click', handleClick, true) };
	}

	// --- EFFECT: Keep the bindable videoElement prop updated ---
	$effect(() => {
		videoElementProp = activeVideoElement;
	});

	// --- EFFECT: Handle incoming player state updates from the owner ---
	$effect(() => {
		const message = $wsStore.lastMessage;
		// Non-owners apply the state sent by the owner.
		if (!message || !activeVideoElement || amOwner) return;

		const { type, payload } = message;
		if (type === 'player_state_update' && payload.fileId === fileId) {
			isApplyingUpdate = true;

			// Sync time - use a threshold to avoid fighting over milliseconds
			if (Math.abs(activeVideoElement.currentTime - payload.time) > 1.5) {
				activeVideoElement.currentTime = payload.time;
			}

			// Sync paused state
			if (activeVideoElement.paused !== payload.paused) {
				if (payload.paused) {
					activeVideoElement.pause();
				} else {
					activeVideoElement
						.play()
						.catch((e) => console.warn('Autoplay prevented on member client.', e));
				}
			}

			// Use a timeout to prevent an echo loop. After applying the state,
			// wait a moment before this client considers itself able to send updates again.
			setTimeout(() => {
				isApplyingUpdate = false;
			}, 200);
		}
	});

	// --- EFFECT: Handle transcoding completion from WebSocket message ---
	$effect(() => {
		const message = $wsStore.lastMessage;
		if (!message || !activeVideoElement) return;

		const { type, payload } = message;

		if (type === 'transcoding_complete' && payload.instance_id === fileId) {
			const newUrl = payload.url;
			if (!newUrl) {
				console.warn('Transcoding complete message received without a URL.');
				return;
			}

			// Prevent re-processing the same transcode event. This logic is wrapped in
			// untrack() to prevent these state reads from becoming dependencies of the effect,
			// which would re-introduce the loop we're trying to prevent.
			if (
				untrack(() => {
					// If the new URL is already the source of the active player, we're done.
					if (sources[activePlayerIndex] === newUrl) return true;
					// If the new URL is on the inactive player, we're already switching.
					const inactiveIdx = activePlayerIndex === 0 ? 1 : 0;
					if (sources[inactiveIdx] === newUrl) return true;
					return false;
				})
			)
				return;

			// This logic performs a seamless switch between two <video> elements.
			// It's triggered directly by the WebSocket message now, instead of a polling mechanism.
			(async () => {
				console.log(
					`Transcoding complete for ${fileId}, preparing to switch player to new URL: ${newUrl}`
				);

				const inactivePlayerIndex = activePlayerIndex === 0 ? 1 : 0;
				const oldPlayerIndex = activePlayerIndex;

				const inactiveVideoElement = inactivePlayerIndex === 0 ? videoA : videoB;
				const currentVideoElement = activeVideoElement;

				if (!inactiveVideoElement || !currentVideoElement) return;

				// 1. Force the inactive player to unload its current source and reset its state.
				// This prevents the browser from caching metadata (like the wrong duration) from the old on-the-fly stream.
				inactiveVideoElement.src = '';
				inactiveVideoElement.load();
				await tick();

				const currentTime = currentVideoElement.currentTime;
				const isPaused = currentVideoElement.paused;
				const isMuted = currentVideoElement.muted;

				const onCanPlayThrough = async () => {
					console.log('New source is ready, switching players now.');

					inactiveVideoElement.currentTime = currentTime;
					inactiveVideoElement.muted = isMuted;
					if (isPaused) {
						inactiveVideoElement.pause();
					} else {
						await inactiveVideoElement.play();
					}

					activePlayerIndex = inactivePlayerIndex;

					currentVideoElement.pause();
					sources[oldPlayerIndex] = null; // Clear the source of the old player

					inactiveVideoElement.removeEventListener('canplaythrough', onCanPlayThrough);
				};

				inactiveVideoElement.addEventListener('canplaythrough', onCanPlayThrough);

				// 2. Now, set the new source on the inactive player. This will trigger the browser to load it.
				sources[inactivePlayerIndex] = newUrl;
			})();
		}
	});

	// --- EVENT SENDING ---
	/**
	 * (Owner only) Sends the full, current state of the player to other party members.
	 * An optional override can be provided for events like 'waiting' where the `paused`
	 * property of the video element isn't what we want to broadcast.
	 */
	function sendFullStateUpdate(override?: { paused: boolean }) {
		if (isApplyingUpdate || !$wsStore.party.threadId || !amOwner || !activeVideoElement) {
			return;
		}

		wsStore.sendMessage({
			type: 'player_state_update',
			payload: {
				fileId: fileId,
				time: activeVideoElement.currentTime,
				paused: override?.paused ?? activeVideoElement.paused
			}
		});
	}

	/** (Owner only) Sends periodic state updates to correct for client drift. */
	function handleTimeUpdate() {
		if (isApplyingUpdate || !amOwner || !activeVideoElement) return;

		if (!throttleTimeout) {
			throttleTimeout = setTimeout(() => {
				if (activeVideoElement) {
					sendFullStateUpdate();
				}
				throttleTimeout = null;
			}, 1000); // Sync every second
		}
	}

	// --- SUBTITLE LOGIC ---
	$effect(() => {
		const fetchSubtitles = async () => {
			if (!fileId) return;
			try {
				const response = await fetch(`/api/instance/${fileId}/subtitles`);
				if (!response.ok) throw new Error('Failed to fetch subtitles list');
				subtitles = await response.json();
			} catch (error) {
				console.error('Could not load subtitles:', error);
				subtitles = [];
			}
		};
		fetchSubtitles();
	});

	function togglePreference(label: string) {
		const newLabels = [...preferredTrackLabels];
		const idx = newLabels.indexOf(label);
		if (idx > -1) {
			newLabels.splice(idx, 1);
		} else {
			// the oldest selection remains the highest priority.
			newLabels.push(label);
		}

		preferredTrackLabels = newLabels;
	}

	// This effect applies the highest-priority preferred language that is available,
	// and ensures the active track is always in sync with the preferences.
	$effect(() => {
		let newActiveIndex = -1;
		if (subtitles.length > 0 && preferredTrackLabels.length > 0) {
			for (const label of preferredTrackLabels) {
				const index = subtitles.findIndex((sub) => `${sub.title} (${sub.language})` === label);
				if (index !== -1) {
					newActiveIndex = index;
					break; // Found the best match
				}
			}
		}
		activeTrackIndex = newActiveIndex;
	});

	// This effect handles two-way data binding for the active subtitle track.
	$effect(() => {
		const video = activeVideoElement;
		if (!video || !video.textTracks) return;

		const tracks = video.textTracks;

		// 1. APPLY state TO the video element.
		const activeSub = activeTrackIndex > -1 ? subtitles[activeTrackIndex] : null;
		const activeLabel = activeSub ? `${activeSub.title} (${activeSub.language})` : null;

		// Explicitly disable all tracks first to prevent multiple being 'showing' due to browser quirks.
		for (let i = 0; i < tracks.length; i++) {
			if (tracks[i].mode !== 'disabled') {
				tracks[i].mode = 'disabled';
			}
		}

		// Then, enable the active one.
		if (activeLabel) {
			for (let i = 0; i < tracks.length; i++) {
				if (tracks[i].label === activeLabel) {
					tracks[i].mode = 'showing';
					break; // Stop after finding and enabling the correct track.
				}
			}
		}
		// 2. READ state FROM the video element.
		const syncActiveTrackFromVideo = () => {
			let foundLabel: string | null = null;
			for (let i = 0; i < tracks.length; i++) {
				if (tracks[i].mode === 'showing') {
					foundLabel = tracks[i].label;
					break;
				}
			}

			const foundIndex = foundLabel
				? subtitles.findIndex((sub) => `${sub.title} (${sub.language})` === foundLabel)
				: -1;

			if (activeTrackIndex !== foundIndex) {
				activeTrackIndex = foundIndex;
			}
		};

		tracks.addEventListener('change', syncActiveTrackFromVideo);

		return () => {
			if (video.textTracks) {
				video.textTracks.removeEventListener('change', syncActiveTrackFromVideo);
			}
		};
	});
</script>

<div class="media-container relative flex flex-col gap-4">
	<div class="relative ml-auto">
		<button
			bind:this={configButton}
			onclick={() => (isConfigOpen = !isConfigOpen)}
			class="rounded-full p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
			title="Player Settings"
		>
			<Settings />
		</button>

		{#if isConfigOpen}
			<div
				bind:this={configDropdown}
				use:clickOutside
				class="ring-opacity-5 absolute top-full right-0 z-10 mt-2 w-64 origin-top-right rounded-md bg-white p-2 shadow-lg ring-1 ring-black focus:outline-none"
			>
				<div class="space-y-4 p-2">
					<!-- Autoplay Setting -->
					<div class="flex items-center justify-between">
						<label for="autoplay-toggle" class="text-sm font-medium text-slate-700">Autoplay</label>
						<button
							id="autoplay-toggle"
							onclick={() => (autoplayEnabled = !autoplayEnabled)}
							class="track-button"
							class:active={autoplayEnabled}
							title="Toggle autoplay on page load"
						>
							{autoplayEnabled ? 'On' : 'Off'}
						</button>
					</div>

					<!-- Immersive Mode Setting -->
					<div class="flex items-center justify-between">
						<label for="immersive-toggle" class="text-sm font-medium text-slate-700"
							>Immersive Mode</label
						>
						<button
							id="immersive-toggle"
							onclick={() => (isDetailsHidden = !isDetailsHidden)}
							class="track-button"
							class:active={isDetailsHidden}
							title="Hide side panel for a focused view"
						>
							{isDetailsHidden ? 'On' : 'Off'}
						</button>
					</div>

					<!-- Captions Setting -->
					{#if subtitles.length > 0}
						<div class="border-t border-slate-200 pt-4">
							<h4 class="mb-2 text-sm font-medium text-slate-700">Captions</h4>
							<div class="flex flex-wrap gap-2">
								<button
									onclick={() => (preferredTrackLabels = [])}
									class="track-button"
									class:active={activeTrackIndex === -1}
								>
									Off
								</button>
								{#each subtitles as sub, i}
									{@const label = `${sub.title} (${sub.language})`}
									{@const priority = preferredTrackLabels.indexOf(label)}
									<button
										onclick={() => togglePreference(label)}
										class="track-button"
										class:active={activeTrackIndex === i}
									>
										{`${sub.language}|${sub.title} `}
										{#if priority !== -1}
											<span class="priority-badge">{priority + 1}</span>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
	{#key subtitles}
		<div class="relative aspect-video">
			<video
				bind:this={videoA}
				src={sources[0]}
				autoplay={autoplayEnabled || null}
				playsinline
				controls
				class="video-player"
				class:inactive={activePlayerIndex !== 0}
				onplay={() => sendFullStateUpdate()}
				onpause={() => sendFullStateUpdate()}
				onseeking={() => sendFullStateUpdate()}
				ontimeupdate={handleTimeUpdate}
				onwaiting={() => sendFullStateUpdate({ paused: true })}
				onplaying={() => sendFullStateUpdate()}
			>
				{#each subtitles as sub}
					<track
						kind="subtitles"
						src={`/api/instance/${fileId}/subtitle/${sub.index}`}
						srclang={sub.language}
						label={`${sub.title} (${sub.language})`}
					/>
				{/each}
				Your browser does not support the video tag.
			</video>
			<video
				bind:this={videoB}
				src={sources[1]}
				autoplay={autoplayEnabled || null}
				playsinline
				controls
				class="video-player"
				class:inactive={activePlayerIndex !== 1}
				onplay={() => sendFullStateUpdate()}
				onpause={() => sendFullStateUpdate()}
				onseeking={() => sendFullStateUpdate()}
				ontimeupdate={handleTimeUpdate}
				onwaiting={() => sendFullStateUpdate({ paused: true })}
				onplaying={() => sendFullStateUpdate()}
			>
				{#each subtitles as sub}
					<track
						kind="subtitles"
						src={`/api/instance/${fileId}/subtitle/${sub.index}`}
						srclang={sub.language}
						label={`${sub.title} (${sub.language})`}
					/>
				{/each}
			</video>
		</div>
	{/key}
</div>

<style>
	/* Styles remain the same */
	.video-player {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: 0.5rem;
		background-color: black;
		object-fit: contain;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
		transition: opacity 0.5s ease-in-out;
		opacity: 1;
		pointer-events: auto;
	}
	.video-player.inactive {
		opacity: 0;
		pointer-events: none;
	}
	.track-button {
		position: relative;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		border: 1px solid #cbd5e1;
		background-color: white;
		color: #475569;
		font-size: 0.875rem;
		transition: all 0.2s ease-in-out;
		cursor: pointer;
	}
	.track-button:hover {
		background-color: #f1f5f9;
		border-color: #94a3b8;
	}
	.track-button.active {
		background-color: #334155;
		color: white;
		border-color: #334155;
		font-weight: 600;
	}
	.priority-badge {
		position: absolute;
		top: -6px;
		right: -4px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 9999px;
		background-color: #4f46e5; /* indigo-600 */
		color: white;
		font-size: 0.65rem;
		font-weight: bold;
		line-height: 1;
		border: 1px solid white;
	}
</style>
