import React, { useCallback, useContext, useEffect, useRef } from "react";
import { Alert } from "react-native";
import type { NavigationContainerRef } from "@react-navigation/native";
import { AuthContext } from "../AuthContext";
import { useConnectivity } from "../context/ConnectivityContext";
import { useSync } from "../context/SyncContext";
import {
    CORE_DATA_SETTINGS_MESSAGE,
    hasCoreData,
} from "../services/coreData";
import {
    getActiveRouteName,
    getRootRouteName,
} from "../services/offlineNavigation";
import { isNetworkOnlineFromFlags } from "../utils/networkState";

type CoreDataGateProps = {
    navigationRef: React.RefObject<NavigationContainerRef<any> | null>;
    appReady?: boolean;
};

/**
 * When online and core SQLite data is missing, send the user to Settings
 * to download it before using offline-capable features.
 */
const CoreDataGate: React.FC<CoreDataGateProps> = ({
    navigationRef,
    appReady = true,
}) => {
    const { userToken, loading: authLoading } = useContext(AuthContext);
    const { isConnected, isInternetReachable } = useConnectivity();
    const { isUpdatingOnlineData } = useSync();
    const isOnline = isNetworkOnlineFromFlags(isConnected, isInternetReachable);
    const promptedRef = useRef(false);

    const enforceCoreData = useCallback(async () => {
        if (!appReady || authLoading || !userToken || !isOnline || isUpdatingOnlineData) {
            return;
        }

        const nav = navigationRef.current;
        if (!nav?.isReady()) {
            return;
        }

        const rootRoute = getRootRouteName(nav.getRootState());
        if (rootRoute !== "Home") {
            return;
        }

        const coreReady = await hasCoreData();
        if (coreReady) {
            promptedRef.current = false;
            return;
        }

        const activeRoute = getActiveRouteName(nav.getRootState());
        if (activeRoute === "Settings") {
            return;
        }

        nav.navigate("Home", { screen: "Settings" });

        if (promptedRef.current) {
            return;
        }

        promptedRef.current = true;
        Alert.alert("Core Data Required", CORE_DATA_SETTINGS_MESSAGE, [
            { text: "OK" },
        ]);
    }, [
        appReady,
        authLoading,
        isOnline,
        isUpdatingOnlineData,
        navigationRef,
        userToken,
    ]);

    useEffect(() => {
        void enforceCoreData();
    }, [enforceCoreData]);

    return null;
};

export default CoreDataGate;
