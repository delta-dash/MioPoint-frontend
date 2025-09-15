<!-- src/lib/components/File/VideoPlayer.svelte -->
<script lang="ts">
	import { wsStore } from '$lib/wsStore';
	import { onDestroy, tick } from 'svelte';

	interface SubtitleTrack {
		index: number;
		language: string;
		title: string;
	}

	// --- PROPS ---
	let {
		fileId,
		src: initialSrc,
		amOwner,
		videoElement: videoElementProp = $bindable()
	}: {
		fileId: number;
		src: string;
		amOwner: boolean;
		videoElement?: HTMLVideoElement | null;
	} = $props();

	// --- INTERNAL STATE ---
	let sources = $state([initialSrc, '']);
	let activePlayerIndex = $state(0);
	let videoA: HTMLVideoElement | null = $state(null);
	let videoB: HTMLVideoElement | null = $state(null);
	let subtitles = $state<SubtitleTrack[]>([]);
	let activeTrackIndex = $state(-1);

	// --- DERIVED STATE ---
	let activeVideoElement = $derived<HTMLVideoElement | null>(
		activePlayerIndex === 0 ? videoA : videoB
	);

	// --- REAL-TIME SYNC STATE ---
	let isApplyingUpdate = $state(false);
	let throttleTimeout: any = null;

	// --- EFFECT: Keep the bindable videoElement prop updated ---
	$effect(() => {
		videoElementProp = activeVideoElement;
	});

	// --- EFFECT: Subscribe to WebSocket messages for synchronization ---
	const unsubscribe = wsStore.subscribe((store) => {
		if (!store.lastMessage || !activeVideoElement) return;
		const { type, payload } = store.lastMessage;
		if (type === 'player_state_update' && payload.fileId === fileId) {
			isApplyingUpdate = true;
			switch (payload.state) {
				case 'play':
					activeVideoElement.play();
					break;
				case 'pause':
					activeVideoElement.pause();
					break;
				case 'seek':
					if (Math.abs(activeVideoElement.currentTime - payload.time) > 1.5) {
						activeVideoElement.currentTime = payload.time;
					}
					break;
			}
			setTimeout(() => {
				isApplyingUpdate = false;
			}, 100);
		}
	});

	// --- EFFECT: Handle transcoding completion ---
	$effect(() => {
	const transcodingInfo = $wsStore.transcodingStatus[fileId];
	if (transcodingInfo?.completed && activeVideoElement) {
		(async () => {
			console.log(`Transcoding complete for ${fileId}, preparing to switch player...`);

			const inactivePlayerIndex = activePlayerIndex === 0 ? 1 : 0;
			const oldPlayerIndex = activePlayerIndex;

			const inactiveVideoElement = inactivePlayerIndex === 0 ? videoA : videoB;
			const currentVideoElement = activeVideoElement;

			if (!inactiveVideoElement || !currentVideoElement) return;

			// --- THE FIX STARTS HERE ---

			// 1. Force the inactive player to unload its current source and reset its state.
			// This prevents the browser from caching metadata (like the wrong duration) from the old stream.
			inactiveVideoElement.src = '';
			inactiveVideoElement.load();
			// Wait for the DOM to process the unload command.
			await tick();

			// --- THE FIX ENDS HERE ---

			const currentTime = currentVideoElement.currentTime;
			const isPaused = currentVideoElement.paused;
			const isMuted = currentVideoElement.muted;
			const currentTrackIndex = activeTrackIndex;

			const onCanPlayThrough = async () => {
				console.log('New source ready, switching now.');

				// The .load() call here is now redundant because changing src implies a load, but it's harmless.
				inactiveVideoElement.load();
				inactiveVideoElement.currentTime = currentTime;
				inactiveVideoElement.muted = isMuted;
				if (isPaused) {
					inactiveVideoElement.pause();
				} else {
					inactiveVideoElement.play();
				}

				if (currentTrackIndex > -1 && inactiveVideoElement.textTracks[currentTrackIndex]) {
					for (let i = 0; i < inactiveVideoElement.textTracks.length; i++) {
						inactiveVideoElement.textTracks[i].mode =
							i === currentTrackIndex ? 'showing' : 'disabled';
					}
				}

				activePlayerIndex = inactivePlayerIndex;

				currentVideoElement.pause();
				sources[oldPlayerIndex] = '';

				inactiveVideoElement.removeEventListener('canplaythrough', onCanPlayThrough);
			};

			inactiveVideoElement.addEventListener('canplaythrough', onCanPlayThrough);

			// 2. Now, set the new source. This will trigger the browser to load it fresh.
			sources[inactivePlayerIndex] = transcodingInfo.url;

			wsStore.updateTranscodingStatus(fileId, { ...transcodingInfo, completed: false });
		})();
	}
});

	onDestroy(unsubscribe);

	// --- EVENT SENDING ---
	function sendStateUpdate(payload: object) {
		let inParty = false;
		const unsub = wsStore.subscribe((s) => (inParty = s.currentParty.threadId != null));
		unsub();
		if (inParty && amOwner) {
			wsStore.sendMessage({
				type: 'player_state_update',
				payload: { ...payload, fileId }
			});
		}
	}
	function handlePlay() {
		if (isApplyingUpdate || !amOwner) return;
		sendStateUpdate({ state: 'play' });
	}
	function handlePause() {
		if (isApplyingUpdate || !amOwner) return;
		sendStateUpdate({ state: 'pause' });
	}
	function handleSeek() {
		if (isApplyingUpdate || !amOwner || !activeVideoElement) return;
		sendStateUpdate({ state: 'seek', time: activeVideoElement.currentTime });
	}
	function handleTimeUpdate() {
		if (isApplyingUpdate || !activeVideoElement || activeVideoElement.paused || !amOwner) return;
		if (!throttleTimeout) {
			throttleTimeout = setTimeout(() => {
				if (activeVideoElement) {
					sendStateUpdate({ state: 'seek', time: activeVideoElement.currentTime });
				}
				throttleTimeout = null;
			}, 1000);
		}
	}

	// --- SUBTITLE LOGIC ---
	$effect(() => {
		const fetchSubtitles = async () => {
			if (!fileId) return;
			try {
				const response = await fetch(`/api/${fileId}/subtitles`);
				if (!response.ok) throw new Error('Failed to fetch subtitles list');
				subtitles = await response.json();
			} catch (error) {
				console.error('Could not load subtitles:', error);
				subtitles = [];
			}
		};
		fetchSubtitles();
	});

	// This function pushes state TO the video element.
	function selectTrack(trackIndex: number) {
		activeTrackIndex = trackIndex;
		if (!activeVideoElement) return;
		for (let i = 0; i < activeVideoElement.textTracks.length; i++) {
			const track = activeVideoElement.textTracks[i];
			track.mode = i === trackIndex ? 'showing' : 'disabled';
		}
	}

	// NEW: This effect pulls state FROM the video element, creating two-way sync.
	$effect(() => {
		const video = activeVideoElement;
		if (!video || !video.textTracks) return;

		const tracks = video.textTracks;

		const syncActiveTrackFromVideo = () => {
			let foundIndex = -1;
			for (let i = 0; i < tracks.length; i++) {
				if (tracks[i].mode === 'showing') {
					foundIndex = i;
					break;
				}
			}
			activeTrackIndex = foundIndex;
		};

		tracks.addEventListener('change', syncActiveTrackFromVideo);
		syncActiveTrackFromVideo(); // Sync initial state

		return () => {
			tracks.removeEventListener('change', syncActiveTrackFromVideo);
		};
	});
