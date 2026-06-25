import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_PROFILE_KEY = "user";

/** Strip passwords only — keep token/access_token for API requests. */
export function sanitizeUserProfileForStorage(
    userData: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    if (!userData || typeof userData !== "object") {
        return {};
    }

    const { password, offline_password, ...profile } = userData;
    return profile;
}

/**
 * Persist signed-in user JSON in AsyncStorage (includes token + access_token).
 */
export async function saveUserProfileToAsyncStorage(
    userData: Record<string, unknown> | null | undefined,
    token?: string
): Promise<void> {
    const profile = sanitizeUserProfileForStorage(userData);
    const authToken =
        token ||
        (typeof profile.token === "string" ? profile.token : null) ||
        (typeof profile.access_token === "string" ? profile.access_token : null);

    const sessionUser = {
        ...profile,
        ...(authToken
            ? { token: authToken, access_token: authToken }
            : {}),
    };

    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(sessionUser));

    if (authToken) {
        await AsyncStorage.setItem("token", authToken);
    }
}

export async function loadUserProfileFromAsyncStorage(): Promise<Record<string, unknown> | null> {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** @deprecated Use sanitizeUserProfileForStorage */
export const stripSensitiveFieldsFromUserProfile = sanitizeUserProfileForStorage;
