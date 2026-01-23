// src/services/offlineSync.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import makeRequest from '../components/utils/makeRequest';
import {
    getUnsyncedCollections,
    markCollectionSynced,
    updateSyncAttempt,
    deleteSyncedCollection,
} from './offlineDatabase';

let syncInterval: NodeJS.Timeout | null = null;

// Check if online
export const checkConnectivity = async (): Promise<boolean> => {
    try {
        const state = await NetInfo.fetch();
        return state.isConnected === true && state.isInternetReachable === true;
    } catch (error) {
        console.error('[SYNC] Error checking connectivity:', error);
        return false;
    }
};

// Attempt to login using stored offline credentials from SQLite
const loginWithStoredCredentials = async (): Promise<boolean> => {
    try {
        console.log('[SYNC] Attempting to login with stored offline credentials...');

        // Get stored offline credentials from SQLite
        const { getOfflineCredentials } = await import('./offlineDatabase');
        const creds = await getOfflineCredentials();

        if (!creds) {
            console.log('[SYNC] No stored offline credentials found');
            return false;
        }

        const { phone_number, password } = creds;

        if (!phone_number || !password) {
            console.log('[SYNC] Incomplete offline credentials');
            return false;
        }

        // Attempt login
        const [status, response] = await makeRequest({
            url: 'auth/login',
            method: 'POST',
            data: { phone_number, password },
        });

        if ([200, 201].includes(status) && response?.token) {
            // Store the token
            await AsyncStorage.setItem('userToken', response.token);
            console.log('[SYNC] Login successful with offline credentials');
            return true;
        } else {
            console.log('[SYNC] Login failed:', response?.message);
            return false;
        }
    } catch (error) {
        console.error('[SYNC] Error logging in with offline credentials:', error);
        return false;
    }
};

