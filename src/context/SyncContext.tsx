import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import {
  performMandatoryOfflineRefresh,
  refreshOfflineReferenceData,
  checkConnectivity,
  type MandatoryOfflineRefreshResult,
} from '../services/offlineSync';
import { hasCoreData, refreshCoreDataFromServer } from '../services/coreData';
import {
  evaluateOfflineCollectionGate,
  buildClearedCollectionGateFromStore,
  createClearedCollectionGate,
  type OfflineCollectionGateState,
} from '../utils/offlineCollectionGate';
import { getUnsyncedCount, getRetryableOfflineCollectionCount, getCurrentOfflineUserId } from '../services/offlineDatabase';

const OFFLINE_GATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
  isUpdatingOnlineData: boolean;
  setMandatorySyncError: (error: string | null) => void;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncResult: (result: { success: number; failed: number } | null) => void;
  setLastSyncTime: (time: Date | null) => void;
  setSyncError: (error: string | null) => void;
  triggerSync: () => Promise<{ success: number; failed: number }>;
  performMandatoryOfflineSync: (
    force?: boolean
  ) => Promise<MandatoryOfflineRefreshResult>;
  updateOnlineReferenceData: () => Promise<boolean>;
  refreshCollectionGate: () => Promise<OfflineCollectionGateState>;
  clearCollectionGate: () => Promise<void>;
  enableCollectionGateCheck: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isUpdatingOnlineData, setIsUpdatingOnlineData] = useState<boolean>(false);
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
  const collectionGateRef = useRef(collectionGate);
  const gateCheckEnabledRef = useRef(gateCheckEnabled);

  useEffect(() => {
    collectionGateRef.current = collectionGate;
  }, [collectionGate]);

  useEffect(() => {
    gateCheckEnabledRef.current = gateCheckEnabled;
  }, [gateCheckEnabled]);

  const clearCollectionGate = useCallback(async () => {
    const cleared = await buildClearedCollectionGateFromStore();
    setCollectionGate(cleared);
    setMandatorySyncError(null);
    setSyncError(null);
    console.log('[SYNC] Refreshed offline intake gate after push');
  }, []);

  const enableCollectionGateCheck = useCallback(() => {
    setGateCheckEnabled(true);
  }, []);

  const refreshCollectionGate = useCallback(async (): Promise<OfflineCollectionGateState> => {
    if (!gateCheckEnabledRef.current) {
      return collectionGateRef.current;
    }

    const gate = await evaluateOfflineCollectionGate();
    setCollectionGate(gate);

    if (!gate.requiresOnlinePush) {
      setMandatorySyncError(null);
    } else {
      setMandatorySyncError(
        'Offline intake time limit reached. Connect to the internet to push your saved records.'
      );
    }

    return gate;
  }, []);

  useEffect(() => {
    enableCollectionGateCheck();
    void refreshCollectionGate();

    const interval = setInterval(() => {
      void refreshCollectionGate();
    }, OFFLINE_GATE_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enableCollectionGateCheck, refreshCollectionGate]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapCoreData = async () => {
      try {
        const userId = await getCurrentOfflineUserId();
        if (!userId || cancelled) {
          return;
        }

        if (await hasCoreData()) {
          return;
        }

        const online = await checkConnectivity();
        if (!online || cancelled) {
          return;
        }

        console.log('[SYNC] Core data missing — downloading after app launch');
        await refreshCoreDataFromServer({ logContext: 'AppLaunch' });
      } catch (error) {
        console.warn('[SYNC] Core data bootstrap failed:', error);
      }
    };

    void bootstrapCoreData();

    return () => {
      cancelled = true;
    };
  }, []);

  const performMandatoryOfflineSync = useCallback(
    async (force = false): Promise<MandatoryOfflineRefreshResult> => {
      const retryableCount = await getRetryableOfflineCollectionCount();

      if (!force && retryableCount === 0) {
        return {
          success: true,
          collectionsResult: { success: 0, failed: 0 },
          referenceSynced: false,
        };
      }

      if (isSyncing && !force) {
        return {
          success: false,
          collectionsResult: { success: 0, failed: 0 },
          referenceSynced: false,
          error: 'Sync already in progress',
        };
      }

      if (retryableCount === 0) {
        return {
          success: true,
          collectionsResult: { success: 0, failed: 0 },
          referenceSynced: false,
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

  const updateOnlineReferenceData = useCallback(async (): Promise<boolean> => {
    setIsUpdatingOnlineData(true);
    setSyncError(null);

    try {
      const online = await checkConnectivity();
      if (!online) {
        setSyncError('No internet connection');
        return false;
      }

      const ok = await refreshOfflineReferenceData();
      if (!ok) {
        setSyncError('Failed to update online data');
      }
      return ok;
    } catch (error: any) {
      setSyncError(error?.message || 'Failed to update online data');
      return false;
    } finally {
      setIsUpdatingOnlineData(false);
    }
  }, []);

  const triggerSync = useCallback(async (): Promise<{ success: number; failed: number }> => {
    enableCollectionGateCheck();
    const result = await performMandatoryOfflineSync(true);
    return result.collectionsResult;
  }, [enableCollectionGateCheck, performMandatoryOfflineSync]);

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
    isUpdatingOnlineData,
    setIsSyncing,
    setLastSyncResult,
    setLastSyncTime,
    setSyncError,
    setMandatorySyncError,
    triggerSync,
    performMandatoryOfflineSync,
    updateOnlineReferenceData,
    refreshCollectionGate,
    clearCollectionGate,
    enableCollectionGateCheck,
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
