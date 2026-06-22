import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRouteCenterDisplayName, getRouteDisplayName } from "./route";
import { getTransporterDisplayName } from "./transporter";
import {
    MemberKilosJournalPayload,
    MemberKilosRecordedEntry,
} from "./memberKilosJournalPayload";

export type MemberReceiptLine = {
    member_id?: number;
    member_label: string;
    can_id?: number | null;
    can_label: string;
    quantity: number;
    scale_weight?: number;
    tare_weight?: number;
    batch_no?: string;
    journal_date?: string;
};

export type MemberReceiptGroup = {
    member_id: number;
    member_label: string;
    entries: MemberReceiptLine[];
    totalCans: number;
    totalQuantity: number;
    totalGross: number;
    totalTare: number;
};

export type BuildMemberKilosReceiptsInput = {
    response: any;
    payload: MemberKilosJournalPayload;
    localEntries: MemberKilosRecordedEntry[];
    commonData: any;
    transporterId?: number | null;
    shiftId?: number | null;
    routeId?: number | null;
    centerId?: number | null;
};

const PENDING_RECEIPTS_STORAGE_KEY = "pending_member_receipts";
const RECEIPT_WIDTH = 32;

export function getPendingReceiptsStorageKey(): string {
    return PENDING_RECEIPTS_STORAGE_KEY;
}

function receiptLine(char: string): string {
    return char.repeat(RECEIPT_WIDTH);
}

function receiptCenteredLine(text: string, char = "-"): string {
    const trimmed = text.trim();
    if (trimmed.length >= RECEIPT_WIDTH) {
        return trimmed.slice(0, RECEIPT_WIDTH);
    }

    const padding = RECEIPT_WIDTH - trimmed.length;
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return `${char.repeat(left)}${trimmed}${char.repeat(right)}`;
}

/** Log full milk-journals POST payload and response for receipt field mapping. */
export function logMilkJournalPost(
    payload: MemberKilosJournalPayload,
    status: number,
    response: any
): void {
    const responseRoot = response?.data ?? response;

    console.log("[MemberKilos] POST milk-journals REQUEST:");
    console.log(JSON.stringify(payload, null, 2));

    console.log(`[MemberKilos] POST milk-journals RESPONSE (${status}):`);
    console.log(JSON.stringify(response, null, 2));

    const responseEntries = extractJournalEntriesFromResponse(response);
    const sampleEntry = responseEntries[0];

    console.log("[MemberKilos] POST milk-journals RESPONSE shape:", {
        status,
        topLevelKeys: responseRoot && typeof responseRoot === "object"
            ? Object.keys(responseRoot)
            : [],
        batchCount: Array.isArray(responseRoot?.batches) ? responseRoot.batches.length : 0,
        entryCount: responseEntries.length,
        sampleEntryKeys: sampleEntry && typeof sampleEntry === "object"
            ? Object.keys(sampleEntry)
            : [],
        sampleEntry: sampleEntry ?? null,
        journal: responseRoot?.journal ?? null,
        journal_date: responseRoot?.journal_date ?? null,
    });
}

/** Pull journal entry rows from common API response shapes. */
export function extractJournalEntriesFromResponse(response: any): any[] {
    const root = response?.data ?? response;
    if (!root || typeof root !== "object") {
        return [];
    }

    if (Array.isArray(root.batches)) {
        return root.batches.flatMap((batch: any) =>
            (batch?.entries || []).map((entry: any) => ({
                ...entry,
                batch_no: entry?.batch_no ?? batch?.batch_no,
            }))
        );
    }

    if (Array.isArray(root.entries)) {
        return root.entries;
    }

    if (Array.isArray(root)) {
        return root;
    }

    return [];
}

export function extractJournalEntriesFromPayload(
    payload: MemberKilosJournalPayload
): any[] {
    return (payload?.batches || []).flatMap((batch) =>
        (batch.entries || []).map((entry) => ({
            ...entry,
            batch_no: entry.batch_no ?? batch.batch_no,
        }))
    );
}

function resolveCanLabel(canId: number | null | undefined, commonData: any): string {
    if (canId == null) {
        return "N/A";
    }

    const can = (commonData?.cans || []).find((c: any) => c.id === canId);
    return can?.can_id || can?.name || `Can ${canId}`;
}

function resolveMember(memberId: number, commonData: any) {
    return (commonData?.members || []).find((m: any) => m.id === memberId);
}

