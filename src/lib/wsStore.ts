// src/lib/wsStore.ts

import { writable, get } from 'svelte/store'; // 1. Import 'get'
import { browser } from '$app/environment';

/**
 * Interface defining the shape of our WebSocket store's state.
 */
interface WebSocketStore {
	ws: WebSocket | null;
	isConnected: boolean;
	isAuthenticated: boolean;
	userId: number | null;
	lastMessage: any | null;
	currentParty: {
		threadId: number | null;
		fileId: number | null;
	};
	transcodingStatus: {
		[fileId: number]: { url: string; completed: boolean };
	};
}

const initialState: WebSocketStore = {
	ws: null,
	isConnected: false,
	isAuthenticated: false,
	userId: null,
	lastMessage: null,
	currentParty: {
		threadId: null,
		fileId: null
	},
	transcodingStatus: {}
};

// 2. Create the store instance itself
const store = writable<WebSocketStore>(initialState);
// 3. Destructure its core methods for use within this file
const { subscribe, set, update } = store;


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
		update((state) => ({...state, ws: ws, isConnected: true }));
		console.log('WebSocket connection opened. Awaiting authentication from server...');
	};

	ws.onmessage = (event) => {
		try {
			const message = JSON.parse(event.data);
			console.log('WebSocket message received:', message);

			update((state) => {
				const newState: WebSocketStore = { ...state, lastMessage: message };

				if (message.type === 'authenticated') {
					console.log('WebSocket authenticated successfully!');
					newState.isAuthenticated = true;
					newState.userId = message.payload.user_id;
				}
				if (message.type === 'watch_party_joined') {
					newState.currentParty = {
						threadId: message.payload.thread_id,
						fileId: message.payload.file_id
					};
				}
				if (message.type === 'watch_party_left' || message.type === 'user_left_party' || message.type === 'user_banned') {
					if (message.type === 'watch_party_left' || message.payload?.id === state.currentParty.threadId || message.payload?.banned_user_id === state.userId) {
						newState.currentParty = { threadId: null, fileId: null };
					}
				}

				if (message.type === 'transcoding_complete') {
					const { file_id, url } = message.payload;
					newState.transcodingStatus = {
						...state.transcodingStatus,
						[file_id]: { url, completed: true }
					};
				}
				return newState;
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
 * @param {object} message - The message object to be sent (will be stringified).
 */
function sendMessage(message: object) {
    // 4. Use get(store) to synchronously read the current state.
	const currentWs = get(store).ws;

	if (currentWs && currentWs.readyState === WebSocket.OPEN) {
		currentWs.send(JSON.stringify(message));
	} else {
		console.warn('Attempted to send message, but WebSocket is not open or available.');
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

function setParty(partyDetails: { threadId: number | null; fileId: number | null }) {
	update((state) => ({ ...state, currentParty: partyDetails }));
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
	updateTranscodingStatus
};