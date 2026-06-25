import {
    evaluateOfflineIntakeGate,
    type OfflineGateSnapshot,
} from "./offlineSaveGate";

export type OfflineCollectionGateState = OfflineGateSnapshot;

export function createClearedCollectionGate(): OfflineCollectionGateState {
    return {
        unsyncedCount: 0,
        oldestUnpushedAt: null,
        pendingAgeMs: null,
        maxOfflineIntakeMs: 0,
        offlineIntakeExpired: false,
        requiresOnlinePush: false,
        requiresReferenceRefresh: false,
        requiresSync: false,
        referenceStale: false,
        syncInfo: null,
    };
}

export async function evaluateOfflineCollectionGate(): Promise<OfflineCollectionGateState> {
    return evaluateOfflineIntakeGate();
}

export async function buildClearedCollectionGateFromStore(): Promise<OfflineCollectionGateState> {
    const gate = await evaluateOfflineIntakeGate();
    if (gate.unsyncedCount === 0) {
        return createClearedCollectionGate();
    }
    return gate;
}
