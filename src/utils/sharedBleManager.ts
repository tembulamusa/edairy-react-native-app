import { BleManager, State } from 'react-native-ble-plx';

let instance: BleManager | null = null;
let refCount = 0;
let adapterState: State = 'Unknown';
let stateSubscription: { remove: () => void } | null = null;
const stateListeners = new Set<(state: State) => void>();

function attachStateSubscription(): void {
    if (!instance || stateSubscription) {
        return;
    }

    stateSubscription = instance.onStateChange((state) => {
        adapterState = state;
        if (state !== 'PoweredOn') {
            try {
                instance?.stopDeviceScan();
            } catch {
                // scan may not be running
            }
        }
        stateListeners.forEach((listener) => {
            try {
                listener(state);
            } catch (err) {
                console.warn('[BLE] State listener error:', err);
            }
        });
    }, true);
}

function detachStateSubscription(): void {
    try {
        stateSubscription?.remove?.();
    } catch {
        // ignore
    }
    stateSubscription = null;
}

/**
 * Single BleManager for the app. react-native-ble-plx must not use multiple
 * instances (e.g. scale + printer hooks on MemberKilosScreen).
 */
export function acquireSharedBleManager(): BleManager {
    refCount += 1;
    if (!instance) {
        instance = new BleManager();
    }
    attachStateSubscription();
    return instance;
}

export function releaseSharedBleManager(): void {
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0) {
        return;
    }

    detachStateSubscription();
    // Keep the native BleManager alive for the app process. Destroying and
    // recreating it while hooks still hold references causes native crashes
    // when Bluetooth is toggled or scans reconnect.
}

export function getBleManagerIfAvailable(): BleManager | null {
    return instance;
}

export function getBleAdapterState(): State {
    return adapterState;
}

export function subscribeBleStateChange(listener: (state: State) => void): () => void {
    stateListeners.add(listener);
    return () => {
        stateListeners.delete(listener);
    };
}

export async function isBleAdapterReady(): Promise<boolean> {
    if (!instance) {
        return false;
    }
    try {
        const state = await instance.state();
        adapterState = state;
        return state === 'PoweredOn';
    } catch (err) {
        console.warn('[BLE] Error reading adapter state:', err);
        return false;
    }
}
