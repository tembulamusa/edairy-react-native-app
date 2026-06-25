import AsyncStorage from "@react-native-async-storage/async-storage";
import makeRequest from "../components/utils/makeRequest";
import {
    getOfflineCredentials,
    hasOfflineCredentials,
    initDatabase,
    saveOfflineCredentials,
    validateOfflineCredentials,
} from "./offlineDatabase";
import { checkConnectivity } from "./connectivity";
import { hasCoreData, refreshCoreDataFromServer } from "./coreData";
import {
    buildEmailLoginPayload,
    extractAuthToken,
    extractLoginErrorMessage,
    getPrimaryPhoneForStorage,
    isValidEmail,
    normalizeEmail,
} from "../utils/loginCredentials";
import { saveUserProfileToAsyncStorage, loadUserProfileFromAsyncStorage } from "../utils/userProfileStorage";

export type AuthLoginFn = (
    token: string,
    options?: { offlineSession?: boolean }
) => Promise<void>;

export type RemoteLoginResult = {
    success: boolean;
    token?: string;
    userPayload?: Record<string, unknown>;
    errorMessage?: string;
};

export type LoginNavigationResult = "home" | "settings";

function getCredentialEmail(
    creds: NonNullable<Awaited<ReturnType<typeof getOfflineCredentials>>>
): string | null {
    const value = creds.email || creds.username || creds.phone_number;
    return value ? String(value).trim() : null;
}

export async function remoteLoginWithCredentials(
    email: string,
    password: string
): Promise<RemoteLoginResult> {
    const normalizedEmail = normalizeEmail(email);
    const data = buildEmailLoginPayload(normalizedEmail, password);

    try {
        const [status, response] = await makeRequest({
            url: "login",
            method: "POST",
            data: data as any,
            skipAuth: true,
        });

        const token = extractAuthToken(response);
        if (![200, 201].includes(status) || !token) {
            return {
                success: false,
                errorMessage: extractLoginErrorMessage(response, status),
            };
        }

        const userPayload = {
            ...(response && typeof response === "object" ? response : {}),
            token,
            access_token: token,
        };

        return {
            success: true,
            token,
            userPayload,
        };
    } catch (error: any) {
        return {
            success: false,
            errorMessage: error?.message || "Something went wrong",
        };
    }
}

