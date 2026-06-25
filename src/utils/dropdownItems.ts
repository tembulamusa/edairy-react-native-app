export type DropdownItem = { label: string; value: number };

export function sortDropdownItemsByLabel<T extends { label: string }>(items: T[]): T[] {
    return [...(items || [])].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
}

export function toShiftDropdownItems(shifts: any[]): DropdownItem[] {
    return sortDropdownItemsByLabel(
        (shifts || []).map((shift) => ({
            label: String(shift?.name ?? ""),
            value: shift.id,
        }))
    );
}

export function toMemberTypeDropdownItems(memberTypes: any[]): DropdownItem[] {
    return sortDropdownItemsByLabel(
        (memberTypes || []).map((type) => ({
            label: String(type?.name ?? ""),
            value: type.id,
        }))
    );
}

/** react-native-dropdown-picker v5 may pass a callback or a direct value to setValue. */
export function resolveDropDownPickerValue<T>(
    valueOrCallback: T | ((current: T) => T),
    current: T
): T {
    return typeof valueOrCallback === "function"
        ? (valueOrCallback as (current: T) => T)(current)
        : valueOrCallback;
}

export function toPositiveIntString(value: unknown): string | null {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        return null;
    }
    return String(Math.trunc(num));
}
