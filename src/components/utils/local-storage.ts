// utils/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getAuthToken(): Promise<string | null> {
    try {
        const user = await getItem("user");
        const fromUser = user?.access_token || user?.token;
        if (typeof fromUser === "string" && fromUser.trim()) {
            return fromUser;
        }

        const storedToken = await AsyncStorage.getItem("token");
        return storedToken?.trim() || null;
    } catch (error) {
        console.error("Failed to read auth token:", error);
        return null;
    }
}

export const setItem = async (key: string, value: any) => {
    try {
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
        console.error("AsyncStorage set error:", e);
    }
};

export const getItem = async (key: string) => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        console.error("AsyncStorage get error:", e);
        return null;
    }
};

export const removeItem = async (key: string) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error("AsyncStorage remove error:", e);
    }
};
