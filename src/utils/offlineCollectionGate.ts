import {
    getReferenceDataSyncInfo,
    getUnsyncedCount,
} from "../services/offlineDatabase";
import {
    isReferenceDataStale,
    type ReferenceSyncInfo,
} from "./offlineStaleGuard";

export type OfflineCollectionGateState = {
    unsyncedCount: number;
    /** Informational only — does not block or force sync by itself. */
    referenceStale: boolean;
    /** True only when there are pending offline collections to upload. */
    requiresSync: boolean;
    syncInfo: ReferenceSyncInfo | null;
};

export function createClearedCollectionGate(
    syncInfo: ReferenceSyncInfo | null = null,
    referenceStale = false
): OfflineCollectionGateState {
    return {
        unsyncedCount: 0,
        referenceStale,
        requiresSync: false,
        syncInfo,
    };
}

export async function evaluateOfflineCollectionGate(): Promise<OfflineCollectionGateState> {
    const [unsyncedCount, syncInfo] = await Promise.all([
        getUnsyncedCount(),
        getReferenceDataSyncInfo(),
    ]);

    const referenceStale = isReferenceDataStale(syncInfo);

    return {
        unsyncedCount,
        referenceStale,
        requiresSync: unsyncedCount > 0,
        syncInfo,
    };
}

/** After sync completes (or nothing pending), stop unsynced gate checks. Reference SQLite data is kept. */
export async function buildClearedCollectionGateFromStore(): Promise<OfflineCollectionGateState> {
    const syncInfo = await getReferenceDataSyncInfo();
    return createClearedCollectionGate(syncInfo, isReferenceDataStale(syncInfo));
}
