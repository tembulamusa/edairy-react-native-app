import { useCallback, useRef } from "react";
import {
    filterMemberDropdownItems,
    mergeRecordsById,
    searchMembersOnServer,
    toMemberDropdownItems,
} from "../utils/referenceDataFetch";

type MemberDropdownItem = { label: string; value: number };

type UseMemberDropdownSearchOptions = {
    members: any[];
    setMembers: (members: any[]) => void;
    allMemberItems: MemberDropdownItem[];
    setAllMemberItems: (items: MemberDropdownItem[]) => void;
    setMemberItems: (items: MemberDropdownItem[]) => void;
    logContext: string;
    remoteSearchEnabled?: boolean;
    searchDebounceMs?: number;
};

export default function useMemberDropdownSearch({
    members,
    setMembers,
    allMemberItems,
    setAllMemberItems,
    setMemberItems,
    logContext,
    remoteSearchEnabled = true,
    searchDebounceMs = 400,
}: UseMemberDropdownSearchOptions) {
    const membersRef = useRef(members);
    const allMemberItemsRef = useRef(allMemberItems);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRequestRef = useRef(0);

    membersRef.current = members;
    allMemberItemsRef.current = allMemberItems;

    const resetMemberDropdownItems = useCallback(() => {
        setMemberItems(allMemberItems);
    }, [allMemberItems, setMemberItems]);

    const handleMemberSearch = useCallback(
        (searchText: string) => {
            const currentMembers = membersRef.current;
            const currentAllItems = allMemberItemsRef.current;
            const localFiltered = filterMemberDropdownItems(
                currentAllItems,
                currentMembers,
                searchText
            );
            setMemberItems(localFiltered);

            const normalized = searchText.trim();
            if (!normalized || localFiltered.length > 0 || !remoteSearchEnabled) {
                return;
            }

            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }

            searchDebounceRef.current = setTimeout(async () => {
                const requestId = ++searchRequestRef.current;

                try {
                    const fetched = await searchMembersOnServer(normalized, logContext);
                    if (requestId !== searchRequestRef.current) {
                        return;
                    }
                    if (fetched.length === 0) {
                        return;
                    }

                    const mergedMembers = mergeRecordsById(
                        membersRef.current,
                        fetched
                    );
                    const mergedItems = toMemberDropdownItems(mergedMembers);

                    setMembers(mergedMembers);
                    setAllMemberItems(mergedItems);
                    setMemberItems(
                        filterMemberDropdownItems(
                            mergedItems,
                            mergedMembers,
                            searchText
                        )
                    );
                } catch (error) {
                    console.warn(`[${logContext}] Remote member search failed:`, error);
                }
            }, searchDebounceMs);
        },
        [
            logContext,
            remoteSearchEnabled,
            searchDebounceMs,
            setAllMemberItems,
            setMemberItems,
            setMembers,
        ]
    );

    return { handleMemberSearch, resetMemberDropdownItems };
}
