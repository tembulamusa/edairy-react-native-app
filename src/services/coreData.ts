import {
    loadMemberKilosReferenceDataFromSQLite,
    syncMemberKilosReferenceDataFromServer,
    type MemberKilosReferenceData,
} from "./offlineReferenceData";
import {
    loadMilkDeliveryReferenceDataFromSQLite,
    syncMilkDeliveryReferenceDataFromServer,
    hasMilkDeliveryReferenceData,
    type MilkDeliveryReferenceData,
} from "./milkDeliveryReferenceData";
import {
    loadStoreSalesReferenceDataFromSQLite,
    refreshStoreSalesReferenceDataFromServer,
    type StoreSalesReferenceData,
} from "./storeSalesReferenceData";
import { initDatabase, saveReferenceSyncMetaForKey } from "./offlineDatabase";
import { checkConnectivity } from "./connectivity";

export const CORE_DATA_SYNC_KEY = "core_data";

export const CORE_DATA_SETTINGS_MESSAGE =
    'Offline core data is missing. Connect to the internet, open Settings, and tap "Update Online Data" to download members, customers, stores, routes, route centers, transporters, shifts, and cans.';

export type CoreDataSnapshot = {
    memberKilos: MemberKilosReferenceData;
    storeSales: StoreSalesReferenceData;
    milkDelivery: MilkDeliveryReferenceData;
};

export function hasMemberKilosCoreData(data: MemberKilosReferenceData): boolean {
    return (
        data.transporters.length > 0 &&
        data.members.length > 0 &&
        data.routes.length > 0 &&
        data.routeCenters.length > 0 &&
        data.shifts.length > 0 &&
        data.cans.length > 0
    );
}

export function hasStoreSalesCoreData(data: StoreSalesReferenceData): boolean {
    return (
        data.members.length > 0 &&
        data.transporters.length > 0 &&
        data.stores.length > 0
    );
}

export function hasCoreDataSnapshot(snapshot: CoreDataSnapshot): boolean {
    return (
        hasMemberKilosCoreData(snapshot.memberKilos) &&
        hasStoreSalesCoreData(snapshot.storeSales) &&
        hasMilkDeliveryReferenceData(snapshot.milkDelivery)
    );
}

export async function loadCoreDataSnapshot(): Promise<CoreDataSnapshot> {
    await initDatabase();

    const [memberKilos, storeSales, milkDelivery] = await Promise.all([
        loadMemberKilosReferenceDataFromSQLite(),
        loadStoreSalesReferenceDataFromSQLite(),
        loadMilkDeliveryReferenceDataFromSQLite(),
    ]);

    return { memberKilos, storeSales, milkDelivery };
}

export async function hasCoreData(): Promise<boolean> {
    try {
        const snapshot = await loadCoreDataSnapshot();
        return hasCoreDataSnapshot(snapshot);
    } catch (error) {
        console.warn("[CORE-DATA] Failed to evaluate core data availability:", error);
        return false;
    }
}

async function saveCoreDataSyncMeta(snapshot: CoreDataSnapshot): Promise<void> {
    await saveReferenceSyncMetaForKey(CORE_DATA_SYNC_KEY, {
        members: snapshot.memberKilos.members.length,
        customers: snapshot.milkDelivery.customers.length,
        stores: snapshot.storeSales.stores.length,
        routes: snapshot.memberKilos.routes.length,
        route_centers: snapshot.memberKilos.routeCenters.length,
        transporters: snapshot.memberKilos.transporters.length,
        shifts: snapshot.memberKilos.shifts.length,
        cans: snapshot.memberKilos.cans.length,
    });
}

/**
 * Download all core offline lists from the server into SQLite.
 * Used on first online login and from Settings → Update Online Data.
 */
export async function refreshCoreDataFromServer(options?: {
    logContext?: string;
}): Promise<boolean> {
    const online = await checkConnectivity();
    if (!online) {
        console.warn("[CORE-DATA] Skipping download — device is offline");
        return false;
    }

    const logContext = options?.logContext ?? "CoreData";

    try {
        await initDatabase();

        const [memberKilos, storeSales, milkDelivery] = await Promise.all([
            syncMemberKilosReferenceDataFromServer(),
            refreshStoreSalesReferenceDataFromServer({ logContext })
                .then(() => true)
                .catch((error) => {
                    console.error("[CORE-DATA] Store sales download failed:", error);
                    return false;
                }),
            syncMilkDeliveryReferenceDataFromServer(),
        ]);

        const snapshot = await loadCoreDataSnapshot();
        const complete = hasCoreDataSnapshot(snapshot);

        if (memberKilos && storeSales && milkDelivery && complete) {
            await saveCoreDataSyncMeta(snapshot);
            console.log("[CORE-DATA] Core data download complete");
            return true;
        }

        console.warn("[CORE-DATA] Core data download incomplete", {
            memberKilos,
            storeSales,
            milkDelivery,
            complete,
        });
        return false;
    } catch (error) {
        console.error("[CORE-DATA] Core data download failed:", error);
        return false;
    }
}
