import fetchCommonData, {
    clearSpecificCommonDataCache,
} from "../components/utils/fetchCommonData";
import {
    getMembers,
    getReferenceDataSyncInfo,
    getRouteCenters,
    getRoutes,
    getTransporters,
    findMemberByNumber,
    initDatabase,
    saveMemberKilosReferenceData as persistMemberKilosReferenceData,
    saveRouteCentersForRoute,
} from "./offlineDatabase";

export type MemberKilosReferenceDataInput = {
    transporters?: any[];
    members?: any[];
    routes?: any[];
    shifts?: any[];
    cans?: any[];
};

export {
    getMembers,
    getReferenceDataSyncInfo,
    getRouteCenters,
    getRoutes,
    getTransporters,
    findMemberByNumber,
};

export async function saveMemberKilosReferenceData(
    data: MemberKilosReferenceDataInput
): Promise<void> {
    await persistMemberKilosReferenceData(data);
}

export async function cacheRouteCentersForOffline(
    routeId: number,
    routeCenters: any[]
): Promise<void> {
    await saveRouteCentersForRoute(routeId, routeCenters);
}

/** Pull latest Member Kilos reference data from the API into SQLite. */
export async function syncMemberKilosReferenceDataFromServer(): Promise<boolean> {
    try {
        const memberFetchOptions = {
            cachable: false as const,
            direct: true,
            logContext: "OfflineReferenceSync",
        };

        await Promise.all([
            clearSpecificCommonDataCache("cans"),
            clearSpecificCommonDataCache("milk-delivery-cans"),
            clearSpecificCommonDataCache("milk-cans"),
            clearSpecificCommonDataCache("measuring_cans"),
            clearSpecificCommonDataCache("route-centers"),
            clearSpecificCommonDataCache("centers"),
        ]);

        const [transporters, routes, shifts, members, cans] = await Promise.all([
            fetchCommonData({ name: "transporters", ...memberFetchOptions }),
            fetchCommonData({
                name: "routes",
                direct: true,
                cachable: false,
                logContext: "OfflineReferenceSync",
            }),
            fetchCommonData({
                name: "milk-delivery-shifts",
                direct: true,
                cachable: false,
                logContext: "OfflineReferenceSync",
            }),
            fetchCommonData({ name: "members", ...memberFetchOptions }),
            fetchCommonData({ name: "milk-cans", ...memberFetchOptions }),
        ]);

        await initDatabase();
        await saveMemberKilosReferenceData({
            transporters: transporters || [],
            members: members || [],
            routes: routes || [],
            shifts: shifts || [],
            cans: cans || [],
        });

        console.log("[REF-SYNC] Reference data synced from server");
        return true;
    } catch (error) {
        console.error("[REF-SYNC] Failed to sync reference data:", error);
        return false;
    }
}
