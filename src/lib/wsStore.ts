// src/lib/wsStore.ts

import { writable, get } from 'svelte/store'; // 1. Import 'get'
import { browser } from '$app/environment';

/**
 * A client-side tracked message for optimistic UI updates.
 */
export interface TrackedMessage {
	clientId: string;
	status: 'sending' | 'sent' | 'failed';
	// Store the original message payload for display purposes
	payload: {
		content: string;
		thread_id: number;
	};
	timestamp: number;
}
/**
 * Interface defining the shape of our WebSocket store's state.
 */
interface WebSocketStore {
	ws: WebSocket | null;
	isConnected: boolean;
	isAuthenticated: boolean;
	userId: number | null;
	lastMessage: any | null;
	party: WatchPartyState;
	transcodingStatus: {
		[fileId: number]: { url: string; completed: boolean };
	};
	pendingMessages: {
		[clientId: string]: TrackedMessage;
	};
}

const initialState: WebSocketStore = {
	ws: null,
	isConnected: false,
	isAuthenticated: false,
	userId: null,
	lastMessage: null,
	party: {
		threadId: null,
		fileId: null,
		isOwner: false
	},
	transcodingStatus: {},
	pendingMessages: {}
};

// 2. Create the store instance itself
const store = writable<WebSocketStore>(initialState);
// 3. Destructure its core methods for use within this file
const { subscribe, set, update } = store;

function generateClientId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}


/**
 * Establishes a WebSocket connection.
 */
