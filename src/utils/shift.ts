export type ShiftPeriod = "am" | "noon" | "pm";

/** Morning (AM), midday (noon), or evening (PM) from the current clock. */
export function getCurrentShiftPeriod(date: Date = new Date()): ShiftPeriod {
    const hour = date.getHours();

    // Around midday: 11:00–13:59
    if (hour >= 11 && hour < 14) {
        return "noon";
    }

    // Morning collection: 03:00–10:59
    if (hour >= 3 && hour < 11) {
        return "am";
    }

    // Afternoon / evening: 14:00–02:59
    return "pm";
}

function getShiftSearchText(shift: any): string {
    return `${shift?.name ?? ""} ${shift?.time ?? ""}`.trim().toLowerCase();
}

function matchesAmShift(text: string): boolean {
    if (/\bnoon\b|\bmidday\b|\b12\b/.test(text)) {
        return false;
    }
    if (/\bpm\b|\bp\.m\b|\bevening\b/.test(text)) {
        return false;
    }

    return (
        /\bam\b/.test(text) ||
        /\ba\.m\b/.test(text) ||
        /\bmorning\b/.test(text)
    );
}

function matchesNoonShift(text: string): boolean {
    return (
        /\bnoon\b/.test(text) ||
        /\bmidday\b/.test(text) ||
        /\blunch\b/.test(text) ||
        /\b12\s*(noon|pm)?\b/.test(text)
    );
}

function matchesPmShift(text: string): boolean {
    if (/\bnoon\b|\bmidday\b/.test(text)) {
        return false;
    }
    if (/\bam\b|\ba\.m\b|\bmorning\b/.test(text)) {
        return false;
    }

    return (
        /\bpm\b/.test(text) ||
        /\bp\.m\b/.test(text) ||
        /\bevening\b/.test(text) ||
        /\bafternoon\b/.test(text) ||
        /\bnight\b/.test(text)
    );
}

/** Legacy API values that used morning / afternoon / evening in the time field. */
function matchesLegacyPeriod(text: string, period: ShiftPeriod): boolean {
    if (period === "am") {
        return /\bmorning\b/.test(text);
    }
    if (period === "noon") {
        return /\bnoon\b|\bmidday\b/.test(text);
    }
    return /\bevening\b/.test(text) || /\bafternoon\b/.test(text);
}

export function shiftMatchesPeriod(shift: any, period: ShiftPeriod): boolean {
    const text = getShiftSearchText(shift);
    if (!text) {
        return false;
    }

    if (period === "am") {
        return matchesAmShift(text) || matchesLegacyPeriod(text, "am");
    }
    if (period === "noon") {
        return matchesNoonShift(text) || matchesLegacyPeriod(text, "noon");
    }
    return matchesPmShift(text) || matchesLegacyPeriod(text, "pm");
}

/** Pick the shift that best matches the current time of day. */
export function findShiftForCurrentTime(
    shifts: any[] | null | undefined,
    date: Date = new Date()
): any | null {
    if (!Array.isArray(shifts) || shifts.length === 0) {
        return null;
    }

    const period = getCurrentShiftPeriod(date);
    const match = shifts.find((shift) => shiftMatchesPeriod(shift, period));
    return match ?? null;
}

export function describeShiftPeriod(period: ShiftPeriod): string {
    if (period === "am") {
        return "morning (AM)";
    }
    if (period === "noon") {
        return "midday (noon)";
    }
    return "evening (PM)";
}
