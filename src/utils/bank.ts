import fetchCommonData from "../components/utils/fetchCommonData";
import { sortDropdownItemsByLabel } from "./dropdownItems";

export type BankRecord = {
    id: number;
    bank_name: string;
    bank_code?: string;
};

export function getBankName(bank: { bank_name?: string; name?: string } | null | undefined): string {
    if (!bank) {
        return "";
    }
    return String(bank.bank_name || bank.name || "").trim();
}

/** e.g. `Nyambene Arimi Sacco (01)` */
export function getBankDisplayName(bank: BankRecord | null | undefined): string {
    if (!bank) {
        return "";
    }

    const name = getBankName(bank);
    const code = bank.bank_code?.trim();

    if (name && code) {
        return `${name} (${code})`;
    }

    return name || `Bank ${bank.id}`;
}

export function toBankDropdownItems(banks: BankRecord[]) {
    return sortDropdownItemsByLabel(
        (banks || []).map((bank) => ({
            label: getBankDisplayName(bank),
            value: bank.id,
        }))
    );
}

/** Load banks from GET /banks. */
export async function fetchBanks(): Promise<BankRecord[]> {
    const banks = await fetchCommonData({
        name: "banks",
        direct: true,
        cachable: true,
        logContext: "MemberRegistration",
    });

    return (Array.isArray(banks) ? banks : [])
        .filter((bank) => bank?.id != null && getBankName(bank))
        .map((bank) => ({
            id: Number(bank.id),
            bank_name: getBankName(bank),
            bank_code: bank.bank_code != null ? String(bank.bank_code) : undefined,
        }));
}
