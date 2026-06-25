import React, { useCallback, useContext, useEffect, useRef } from "react";
import type { NavigationContainerRef } from "@react-navigation/native";
import { AuthContext } from "../AuthContext";
import { useConnectivity } from "../context/ConnectivityContext";
import { isNetworkOnlineFromFlags } from "../utils/networkState";
import {
    navigateToLoginWhenOffline,
} from "../services/offlineNavigation";

type OfflineModeRedirectProps = {
    navigationRef: React.RefObject<NavigationContainerRef<any> | null>;
    appReady?: boolean;
};

/**
 * When offline, keep the user on their current screen. Only unauthenticated users
 * are sent back to login.
 */
const OfflineModeRedirect: React.FC<OfflineModeRedirectProps> = ({
    navigationRef,
    appReady = true,
}) => {
    const { userToken, loading: authLoading } = useContext(AuthContext);
    const { isConnected, isInternetReachable } = useConnectivity();
    const isOnline = isNetworkOnlineFromFlags(isConnected, isInternetReachable);

    const isOnlineRef = useRef(isOnline);
    const userTokenRef = useRef(userToken);

    isOnlineRef.current = isOnline;
    userTokenRef.current = userToken;

    const enforceOfflineMode = useCallback(() => {
        if (!appReady || authLoading) {
            return;
        }

        const nav = navigationRef.current;
        if (!nav?.isReady()) {
            return;
        }

        if (isOnlineRef.current) {
            return;
        }

        if (userTokenRef.current) {
            return;
        }

        navigateToLoginWhenOffline(nav);
    }, [appReady, authLoading, navigationRef]);

    useEffect(() => {
        enforceOfflineMode();
    }, [isOnline, userToken, authLoading, appReady, enforceOfflineMode]);

    useEffect(() => {
        if (!navigationRef.current) {
            return;
        }

        const interval = setInterval(() => {
            if (!isOnlineRef.current) {
                enforceOfflineMode();
            }
        }, 1500);

        return () => clearInterval(interval);
    }, [enforceOfflineMode, navigationRef]);

    return null;
};

export default OfflineModeRedirect;
