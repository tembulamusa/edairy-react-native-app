import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredUser = {
    permissions?: string[] | Record<string, boolean | number | string>;
    all_permissions?: string[];
    user_permissions?: string[] | Record<string, boolean | number | string>;
    [key: string]: unknown;
};

const USER_STORAGE_KEY = "user";

export async function getStoredUser(): Promise<StoredUser | null> {
    try {
        const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw) as StoredUser;
    } catch (error) {
        console.error("[Permissions] Failed to read stored user:", error);
        return null;
    }
}

function permissionsFromRecord(
    record: Record<string, boolean | number | string>
): string[] {
    return Object.entries(record)
        .filter(([, value]) => value === true || value === 1 || value === "1")
        .map(([key]) => key);
}

/** Normalize permission values from the stored user object. */
export function extractUserPermissions(user: StoredUser | null | undefined): string[] {
    if (!user) {
        return [];
    }

    const sources = [user.permissions, user.all_permissions, user.user_permissions];
    const normalized = new Set<string>();

    for (const source of sources) {
        if (Array.isArray(source)) {
            source.forEach((permission) => {
                if (typeof permission === "string" && permission.trim()) {
                    normalized.add(permission.trim());
                }
            });
            continue;
        }

        if (source && typeof source === "object") {
            permissionsFromRecord(source as Record<string, boolean | number | string>)
                .forEach((permission) => normalized.add(permission));
        }
    }

    return Array.from(normalized);
}

function permissionMatches(granted: string, required: string): boolean {
    if (granted === "*") {
        return true;
    }

    return granted === required;
}

/** Returns true only when the stored user has the exact permission string from the backend. */
export function userCan(
    user: StoredUser | null | undefined,
    permission: string
): boolean {
    if (!permission?.trim()) {
        return false;
    }

    const required = permission.trim();
    const grantedPermissions = extractUserPermissions(user);

    return grantedPermissions.some((granted) => permissionMatches(granted, required));
}

export async function can(permission: string): Promise<boolean> {
    const user = await getStoredUser();
    return userCan(user, permission);
}

export async function getUserPermissions(): Promise<string[]> {
    const user = await getStoredUser();
    return extractUserPermissions(user);
}
