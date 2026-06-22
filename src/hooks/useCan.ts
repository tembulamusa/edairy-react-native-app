import { useContext, useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../AuthContext";
import { can, getStoredUser, extractUserPermissions, StoredUser } from "../utils/permissions";

/**
 * Check whether the logged-in user has an exact backend permission string.
 *
 * @example
 * const canCreateMilkJournal = useCan("milk-journals.create");
 */
export default function useCan(permission: string): boolean {
    const { userToken } = useContext(AuthContext);
    const [allowed, setAllowed] = useState(false);

    const refresh = useCallback(async () => {
        if (!permission?.trim()) {
            setAllowed(false);
            return;
        }

        const result = await can(permission);
        setAllowed(result);
    }, [permission, userToken]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    return allowed;
}

type UseUserResult = {
    user: StoredUser | null;
    permissions: string[];
    loading: boolean;
    refresh: () => Promise<void>;
};

/** Load the stored user and their permissions from local storage. */
export function useUser(): UseUserResult {
    const { userToken } = useContext(AuthContext);
    const [user, setUser] = useState<StoredUser | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const storedUser = await getStoredUser();
            setUser(storedUser);
            setPermissions(extractUserPermissions(storedUser));
        } finally {
            setLoading(false);
        }
    }, [userToken]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    return { user, permissions, loading, refresh };
}
