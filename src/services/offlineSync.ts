// src/services/offlineSync.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import makeRequest from '../components/utils/makeRequest';
import { checkConnectivity } from './connectivity';
import { refreshCoreDataFromServer } from './coreData';
import {
    buildMemberKilosJournalPayload,
    type MemberKilosJournalPayload,
} from '../utils/memberKilosJournalPayload';
import { logMilkJournalPost } from '../utils/memberKilosJournalReceipts';
import {
    getRetryableOfflineCollections,
    deleteOfflineCollectionById,
    incrementOfflineCollectionRetry,
    getOfflineCollectionById,
    logOfflineCollectionDebug,
    MAX_OFFLINE_COLLECTION_RETRIES,
    getRetryableOfflineCollectionCount,
} from './offlineDatabase';

let syncInterval: NodeJS.Timeout | null = null;

export { checkConnectivity } from './connectivity';

// Attempt to login using stored offline credentials from SQLite
const loginWithStoredCredentials = async (): Promise<boolean> => {
    try {
        const { refreshOnlineTokenFromSQLiteStorage } = await import('./authSession');
        const token = await refreshOnlineTokenFromSQLiteStorage();
        return !!token;
    } catch (error) {
        console.error('[SYNC] Error logging in with offline credentials:', error);
        return false;
    }
};

// Check if user is logged in
const isLoggedIn = async (): Promise<boolean> => {
    try {
        const token =
            (await AsyncStorage.getItem('token')) ||
            (await AsyncStorage.getItem('userToken'));
        return !!token;
    } catch (error) {
        console.error('[SYNC] Error checking login status:', error);
        return false;
    }
};

// Check if offline credentials are available for offline login
// This function is now handled by offlineDatabase.ts
// Keeping for backward compatibility but delegating to SQLite
export const hasOfflineCredentials = async (): Promise<boolean> => {
    const { hasOfflineCredentials: hasSQLiteCreds } = await import('./offlineDatabase');
    return await hasSQLiteCreds();
};

// Validate offline login (check if credentials exist and are recent)
// This function is now handled by offlineDatabase.ts
// Keeping for backward compatibility but delegating to SQLite
export const validateOfflineLogin = async (): Promise<boolean> => {
    const { hasOfflineCredentials: hasSQLiteCreds } = await import('./offlineDatabase');
    return await hasSQLiteCreds();
};

const extractApiErrorMessage = (response: any, status?: number): string => {
    if (typeof response === 'string' && response.trim()) {
        return response.trim();
    }

    if (response && typeof response === 'object') {
        const message =
            response.message ||
            response.error ||
            response.data?.message ||
            response.data?.error;

        if (typeof message === 'string' && message.trim()) {
            return message.trim();
        }
    }

    if (status) {
        return `Failed to send kilos (status ${status}).`;
    }

    return 'Failed to send kilos.';
};

const extractGenericApiErrorMessage = (
    response: any,
    status?: number,
    fallback = 'Request failed.'
): string => {
    const message = extractApiErrorMessage(response, status);
    if (message !== 'Failed to send kilos.') {
        return message;
    }
    return status ? `${fallback} (status ${status}).` : fallback;
};

/** Build the same milk-journals payload used by Member Kilos from a SQLite collection row. */
export const buildOfflineCollectionJournalPayload = async (
    collection: any
): Promise<MemberKilosJournalPayload | null> => {
    const entries = Array.isArray(collection?.cans_data) ? collection.cans_data : [];
    if (entries.length === 0) {
        return null;
    }

    const transporterId = Number(collection.transporter_id);
    const routeId = Number(collection.route_id);
    const shiftId = Number(collection.shift_id);

    if (!transporterId || !routeId || !shiftId) {
        return null;
    }

    const firstEntry = entries[0] || {};
    const journalOverride =
        typeof firstEntry.journal === 'string' && firstEntry.journal.trim()
            ? firstEntry.journal.trim()
            : undefined;
    const batchNoOverride =
        typeof firstEntry.batch_no === 'string' && firstEntry.batch_no.trim()
            ? firstEntry.batch_no.trim()
            : undefined;

    const journalDate = collection.created_at
        ? new Date(collection.created_at)
        : new Date();

    let transporter: any;
    let route: any;

    if (!journalOverride || !batchNoOverride) {
        const { getTransporters, getRoutes } = await import('./offlineReferenceData');
        const [transporters, routes] = await Promise.all([
            getTransporters(),
            getRoutes(),
        ]);
        transporter = (transporters || []).find((t: any) => t.id === transporterId);
        route = (routes || []).find((r: any) => r.id === routeId);
    }

    return buildMemberKilosJournalPayload({
        transporterId,
        routeId,
        milkDeliveryShiftId: shiftId,
        entries,
        transporter,
        route,
        journal: journalOverride,
        batch_no: batchNoOverride,
        journalDate,
    });
};

