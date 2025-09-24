// src/lib/partyIndicatorStore.ts
import { writable } from 'svelte/store';

interface PartyIndicatorStoreState {
    // Map component's unique ID to its priority
    registry: Map<symbol, number>;
    alwaysFollow: boolean;
}

function createPartyIndicatorStore() {
    const { subscribe, update } = writable<PartyIndicatorStoreState>({
        registry: new Map(),
        alwaysFollow: false
    });

    function register(id: symbol, priority: number) {
        update((state) => {
            state.registry.set(id, priority);
            return { ...state, registry: new Map(state.registry) }; // new Map to trigger reactivity
        });
    }

    function unregister(id: symbol) {
        update((state) => {
            state.registry.delete(id);
            return { ...state, registry: new Map(state.registry) };
        });
    }

    function setAlwaysFollow(shouldFollow: boolean) {
        update((state) => ({ ...state, alwaysFollow: shouldFollow }));
    }

    return {
        subscribe,
        register,
        unregister,
        setAlwaysFollow
    };
}

export const partyIndicatorStore = createPartyIndicatorStore();