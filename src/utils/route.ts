type RouteLike = {
    name?: string;
    description?: string;
    code?: string;
    route_name?: string;
    route_code?: string;
    location_name?: string;
};

/** Resolve the primary route label from current or legacy API shapes. */
export function getRouteName(route: RouteLike | null | undefined): string {
    if (!route) {
        return "";
    }

    return (
        route.name ||
        route.route_name ||
        route.description ||
        "Unknown"
    );
}

/** e.g. `Mweromutua` or `Mweromutua (R01)` when code is present */
export function getRouteDisplayName(route: RouteLike | null | undefined): string {
    const name = getRouteName(route);
    const code = route?.code || route?.route_code;

    if (code && String(code).trim()) {
        return `${name} (${code})`;
    }

    return name;
}

type RouteCenterLike = {
    name?: string;
    center?: string;
    description?: string;
    id?: number;
};

export function getRouteCenterDisplayName(
    routeCenter: RouteCenterLike | null | undefined
): string {
    if (!routeCenter) {
        return "";
    }

    return (
        routeCenter.name ||
        routeCenter.center ||
        routeCenter.description ||
        `Route Center ${routeCenter.id ?? ""}`
    );
}

/** Keep only centers that belong to the selected route. */
export function filterRouteCentersForRoute(
    centers: any[] | null | undefined,
    routeId: number | null | undefined
): any[] {
    if (!Array.isArray(centers) || routeId == null) {
        return [];
    }

    return centers.filter((center) => {
        if (center?.route_id == null) {
            return true;
        }
        return Number(center.route_id) === Number(routeId);
    });
}

export function toRouteCenterDropdownItems(centers: any[]) {
    return (centers || []).map((center) => ({
        label: getRouteCenterDisplayName(center),
        value: center.id,
    }));
}
