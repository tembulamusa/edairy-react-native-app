import {
    DEFAULT_OFFLINE_REFERENCE_SYNC_HOURS,
    getOfflineReferenceStaleMs,
} from "./userPreferences";

/** Default max age of locally stored reference data before offline collection is blocked. */
export const OFFLINE_REFERENCE_STALE_MS =
    DEFAULT_OFFLINE_REFERENCE_SYNC_HOURS * 60 * 60 * 1000;

export type ReferenceSyncInfo = {
    synced_at: string;
    record_counts?: Record<string, number>;
};

export function getReferenceDataAgeMs(
    syncInfo: ReferenceSyncInfo | null
): number | null {
    if (!syncInfo?.synced_at) {
        return null;
    }

    const syncedAt = new Date(syncInfo.synced_at).getTime();
    if (Number.isNaN(syncedAt)) {
        return null;
    }

    return Math.max(0, Date.now() - syncedAt);
}

export function isReferenceDataStale(
    syncInfo: ReferenceSyncInfo | null,
    thresholdMs: number = OFFLINE_REFERENCE_STALE_MS
): boolean {
    const ageMs = getReferenceDataAgeMs(syncInfo);
    if (ageMs == null) {
        return true;
    }

    return ageMs > thresholdMs;
}

export async function isReferenceDataStaleAsync(
    syncInfo: ReferenceSyncInfo | null
): Promise<boolean> {
    const thresholdMs = await getOfflineReferenceStaleMs();
    return isReferenceDataStale(syncInfo, thresholdMs);
}

export function formatReferenceDataAge(syncInfo: ReferenceSyncInfo | null): string {
    const ageMs = getReferenceDataAgeMs(syncInfo);
    if (ageMs == null) {
        return "never synced";
    }

    const totalSeconds = Math.floor(ageMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ago`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s ago`;
    }

    return `${seconds}s ago`;
}
