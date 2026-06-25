import AsyncStorage from "@react-native-async-storage/async-storage";

export const USER_PREFERENCES_KEY = "@edairyApp:user_preferences";
export const DEFAULT_DAIRY_NAME = "Maziwa Dairy";
export const DEFAULT_OFFLINE_REFERENCE_SYNC_HOURS = 6;
const DBU_BRANDING_SUFFIX = "DFCS";

/** e.g. "Tigania West ERP" → "Tigania West DFCS" */
export function formatDbuBrandingName(name: string): string {
    const trimmed = (name || "").trim();
    if (!trimmed) {
        return trimmed;
    }

    if (/\s+DFCS$/i.test(trimmed)) {
        return trimmed;
    }

    if (/\s+ERP$/i.test(trimmed)) {
        return trimmed.replace(/\s+ERP$/i, ` ${DBU_BRANDING_SUFFIX}`);
    }

    return trimmed;
}

export type StoredUserPreferences = {
    dairy_name?: string;
    notifications_enabled?: boolean;
    biometrics_enabled?: boolean;
    dark_mode_enabled?: boolean;
    auto_print_enabled?: boolean;
    scale_connection_type?: string;
    /** Hours before offline reference data must be refreshed online (default 6). */
    offline_reference_sync_hours?: number;
};

export async function loadUserPreferences(): Promise<StoredUserPreferences> {
    try {
        const stored = await AsyncStorage.getItem(USER_PREFERENCES_KEY);
        if (stored) {
            return JSON.parse(stored) as StoredUserPreferences;
        }
    } catch (error) {
        console.warn("[Preferences] Failed to load user preferences:", error);
    }
    return {};
}

export async function getDairyName(): Promise<string> {
    const prefs = await loadUserPreferences();
    const raw = (prefs.dairy_name || "").trim();
    const fallback = raw || DEFAULT_DAIRY_NAME;
    const normalized = formatDbuBrandingName(fallback);

    if (raw && normalized !== raw) {
        await AsyncStorage.setItem(
            USER_PREFERENCES_KEY,
            JSON.stringify({
                ...prefs,
                dairy_name: normalized,
            })
        );
    }

    return normalized;
}

export async function saveDairyName(name: string): Promise<void> {
    const prefs = await loadUserPreferences();
    const normalized = formatDbuBrandingName(name.trim() || DEFAULT_DAIRY_NAME);
    const next = {
        ...prefs,
        dairy_name: normalized || DEFAULT_DAIRY_NAME,
    };
    await AsyncStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(next));
}

export async function getOfflineReferenceSyncHours(): Promise<number> {
    const prefs = await loadUserPreferences();
    const hours = Number(prefs.offline_reference_sync_hours);
    if (Number.isFinite(hours) && hours > 0) {
        return hours;
    }
    return DEFAULT_OFFLINE_REFERENCE_SYNC_HOURS;
}

export async function getOfflineReferenceStaleMs(): Promise<number> {
    return getMaxOfflineIntakeMs();
}

/** Max time allowed since the first unpushed offline record before further offline intake is blocked. */
export async function getMaxOfflineIntakeMs(): Promise<number> {
    const hours = await getOfflineReferenceSyncHours();
    return hours * 60 * 60 * 1000;
}

export async function saveOfflineReferenceSyncHours(hours: number): Promise<void> {
    const normalized = Number(hours);
    if (!Number.isFinite(normalized) || normalized <= 0) {
        throw new Error("Offline sync interval must be a positive number of hours");
    }

    const prefs = await loadUserPreferences();
    await AsyncStorage.setItem(
        USER_PREFERENCES_KEY,
        JSON.stringify({
            ...prefs,
            offline_reference_sync_hours: normalized,
        })
    );
}