function getMemberDisplayName(member: any, memberId: number): string {
    if (!member) {
        return `Member #${memberId}`;
    }

    const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
    return name || `Member #${memberId}`;
}

function getMemberNumber(member: any): string | null {
    return member?.member_no || member?.membership_no || member?.membershipNo || null;
}

function getMemberEntryLabel(
    member: any,
    memberId: number,
    entry?: any
): string {
    if (typeof entry?.member_name === "string" && entry.member_name.trim()) {
        return entry.member_name.trim();
    }

    if (entry?.member && typeof entry.member === "object") {
        const nestedMember = entry.member;
        const nestedId = nestedMember.id ?? memberId;
        const name = getMemberDisplayName(nestedMember, nestedId);
        const memberNo = getMemberNumber(nestedMember);
        return memberNo ? `${name} (${memberNo})` : name;
    }

    const name = getMemberDisplayName(member, memberId);
    const memberNo = getMemberNumber(member);
    return memberNo ? `${name} (${memberNo})` : name;
}

function mapSourceEntryToReceiptLine(
    entry: any,
    commonData: any,
    fallbackMemberId?: number
): MemberReceiptLine | null {
    const entryMemberId = entry?.member_id ?? fallbackMemberId;
    if (entryMemberId == null) {
        return null;
    }

    const entryMember = entry?.member ?? resolveMember(entryMemberId, commonData);
    const quantity = Number(entry?.quantity ?? entry?.net ?? 0);

    return {
        member_id: entryMemberId,
        member_label: getMemberEntryLabel(entryMember, entryMemberId, entry),
        can_id: entry?.can_id ?? null,
        can_label: resolveCanLabel(entry?.can_id, commonData),
        quantity,
        scale_weight:
            entry?.scale_weight != null ? Number(entry.scale_weight) : undefined,
        tare_weight: entry?.tare_weight != null ? Number(entry.tare_weight) : undefined,
        batch_no: entry?.batch_no,
        journal_date: entry?.journal_date,
    };
}

function enrichEntriesWithLocalData(
    sourceEntries: any[],
    localEntries: MemberKilosRecordedEntry[]
): any[] {
    if (!localEntries.length) {
        return sourceEntries;
    }

    return sourceEntries.map((entry, index) => {
        const local =
            localEntries[index] ??
            localEntries.find(
                (localEntry) =>
                    localEntry.can_id === entry.can_id &&
                    (localEntry.member_id == null ||
                        localEntry.member_id === entry.member_id)
            );

        if (!local) {
            return entry;
        }

        return {
            ...entry,
            member_id: entry.member_id ?? local.member_id,
            member_label: entry.member_label ?? local.member_label,
            scale_weight: entry.scale_weight ?? local.scale_weight,
            tare_weight: entry.tare_weight ?? local.tare_weight,
            quantity: Number(
                entry.quantity ?? entry.net ?? local.net ?? local.quantity ?? 0
            ),
        };
    });
}

function resolveReceiptSourceEntries(
    input: BuildMemberKilosReceiptsInput
): any[] {
    const { response, payload, localEntries } = input;
    const responseEntries = extractJournalEntriesFromResponse(response);
    const payloadEntries = extractJournalEntriesFromPayload(payload);

    let sourceEntries = responseEntries.length > 0 ? responseEntries : payloadEntries;

    if (sourceEntries.length === 0 && localEntries.length > 0) {
        const fallbackMemberId = payloadEntries[0]?.member_id;
        const fallbackBatchNo = payload?.batches?.[0]?.batch_no;
        const fallbackJournalDate = payload?.journal_date;

        sourceEntries = localEntries.map((entry, index) => ({
            member_id: entry?.member_id ?? fallbackMemberId,
            member_label: entry?.member_label,
            can_id: entry.can_id ?? null,
            quantity: Number(entry.net ?? entry.quantity ?? 0),
            scale_weight: entry.scale_weight,
            tare_weight: entry.tare_weight,
            net: entry.net,
            batch_no: payloadEntries[index]?.batch_no ?? fallbackBatchNo,
            journal_date: fallbackJournalDate,
        }));
    } else if (sourceEntries.length > 0 && localEntries.length > 0) {
        sourceEntries = enrichEntriesWithLocalData(sourceEntries, localEntries);
    }

    return sourceEntries;
}

