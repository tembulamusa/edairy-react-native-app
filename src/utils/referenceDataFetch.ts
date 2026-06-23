import fetchCommonData from "../components/utils/fetchCommonData";
import { saveMembers } from "../services/offlineDatabase";
import { checkConnectivity } from "../services/offlineSync";

export const REFERENCE_DATA_FETCH_LIMIT = 300;

export const referenceDataLimitParams = () => ({
    limit: REFERENCE_DATA_FETCH_LIMIT,
});

export function getMemberNumber(member: any): string {
    return String(
        member?.member_no || member?.membership_no || member?.membershipNo || ""
    ).trim();
}

export function getMemberDisplayName(member: any): string {
    if (!member) {
        return "";
    }

    const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
    return name || member.name || member.full_name || "";
}

export function toMemberDropdownItems(members: any[]) {
    return (members || []).map((m: any) => {
        const memberNo = getMemberNumber(m);
        const name = getMemberDisplayName(m);
        return {
            label: memberNo ? `${name} (${memberNo})` : name,
            value: m.id,
        };
    });
}

export function filterMemberDropdownItems(
    items: { label: string; value: number }[],
    members: any[],
    searchText: string
) {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
        return items;
    }

    return items.filter((item) => {
        const member = members.find((m: any) => m.id === item.value);
        if (!member) {
            return item.label.toLowerCase().includes(normalized);
        }

        const memberNo = getMemberNumber(member).toLowerCase();
        const firstName = String(member.first_name ?? "").toLowerCase();
        const lastName = String(member.last_name ?? "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();

        return (
            item.label.toLowerCase().includes(normalized) ||
            memberNo.includes(normalized) ||
            firstName.includes(normalized) ||
            lastName.includes(normalized) ||
            fullName.includes(normalized)
        );
    });
}

/** Use member_no when the query looks like a number/code; otherwise search by name. */
export function shouldSearchMemberByNumber(searchText: string): boolean {
    const trimmed = searchText.trim();
    if (!trimmed || trimmed.includes(" ")) {
        return false;
    }

    if (/^\d+$/.test(trimmed)) {
        return true;
    }

    return /^[A-Za-z0-9-]+$/.test(trimmed) && /\d/.test(trimmed);
}

export function buildMemberSearchApiParams(searchText: string): Record<string, string | number> {
    const trimmed = searchText.trim();
    const params: Record<string, string | number> = {
        limit: REFERENCE_DATA_FETCH_LIMIT,
    };

    if (!trimmed) {
        return params;
    }

    if (shouldSearchMemberByNumber(trimmed)) {
        params.member_no = trimmed;
    } else {
        params.name = trimmed;
    }

    return params;
}

export function mergeRecordsById<T extends { id: number }>(
    existing: T[],
    incoming: T[]
): T[] {
    const byId = new Map<number, T>();
    for (const record of existing || []) {
        if (record?.id != null) {
            byId.set(record.id, record);
        }
    }
    for (const record of incoming || []) {
        if (record?.id != null) {
            byId.set(record.id, record);
        }
    }
    return Array.from(byId.values());
}

export async function searchMembersOnServer(
    searchText: string,
    logContext: string
): Promise<any[]> {
    const trimmed = searchText.trim();
    if (!trimmed) {
        return [];
    }

    const online = await checkConnectivity();
    if (!online) {
        return [];
    }

    const params = buildMemberSearchApiParams(trimmed);
    const members = await fetchCommonData({
        name: "members",
        cachable: false,
        direct: true,
        params,
        logContext,
    });

    if (!Array.isArray(members) || members.length === 0) {
        return [];
    }

    try {
        await saveMembers(members);
    } catch (error) {
        console.warn(`[${logContext}] Failed to cache searched members:`, error);
    }

    return members;
}
