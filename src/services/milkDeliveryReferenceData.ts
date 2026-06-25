import fetchCommonData from "../components/utils/fetchCommonData";
import { REFERENCE_DATA_FETCH_LIMIT, referenceDataLimitParams } from "../utils/referenceDataFetch";
import { checkConnectivity } from "./connectivity";
import {
    getCustomers,
    getMeasuringCans,
    getShifts,
    getTransporters,
    initDatabase,
    saveCustomers,
    saveMeasuringCans,
    saveMilkDeliveryReferenceSyncMeta,
    saveShifts,
    saveTransporters,
} from "./offlineDatabase";
import { normalizeMemberKilosCans } from "./offlineReferenceData";

export type MilkDeliveryReferenceData = {
    customers: any[];
    transporters: any[];
    shifts: any[];
    cans: any[];
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

export function hasMilkDeliveryReferenceData(data: MilkDeliveryReferenceData): boolean {
    return (
        data.customers.length > 0 &&
        data.transporters.length > 0 &&
        data.shifts.length > 0
    );
}

export async function loadMilkDeliveryReferenceDataFromSQLite(): Promise<MilkDeliveryReferenceData> {
    await initDatabase();

    const [customers, transporters, shifts, cans] = await Promise.all([
        getCustomers(),
        getTransporters(),
        getShifts(),
        getMeasuringCans(),
    ]);

    return {
        customers: customers || [],
        transporters: transporters || [],
        shifts: shifts || [],
        cans: normalizeMemberKilosCans(cans || []),
    };
}

export async function refreshMilkDeliveryReferenceDataFromServer(
    logContext = "MilkDeliveryReference"
): Promise<MilkDeliveryReferenceData> {
    const fetchOptions = directFetchOptions(logContext);
    await initDatabase();

    const [customers, transporters, shifts, cans] = await Promise.all([
        fetchCommonData({ name: "customers", ...fetchOptions }),
        fetchCommonData({ name: "transporters", ...fetchOptions }),
        fetchCommonData({ name: "milk-delivery-shifts", ...fetchOptions }),
        fetchCommonData({ name: "milk-cans", ...fetchOptions }),
    ]);

    const customersArr = ensureRecordArray(customers);
    const transportersArr = ensureRecordArray(transporters);
    const shiftsArr = ensureRecordArray(shifts);
    const cansArr = normalizeMemberKilosCans(ensureRecordArray(cans));

    if (customersArr.length > 0) {
        await saveCustomers(customersArr);
    }
    if (transportersArr.length > 0) {
        await saveTransporters(transportersArr);
    }
    if (shiftsArr.length > 0) {
        await saveShifts(shiftsArr);
    }
    if (cansArr.length > 0) {
        await saveMeasuringCans(cansArr);
    }

    const [savedCustomers, savedTransporters, savedShifts, savedCans] = await Promise.all([
        getCustomers(),
        getTransporters(),
        getShifts(),
        getMeasuringCans(),
    ]);

    await saveMilkDeliveryReferenceSyncMeta({
        customers: savedCustomers.length,
        transporters: savedTransporters.length,
        shifts: savedShifts.length,
        cans: savedCans.length,
    });

    return {
        customers: customersArr,
        transporters: transportersArr,
        shifts: shiftsArr,
        cans: cansArr,
    };
}

export async function syncMilkDeliveryReferenceDataFromServer(): Promise<boolean> {
    try {
        await refreshMilkDeliveryReferenceDataFromServer("MilkDeliveryReferenceSync");
        return true;
    } catch (error) {
        console.error("[MilkDelivery] Failed to sync reference data:", error);
        return false;
    }
}