export function buildMemberReceiptGroups(
    input: BuildMemberKilosReceiptsInput
): MemberReceiptGroup[] {
    const { commonData, payload } = input;
    const responseEntries = extractJournalEntriesFromResponse(input.response);
    const payloadEntries = extractJournalEntriesFromPayload(payload);
    const sourceEntries = resolveReceiptSourceEntries(input);
    const fallbackMemberId = payloadEntries[0]?.member_id;

    const lines = sourceEntries
        .map((entry) => mapSourceEntryToReceiptLine(entry, commonData, fallbackMemberId))
        .filter((line): line is MemberReceiptLine => line != null);

    const grouped = new Map<number, MemberReceiptLine[]>();
    lines.forEach((line) => {
        const memberId = line.member_id!;
        const existing = grouped.get(memberId) || [];
        existing.push(line);
        grouped.set(memberId, existing);
    });

    const groups: MemberReceiptGroup[] = [];

    grouped.forEach((memberEntries, memberId) => {
        const member = resolveMember(memberId, commonData);
        const totalGross = memberEntries.reduce(
            (sum, line) => sum + (line.scale_weight ?? 0),
            0
        );
        const totalTare = memberEntries.reduce(
            (sum, line) => sum + (line.tare_weight ?? 0),
            0
        );
        const totalQuantity = memberEntries.reduce(
            (sum, line) => sum + line.quantity,
            0
        );

        groups.push({
            member_id: memberId,
            member_label:
                memberEntries[0]?.member_label ||
                getMemberEntryLabel(member, memberId),
            entries: memberEntries,
            totalCans: memberEntries.length,
            totalQuantity,
            totalGross,
            totalTare,
        });
    });

    console.log("[MemberKilos] Journal response vs payload:", {
        responseEntryCount: responseEntries.length,
        payloadEntryCount: payloadEntries.length,
        memberReceiptCount: groups.length,
        members: groups.map((group) => ({
            member_id: group.member_id,
            member_label: group.member_label,
            cans: group.totalCans,
            quantity: group.totalQuantity,
        })),
    });

    return groups;
}

function formatSummaryCansList(entries: MemberReceiptLine[]): string {
    if (!entries.length) {
        return "";
    }

    let block = "Cans:\n";
    entries.forEach((entry, index) => {
        block += ` ${index + 1}. ${entry.can_label} - ${entry.quantity.toFixed(2)} KG\n`;
    });

    return block;
}

function formatCanDetailLine(index: number, entry: MemberReceiptLine): string {
    let block = `${index + 1}. ${entry.can_label}\n`;

    const hasGross = entry.scale_weight != null && isFinite(entry.scale_weight);
    const hasTare = entry.tare_weight != null && isFinite(entry.tare_weight);

    if (hasGross || hasTare) {
        const grossText = hasGross ? entry.scale_weight!.toFixed(2) : "-";
        const tareText = hasTare ? entry.tare_weight!.toFixed(2) : "-";
        block += `   Gross: ${grossText}  Tare: ${tareText}\n`;
    }

    block += `   Net: ${entry.quantity.toFixed(2)} KG\n`;
    return block;
}

