import { sortDropdownItemsByLabel } from "./dropdownItems";
import { toMemberDropdownItems } from "./referenceDataFetch";
import { toTransporterDropdownItems } from "./transporter";

export { toMemberDropdownItems, toTransporterDropdownItems };

/** Map user-store-assignment rows into store picker records. */
export function normalizeUserStoreAssignments(assignments: any[]): any[] {
    return (assignments || [])
        .map((assignment) => {
            const nestedStore = assignment?.store;
            const storeId =
                assignment?.store_id ??
                nestedStore?.id ??
                assignment?.id;

            if (storeId == null) {
                return null;
            }

            const description =
                nestedStore?.description ??
                nestedStore?.name ??
                assignment?.store_name ??
                assignment?.description ??
                assignment?.name ??
                `Store ${storeId}`;

            return {
                id: Number(storeId),
                store_id: Number(storeId),
                description,
                name: nestedStore?.name ?? assignment?.store_name ?? description,
                assignment_id: assignment?.id,
                ...nestedStore,
            };
        })
        .filter((store): store is NonNullable<typeof store> => store != null);
}

export function toStoreDropdownItems(stores: any[]) {
    return sortDropdownItemsByLabel(
        (stores || [])
            .map((store) => {
                const nested = store?.store;
                const value = store.id ?? store.store_id ?? nested?.id;
                const label =
                    store.description ||
                    store.name ||
                    store.store_name ||
                    nested?.description ||
                    nested?.name ||
                    (value != null ? `Store ${value}` : "");

                if (value == null || !label) {
                    return null;
                }

                return { label, value: Number(value) };
            })
            .filter((item): item is { label: string; value: number } => item != null)
    );
}

export function pickDefaultStoreValue(
    items: { label: string; value: number }[],
    current: number | null
): number | null {
    if (!items.length) {
        return current;
    }

    const stillValid =
        current != null && items.some((item) => item.value === current);

    return stillValid ? current : items[0].value;
}

export function toPersonDropdownItems(
    people: any[],
    numberField: "employee_no" | "vendor_no" | "supplier_no"
) {
    return sortDropdownItemsByLabel(
        (people || []).map((person) => {
            const name =
                `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() ||
                "Unknown";
            const no = person?.[numberField] ?? person?.id;
            return { label: `${name} (${no})`, value: person.id };
        })
    );
}

export function getStockItemName(stock: any): string {
    return String(
        stock?.item_name ??
            stock?.item?.description ??
            stock?.name ??
            stock?.item?.name ??
            `Item ${stock?.id ?? ""}`
    ).trim();
}

export function getStockAvailableQuantity(stock: any): number | null {
    const raw =
        stock?.available_stock ??
        stock?.stock ??
        stock?.available_quantity ??
        stock?.stock_quantity ??
        stock?.quantity ??
        null;

    if (raw === null || raw === undefined || raw === "") {
        return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

export function toStockDropdownItems(stockItems: any[]) {
    return (stockItems || []).map((stock) => {
        const itemName = getStockItemName(stock);
        const stockQty = getStockAvailableQuantity(stock);
        const label =
            stockQty !== null
                ? `${itemName} (${Math.floor(stockQty)})`
                : itemName;
        const unitPrice =
            Number(
                stock?.selling_price ??
                    stock?.unit_price ??
                    stock?.item?.selling_price ??
                    stock?.item?.unit_price ??
                    0
            ) || 0;

        return { label, value: stock.id, unit_price: unitPrice };
    });
}