</script>

<div class="media-container relative flex flex-col gap-4">
	{#key subtitles}
		<div class="relative aspect-video">
			<video
				bind:this={videoA}
				src={sources[0]}
				autoplay
				playsinline
				controls
				class="video-player"
				class:inactive={activePlayerIndex !== 0}
				crossorigin="anonymous"
				onplay={handlePlay}
				onpause={handlePause}
				onseeking={handleSeek}
				ontimeupdate={handleTimeUpdate}
			>
				{#each subtitles as sub}
					<track
						kind="subtitles"
						src={`/api/${fileId}/subtitle/${sub.index}`}
						srclang={sub.language}
						label={`${sub.title} (${sub.language})`}
					/>
				{/each}
				Your browser does not support the video tag.
			</video>
			<video
				bind:this={videoB}
				src={sources[1]}
				autoplay
				playsinline
				controls
				class="video-player"
				class:inactive={activePlayerIndex !== 1}
				crossorigin="anonymous"
				onplay={handlePlay}
				onpause={handlePause}
				onseeking={handleSeek}
				ontimeupdate={handleTimeUpdate}
			>
				{#each subtitles as sub}
					<track
						kind="subtitles"
						src={`/api/${fileId}/subtitle/${sub.index}`}
						srclang={sub.language}
						label={`${sub.title} (${sub.language})`}
					/>
				{/each}
			</video>
		</div>

		{#if subtitles.length > 0}
			<div class="flex flex-wrap items-center gap-2 rounded-md bg-slate-100 p-3">
				<strong class="mr-2 text-sm font-semibold text-slate-600">Captions:</strong>
				<button
					onclick={() => selectTrack(-1)}
					class="track-button"
					class:active={activeTrackIndex === -1}
				>
					Off
				</button>
				{#each subtitles as sub, i}
					<button
						onclick={() => selectTrack(i)}
						class="track-button"
						class:active={activeTrackIndex === i}
					>
						{sub.language}
					</button>
				{/each}
			</div>
		{/if}
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
</style>
