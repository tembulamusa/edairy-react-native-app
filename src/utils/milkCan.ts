/** Resolve tare from milk-can payloads that use either field name. */
export function getMilkCanTare(can: any): number {
    const raw = can?.tare_weight ?? can?.weight;
    if (raw === null || raw === undefined || raw === "") {
        return 0;
    }

    const parsed = parseFloat(String(raw));
    return Number.isFinite(parsed) ? parsed : 0;
}
