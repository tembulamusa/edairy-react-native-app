type HeaderRefreshListener = () => void;

const listeners = new Set<HeaderRefreshListener>();

export function subscribeHeaderRefresh(listener: HeaderRefreshListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function notifyHeaderRefresh(): void {
    listeners.forEach((listener) => {
        try {
            listener();
        } catch (error) {
            console.warn('[Header] Refresh listener error:', error);
        }
    });
}