// Check if user is logged in
const isLoggedIn = async (): Promise<boolean> => {
    try {
        const token = await AsyncStorage.getItem('userToken');
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

// Sync single collection
const syncCollection = async (collection: any): Promise<boolean> => {
    try {
        console.log('[SYNC] Syncing collection ID:', collection.id);

        // Get stored phone number
        const phoneNumber = await AsyncStorage.getItem("@edairyApp:user_phone_number");
        console.log('[SYNC] Using phone number:', phoneNumber);

        // Prepare payload
        const payload = {
            member_number: collection.member_number,
            shift_id: collection.shift_id,
            transporter_phone: phoneNumber,
            cans: collection.cans_data,
            collected_at: collection.created_at,
            is_offline: true,
        };

        // Send to server
        const [status, response] = await makeRequest({
            url: 'offline-collection',
            method: 'POST',
            data: payload,
        });

        if ([200, 201].includes(status)) {
            // Mark as synced
            await markCollectionSynced(collection.id);
            // Delete from local database
            await deleteSyncedCollection(collection.id);
            return true;
        } else {
            console.error('[SYNC] Failed to sync collection:', response?.message);
            await updateSyncAttempt(collection.id, response?.message || 'Unknown error');
            return false;
        }
    } catch (error: any) {
        console.error('[SYNC] Error syncing collection:', error);
        await updateSyncAttempt(collection.id, error?.message || 'Network error');
        return false;
    }
};

// Internal sync logic (without UI state management)
const performSyncAllCollections = async (forceLogin: boolean = true): Promise<{ success: number; failed: number }> => {
    console.log('[SYNC] Starting sync process...');

    // Check connectivity
    const isOnline = await checkConnectivity();
    if (!isOnline) {
        console.log('[SYNC] No internet connection, skipping sync');
        return { success: 0, failed: 0 };
    }

    // Check if logged in, if not, try to login (unless disabled)
    if (forceLogin) {
        let loggedIn = await isLoggedIn();
        if (!loggedIn) {
            console.log('[SYNC] Not logged in, attempting to login...');
            loggedIn = await loginWithStoredCredentials();
            if (!loggedIn) {
                console.log('[SYNC] Failed to login, cannot sync');
                return { success: 0, failed: 0 };
            }
        }
    }

    // Get unsynced collections
    const collections = await getUnsyncedCollections();
    if (collections.length === 0) {
        console.log('[SYNC] No collections to sync');
        return { success: 0, failed: 0 };
    }

    console.log('[SYNC] Found', collections.length, 'collections to sync');

    let successCount = 0;
    let failedCount = 0;

    // Sync each collection
    for (const collection of collections) {
        const success = await syncCollection(collection);
        if (success) {
            successCount++;
        } else {
            failedCount++;
        }

        // Add delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[SYNC] Sync completed:', successCount, 'success,', failedCount, 'failed');
    return { success: successCount, failed: failedCount };
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

        // Get unsynced collections
        const collections = await getUnsyncedCollections();

        if (collections.length === 0) {
            console.log('[SYNC] No collections to sync');
            Alert.alert(
                'No Pending Syncs',
                'All your offline collections are already synced.',
                [{ text: 'OK' }]
            );
            return;
        }

        // Show confirmation alert
        Alert.alert(
            'Sync Offline Collections',
            `You have ${collections.length} offline collection(s) pending sync. Would you like to sync them now?`,
            [
                {
                    text: 'Review & Sync',
                    onPress: async () => {
                        // Show each collection for review
                        for (const collection of collections) {
                            await reviewAndSyncCollection(collection);
                        }
                    }
                },
                {
                    text: 'Sync All',
                    onPress: async () => {
                        // Show progress indicator through context
                        const result = await syncAllCollections(
                            () => {}, // onSyncStart - handled by context
                            () => {}, // onSyncComplete - handled by context
                            () => {}, // onSyncError - handled by context
                            true // forceLogin - user is already logged in
                        );

                        // Show final result
                        if (result.success > 0 && result.failed === 0) {
                            Alert.alert(
                                'Sync Complete',
                                `Successfully synced all ${result.success} collection(s).`,
                                [{ text: 'OK' }]
                            );
                        } else if (result.failed > 0) {
                            Alert.alert(
                                'Sync Partially Failed',
                                `Successfully synced ${result.success} collection(s), but ${result.failed} failed. You can try syncing the failed ones again.`,
                                [{ text: 'OK' }]
                            );
                        }
                    }
                },
                {
                    text: 'Later',
                    style: 'cancel'
                }
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

// Review and sync individual collection
const reviewAndSyncCollection = async (collection: any): Promise<void> => {
    return new Promise((resolve) => {
        const { Alert } = require('react-native');

        const memberInfo = `Member: ${collection.member_number}`;
        const dateInfo = `Date: ${new Date(collection.created_at).toLocaleString()}`;
        const quantityInfo = `Quantity: ${collection.total_quantity.toFixed(2)} KG (${collection.total_cans} cans)`;

        Alert.alert(
            'Review Collection',
            `${memberInfo}\n${dateInfo}\n${quantityInfo}\n\nWhat would you like to do?`,
            [
                {
                    text: 'Sync',
                    onPress: async () => {
                        try {
                            const success = await syncCollection(collection);
                            if (success) {
                                Alert.alert('Success', 'Collection synced successfully', [{ text: 'OK' }]);
                            } else {
                                Alert.alert('Error', 'Failed to sync collection', [{ text: 'OK' }]);
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to sync collection', [{ text: 'OK' }]);
                        }
                        resolve();
                    }
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Confirm deletion
                        Alert.alert(
                            'Confirm Delete',
                            'Are you sure you want to delete this collection? This cannot be undone.',
                            [
                                {
                                    text: 'Cancel',
                                    style: 'cancel',
                                    onPress: () => resolve()
                                },
                                {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            const { deleteOfflineCollection } = await import('./offlineDatabase');
                                            await deleteOfflineCollection(collection.id);
                                            Alert.alert('Deleted', 'Collection has been deleted', [{ text: 'OK' }]);
                                        } catch (error) {
                                            Alert.alert('Error', 'Failed to delete collection', [{ text: 'OK' }]);
                                        }
                                        resolve();
                                    }
                                }
                            ]
                        );
                    }
                },
                {
                    text: 'Skip',
                    style: 'cancel',
                    onPress: () => resolve()
                }
            ]
        );
    });
};

// Listen to network state changes and prompt for sync when online with pending data
export const setupNetworkListener = () => {
    let wasOffline = false;

    const unsubscribe = NetInfo.addEventListener(state => {
        const isOnline = state.isConnected && state.isInternetReachable;

        console.log('[SYNC] Network state changed:', state.isConnected, state.isInternetReachable);

        // Check if we just came online (was offline, now online)
        if (isOnline && wasOffline) {
            console.log('[SYNC] Internet connection detected, checking for pending syncs...');
            // Wait a bit before checking to ensure connection is stable
            setTimeout(async () => {
                try {
                    const collections = await getUnsyncedCollections();
                    if (collections.length > 0) {
                        console.log(`[SYNC] Found ${collections.length} pending collections, prompting for sync...`);
                        // Prompt user for sync permission
                        const { Alert } = require('react-native');
                        Alert.alert(
                            'Sync Available',
                            `You have ${collections.length} offline collection(s) ready to sync. Would you like to sync them now?`,
                            [
                                {
                                    text: 'Sync Now',
                                    onPress: () => performNetworkTriggeredSync(),
                                },
                                {
                                    text: 'Later',
                                    style: 'cancel'
                                }
                            ]
                        );
                    }
                } catch (error) {
                    console.error('[SYNC] Error checking pending collections:', error);
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
                    const collections = await getUnsyncedCollections();
                    console.log(`[SYNC] Found ${collections.length} pending collections`);

                    if (collections.length > 0) {
                        console.log(`[SYNC] Found ${collections.length} pending collections, prompting for sync...`);

                        const { Alert } = require('react-native');
                        Alert.alert(
                            'Sync Available',
                            `You have ${collections.length} offline collection(s) ready to sync. Would you like to sync them now?`,
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
                phone_number: offlineCreds.phone_number,
                password: offlineCreds.password
            }
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
            const collections = await getUnsyncedCollections();
            if (collections.length > 0) {
                console.log(`[SYNC] Found ${collections.length} pending collections after re-auth, prompting for sync...`);

                const { Alert } = require('react-native');
                Alert.alert(
                    'Sync Available',
                    `You have ${collections.length} offline collection(s) ready to sync. Would you like to sync them now?`,
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
            const collections = await getUnsyncedCollections();
            if (collections.length > 0) {
                const { Alert } = require('react-native');
                Alert.alert(
                    'Ready to Sync',
                    `You have ${collections.length} offline collection(s) ready to sync. Would you like to sync them now?`,
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

