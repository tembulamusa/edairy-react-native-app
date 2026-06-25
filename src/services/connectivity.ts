import NetInfo from "@react-native-community/netinfo";

/** True when the device has a usable network connection for API calls. */
export const checkConnectivity = async (): Promise<boolean> => {
    try {
        const state = await NetInfo.fetch();
        return state.isConnected === true && state.isInternetReachable !== false;
    } catch (error) {
        console.error("[CONNECTIVITY] Error checking connectivity:", error);
        return false;
    }
};