// Push each retryable offline_collections row to its API endpoint.
export const pushSyncQueue = async (
    forceLogin: boolean = true
): Promise<{ success: number; failed: number }> => {
    console.warn('[OFFLINE-COLLECTIONS] pushSyncQueue started');
    console.log('[SYNC] Starting offline_collections push...');

    const isOnline = await checkConnectivity();
    if (!isOnline) {
        console.log('[SYNC] No internet connection, skipping offline_collections push');
        return { success: 0, failed: 0 };
    }

    if (forceLogin) {
        let loggedIn = await isLoggedIn();
        if (!loggedIn) {
            console.log('[SYNC] Not logged in, attempting to login...');
            loggedIn = await loginWithStoredCredentials();
            if (!loggedIn) {
                console.log('[SYNC] Failed to login, cannot push offline_collections');
                return { success: 0, failed: 0 };
            }
        }
    }

    const queueItems = await getRetryableOfflineCollections();
    if (queueItems.length === 0) {
        console.log('[SYNC] offline_collections is empty (no retryable items)');
        return { success: 0, failed: 0 };
    }

    console.log('[SYNC] Pushing', queueItems.length, 'offline_collections row(s)');

    let successCount = 0;
    let failedCount = 0;

    for (const item of queueItems) {
        try {
            const payload = JSON.parse(item.data);
            const method = item.method.toUpperCase();

            logOfflineCollectionDebug('ONLINE_PUSH', item, {
                request_url: item.endpoint,
                request_method: method,
            });

            const [status, response] = await makeRequest({
                url: item.endpoint,
                method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
                data: payload,
            });

            const isPostSuccess =
                method === 'POST' && [200, 201].includes(status);

            if (isPostSuccess) {
                logOfflineCollectionDebug('ONLINE_PUSH_SUCCESS', item, {
                    http_status: status,
                    response,
                });
                await deleteOfflineCollectionById(item.id);
                successCount++;
            } else {
                const errorMsg = extractGenericApiErrorMessage(
                    response,
                    status,
                    `Failed to push ${item.endpoint}`
                );
                const retries = await incrementOfflineCollectionRetry(item.id, errorMsg);
                const updatedRecord = (await getOfflineCollectionById(item.id)) ?? {
                    ...item,
                    retries,
                    error_message: errorMsg,
                };
                logOfflineCollectionDebug('ONLINE_PUSH_FAILED', updatedRecord, {
                    http_status: status,
                    response,
                    error: errorMsg,
                    retries,
                    max_retries: MAX_OFFLINE_COLLECTION_RETRIES,
                });
                failedCount++;
            }
        } catch (error: any) {
            const errorMsg = error?.message || 'Network error';
            const retries = await incrementOfflineCollectionRetry(item.id, errorMsg);
            const updatedRecord = (await getOfflineCollectionById(item.id)) ?? {
                ...item,
                retries,
                error_message: errorMsg,
            };
            logOfflineCollectionDebug('ONLINE_PUSH_FAILED', updatedRecord, {
                error: errorMsg,
                retries,
                max_retries: MAX_OFFLINE_COLLECTION_RETRIES,
            });
            failedCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('[SYNC] sync_queue push completed:', successCount, 'success,', failedCount, 'failed');
    return { success: successCount, failed: failedCount };
};

// Internal sync logic (without UI state management)
const performSyncAllPending = async (
    forceLogin: boolean = true
): Promise<{ success: number; failed: number }> => {
    return pushSyncQueue(forceLogin);
};

const performSyncAllCollections = performSyncAllPending;

export type MandatoryOfflineRefreshResult = {
    success: boolean;
    collectionsResult: { success: number; failed: number };
    referenceSynced: boolean;
    error?: string;
};

/** Download core offline lists (members, routes, customers, stores, etc.) into SQLite. */
export const refreshOfflineReferenceData = async (): Promise<boolean> => {
    return refreshCoreDataFromServer({ logContext: "UpdateOnlineData" });
};

/** Push pending offline transactions to the server. Reference data is not refreshed here. */
export const performPushPendingOfflineRecords = async (
    forceLogin: boolean = true
): Promise<{ success: number; failed: number }> => {
    const isOnline = await checkConnectivity();
    if (!isOnline) {
        return { success: 0, failed: 0 };
    }

    const pendingCount = await getRetryableOfflineCollectionCount();
    if (pendingCount === 0) {
        console.log('[SYNC] No retryable sync_queue items to push');
        return { success: 0, failed: 0 };
    }

    return performSyncAllCollections(forceLogin);
};

/** Upload pending offline records when online. Does not refresh reference data. */
export const performMandatoryOfflineRefresh = async (): Promise<MandatoryOfflineRefreshResult> => {
    const isOnline = await checkConnectivity();
    if (!isOnline) {
        return {
            success: false,
            collectionsResult: { success: 0, failed: 0 },
            referenceSynced: false,
            error: "No internet connection",
        };
    }

    const pendingCount = await getRetryableOfflineCollectionCount();
    if (pendingCount === 0) {
        console.log('[SYNC] No retryable sync_queue items to push');
        return {
            success: true,
            collectionsResult: { success: 0, failed: 0 },
            referenceSynced: false,
        };
    }

    try {
        const collectionsResult = await performPushPendingOfflineRecords(true);
        const pendingAfterSync = await getRetryableOfflineCollectionCount();

        return {
            success: collectionsResult.failed === 0 && pendingAfterSync === 0,
            collectionsResult,
            referenceSynced: false,
            error:
                collectionsResult.failed > 0
                    ? "Some offline records failed to upload"
                    : pendingAfterSync > 0
                      ? "Some offline records are still pending upload"
                      : undefined,
        };
    } catch (error: any) {
        console.error("[SYNC] Error pushing offline records:", error);
        return {
            success: false,
            collectionsResult: { success: 0, failed: 0 },
            referenceSynced: false,
            error: error?.message || "Failed to push offline records",
        };
    }
};

// Sync all unsynced collections (with UI state management through callbacks)
export const syncAllCollections = async (
    onSyncStart?: () => void,
    onSyncComplete?: (result: { success: number; failed: number }) => void,
    onSyncError?: (error: string) => void,
    forceLogin: boolean = true
): Promise<{ success: number; failed: number }> => {
    try {
        if (onSyncStart) onSyncStart();

        const result = await performSyncAllCollections(forceLogin);

        if (onSyncComplete) onSyncComplete(result);
        return result;
    } catch (error: any) {
        console.error('[SYNC] Error in sync process:', error);
        if (onSyncError) onSyncError(error?.message || 'Sync failed');
        return { success: 0, failed: 0 };
    }
};

// Start auto-sync service
export const startAutoSync = (intervalMinutes: number = 5) => {
    if (syncInterval) {
        console.log('[SYNC] Auto-sync already running');
        return;
    }

    console.log('[SYNC] Starting auto-sync with', intervalMinutes, 'minute interval');

    // Run immediately
    syncAllCollections();

    // Then run at intervals
    syncInterval = setInterval(() => {
        syncAllCollections();
    }, intervalMinutes * 60 * 1000);
};

// Stop auto-sync service
export const stopAutoSync = () => {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('[SYNC] Auto-sync stopped');
    }
};

// Sync with user confirmation (post-login scenario - when user clicks notification icon)
export const syncWithConfirmation = async (): Promise<void> => {
    try {
        const { Alert } = require('react-native');
        const pendingCount = await getRetryableOfflineCollectionCount();

        if (pendingCount === 0) {
            Alert.alert(
                'No Pending Syncs',
                'All your offline records are already synced.',
                [{ text: 'OK' }]
            );
            return;
        }

        Alert.alert(
            'Sync Offline Records',
            `You have ${pendingCount} offline record(s) pending sync. Would you like to sync them now?`,
            [
                {
                    text: 'Sync All',
                    onPress: async () => {
                        const result = await pushSyncQueue(true);
                        if (result.success > 0 && result.failed === 0) {
                            Alert.alert(
                                'Sync Complete',
                                `Successfully synced ${result.success} record(s).`,
                                [{ text: 'OK' }]
                            );
                        } else if (result.failed > 0) {
                            Alert.alert(
                                'Sync Partially Failed',
                                `Synced ${result.success} record(s), but ${result.failed} failed.`,
                                [{ text: 'OK' }]
                            );
                        }
                    },
                },
                {
                    text: 'Later',
                    style: 'cancel',
                },
            ]
        );
    } catch (error) {
        console.error('[SYNC] Error in sync confirmation:', error);
        const { Alert } = require('react-native');
        Alert.alert(
            'Sync Error',
            'An error occurred while preparing to sync. Please try again.',
            [{ text: 'OK' }]
        );
    }
};

// Legacy review helper retained for compatibility with old collection UI flows.
const reviewAndSyncCollection = async (_collection: any): Promise<void> => {
    await pushSyncQueue(true);
};

// Listen to network state changes and prompt for sync when online with pending data
export const setupNetworkListener = () => {
    let wasOffline = false;

    const unsubscribe = NetInfo.addEventListener(state => {
        const isOnline = state.isConnected && state.isInternetReachable;

        console.log('[SYNC] Network state changed:', state.isConnected, state.isInternetReachable);

        if (isOnline && wasOffline) {
            console.log('[SYNC] Internet connection detected, checking for pending syncs...');
            setTimeout(async () => {
                try {
                    const pendingCount = await getRetryableOfflineCollectionCount();
                    if (pendingCount > 0) {
                        console.log(`[SYNC] Found ${pendingCount} pending sync_queue item(s), prompting for sync...`);
                        const { Alert } = require('react-native');
                        Alert.alert(
                            'Sync Available',
                            `You have ${pendingCount} offline record(s) ready to sync. Would you like to sync them now?`,
                            [
                                {
                                    text: 'Sync Now',
                                    onPress: () => performNetworkTriggeredSync(),
                                },
                                {
                                    text: 'Later',
                                    style: 'cancel',
                                },
                            ]
                        );
                    }
                } catch (error) {
                    console.error('[SYNC] Error checking pending sync_queue items:', error);
                }
            }, 2000);
        }

        wasOffline = !isOnline;
    });

    return unsubscribe;
};

// Flag to track if sync is pending after login
let syncPendingAfterLogin = false;

// Export function to check if sync is pending after login
export const isSyncPendingAfterLogin = () => syncPendingAfterLogin;

// Export function to clear sync pending flag
export const clearSyncPendingAfterLogin = () => {
    syncPendingAfterLogin = false;
};

// New network listener that has access to SyncContext triggerSync function
export const setupNetworkListenerWithSync = (triggerSync: () => Promise<{ success: number; failed: number }>) => {
    let wasOffline = false;

    const unsubscribe = NetInfo.addEventListener(state => {
        const isOnline = state.isConnected && state.isInternetReachable;

        console.log('[SYNC] Network state changed (with sync):', state.isConnected, state.isInternetReachable);

        // Check if we just came online (was offline, now online)
        if (isOnline && wasOffline) {
            console.log('[SYNC] Internet connection detected, checking for offline re-auth and syncs...');
            // Wait a bit before checking to ensure connection is stable
            setTimeout(async () => {
                try {
                    // First, check if user is logged in with offline credentials that need re-auth
                    console.log('[SYNC] Checking user login status...');
                    const { getItem } = await import('../components/utils/local-storage');
                    const user = await getItem("user");
                    console.log('[SYNC] User exists in storage:', !!user);

                    console.log('[SYNC] Checking offline credentials...');
                    const offlineCreds = await getOfflineCredentials();
                    console.log('[SYNC] Offline credentials found:', !!offlineCreds);

                    if (user && offlineCreds) {
                        console.log('[SYNC] User logged in with offline credentials, re-authenticating with API...');
                        try {
                            await performOfflineReAuthentication(triggerSync);
                            console.log('[SYNC] Re-authentication completed');
                            return; // Don't check for syncs yet, wait for re-auth completion
                        } catch (reAuthError) {
                            console.error('[SYNC] Re-authentication failed:', reAuthError);
                            // Continue to check for syncs even if re-auth fails
                        }
                    }

                    // If not logged in with offline credentials, check for pending syncs normally
                    console.log('[SYNC] Checking for pending collections...');
                    const pendingCount = await getRetryableOfflineCollectionCount();
                    console.log(`[SYNC] Found ${pendingCount} pending sync_queue items`);

                    if (pendingCount > 0) {
                        console.log(`[SYNC] Found ${pendingCount} pending records, prompting for sync...`);

                        const { Alert } = require('react-native');
                        Alert.alert(
                            'Sync Available',
                            `You have ${pendingCount} offline record(s) ready to sync. Would you like to sync them now?`,
                            [
                                {
                                    text: 'Sync Now',
                                    onPress: () => {
                                        // Check if user is logged in before syncing
                                        checkLoginAndSync(triggerSync);
                                    },
                                },
                                {
                                    text: 'Later',
                                    style: 'cancel'
                                }
                            ]
                        );
                    } else {
                        console.log('[SYNC] No pending collections found');
                    }
                } catch (error) {
                    console.error('[SYNC] Error in online transition logic:', error);
                    console.error('[SYNC] Error details:', error?.message, error?.stack);
                }
            }, 2000);
        }

        wasOffline = !isOnline;
    });

    return unsubscribe;
};

// Perform offline re-authentication when internet comes back
const performOfflineReAuthentication = async (triggerSync: () => Promise<{ success: number; failed: number }>) => {
    try {
        console.log('[SYNC] Starting offline re-authentication...');

        // Get stored offline credentials
        const offlineCreds = await getOfflineCredentials();
        if (!offlineCreds) {
            console.log('[SYNC] No offline credentials found for re-auth');
            return;
        }

        console.log('[SYNC] Re-authenticating with stored credentials...');

        // Import makeRequest dynamically
        const makeRequest = (await import('./makeRequest')).default;

        // Send stored credentials to login API
        const [status, response] = await makeRequest({
            url: 'member-token',
            method: 'POST',
            data: {
                email: offlineCreds.email,
                password: offlineCreds.password,
            },
        });

        if ([200, 201].includes(status) && response?.access_token) {
            console.log('[SYNC] Re-authentication successful, updating credentials...');

            const newToken = response.access_token;

            // Import AuthContext and update login
            const { login } = (await import('../AuthContext')).default || (await import('../AuthContext'));
            await login(newToken);

            // Update AsyncStorage with new user data
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.setItem("user", JSON.stringify(response));

            // Update SQLite with fresh credentials
            const { saveOfflineCredentials } = await import('./offlineDatabase');
            const updatedCreds = {
                ...offlineCreds,
                token: newToken,
                user_data: response,
                stored_at: new Date().toISOString()
            };
            await saveOfflineCredentials(updatedCreds);

            console.log('[SYNC] Re-authentication complete, credentials updated');

            // Now check for and prompt sync
            const pendingCount = await getRetryableOfflineCollectionCount();
            if (pendingCount > 0) {
                console.log(`[SYNC] Found ${pendingCount} pending records after re-auth, prompting for sync...`);

                const { Alert } = require('react-native');
                Alert.alert(
                    'Sync Available',
                    `You have ${pendingCount} offline record(s) ready to sync. Would you like to sync them now?`,
                    [
                        {
                            text: 'Sync Now',
                            onPress: () => performNetworkTriggeredSyncWithContext(triggerSync),
                        },
                        {
                            text: 'Later',
                            style: 'cancel'
                        }
                    ]
                );
            } else {
                console.log('[SYNC] No pending collections after re-auth');
            }

        } else {
            console.log('[SYNC] Re-authentication failed:', response?.message);
            // If re-auth fails, show error and keep current offline session
            const { Alert } = require('react-native');
            Alert.alert(
                'Re-authentication Failed',
                'Could not verify your credentials with the server. You can continue using offline mode or try logging in again.',
                [{ text: 'Continue Offline' }]
            );
        }

    } catch (error) {
        console.error('[SYNC] Error during offline re-authentication:', error);
        const { Alert } = require('react-native');
        Alert.alert(
            'Connection Error',
            'Could not re-authenticate with the server. Please check your connection.',
            [{ text: 'Continue Offline' }]
        );
    }
};

// Check login status and either sync or redirect to login
const checkLoginAndSync = async (triggerSync: () => Promise<{ success: number; failed: number }>) => {
    try {
        const { getItem } = await import('../components/utils/local-storage');
        const user = await getItem("user");

        if (user) {
            // User is logged in, proceed with sync
            performNetworkTriggeredSyncWithContext(triggerSync);
        } else {
            // User not logged in, set flag and redirect to login
            syncPendingAfterLogin = true;

            // Try to navigate to login - this will work if we have navigation access
            // For now, we'll rely on the app's natural flow to go to Auth screen
            const { Alert } = require('react-native');
            Alert.alert(
                'Login Required',
                'Please login first to sync your offline data.',
                [
                    {
                        text: 'Go to Login',
                        onPress: () => {
                            // The app should naturally navigate to Auth screen
                            // We could dispatch a navigation action here if needed
                        }
                    }
                ]
            );
        }
    } catch (error) {
        console.error('[SYNC] Error checking login status:', error);
    }
};

// Function to check and prompt for sync after login
export const checkAndPromptPendingSyncAfterLogin = async (triggerSync: () => Promise<{ success: number; failed: number }>) => {
    if (syncPendingAfterLogin) {
        syncPendingAfterLogin = false; // Reset the flag

        try {
            const pendingCount = await getRetryableOfflineCollectionCount();
            if (pendingCount > 0) {
                const { Alert } = require('react-native');
                Alert.alert(
                    'Ready to Sync',
                    `You have ${pendingCount} offline record(s) ready to sync. Would you like to sync them now?`,
                    [
                        {
                            text: 'Sync Now',
                            onPress: () => performNetworkTriggeredSyncWithContext(triggerSync),
                        },
                        {
                            text: 'Later',
                            style: 'cancel'
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('[SYNC] Error prompting for sync after login:', error);
        }
    }
};

// Perform sync triggered by network connection (pre-login scenario) - uses SyncContext
const performNetworkTriggeredSyncWithContext = async (triggerSync: () => Promise<{ success: number; failed: number }>) => {
    try {
        console.log('[SYNC] Starting network-triggered sync via SyncContext...');

        // Use the SyncContext's triggerSync which will show the overlay
        const result = await triggerSync();

        // Show result alert after sync completes
        showNetworkSyncResult(result);

    } catch (error) {
        console.error('[SYNC] Error in network-triggered sync:', error);
        showNetworkSyncError(error);
    }
};

// Legacy function for backward compatibility (still used by setupNetworkListener)
const performNetworkTriggeredSync = async () => {
    try {
        // Use syncAllCollections directly with callbacks that will trigger the overlay
        // We need to set up callbacks that will trigger the SyncContext overlay
        const result = await syncAllCollections(
            () => {
                // This callback will be handled by the SyncContext when we modify it
                console.log('[SYNC] Network-triggered sync started');
            },
            (result) => {
                console.log(`[SYNC] Network-triggered sync completed: ${result.success} success, ${result.failed} failed`);
                // Show result alert after sync completes
                showNetworkSyncResult(result);
            },
            (error) => {
                console.error('[SYNC] Network-triggered sync error:', error);
                showNetworkSyncError(error);
            },
            false // forceLogin - allow sync without login
        );

    } catch (error) {
        console.error('[SYNC] Error in network-triggered sync:', error);
        showNetworkSyncError(error);
    }
};

// Helper functions to show sync results for network-triggered syncs
const showNetworkSyncResult = (result: { success: number; failed: number }) => {
    const { Alert } = require('react-native');
    if (result.success > 0 && result.failed === 0) {
        Alert.alert(
            'Sync Complete',
            `Successfully synced ${result.success} collection(s).`,
            [{ text: 'Continue to Login' }]
        );
    } else if (result.failed > 0) {
        Alert.alert(
            'Sync Partially Failed',
            `Successfully synced ${result.success} collection(s), but ${result.failed} failed. You can try syncing again later.`,
            [{ text: 'Continue to Login' }]
        );
    }
};

const showNetworkSyncError = (error: any) => {
    const { Alert } = require('react-native');
    Alert.alert(
        'Sync Error',
        'An error occurred during sync. You can try again later.',
        [{ text: 'Continue to Login' }]
    );
};

