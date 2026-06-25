import { sortDropdownItemsByLabel } from "./dropdownItems";

/** Resolve tare from milk-can payloads that use either field name. */
export function getMilkCanTare(can: any): number {
    const raw = can?.tare_weight ?? can?.weight;
    if (raw === null || raw === undefined || raw === "") {
        return 0;
    }

    const parsed = parseFloat(String(raw));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function getMilkCanLabel(can: any): string {
    return can?.can_id || can?.name || `Can ${can?.id ?? ""}`;
}

export function toMilkCanDropdownItems(cans: any[]) {
    return sortDropdownItemsByLabel(
        (cans || []).map((can) => ({
            label: getMilkCanLabel(can),
            value: can.id,
        }))
    );
}
