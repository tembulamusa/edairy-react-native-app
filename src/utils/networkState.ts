import type { NetInfoState } from "@react-native-community/netinfo";

/** True when the device has a usable connection (matches dashboard / login behaviour). */
export function isNetworkOnline(state: NetInfoState): boolean {
    return state.isConnected === true && state.isInternetReachable !== false;
}

export function isNetworkOnlineFromFlags(
    isConnected: boolean,
    isInternetReachable: boolean
): boolean {
    return isConnected === true && isInternetReachable !== false;
}
