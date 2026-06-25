import fetchCommonData, {
    clearSpecificCommonDataCache,
} from "../components/utils/fetchCommonData";
import {
    findMemberByNumber,
    getMeasuringCans,
    getMembers,
    getReferenceDataSyncInfo,
    getRouteCenters,
    getRoutes,
    getShifts,
    getTransporters,
    initDatabase,
    saveMeasuringCans,
    saveMemberKilosReferenceData as persistMemberKilosReferenceData,
    saveMemberKilosReferenceSyncMeta,
    saveMembers,
    saveRoutes,
    saveAllRouteCenters,
    saveRouteCentersForRoute,
    saveShifts,
    saveTransporters,
} from "./offlineDatabase";
import { referenceDataLimitParams } from "../utils/referenceDataFetch";
import { filterRouteCentersForRoute } from "../utils/route";
import { checkConnectivity } from "./connectivity";

export type MemberKilosReferenceDataInput = {
    transporters?: any[];
    members?: any[];
    routes?: any[];
    shifts?: any[];
    cans?: any[];
};

export type MemberKilosReferenceData = {
    transporters: any[];
    members: any[];
    routes: any[];
    shifts: any[];
    cans: any[];
    routeCenters: any[];
};

export {
    findMemberByNumber,
    getMembers,
    getMeasuringCans,
    getReferenceDataSyncInfo,
    getRouteCenters,
    getRoutes,
    getShifts,
    getTransporters,
};

export function normalizeMemberKilosCans(cans: any[]): any[] {
    return (cans || []).map((can) => ({
        ...can,
        tare_weight: can?.tare_weight ?? can?.weight ?? 0,
        weight: can?.weight ?? can?.tare_weight ?? 0,
    }));
}

export function hasMemberKilosReferenceData(data: MemberKilosReferenceData): boolean {
    return (
        data.transporters.length > 0 ||
        data.members.length > 0 ||
        data.routes.length > 0 ||
        data.shifts.length > 0 ||
        data.cans.length > 0
    );
}

function ensureRecordArray(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
}

async function persistReferenceSyncCountsFromSQLite(): Promise<void> {
    const snapshot = await loadMemberKilosReferenceDataFromSQLite();
    await saveMemberKilosReferenceSyncMeta({
        transporters: snapshot.transporters.length,
        members: snapshot.members.length,
        routes: snapshot.routes.length,
        shifts: snapshot.shifts.length,
        cans: snapshot.cans.length,
        route_centers: snapshot.routeCenters.length,
    });
}

/** Read transporters, members, routes, shifts, and cans from their SQLite tables. */
export async function loadMemberKilosReferenceDataFromSQLite(): Promise<MemberKilosReferenceData> {
    await initDatabase();

    const [transporters, members, routes, shifts, measuringCans, routeCenters] =
        await Promise.all([
            getTransporters(),
            getMembers(),
            getRoutes(),
            getShifts(),
            getMeasuringCans(),
            getRouteCenters(),
        ]);

    return {
        transporters: transporters || [],
        members: members || [],
        routes: routes || [],
        shifts: shifts || [],
        cans: normalizeMemberKilosCans(measuringCans || []),
        routeCenters: routeCenters || [],
    };
}

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

type FetchRouteCentersOptions = {
    logContext?: string;
    preferOnline?: boolean;
};

/** Load route centers for one route only (API when online, SQLite when offline). */
export async function fetchRouteCentersForRoute(
    routeId: number,
    options: FetchRouteCentersOptions = {}
): Promise<any[]> {
    const logContext = options.logContext ?? "RouteCenters";
    const preferOnline = options.preferOnline ?? true;
    const online = preferOnline && (await checkConnectivity());

    let centers: any[] = [];

    if (online) {
        await clearSpecificCommonDataCache("route-centers");

        const response = await fetchCommonData({
            name: "route-centers",
            cachable: false,
            direct: true,
            params: { route_id: routeId },
            logContext,
        });

        centers = ensureRecordArray(response);

        if (centers.length > 0) {
            try {
                await saveRouteCentersForRoute(routeId, centers);
            } catch (error) {
                console.warn(`[${logContext}] Failed to cache route centers:`, error);
            }
        }
    } else {
        centers = await getRouteCenters(routeId);
    }

    return filterRouteCentersForRoute(centers, routeId);
}