export async function persistAuthenticatedSession(options: {
    token: string;
    email: string;
    password: string;
    userPayload: Record<string, unknown>;
    login: AuthLoginFn;
    offlineSession?: boolean;
}): Promise<void> {
    const normalizedEmail = normalizeEmail(options.email);

    await options.login(options.token, {
        offlineSession: options.offlineSession === true,
    });
    await saveUserProfileToAsyncStorage(options.userPayload, options.token);

    try {
        await initDatabase();
        await saveOfflineCredentials({
            email: normalizedEmail,
            password: options.password,
            token: options.token,
            user_data: options.userPayload,
            stored_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error("[AUTH-SESSION] Failed to persist offline credentials:", error);
        throw error;
    }

    await AsyncStorage.setItem(
        "@edairyApp:user_phone_number",
        getPrimaryPhoneForStorage(options.userPayload)
    );
}

export async function completeOnlineLogin(options: {
    email: string;
    password: string;
    login: AuthLoginFn;
    downloadCoreData?: boolean;
}): Promise<{
    success: boolean;
    navigationTarget: LoginNavigationResult;
    errorMessage?: string;
}> {
    const remote = await remoteLoginWithCredentials(options.email, options.password);
    if (!remote.success || !remote.token || !remote.userPayload) {
        return {
            success: false,
            navigationTarget: "home",
            errorMessage: remote.errorMessage || "Login failed",
        };
    }

    await persistAuthenticatedSession({
        token: remote.token,
        email: options.email,
        password: options.password,
        userPayload: remote.userPayload,
        login: options.login,
        offlineSession: false,
    });

    if (options.downloadCoreData === false) {
        return { success: true, navigationTarget: "home" };
    }

    let coreDataReady = await hasCoreData();
    if (!coreDataReady) {
        coreDataReady = await refreshCoreDataFromServer({ logContext: "Login" });
    }

    return {
        success: true,
        navigationTarget: coreDataReady ? "home" : "settings",
    };
}

export async function completeOfflineLogin(options: {
    email: string;
    password: string;
    login: AuthLoginFn;
}): Promise<{ success: boolean; errorMessage?: string }> {
    const validation = await validateOfflineCredentials(options.email, options.password);
    if (!validation.valid || !validation.token) {
        return {
            success: false,
            errorMessage:
                "Invalid email or password. Connect to the internet if this is your first sign-in on this device.",
        };
    }

    await options.login(validation.token, { offlineSession: true });
    await saveUserProfileToAsyncStorage(validation.userData, validation.token);
    await AsyncStorage.setItem(
        "@edairyApp:user_phone_number",
        getPrimaryPhoneForStorage(validation.userData)
    );

    return { success: true };
}

/**
 * Single sign-in entry point: online API when connected, otherwise SQLite credentials.
 */
export async function signInWithEmailPassword(options: {
    email: string;
    password: string;
    login: AuthLoginFn;
}): Promise<{
    success: boolean;
    navigationTarget?: LoginNavigationResult;
    errorMessage?: string;
    usedOfflineCredentials?: boolean;
}> {
    if (!isValidEmail(options.email)) {
        return { success: false, errorMessage: "Please enter a valid email address." };
    }

    if (!options.password) {
        return { success: false, errorMessage: "Please enter your password." };
    }

    const online = await checkConnectivity();

    if (online) {
        const result = await completeOnlineLogin({
            email: options.email,
            password: options.password,
            login: options.login,
        });
        return {
            success: result.success,
            navigationTarget: result.navigationTarget,
            errorMessage: result.errorMessage,
            usedOfflineCredentials: false,
        };
    }

    const hasStoredCredentials = await hasOfflineCredentials();
    if (!hasStoredCredentials) {
        return {
            success: false,
            errorMessage:
                "No saved credentials on this device. Connect to the internet to sign in for the first time.",
        };
    }

    const offlineResult = await completeOfflineLogin(options);
    return {
        success: offlineResult.success,
        navigationTarget: "home",
        errorMessage: offlineResult.errorMessage,
        usedOfflineCredentials: true,
    };
}

/**
 * When an offline session regains connectivity, silently re-authenticate with
 * the email/password saved in SQLite for the current user.
 */
export async function silentOnlineRefreshFromSQLite(
    login: AuthLoginFn
): Promise<string | null> {
    const online = await checkConnectivity();
    if (!online) {
        return null;
    }

    const creds = await getOfflineCredentials();
    const email = creds ? getCredentialEmail(creds) : null;

    if (!creds || !email || !creds.password) {
        console.warn("[AUTH-SESSION] Silent online refresh skipped — no stored credentials");
        return null;
    }

    const storedUser = await loadUserProfileFromAsyncStorage();
    const currentEmail =
        storedUser?.email != null
            ? normalizeEmail(String(storedUser.email))
            : storedUser?.username != null
              ? normalizeEmail(String(storedUser.username))
              : null;

    if (currentEmail && normalizeEmail(email) !== currentEmail) {
        console.warn(
            "[AUTH-SESSION] Silent online refresh skipped — stored credentials do not match current user"
        );
        return null;
    }

    console.log("[AUTH-SESSION] Silent online refresh for", email);

    const result = await completeOnlineLogin({
        email,
        password: creds.password,
        login,
        downloadCoreData: true,
    });

    if (!result.success) {
        console.warn("[AUTH-SESSION] Silent online refresh failed:", result.errorMessage);
        return null;
    }

    const token = (await AsyncStorage.getItem("token")) || creds.token;
    console.log("[AUTH-SESSION] Silent online refresh succeeded");
    return token;
}

const OFFLINE_SESSION_KEY = "@edairyApp:offline_session";

export async function refreshOnlineTokenFromSQLiteStorage(): Promise<string | null> {
    return silentOnlineRefreshFromSQLite(async (token, options) => {
        await AsyncStorage.setItem("token", token);
        const existingUser = await loadUserProfileFromAsyncStorage();
        if (existingUser) {
            await saveUserProfileToAsyncStorage(
                { ...existingUser, token, access_token: token },
                token
            );
        }
        if (options?.offlineSession) {
            await AsyncStorage.setItem(OFFLINE_SESSION_KEY, "1");
        } else {
            await AsyncStorage.removeItem(OFFLINE_SESSION_KEY);
        }
    });
}
