import AsyncStorage from "@react-native-async-storage/async-storage";

export const USER_PREFERENCES_KEY = "@edairyApp:user_preferences";
export const DEFAULT_DAIRY_NAME = "Maziwa Dairy";

export type StoredUserPreferences = {
    dairy_name?: string;
    notifications_enabled?: boolean;
    biometrics_enabled?: boolean;
    dark_mode_enabled?: boolean;
    auto_print_enabled?: boolean;
    scale_connection_type?: string;
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
    const name = (prefs.dairy_name || "").trim();
    return name || DEFAULT_DAIRY_NAME;
}

export async function saveDairyName(name: string): Promise<void> {
    const prefs = await loadUserPreferences();
    const trimmed = name.trim();
    const next = {
        ...prefs,
        dairy_name: trimmed || DEFAULT_DAIRY_NAME,
    };
    await AsyncStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(next));
}