function connect() {
	if (!browser) return;

	// Use get() to prevent reconnecting if already connected.
	if (get(store).ws) {
		return;
	}

	const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/connect`;

	console.log(`Attempting to connect to WebSocket at: ${wsUrl}`);
	const ws = new WebSocket(wsUrl);

	ws.onopen = () => {
		update((state) => ({ ...state, ws: ws, isConnected: true }));
		console.log('WebSocket connection opened. Awaiting authentication from server...');
	};

	ws.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data);
			console.log('WebSocket message received:', message);

			update((currentState) => {
				// Start with the basic update: new lastMessage
				const nextState: WebSocketStore = { ...currentState, lastMessage: message };

				// Use a switch statement for clarity and to ensure pure, immutable updates.
				// Each case that modifies state should return a completely new state object.
				switch (message.type) {
					case 'authenticated':
						console.log('WebSocket authenticated successfully!');
						// Proactively ask the server for the current party status.
						// This ensures state is synced if the user opens a new tab while in a party.
						sendMessage({ type: 'get_my_party_status' });
						return {
							...nextState,
							isAuthenticated: true,
							userId: message.payload.user_id
						};

					case 'active_party_info':
						// The server is informing this tab about an existing party session.
						// We update the party state but mark this tab as NOT active.
						return {
							...nextState,
							party: {
								threadId: message.payload.thread_id,
								fileId: message.payload.file_id,
								isOwner: message.payload.is_owner
							}
						};

					case 'joined_watch_party_success':
						// The user has actively clicked "Join" on this tab.
						return {
							...nextState,
							party: {
								threadId: message.payload.thread_id,
								fileId: message.payload.file_id,
								isOwner: message.payload.is_owner
							}
						};

					case 'watch_party_left':
						return { ...nextState, party: { threadId: null, fileId: null, isOwner: false } };

					case 'user_banned':
						// If the banned user is the current user, clear their party state.
						if (message.payload?.banned_user_id === currentState.userId) {
							return { ...nextState, party: { threadId: null, fileId: null, isOwner: false } };
						}
						break;
					case 'party_list_updated':
						// This message can be overloaded. It might be a file change notification for party members.
						// We check if it contains a new file ID for our current party.
						// We assume a `newFileId` field based on the `party_file_changed` event.
						const newPartyFileId = message.payload?.newFileId;
						if (newPartyFileId && nextState.party.threadId && nextState.party.fileId !== newPartyFileId) {
							// It's a file change event. Update the store's party fileId to trigger navigation.
							return { ...nextState, party: { ...nextState.party, fileId: newPartyFileId } };
						}
						break;
					case 'ownership_transferred':
						// The current user has been promoted to owner.
						if (nextState.party.threadId === message.payload.thread_id) {
							console.log('You are now the owner of the watch party!');
							return { ...nextState, party: { ...nextState.party, isOwner: true } };
						}
						break;

					case 'ownership_revoked':
						// The current user has been demoted from owner.
						if (nextState.party.threadId === message.payload.thread_id) {
							console.log('You are no longer the owner of the watch party.');
							return { ...nextState, party: { ...nextState.party, isOwner: false } };
						}
						break;

					case 'party_file_changed':
						const { newFileId } = message.payload as PartyFileChangedNotification;
						if (nextState.party.threadId && nextState.party.fileId !== newFileId) {
							return { ...nextState, party: { ...nextState.party, fileId: newFileId } };
						}
						break;

					case 'new_chat_message':
						// This message is broadcast when a new message is added to a thread.
						// This is where we confirm a pending message has been received by the server.
						const incomingMessage = message.payload;

						// This logic attempts to match a received message to a pending one without server cooperation.
						// Note: This can be unreliable if a user sends the same message twice in rapid succession.
						// The recommended production approach is to send a `client_id` and have the server echo it back.
						if (incomingMessage.author?.id === currentState.userId) {
							// Find a pending message from the current user that matches the content and thread.
							const matchingPending = Object.values(currentState.pendingMessages).find(
								(p) =>
									p.payload.thread_id === incomingMessage.thread_id &&
									p.payload.content === incomingMessage.content
							);

							if (matchingPending) {
								const newPending = { ...currentState.pendingMessages };
								delete newPending[matchingPending.clientId];
								return { ...nextState, pendingMessages: newPending };
							}
						}
						break; // Fall through to default behavior if not a tracked message
					case 'transcoding_complete':
						const { file_id, url } = message.payload;
						return {
							...nextState,
							transcodingStatus: {
								...currentState.transcodingStatus,
								[file_id]: { url, completed: true }
							}
						};
				}
				// If no specific case returned, just return the state with the updated lastMessage.
				return nextState;
			});
		} catch (error) {
			console.error('Failed to parse WebSocket message:', event.data, error);
		}
	};

	ws.onclose = (event) => {
		console.log(`WebSocket closed: Code ${event.code}, Reason: ${event.reason}`);
		set(initialState);
	};

	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
		ws.close();
	};
}

/**
 * Sends a message object to the server through the WebSocket.
 * If the message is a chat message, it will be tracked for sent/received status.
 * @param {object} message - The message object to be sent (will be stringified).
 */
function sendMessage(message: { type: string; payload?: any }) {
	const currentWs = get(store).ws; // get ws instance

	if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
		console.warn('Attempted to send message, but WebSocket is not open or available.');
		return;
	}

	const isTrackable =
		(message.type === 'send_message_to_thread' || message.type === 'send_message_to_party') &&
		message.payload?.content;

	if (isTrackable) {
		const clientId = generateClientId();
		// This implementation uses client-side matching and does not send a client_id to the server.
		// Note: A more robust implementation would send a `client_id` and have the server echo it
		// back in the `new_chat_message` broadcast for definitive confirmation.
		const messageToSend = message;

		const trackedMessage: TrackedMessage = {
			clientId, // The clientId is still needed for local tracking in the map.
			status: 'sending',
			payload: message.payload,
			timestamp: Date.now()
		};

		// Add to pending messages store with 'sending' status
		update((s) => ({
			...s,
			pendingMessages: { ...s.pendingMessages, [clientId]: trackedMessage }
		}));

		try {
			console.log('Sending trackable WebSocket message:', messageToSend);
			currentWs.send(JSON.stringify(messageToSend));
			// Immediately update status to 'sent'
			update((s) => {
				const newPending = { ...s.pendingMessages };
				const pendingMsg = newPending[clientId];
				if (pendingMsg) {
					// Create a new object for the message to ensure reactivity
					newPending[clientId] = { ...pendingMsg, status: 'sent' };
					return { ...s, pendingMessages: newPending };
				}
				return s;
			});
		} catch (error) {
			console.error('Failed to send WebSocket message:', error);
			// Update status to 'failed' if send throws an error
			update((s) => {
				const newPending = { ...s.pendingMessages };
				const pendingMsg = newPending[clientId];
				if (pendingMsg) {
					// Create a new object for the message to ensure reactivity
					newPending[clientId] = { ...pendingMsg, status: 'failed' };
					return { ...s, pendingMessages: newPending };
				}
				return s;
			});
		}
	} else {
		console.log('Sending WebSocket message:', message);
		currentWs.send(JSON.stringify(message));
	}
}

/**
 * Closes the WebSocket connection and resets the store.
 */
function disconnect() {
	const currentWs = get(store).ws;
	if (currentWs) {
		currentWs.close(); // The onclose handler will reset the state.
	} else {
		set(initialState); // If no ws object, just reset state.
	}
}

function setParty(partyDetails: Partial<WatchPartyState>) {
	update((state) => ({ ...state, party: { ...state.party, ...partyDetails } }));
}

function setPartyFile(fileId: number) {
	update((state) => {
		if (state.party.threadId) {
			return { ...state, party: { ...state.party, fileId } };
		}
		return state;
	});
}

function updateTranscodingStatus(fileId: number, status: { url: string; completed: boolean }) {
	update((state) => ({
		...state,
		transcodingStatus: {
			...state.transcodingStatus,
			[fileId]: status
		}
	}));
}

/**
 * Exporting the store's `subscribe` method and our custom actions.
 */
export const wsStore = {
	subscribe, // Pass through the subscribe method for components to use
	connect,
	sendMessage,
	disconnect,
	setParty,
	setPartyFile,
	updateTranscodingStatus
};