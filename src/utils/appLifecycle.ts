import { AppState, AppStateStatus } from "react-native";

let currentAppState: AppStateStatus = AppState.currentState;
let listenerAttached = false;
const listeners = new Set<(state: AppStateStatus) => void>();

function attachAppStateListener(): void {
    if (listenerAttached) {
        return;
    }

    listenerAttached = true;
    AppState.addEventListener("change", (nextState) => {
        currentAppState = nextState;
        listeners.forEach((listener) => {
            try {
                listener(nextState);
            } catch (error) {
                console.warn("[AppLifecycle] Listener error:", error);
            }
        });
    });
}

/** True when the app is in the foreground and accepting UI updates. */
export function isAppInForeground(): boolean {
    return currentAppState === "active";
}

export function getAppState(): AppStateStatus {
    return currentAppState;
}

export function subscribeAppState(
    listener: (state: AppStateStatus) => void
): () => void {
    attachAppStateListener();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
