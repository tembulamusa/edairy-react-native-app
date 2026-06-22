type TransporterLike = {
    transporter_no?: string;
    category?: string;
    first_name?: string;
    last_name?: string;
    full_names?: string;
    name?: string;
    individual?: {
        first_name?: string;
        last_name?: string;
    };
    company?: {
        name?: string;
        first_name?: string;
        last_name?: string;
    };
};

/** Resolve first/last name from individual or company transporter payloads. */
export function getTransporterName(transporter: TransporterLike | null | undefined): string {
    if (!transporter) {
        return "";
    }

    const category = String(transporter.category ?? "").toUpperCase();

    if (category === "INDIVIDUAL" && transporter.individual) {
        const first = transporter.individual.first_name ?? "";
        const last = transporter.individual.last_name ?? "";
        const name = `${first} ${last}`.trim();
        if (name) {
            return name;
        }
    }

    const rootName = `${transporter.first_name ?? ""} ${transporter.last_name ?? ""}`.trim();
    if (rootName) {
        return rootName;
    }

    const companyName =
        transporter.company?.name ||
        `${transporter.company?.first_name ?? ""} ${transporter.company?.last_name ?? ""}`.trim();

    return (
        companyName ||
        transporter.full_names ||
        transporter.name ||
        "Unknown"
    );
}

/** e.g. `T01 - Mosses mwenda` */
export function getTransporterDisplayName(
    transporter: TransporterLike | null | undefined
): string {
    const name = getTransporterName(transporter);
    const no = transporter?.transporter_no;

    if (no) {
        return `${no} - ${name}`;
    }

    return name;
}
