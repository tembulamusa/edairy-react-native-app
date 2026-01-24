import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// Import sync function statically to avoid bundler issues
import { syncAllCollections } from '../services/offlineSync';

interface SyncContextType {
  isSyncing: boolean;
  isInitialSyncComplete: boolean;
  isUIBlocked: boolean;
  isInitialLoading: boolean;
  lastSyncResult: { success: number; failed: number } | null;
  lastSyncTime: Date | null;
  syncError: string | null;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncResult: (result: { success: number; failed: number } | null) => void;
  setLastSyncTime: (time: Date | null) => void;
  setSyncError: (error: string | null) => void;
  triggerSync: () => Promise<{ success: number; failed: number }>;
  checkAndSyncPendingData: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState<boolean>(false);
  const [isUIBlocked, setIsUIBlocked] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const checkAndSyncPendingData = async (): Promise<void> => {
    let hasError = false;
    try {
      setIsUIBlocked(true);
      setIsInitialLoading(true);
      setSyncError(null);

      // Import offline database to check for pending collections
      const { getUnsyncedCollections } = await import('../services/offlineDatabase');
      const pendingCollections = await getUnsyncedCollections();

      // Additional safety check
      if (!Array.isArray(pendingCollections)) {
        console.warn('[SYNC] getUnsyncedCollections returned invalid data:', pendingCollections);
        return;
      }

      if (pendingCollections.length > 0) {
        console.log(`[SYNC] Found ${pendingCollections.length} pending collections, starting sync...`);
        const result = await triggerSync();

        if (result.failed > 0) {
          console.warn(`[SYNC] Some collections failed to sync: ${result.failed} failed, ${result.success} succeeded`);
          // Don't set as error, just log it - user can still continue
        }
      } else {
        console.log('[SYNC] No pending collections found');
      }
    } catch (error: any) {
      console.error('[SYNC] Error during initial sync check:', error);
      hasError = true;
      setSyncError(error?.message || 'Failed to check for pending syncs');
      // Still allow the app to continue even if sync fails
    } finally {
      // Always mark as complete and unblock UI, even on error
      setIsInitialSyncComplete(true);
      setIsInitialLoading(false);
      setIsUIBlocked(false);

      if (hasError) {
        // Wait a moment before clearing error so user can see it if needed
        setTimeout(() => {
          setSyncError(null);
        }, 3000);
      }
    }
  };

  const triggerSync = async (): Promise<{ success: number; failed: number }> => {
    if (isSyncing) {
      console.log('[SYNC] Sync already in progress, skipping...');
      return { success: 0, failed: 0 };
    }

    try {
      setIsSyncing(true);
      setSyncError(null);

      // Use statically imported sync function
      const result = await syncAllCollections(
        () => {
          console.log('[SYNC] Sync started');
          setIsSyncing(true);
        }, // onSyncStart
        (result) => { // onSyncComplete
          console.log(`[SYNC] Sync completed: ${result.success} success, ${result.failed} failed`);
          setLastSyncResult(result);
          setLastSyncTime(new Date());
          setIsSyncing(false);
        },
        (error) => { // onSyncError
          console.error('[SYNC] Sync error:', error);
          setSyncError(error);
          setIsSyncing(false);
        },
        false // forceLogin - allow sync without login for initial check
      );

      return result;
    } catch (error: any) {
      console.error('[SYNC] Unexpected error during sync:', error);
      setSyncError(error?.message || 'Sync failed');
      setIsSyncing(false);
      throw error;
    }
  };

  // Removed automatic sync on app launch - sync should be user-initiated only
  // useEffect(() => {
  //   checkAndSyncPendingData();
  // }, []);

  const contextValue: SyncContextType = {
    isSyncing,
    isInitialSyncComplete,
    isUIBlocked,
    isInitialLoading,
    lastSyncResult,
    lastSyncTime,
    syncError,
    setIsSyncing,
    setLastSyncResult,
    setLastSyncTime,
    setSyncError,
    triggerSync,
    checkAndSyncPendingData,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export default SyncContext;