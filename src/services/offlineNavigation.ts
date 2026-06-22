import type { NavigationContainerRef } from "@react-navigation/native";

let boundNavigationRef: NavigationContainerRef<any> | null = null;

export function bindAppNavigationRef(
    ref: NavigationContainerRef<any> | null | undefined
): void {
    boundNavigationRef = ref ?? null;
}

export function navigateToDashboard(
    navigationRef?: NavigationContainerRef<any> | null
): boolean {
    const nav = navigationRef ?? boundNavigationRef;
    if (!nav?.isReady()) {
        return false;
    }

    nav.reset({
        index: 0,
        routes: [{ name: "Home" }],
    });
    console.log("[OFFLINE-NAV] Navigated to Dashboard");
    return true;
}

export const OFFLINE_COLLECTION_SCREEN_NAMES = [
    "OfflineMilkCollection",
    "OfflineCollection",
] as const;

type NavState = {
    index?: number;
    routes?: Array<{ name?: string; state?: NavState }>;
};

export function getActiveRouteName(state?: NavState): string | undefined {
    if (!state?.routes?.length) {
        return undefined;
    }

    const index = state.index ?? 0;
    const route = state.routes[index];
    if (!route) {
        return undefined;
    }

    if (route.state) {
        return getActiveRouteName(route.state) ?? route.name;
    }

    return route.name;
}

export function getRootRouteName(state?: NavState): string | undefined {
    if (!state?.routes?.length) {
        return undefined;
    }

    const index = state.index ?? 0;
    return state.routes[index]?.name;
}

export function isOnOfflineCollectionScreen(
    navigationRef: NavigationContainerRef<any> | null | undefined
): boolean {
    if (!navigationRef?.isReady()) {
        return false;
    }

    const activeRoute = getActiveRouteName(navigationRef.getRootState());
    return OFFLINE_COLLECTION_SCREEN_NAMES.includes(
        activeRoute as (typeof OFFLINE_COLLECTION_SCREEN_NAMES)[number]
    );
}

export function navigateToOfflineCollection(
    navigationRef: NavigationContainerRef<any> | null | undefined
): boolean {
    if (!navigationRef?.isReady()) {
        return false;
    }

    if (isOnOfflineCollectionScreen(navigationRef)) {
        return false;
    }

    const rootRoute = getRootRouteName(navigationRef.getRootState());

    if (rootRoute === "Auth") {
        navigationRef.reset({
            index: 0,
            routes: [
                {
                    name: "Home",
                    params: {
                        screen: "Members",
                        params: { screen: "OfflineMilkCollection" },
                    },
                },
            ],
        });
        console.log("[OFFLINE-NAV] Reset Auth → Home → OfflineMilkCollection");
        return true;
    }

    navigationRef.navigate("Home", {
        screen: "Members",
        params: { screen: "OfflineMilkCollection" },
    });
    console.log("[OFFLINE-NAV] Navigated to OfflineMilkCollection");
    return true;
}

export function navigateToLoginWhenOffline(
    navigationRef: NavigationContainerRef<any> | null | undefined
): boolean {
    if (!navigationRef?.isReady()) {
        return false;
    }

    const rootRoute = getRootRouteName(navigationRef.getRootState());
    if (rootRoute === "Auth") {
        return false;
    }

    navigationRef.reset({
        index: 0,
        routes: [{ name: "Auth" }],
    });
    console.log("[OFFLINE-NAV] Reset to Auth (login) while offline");
    return true;
}
