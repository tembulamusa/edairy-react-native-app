import {
    getOldestUnpushedRecordAt,
    getUnsyncedCount,
    MEMBER_KILOS_SYNC_KEY,
    MILK_DELIVERY_SYNC_KEY,
    OFFLINE_REFERENCE_SYNC_KEYS,
    STORE_SALES_SYNC_KEY,
} from "../services/offlineDatabase";
import {
    hasMemberKilosReferenceData,
    loadMemberKilosReferenceDataFromSQLite,
} from "../services/offlineReferenceData";
import {
    hasMilkDeliveryReferenceData,
    loadMilkDeliveryReferenceDataFromSQLite,
} from "../services/milkDeliveryReferenceData";
import {
    hasStoreSalesReferenceData,
    loadStoreSalesReferenceDataFromSQLite,
} from "../services/storeSalesReferenceData";
import { getMaxOfflineIntakeMs } from "./userPreferences";
import { CORE_DATA_SETTINGS_MESSAGE } from "../services/coreData";

export type OfflineModuleKey = (typeof OFFLINE_REFERENCE_SYNC_KEYS)[number];

export type OfflineGateSnapshot = {
    unsyncedCount: number;
    oldestUnpushedAt: string | null;
    pendingAgeMs: number | null;
    maxOfflineIntakeMs: number;
    /** True when the oldest unpushed record is older than the configured max offline intake window. */
    offlineIntakeExpired: boolean;
    /** Block further offline saves until records are pushed online. */
    requiresOnlinePush: boolean;
    /** @deprecated Use requiresOnlinePush — kept for existing UI checks. */
    requiresReferenceRefresh: boolean;
    /** @deprecated Use requiresOnlinePush — kept for existing UI checks. */
    requiresSync: boolean;
    /** @deprecated Use offlineIntakeExpired — kept for existing UI checks. */
    referenceStale: boolean;
    syncInfo: null;
};

const MODULE_MISSING_MESSAGES: Record<OfflineModuleKey, string> = {
    [MEMBER_KILOS_SYNC_KEY]: CORE_DATA_SETTINGS_MESSAGE,
    [STORE_SALES_SYNC_KEY]: CORE_DATA_SETTINGS_MESSAGE,
    [MILK_DELIVERY_SYNC_KEY]: CORE_DATA_SETTINGS_MESSAGE,
};

export async function evaluateOfflineIntakeGate(): Promise<OfflineGateSnapshot> {
    const [unsyncedCount, oldestUnpushedAt, maxOfflineIntakeMs] = await Promise.all([
        getUnsyncedCount(),
        getOldestUnpushedRecordAt(),
        getMaxOfflineIntakeMs(),
    ]);

    let pendingAgeMs: number | null = null;
    if (oldestUnpushedAt) {
        const oldestMs = new Date(oldestUnpushedAt).getTime();
        if (!Number.isNaN(oldestMs)) {
            pendingAgeMs = Math.max(0, Date.now() - oldestMs);
        }
    }

    const offlineIntakeExpired =
        unsyncedCount > 0 &&
        pendingAgeMs != null &&
        pendingAgeMs > maxOfflineIntakeMs;

    const requiresOnlinePush = offlineIntakeExpired;

    return {
        unsyncedCount,
        oldestUnpushedAt,
        pendingAgeMs,
        maxOfflineIntakeMs,
        offlineIntakeExpired,
        requiresOnlinePush,
        requiresReferenceRefresh: requiresOnlinePush,
        requiresSync: requiresOnlinePush,
        referenceStale: offlineIntakeExpired,
        syncInfo: null,
    };
}

export async function assertOfflineReferenceAvailable(
    module: OfflineModuleKey
): Promise<{ allowed: boolean; message?: string }> {
    const missingMessage =
        MODULE_MISSING_MESSAGES[module] ?? CORE_DATA_SETTINGS_MESSAGE;

    try {
        if (module === MEMBER_KILOS_SYNC_KEY) {
            const data = await loadMemberKilosReferenceDataFromSQLite();
            if (!hasMemberKilosReferenceData(data)) {
                return { allowed: false, message: missingMessage };
            }
            return { allowed: true };
        }

        if (module === STORE_SALES_SYNC_KEY) {
            const data = await loadStoreSalesReferenceDataFromSQLite();
            if (!hasStoreSalesReferenceData(data)) {
                return { allowed: false, message: missingMessage };
            }
            return { allowed: true };
        }

        if (module === MILK_DELIVERY_SYNC_KEY) {
            const data = await loadMilkDeliveryReferenceDataFromSQLite();
            if (!hasMilkDeliveryReferenceData(data)) {
                return { allowed: false, message: missingMessage };
            }
            return { allowed: true };
        }
    } catch (error) {
        console.warn("[OFFLINE] Reference availability check failed:", module, error);
    }

    return { allowed: false, message: missingMessage };
}

/** @deprecated Use assertOfflineReferenceAvailable */
export async function assertModuleReferenceReady(
    key: OfflineModuleKey
): Promise<{ allowed: boolean; message?: string }> {
    return assertOfflineReferenceAvailable(key);
}

export function getOfflineBlockedMessage(options: {
    isSyncing: boolean;
    requiresOnlinePush?: boolean;
    requiresSync?: boolean;
    requiresReferenceRefresh?: boolean;
    moduleLabel?: string;
    maxOfflineHours?: number;
}): string {
    const requiresPush =
        options.requiresOnlinePush ??
        options.requiresReferenceRefresh ??
        options.requiresSync ??
        false;

    if (options.isSyncing) {
        return "Please wait while your offline records are being pushed online.";
    }

    if (requiresPush) {
        const hours = options.maxOfflineHours ?? 6;
        return `You have offline records waiting to be pushed. The maximum offline intake time (${hours} hour${hours === 1 ? "" : "s"} since the first unsaved record) has been reached. Connect to the internet so your records can upload automatically before saving more offline.`;
    }

    return "Offline save is not available right now.";
}

export function formatPendingAge(pendingAgeMs: number | null): string {
    if (pendingAgeMs == null) {
        return "no pending records";
    }

    const totalMinutes = Math.floor(pendingAgeMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}
