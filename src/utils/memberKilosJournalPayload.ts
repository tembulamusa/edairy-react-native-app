import { getRouteDisplayName } from "./route";
import { getTransporterDisplayName } from "./transporter";

export type MemberKilosRecordedEntry = {
    member_id?: number | null;
    member_label?: string;
    can_id?: number | null;
    can_label?: string;
    scale_weight?: number;
    tare_weight?: number;
    net?: number;
    quantity?: number;
};

export type MemberKilosJournalEntry = {
    member_id: number;
    batch_no: string;
    route_id: number;
    milk_delivery_shift_id: number;
    can_id: number | null;
    journal_date: string;
    quantity: number;
    transporter_id: number;
};

export type MemberKilosJournalBatch = {
    batch_no: string;
    entries: MemberKilosJournalEntry[];
};

export type MemberKilosJournalPayload = {
    journal: string;
    batch_no: string;
    journal_date: string;
    milk_delivery_shift_id: number;
    transporter_id: number;
    route_id: number;
    batches: MemberKilosJournalBatch[];
};

export function formatJournalDate(date: Date = new Date()): string {
    return date.toISOString().split("T")[0];
}

function formatJournalDateCompact(journalDate: string): string {
    return journalDate.replace(/-/g, "");
}

/** e.g. T01 -> 001 for jrn-001-20260622 */
export function getTransporterJournalCode(transporter: any): string {
    const raw = String(transporter?.transporter_no ?? transporter?.id ?? "0");
    const digits = raw.replace(/\D/g, "");
    return (digits || "0").padStart(3, "0");
}

/** e.g. jrn-001-20260622 */
export function buildJournalCode(transporter: any, journalDate: string): string {
    return `jrn-${getTransporterJournalCode(transporter)}-${formatJournalDateCompact(journalDate)}`;
}

/** e.g. PAGE-001 from route code/name */
export function buildBatchNo(route: any, batchIndex = 1): string {
    const code = route?.code?.trim() || route?.route_code?.trim();
    if (code) {
        return `${code.toUpperCase()}-${String(batchIndex).padStart(3, "0")}`;
    }

    const routeName = getRouteDisplayName(route);
    const letters = routeName.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const prefix = letters.slice(0, 4) || "BATCH";

    return `${prefix}-${String(batchIndex).padStart(3, "0")}`;
}

type BuildMemberKilosJournalPayloadInput = {
    memberId?: number | null;
    transporterId: number;
    routeId: number;
    milkDeliveryShiftId: number;
    entries: MemberKilosRecordedEntry[];
    transporter?: any;
    route?: any;
    journal?: string;
    batch_no?: string;
    journalDate?: Date;
    batchIndex?: number;
};

export function buildMemberKilosJournalPayload({
    memberId,
    transporterId,
    routeId,
    milkDeliveryShiftId,
    entries,
    transporter,
    route,
    journal: journalOverride,
    batch_no: batchNoOverride,
    journalDate = new Date(),
    batchIndex = 1,
}: BuildMemberKilosJournalPayloadInput): MemberKilosJournalPayload {
    const journal_date = formatJournalDate(journalDate);
    const journal = journalOverride ?? buildJournalCode(transporter, journal_date);
    const batch_no = batchNoOverride ?? buildBatchNo(route, batchIndex);

    const apiEntries: MemberKilosJournalEntry[] = entries.map((entry) => ({
        member_id: Number(entry.member_id ?? memberId),
        batch_no,
        route_id: routeId,
        milk_delivery_shift_id: milkDeliveryShiftId,
        can_id: entry.can_id ?? null,
        journal_date,
        quantity: Number(entry.net ?? entry.quantity ?? 0),
        transporter_id: transporterId,
    }));

    return {
        journal,
        batch_no,
        journal_date,
        milk_delivery_shift_id: milkDeliveryShiftId,
        transporter_id: transporterId,
        route_id: routeId,
        batches: [
            {
                batch_no,
                entries: apiEntries,
            },
        ],
    };
}

export function describeJournalPayloadContext(transporter: any, route: any): string {
    return [
        `Transporter: ${getTransporterDisplayName(transporter)}`,
        `Route: ${getRouteDisplayName(route)}`,
    ].join("\n");
}
