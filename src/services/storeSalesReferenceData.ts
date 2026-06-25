import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData from "../components/utils/fetchCommonData";
import { REFERENCE_DATA_FETCH_LIMIT, referenceDataLimitParams } from "../utils/referenceDataFetch";
import { normalizeUserStoreAssignments } from "../utils/storeSales";
import { checkConnectivity } from "./connectivity";
import {
    getMembers,
    getStores,
    getTransporters,
    initDatabase,
    saveMembers,
    saveStoreSalesReferenceSyncMeta,
    saveStores,
    saveStoreStocksForStore,
    saveTransporters,
} from "./offlineDatabase";

export type StoreSalesReferenceData = {
    members: any[];
    employees: any[];
    vendors: any[];
    transporters: any[];
    suppliers: any[];
    stores: any[];
    stock_items: any[];
};

function ensureRecordArray(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
}

function directFetchOptions(logContext: string) {
    return {
        cachable: false as const,
        direct: true,
        logContext,
        params: referenceDataLimitParams(),
    };
}

/** Store-sales lookup models are served via global-data, not direct REST paths. */
function globalDataFetchOptions(logContext: string) {
    return {
        cachable: false as const,
        logContext,
        params: referenceDataLimitParams(),
    };
}

export function hasStoreSalesReferenceData(data: StoreSalesReferenceData): boolean {
    return (
        data.members.length > 0 ||
        data.transporters.length > 0 ||
        data.stores.length > 0
    );
}

/** Load members, transporters, and stores from SQLite. */
export async function loadStoreSalesReferenceDataFromSQLite(): Promise<StoreSalesReferenceData> {
    await initDatabase();

    const [members, transporters, stores] = await Promise.all([
        getMembers(),
        getTransporters(),
        getStores(),
    ]);

    return {
        members: members || [],
        employees: [],
        vendors: [],
        transporters: transporters || [],
        suppliers: [],
        stores: stores || [],
        stock_items: [],
    };
}

type RefreshOptions = {
    logContext?: string;
};

export async function getLoggedInUserId(): Promise<number | null> {
    try {
        const userDataString = await AsyncStorage.getItem("user");
        const userData = userDataString ? JSON.parse(userDataString) : null;
        const userId = userData?.user_id ?? userData?.id;

        if (userId == null || userId === "") {
            return null;
        }

        return Number(userId);
    } catch (error) {
        console.warn("[StoreSales] Failed to read logged-in user id:", error);
        return null;
    }
}

/** Stores assigned to the logged-in user via GET user-store-assignments. */
export async function fetchUserAssignedStores(
    logContext = "StoreSales"
): Promise<any[]> {
    const userId = await getLoggedInUserId();
    if (!userId) {
        console.warn(`[${logContext}] No user_id — skipping store assignments fetch`);
        return [];
    }

    const assignments = await fetchCommonData({
        name: "user-store-assignments",
        direct: true,
        cachable: false,
        logContext,
        params: {
            page: 1,
            limit: REFERENCE_DATA_FETCH_LIMIT,
            user_id: userId,
        },
    });

    return normalizeUserStoreAssignments(ensureRecordArray(assignments));
}

/** Stock for a store via GET store-stocks?store_id={storeId}, with SQLite fallback. */
export async function fetchStoreStocks(
    storeId: number,
    logContext = "StoreSale"
): Promise<any[]> {
    if (!storeId) {
        return [];
    }

    const online = await checkConnectivity();
    if (!online) {
        const { getStoreStocks } = await import("./offlineDatabase");
        return getStoreStocks(storeId);
    }

    const data = await fetchCommonData({
        name: "store-stocks",
        direct: true,
        cachable: false,
        logContext,
        params: { store_id: storeId },
    });

    const stocks = ensureRecordArray(data);
    if (stocks.length > 0) {
        await saveStoreStocksForStore(storeId, stocks);
    }

    return stocks;
}

/**
 * Fetch Store Sales reference data from direct API endpoints (same pattern as Member Kilos)
 * and persist members/transporters to SQLite.
 */
export async function refreshStoreSalesReferenceDataFromServer(
    options: RefreshOptions = {}
): Promise<StoreSalesReferenceData> {
    const logContext = options.logContext ?? "StoreSalesReference";
    const directOptions = directFetchOptions(logContext);
    const globalOptions = globalDataFetchOptions(logContext);

    await initDatabase();

    const [
        members,
        employees,
        vendors,
        transporters,
        suppliers,
        stores,
    ] = await Promise.all([
        fetchCommonData({ name: "members", ...directOptions }),
        fetchCommonData({ name: "employees", ...globalOptions }),
        fetchCommonData({ name: "vendors", ...globalOptions }),
        fetchCommonData({ name: "transporters", ...directOptions }),
        fetchCommonData({ name: "suppliers", ...globalOptions }),
        fetchUserAssignedStores(logContext),
    ]);

    const membersArr = ensureRecordArray(members);
    const transportersArr = ensureRecordArray(transporters);

    if (membersArr.length > 0) {
        await saveMembers(membersArr);
        console.log(`[StoreSales] Saved ${membersArr.length} members to SQLite`);
    }

    if (transportersArr.length > 0) {
        await saveTransporters(transportersArr);
        console.log(`[StoreSales] Saved ${transportersArr.length} transporters to SQLite`);
    }

    if (stores.length > 0) {
        await saveStores(stores);
        console.log(`[StoreSales] Saved ${stores.length} stores to SQLite`);

        for (const store of stores) {
            if (!store?.id) {
                continue;
            }
            try {
                const stocks = await fetchStoreStocks(store.id, logContext);
                if (stocks.length > 0) {
                    console.log(
                        `[StoreSales] Cached ${stocks.length} stock item(s) for store ${store.id}`
                    );
                }
            } catch (stockError) {
                console.warn(`[StoreSales] Failed to cache stocks for store ${store.id}:`, stockError);
            }
        }
    }

    const [savedMembers, savedTransporters, savedStores] = await Promise.all([
        getMembers(),
        getTransporters(),
        getStores(),
    ]);

    await saveStoreSalesReferenceSyncMeta({
        members: savedMembers.length,
        transporters: savedTransporters.length,
        stores: savedStores.length,
    });

    return {
        members: membersArr,
        employees: ensureRecordArray(employees),
        vendors: ensureRecordArray(vendors),
        transporters: transportersArr,
        suppliers: ensureRecordArray(suppliers),
        stores,
        stock_items: [],
    };
}

/** Fetch filtered store sales summary via global-data?model=store_sales. */
export async function fetchStoreSalesSummary(
    params: Record<string, any>,
    logContext = "StoreSales"
): Promise<any[]> {
    const data = await fetchCommonData({
        name: "store_sales",
        cachable: false,
        params,
        logContext,
    });

    return ensureRecordArray(data);
}

export { checkConnectivity };