export function formatMemberKilosReceiptForMember(
    group: MemberReceiptGroup,
    input: BuildMemberKilosReceiptsInput,
    options?: { receiptNumber?: number; totalReceipts?: number }
): string {
    const responseRoot = input.response?.data ?? input.response ?? {};
    const journal =
        responseRoot?.journal ||
        input.payload?.journal ||
        "N/A";
    const journalDate =
        responseRoot?.journal_date ||
        input.payload?.journal_date ||
        group.entries[0]?.journal_date ||
        new Date().toISOString().split("T")[0];
    const batchNo =
        group.entries[0]?.batch_no ||
        input.payload?.batch_no ||
        input.payload?.batches?.[0]?.batch_no ||
        "N/A";

    const member = resolveMember(group.member_id, input.commonData);
    const selectedTransporter = (input.commonData?.transporters || []).find(
        (t: any) => t.id === input.transporterId
    );
    const selectedShift = (input.commonData?.shifts || []).find(
        (s: any) => s.id === input.shiftId
    );
    const selectedRoute = (input.commonData?.routes || []).find(
        (r: any) => r.id === input.routeId
    );
    const selectedCenter = (input.commonData?.route_centers || []).find(
        (c: any) => c.id === input.centerId
    );

    const memberName = getMemberDisplayName(member, group.member_id);
    const memberNo = getMemberNumber(member);
    const memberDividerLabel = group.member_label || (
        memberNo ? `${memberName} (${memberNo})` : memberName
    );

    const hasWeighDetails = group.entries.some(
        (entry) =>
            (entry.scale_weight != null && isFinite(entry.scale_weight)) ||
            (entry.tare_weight != null && isFinite(entry.tare_weight))
    );

    let receipt = "";
    receipt += "      E-DAIRY LIMITED\n";
    receipt += "      P.O. Box [P.O. Box Number]\n";
    receipt += "\n\n";
    receipt += "      MEMBER KILOS RECEIPT\n";
    receipt += `${receiptLine("=")}\n`;
    receipt += `${receiptCenteredLine(memberDividerLabel, "*")}\n`;
    receipt += `${receiptLine("=")}\n`;

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    receipt += `Submitted: ${journalDate} ${timeStr}\n`;
    receipt += `Journal: ${journal}\n`;
    receipt += `Journal Date: ${journalDate}\n`;
    receipt += `Batch: ${batchNo}\n`;

    if (options?.receiptNumber != null && options?.totalReceipts != null) {
        receipt += `Receipt: ${options.receiptNumber} of ${options.totalReceipts}\n`;
    }

    receipt += `Member: ${memberName}\n`;

    if (memberNo) {
        receipt += `Member No: ${memberNo}\n`;
    }

    receipt += `Transporter: ${getTransporterDisplayName(selectedTransporter) || "N/A"}\n`;
    receipt += `Shift: ${selectedShift?.name || "N/A"}\n`;
    receipt += `Route: ${getRouteDisplayName(selectedRoute) || "N/A"}\n`;
    receipt += `Route Center: ${getRouteCenterDisplayName(selectedCenter) || "N/A"}\n`;
    receipt += `${receiptLine("-")}\n`;
    receipt += "SUBMISSION SUMMARY\n";
    receipt += `Total Cans: ${group.totalCans}\n`;
    receipt += formatSummaryCansList(group.entries);
    receipt += `Total Volume: ${group.totalQuantity.toFixed(2)} KG\n`;

    if (hasWeighDetails && group.totalGross > 0) {
        receipt += `Total Gross: ${group.totalGross.toFixed(2)} KG\n`;
    }

    if (hasWeighDetails && group.totalTare > 0) {
        receipt += `Total Tare: ${group.totalTare.toFixed(2)} KG\n`;
    }

    receipt += `${receiptLine("-")}\n`;
    receipt += "CANS DETAILS\n";
    receipt += `${receiptLine("-")}\n`;

    group.entries.forEach((entry, index) => {
        receipt += formatCanDetailLine(index, entry);
    });

    receipt += `${receiptLine("-")}\n`;
    receipt += `TOTAL NET WEIGHT: ${group.totalQuantity.toFixed(2)} KG\n`;
    receipt += `${receiptLine("=")}\n`;
    receipt += "Thank you for your delivery!\n";
    receipt += `${receiptLine("=")}\n`;
    receipt += "Powered by eDairy.africa\n";
    receipt += "\n\n";

    return receipt;
}

export function buildMemberKilosReceipts(
    input: BuildMemberKilosReceiptsInput
): string[] {
    const groups = buildMemberReceiptGroups(input);

    if (groups.length === 0) {
        return [];
    }

    return groups.map((group, index) =>
        formatMemberKilosReceiptForMember(group, input, {
            receiptNumber: index + 1,
            totalReceipts: groups.length,
        })
    );
}

/** One receipt per member for offline collections (same layout as Member Kilos). */
export function buildOfflineCollectionReceipts(
    input: Omit<BuildMemberKilosReceiptsInput, "response"> & { response?: any }
): string[] {
    const receipts = buildMemberKilosReceipts({
        ...input,
        response: input.response ?? null,
    });

    return receipts.map((receipt) =>
        receipt
            .replace("      MEMBER KILOS RECEIPT\n", "   OFFLINE MILK COLLECTION\n")
            .replace(
                "Thank you for your delivery!\n",
                "Thank you for your delivery!\nNOTE: Collected Offline\nWill sync when online\n"
            )
    );
}

export async function loadPendingMemberReceipts(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(PENDING_RECEIPTS_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((r) => typeof r === "string") : [];
    } catch {
        return [];
    }
}
