import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  performMandatoryOfflineRefresh,
  checkConnectivity,
  type MandatoryOfflineRefreshResult,
} from '../services/offlineSync';
import {
  evaluateOfflineCollectionGate,
  buildClearedCollectionGateFromStore,
  createClearedCollectionGate,
  type OfflineCollectionGateState,
} from '../utils/offlineCollectionGate';

interface SyncContextType {
  isSyncing: boolean;
  isInitialSyncComplete: boolean;
  isUIBlocked: boolean;
  isInitialLoading: boolean;
  lastSyncResult: { success: number; failed: number } | null;
  lastSyncTime: Date | null;
  syncError: string | null;
  collectionGate: OfflineCollectionGateState;
  mandatorySyncError: string | null;
  gateCheckEnabled: boolean;
  setMandatorySyncError: (error: string | null) => void;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncResult: (result: { success: number; failed: number } | null) => void;
  setLastSyncTime: (time: Date | null) => void;
  setSyncError: (error: string | null) => void;
  triggerSync: () => Promise<{ success: number; failed: number }>;
  performMandatoryOfflineSync: (
    force?: boolean
  ) => Promise<MandatoryOfflineRefreshResult>;
  refreshCollectionGate: () => Promise<OfflineCollectionGateState>;
  clearCollectionGate: () => Promise<void>;
  enableCollectionGateCheck: () => void;
  handleOnlineReconnect: () => Promise<MandatoryOfflineRefreshResult | null>;
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
  const [collectionGate, setCollectionGate] = useState<OfflineCollectionGateState>(
    createClearedCollectionGate()
  );
  const [mandatorySyncError, setMandatorySyncError] = useState<string | null>(null);
  const [gateCheckEnabled, setGateCheckEnabled] = useState<boolean>(true);
  const onlineReconnectRunningRef = useRef(false);

  const clearCollectionGate = useCallback(async () => {
    const cleared = await buildClearedCollectionGateFromStore();
    setCollectionGate(cleared);
    setMandatorySyncError(null);
    setSyncError(null);
    setGateCheckEnabled(false);
    console.log('[SYNC] Cleared pending-collection gate checks (reference SQLite data unchanged)');
  }, []);

  const enableCollectionGateCheck = useCallback(() => {
    setGateCheckEnabled(true);
  }, []);

  const refreshCollectionGate = useCallback(async (): Promise<OfflineCollectionGateState> => {
    if (!gateCheckEnabled) {
      return collectionGate;
    }

    const gate = await evaluateOfflineCollectionGate();
    setCollectionGate(gate);

    if (!gate.requiresSync) {
      setMandatorySyncError(null);
    }

    return gate;
  }, [collectionGate, gateCheckEnabled]);

  const performMandatoryOfflineSync = useCallback(
    async (force = false): Promise<MandatoryOfflineRefreshResult> => {
      if (isSyncing && !force) {
        return {
          success: false,
          collectionsResult: { success: 0, failed: 0 },
          referenceSynced: false,
          error: 'Sync already in progress',
        };
      }

      setIsSyncing(true);
      setSyncError(null);
      setMandatorySyncError(null);

      try {
        const result = await performMandatoryOfflineRefresh();

        setLastSyncResult(result.collectionsResult);

        if (result.success) {
          setLastSyncTime(new Date());
          setSyncError(null);
          await clearCollectionGate();
        } else if (result.error) {
          setSyncError(result.error);
          setMandatorySyncError(result.error);
          if (gateCheckEnabled) {
            const gate = await evaluateOfflineCollectionGate();
            setCollectionGate(gate);
          }
        }

        return result;
      } catch (error: any) {
        const message = error?.message || 'Sync failed';
        setSyncError(message);
        setMandatorySyncError(message);
        return {
          success: false,
          collectionsResult: { success: 0, failed: 0 },
          referenceSynced: false,
          error: message,
        };
      } finally {
        setIsSyncing(false);
      }
    },
    [clearCollectionGate, gateCheckEnabled, isSyncing]
  );

  const handleOnlineReconnect = useCallback(async (): Promise<MandatoryOfflineRefreshResult | null> => {
    if (onlineReconnectRunningRef.current) {
      return null;
    }

    onlineReconnectRunningRef.current = true;
    enableCollectionGateCheck();

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));

      const stillOnline = await checkConnectivity();
      if (!stillOnline) {
        return null;
      }

      const gate = await evaluateOfflineCollectionGate();
      setCollectionGate(gate);

      if (!gate.requiresSync) {
        await clearCollectionGate();
        return null;
      }

      console.log('[SYNC] Auto-sync on reconnect', gate);
      return await performMandatoryOfflineSync(true);
    } finally {
      onlineReconnectRunningRef.current = false;
    }
  }, [clearCollectionGate, enableCollectionGateCheck, performMandatoryOfflineSync]);

  const triggerSync = useCallback(async (): Promise<{ success: number; failed: number }> => {
    enableCollectionGateCheck();
    const result = await performMandatoryOfflineSync(true);
    return result.collectionsResult;
  }, [enableCollectionGateCheck, performMandatoryOfflineSync]);

  const checkAndSyncPendingData = async (): Promise<void> => {
    let hasError = false;
    try {
      setIsUIBlocked(true);
      setIsInitialLoading(true);
      setSyncError(null);
      enableCollectionGateCheck();

      const gate = await evaluateOfflineCollectionGate();
      setCollectionGate(gate);

      if (gate.requiresSync) {
        console.log('[SYNC] Sync required on launch', gate);
        const result = await performMandatoryOfflineSync(true);

        if (result.collectionsResult.failed > 0) {
          console.warn(
            `[SYNC] Some collections failed to sync: ${result.collectionsResult.failed} failed, ${result.collectionsResult.success} succeeded`
          );
        }
      } else {
        await clearCollectionGate();
      }
    } catch (error: any) {
      console.error('[SYNC] Error during initial sync check:', error);
      hasError = true;
      setSyncError(error?.message || 'Failed to check for pending syncs');
    } finally {
      setIsInitialSyncComplete(true);
      setIsInitialLoading(false);
      setIsUIBlocked(false);

      if (hasError) {
        setTimeout(() => {
          setSyncError(null);
        }, 3000);
      }
    }
  };

  const contextValue: SyncContextType = {
    isSyncing,
    isInitialSyncComplete,
    isUIBlocked,
    isInitialLoading,
    lastSyncResult,
    lastSyncTime,
    syncError,
    collectionGate,
    mandatorySyncError,
    gateCheckEnabled,
    setIsSyncing,
    setLastSyncResult,
    setLastSyncTime,
    setSyncError,
    setMandatorySyncError,
    triggerSync,
    performMandatoryOfflineSync,
    refreshCollectionGate,
    clearCollectionGate,
    enableCollectionGateCheck,
    handleOnlineReconnect,
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