async function clearMemberKilosFetchCaches(): Promise<void> {
    await Promise.all([
        clearSpecificCommonDataCache("cans"),
        clearSpecificCommonDataCache("milk-delivery-cans"),
        clearSpecificCommonDataCache("milk-cans"),
        clearSpecificCommonDataCache("measuring_cans"),
        clearSpecificCommonDataCache("route-centers"),
        clearSpecificCommonDataCache("centers"),
    ]);
}

type RefreshOptions = {
    logContext?: string;
};

/**
 * Fetch Member Kilos reference data from the API and persist each entity
 * to its own SQLite table (transporters, members, routes, shifts, cans).
 * Existing SQLite rows are upserted, never wiped on empty/failed fetches.
 * Returns the merged snapshot read back from SQLite.
 */
export async function refreshMemberKilosReferenceDataFromServer(
    options: RefreshOptions = {}
): Promise<MemberKilosReferenceData> {
    const logContext = options.logContext ?? "MemberKilosReference";
    const limitParams = referenceDataLimitParams();
    const fetchOptions = {
        cachable: false as const,
        direct: true,
        logContext,
        params: limitParams,
    };

    await clearMemberKilosFetchCaches();
    await initDatabase();

    const transporters = ensureRecordArray(
        await fetchCommonData({ name: "transporters", ...fetchOptions })
    );
    if (transporters.length > 0) {
        await saveTransporters(transporters);
        console.log(`[REF-DATA] Saved ${transporters.length} transporters to SQLite`);
    }

    const routes = ensureRecordArray(
        await fetchCommonData({ name: "routes", ...fetchOptions })
    );
    if (routes.length > 0) {
        await saveRoutes(routes);
        console.log(`[REF-DATA] Saved ${routes.length} routes to SQLite`);
    }

    const shifts = ensureRecordArray(
        await fetchCommonData({ name: "milk-delivery-shifts", ...fetchOptions })
    );
    if (shifts.length > 0) {
        await saveShifts(shifts);
        console.log(`[REF-DATA] Saved ${shifts.length} shifts to SQLite`);
    }

    const members = ensureRecordArray(
        await fetchCommonData({ name: "members", ...fetchOptions })
    );
    if (members.length > 0) {
        await saveMembers(members);
        console.log(`[REF-DATA] Saved ${members.length} members to SQLite`);
    }

    const cans = ensureRecordArray(
        await fetchCommonData({ name: "milk-cans", ...fetchOptions })
    );
    if (cans.length > 0) {
        await saveMeasuringCans(cans);
        console.log(`[REF-DATA] Saved ${cans.length} milk cans to SQLite`);
    }

    const routeCenters = ensureRecordArray(
        await fetchCommonData({ name: "route-centers", ...fetchOptions })
    );
    if (routeCenters.length > 0) {
        await saveAllRouteCenters(routeCenters);
        console.log(`[REF-DATA] Saved ${routeCenters.length} route centers to SQLite`);
    }

    await persistReferenceSyncCountsFromSQLite();
    return loadMemberKilosReferenceDataFromSQLite();
}

/** Pull latest Member Kilos reference data from the API into SQLite. */
export async function syncMemberKilosReferenceDataFromServer(): Promise<boolean> {
    try {
        await refreshMemberKilosReferenceDataFromServer({
            logContext: "OfflineReferenceSync",
        });
        console.log("[REF-SYNC] Reference data synced from server");
        return true;
    } catch (error) {
        console.error("[REF-SYNC] Failed to sync reference data:", error);
        return false;
    }
}
