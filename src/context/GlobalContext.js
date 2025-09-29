import React, { createContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import { Alert, BackHandler, StatusBar, AppState } from 'react-native';

export const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [rawDateTime, setRawDateTime] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [instance, setInstance] = useState('');
  const [departments, setDepartments] = useState('');
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
  const [shiftId, setShiftId] = useState(null);
  const [point, setPoint] = useState(null);
  const [deviceUID, setDeviceUID] = useState('');
  const [batteryLevel, setBatteryLevel] = useState('');
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [connectionType, setConnectionType] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [offlineEvents, setOfflineEvents] = useState(0);
  const [notificationSettings, setNotificationSettings] = useState({
    enabled: true,
    clockInTime: { hours: 8, minutes: 0 },
    clockOutTime: { hours: 16, minutes: 0 },
  });

  // Bluetooth connection settings
  const [bluetoothSettings, setBluetoothSettings] = useState({
    persistentConnection: false,
    autoReconnect: true,
  });

  // Scale connection state
  const [scaleConnectionState, setScaleConnectionState] = useState({
    isConnected: false,
    deviceName: '',
    deviceAddress: '',
    connectionStatus: 'disconnected', // 'disconnected', 'connecting', 'connected', 'connection_failed'
    lastConnected: null,
  });

  // Background sync refs to prevent multiple concurrent syncs
  const syncInProgress = useRef(false);
  const backgroundSyncInterval = useRef(null);
  const lookupSyncInterval = useRef(null);

  // Notification service initialization has been disabled to prevent crashes

  // Load notification settings with default values to prevent crashes
  const loadNotificationSettings = async () => {
    // Use default settings instead of loading from NotificationService
    const defaultSettings = {
      enabled: false,
      clockInTime: { hours: 8, minutes: 0 },
      clockOutTime: { hours: 16, minutes: 0 },
    };
    setNotificationSettings(defaultSettings);
  };

  // Notification methods have been disabled to prevent crashes

  // Update notification settings (disabled)
  const updateNotificationSettings = async newSettings => {
    // Skip calling NotificationService
    setNotificationSettings(newSettings);
    console.log('Notification settings update skipped');
  };

  // Enable/disable notifications (disabled)
  const toggleNotifications = async enabled => {
    // Skip calling NotificationService
    const updatedSettings = { ...notificationSettings, enabled };
    setNotificationSettings(updatedSettings);
    console.log('Toggle notifications skipped');
  };

  // Update clock-in time (disabled)
  const updateClockInTime = async (hours, minutes) => {
    // Skip calling NotificationService
    const updatedSettings = {
      ...notificationSettings,
      clockInTime: { hours, minutes },
    };
    setNotificationSettings(updatedSettings);
    console.log('Clock-in time update skipped');
  };

  // Update clock-out time (disabled)
  const updateClockOutTime = async (hours, minutes) => {
    // Skip calling NotificationService
    const updatedSettings = {
      ...notificationSettings,
      clockOutTime: { hours, minutes },
    };
    setNotificationSettings(updatedSettings);
    console.log('Clock-out time update skipped');
  };

  // Format time for display
  const formatTime = time => {
    // Simple time formatter instead of using NotificationService
    const { hours, minutes } = time;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
  };

  // Load Bluetooth settings from AsyncStorage
  const loadBluetoothSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('bluetoothSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setBluetoothSettings(parsedSettings);
        console.log('Loaded Bluetooth settings:', parsedSettings);
      } else {
        console.log('No saved Bluetooth settings found, using defaults');
      }
    } catch (error) {
      console.error('Error loading Bluetooth settings:', error);
    }
  };

  // Save Bluetooth settings to AsyncStorage
  const saveBluetoothSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('bluetoothSettings', JSON.stringify(newSettings));
      setBluetoothSettings(newSettings);
      console.log('Saved Bluetooth settings:', newSettings);
    } catch (error) {
      console.error('Error saving Bluetooth settings:', error);
    }
  };

  // Enable/disable persistent connection
  const setPersistentConnection = async (enabled) => {
    const updatedSettings = { ...bluetoothSettings, persistentConnection: enabled };
    await saveBluetoothSettings(updatedSettings);
  };

  // Enable/disable auto-reconnect
  const setAutoReconnect = async (enabled) => {
    const updatedSettings = { ...bluetoothSettings, autoReconnect: enabled };
    await saveBluetoothSettings(updatedSettings);
  };

  // Combined Bluetooth settings update
  const updateBluetoothSettings = async (newSettings) => {
    const updatedSettings = { ...bluetoothSettings, ...newSettings };
    await saveBluetoothSettings(updatedSettings);
  };

  // Background sync function (silent, no UI updates)
  const backgroundSyncData = async () => {
    if (!isConnected || syncInProgress.current || !instance) {
      return;
    }

    try {
      syncInProgress.current = true;
      console.log('Starting automatic background sync...');

      // Check if there are offline events to sync
      const offlineCount = Number(await AsyncStorage.getItem('offline-events-count')) || 0;
      if (offlineCount === 0) {
        console.log('No offline events to sync');
        return;
      }

      console.log('Automatic background sync completed successfully');
    } catch (error) {
      console.log('Background sync failed (will retry later):', error);
    } finally {
      syncInProgress.current = false;
    }
  };

  // Background lookup refresh (silent, runs less frequently)
  const backgroundSyncLookups = async () => {
    if (!isConnected || syncInProgress.current || !instance) {
      return;
    }

    // Ensure clientId is available, fetch from storage if needed
    let currentClientId = clientId;
    if (!currentClientId) {
      try {
        currentClientId = await AsyncStorage.getItem('clientId');
        if (currentClientId) {
          setClientId(currentClientId);
        } else {
          console.log('Background lookup sync skipped: No clientId available');
          return;
        }
      } catch (error) {
        console.log('Error fetching clientId from storage:', error);
        return;
      }
    }

    try {
      syncInProgress.current = true;
      console.log('Starting background lookup sync...');

      // Create dummy functions for silent operation
      const silentLoading = () => { };
      const silentHeading = () => { };
      const silentText = () => { };



      console.log('Background lookup sync completed successfully');
    } catch (error) {
      console.log('Background lookup sync failed (will retry later):', error);
    } finally {
      syncInProgress.current = false;
    }
  };

  // Manual sync function (with UI updates for user-triggered sync)
  const synchData = async (showLoader = true, setLoading = null, setLoaderHeading = null, setLoadingText = null) => {
    console.log("currentClientId ", clientId);
    console.log("currentDepartments ", departments);
    if (!isConnected) {
      console.log('Cannot sync: No internet connection');
      return;
    }

    if (syncInProgress.current) {
      console.log('Sync already in progress');
      return;
    }

    try {
      syncInProgress.current = true;
      console.log('Starting manual sync...');

      // Show loading UI only for manual sync
      if (showLoader && setLoading) {
        setLoading(true);
        if (setLoaderHeading) setLoaderHeading('Synchronizing Data');
        if (setLoadingText) setLoadingText('Starting synchronization...');
      }


      // Sync lookups/reference data for manual sync
      let currentClientId = clientId;
      let currentDepartments = departments;

      if (!currentClientId) {
        try {
          currentClientId = await AsyncStorage.getItem('clientId');
          if (currentClientId) {
            setClientId(currentClientId);
          }
        } catch (error) {
          console.log('Error fetching clientId from storage:', error);
        }
      }

      if (!currentDepartments) {
        try {
          const departmentString = await AsyncStorage.getItem('departments');
          if (departmentString) {
            currentDepartments = JSON.parse(departmentString);
            setDepartments(currentDepartments);
          }
        } catch (error) {
          console.log('Error fetching departments from storage:', error);
        }
      }

      if (currentClientId) {
        console.log('Manual sync: Starting lookup sync with clientId:', currentClientId);
        console.log('Manual sync: Departments available:', !!currentDepartments);
        console.log('Manual sync: Departments value:', currentDepartments);

        // Prepare departments parameter
        let departmentsParam = '';
        if (currentDepartments && Array.isArray(currentDepartments) && currentDepartments.length > 0) {
          departmentsParam = JSON.stringify(currentDepartments);
        } else if (currentDepartments && typeof currentDepartments === 'string' && currentDepartments !== '[]') {
          departmentsParam = currentDepartments;
        }
        console.log('Manual sync: Sending departments parameter:', departmentsParam);


      } else {
        console.log('Manual sync: Skipped lookup sync (no clientId available)');
      }

      console.log('Manual sync completed successfully');
    } catch (error) {
      console.error('Manual sync error:', error);
      throw error; // Re-throw to allow error handling in calling component
    } finally {
      syncInProgress.current = false;
      if (showLoader && setLoading) {
        setLoading(false);
      }
    }
  };

  // Fetch offline events count
  const fetchOfflineEventsCount = async () => {
    try {
      const count =
        Number(await AsyncStorage.getItem('offline-events-count')) || 0;
      setOfflineEvents(count);
    } catch (error) {
      console.log('Error fetching offline events count', error);
    }
  };

  useEffect(() => {
    fetchOfflineEventsCount();
  }, []);

  // Update functions
  const updateClientId = clientId => setClientId(clientId);
  const updateClientName = name => setClientName(name);
  const updateInstance = instanceId => setInstance(instanceId);
  const updateDepartments = departments => setDepartments(departments);
  const updateDeviceUid = deviceId => setDeviceUID(deviceId);
  const updateSite = siteObj => setSite(siteObj);
  const updatePoint = pointObj => setPoint(pointObj);
  const updateUser = userObj => setUser(userObj);
  const updateShiftId = shift => setShiftId(shift);

  // Scale connection update functions
  const updateScaleConnection = (connectionData) => {
    setScaleConnectionState(prev => ({
      ...prev,
      ...connectionData,
      lastConnected: connectionData.isConnected ? new Date().toISOString() : prev.lastConnected,
    }));
  };

  const updateScaleConnectionStatus = (status, message = '') => {
    console.log(`🔄 GlobalContext: Scale connection status updated to '${status}': ${message}`);
    setScaleConnectionState(prev => ({
      ...prev,
      connectionStatus: status,
      isConnected: status === 'connected',
    }));
  };

  const setScaleDevice = (deviceName, deviceAddress) => {
    console.log(`📡 GlobalContext: Scale device set to '${deviceName}' (${deviceAddress})`);
    setScaleConnectionState(prev => ({
      ...prev,
      deviceName: deviceName || '',
      deviceAddress: deviceAddress || '',
    }));
  };

  const resetScaleConnection = () => {
    console.log('🔌 GlobalContext: Scale connection reset');
    setScaleConnectionState({
      isConnected: false,
      deviceName: '',
      deviceAddress: '',
      connectionStatus: 'disconnected',
      lastConnected: null,
    });
  };

  // Retrieve stored clientName and instance
  useEffect(() => {
    const getStoredInfo = async () => {
      try {
        const instance_id = await AsyncStorage.getItem('instance');
        const departmentString = await AsyncStorage.getItem('departments');
        const client_id = await AsyncStorage.getItem('clientId');
        const client = await AsyncStorage.getItem('clientName');
        const userData = await AsyncStorage.getItem('user');
        const deviceId = await AsyncStorage.getItem('deviceUID');
        const siteData = await AsyncStorage.getItem('site');
        const pointData = await AsyncStorage.getItem('point');
        const shift = await AsyncStorage.getItem('shiftId');
        const parsedShiftId = parseInt(shift, 10);

        if (instance_id) setInstance(instance_id);
        if (departmentString) setDepartments(JSON.parse(departmentString));
        if (siteData) setSite(JSON.parse(siteData));
        if (pointData) setPoint(JSON.parse(pointData));
        if (deviceId) setDeviceUID(deviceId);
        if (client_id) setClientId(client_id);
        if (client) setClientName(client);
        if (parsedShiftId) setShiftId(parsedShiftId);

        if (userData) {
          const parsedUserData = JSON.parse(userData);
          setUser(parsedUserData);
        }

        // Load Bluetooth settings
        await loadBluetoothSettings();
      } catch (error) {
        console.log('Error retrieving stored data', error);
      }
    };
    getStoredInfo();
  }, []);

  // Subscribe to network state updates
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      handleNetworkChange(state);
    });
    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);

  const handleNetworkChange = state => {
    const wasConnected = isConnected;
    setIsConnected(state.isConnected);

    const connectionMap = {
      unknown: 'Unknown connection',
      none: 'No network connection',
      cellular: `Cellular (${state.details.cellularGeneration || 'generic'
        }) connection`,
      wifi: 'WiFi connection',
      ethernet: 'Ethernet connection',
      bluetooth: 'Bluetooth connection',
    };
    setConnectionType(connectionMap[state.type] || 'Unknown connection');

    // Trigger background sync when connectivity is restored
    if (!wasConnected && state.isConnected && instance) {
      console.log('Network connectivity restored, starting background sync...');
      setTimeout(() => {
        backgroundSyncData();
      }, 3000); // Wait 3 seconds after connectivity restoration

      // Also refresh lookups when connectivity is restored (longer delay)
      setTimeout(() => {
        backgroundSyncLookups();
      }, 10000); // Wait 10 seconds for lookup refresh
    }
  };

  // Set up 30-minute background sync interval
  useEffect(() => {
    // Clear any existing interval
    if (backgroundSyncInterval.current) {
      clearInterval(backgroundSyncInterval.current);
    }

    // Set up new interval for 30-minute background sync
    backgroundSyncInterval.current = setInterval(async () => {
      if (isConnected && instance) {
        const offlineCount = Number(await AsyncStorage.getItem('offline-events-count')) || 0;
        if (offlineCount > 0) {
          console.log('30-minute interval: Found offline records, starting background sync...');
          backgroundSyncData();
        } else {
          console.log('30-minute interval: No offline records to sync');
        }
      } else {
        console.log('30-minute interval: Skipped (offline or no instance)');
      }
    }, 30 * 60 * 1000); // 30 minutes in milliseconds

    return () => {
      if (backgroundSyncInterval.current) {
        clearInterval(backgroundSyncInterval.current);
      }
    };
  }, [isConnected, instance]);

  // Set up 2-hour lookup sync interval
  useEffect(() => {
    // Clear any existing lookup interval
    if (lookupSyncInterval.current) {
      clearInterval(lookupSyncInterval.current);
    }

    // Set up new interval for 2-hour lookup sync
    lookupSyncInterval.current = setInterval(async () => {
      if (isConnected && instance && departments) {
        // Check for clientId, fetch from storage if needed
        let currentClientId = clientId;
        if (!currentClientId) {
          try {
            currentClientId = await AsyncStorage.getItem('clientId');
            if (currentClientId) {
              setClientId(currentClientId);
            }
          } catch (error) {
            console.log('Error fetching clientId from storage for interval sync:', error);
          }
        }

        if (currentClientId) {
          console.log('2-hour interval: Starting background lookup sync...');
          backgroundSyncLookups();
        } else {
          console.log('2-hour interval: Skipped lookup sync (no clientId available)');
        }
      } else {
        console.log('2-hour interval: Skipped lookup sync (offline or missing parameters)');
      }
    }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds

    return () => {
      if (lookupSyncInterval.current) {
        clearInterval(lookupSyncInterval.current);
      }
    };
  }, [isConnected, instance, departments]); // Removed clientId dependency since we fetch it dynamically

  // Update the current date and time every second
  useEffect(() => {
    const updateDateTime = () => {
      // Get the current date and time
      const now = new Date();

      // Set rawDateTime as the current date and time in "DD/MM/YYYY HH:MM:SS" format
      const rawDateTime = now
        .toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
        .replace(',', ''); // Remove the comma after the date part
      setRawDateTime(rawDateTime); // Set rawDateTime as the current datetime

      // Get day of the week
      const dayOfWeek = now.toLocaleString('en-US', { weekday: 'long' });

      // Get day of the month with ordinal suffix (st, nd, rd, th)
      const day = now.getDate();
      const daySuffix =
        day === 1 || day === 21 || day === 31
          ? 'st'
          : day === 2 || day === 22
            ? 'nd'
            : day === 3 || day === 23
              ? 'rd'
              : 'th';

      // Get the full month name
      const month = now.toLocaleString('en-US', { month: 'long' });

      // Get full year
      const year = now.getFullYear();

      // Get the current time in 12-hour format with AM/PM
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      // Format the date as "Monday, 22nd October 2024, 12:08:51 PM"
      const formattedDateTime = `${dayOfWeek}, ${day}${daySuffix} ${month} ${year}, ${time}`;
      setCurrentDateTime(formattedDateTime);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []);

  // Update the battery status every 30 seconds instead of every second
  useEffect(() => {
    const updateBatteryStatus = () => {
      DeviceInfo.getPowerState()
        .then(state => {
          const newLevel = Math.round(state.batteryLevel * 100);
          setBatteryLevel(newLevel);
          setBatteryCharging(state.batteryState === 'charging');
        })
        .catch(error => {
          console.log('Error fetching battery status', error);
        });
    };
    updateBatteryStatus(); // Initial fetch
    const interval = setInterval(updateBatteryStatus, 30000); // Poll every 30 seconds
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        currentDateTime,
        rawDateTime,
        clientId,
        updateClientId,
        clientName,
        instance,
        departments,
        batteryLevel,
        batteryCharging,
        connectionType,
        isConnected,
        updateClientName,
        updateInstance,
        updateDepartments,
        deviceUID,
        updateDeviceUid,
        site,
        point,
        updateSite,
        updatePoint,
        user,
        updateUser,
        shiftId,
        updateShiftId,
        offlineEvents,
        fetchOfflineEventsCount,
        // Sync functions
        synchData,
        backgroundSyncData,
        backgroundSyncLookups,
        // Notification related values and methods
        notificationSettings,
        updateNotificationSettings,
        toggleNotifications,
        updateClockInTime,
        updateClockOutTime,
        formatTime,
        // Bluetooth settings and methods
        bluetoothSettings,
        loadBluetoothSettings,
        saveBluetoothSettings,
        setPersistentConnection,
        setAutoReconnect,
        updateBluetoothSettings,
        // Scale connection state and methods
        scaleConnectionState,
        updateScaleConnection,
        updateScaleConnectionStatus,
        setScaleDevice,
        resetScaleConnection,
      }}>
      {children}
    </GlobalContext.Provider>
  );
};

// Export fetchOfflineEventsCount function for standalone use
export const fetchOfflineEventsCount = async () => {
  try {
    const count =
      Number(await AsyncStorage.getItem('offline-events-count')) || 0;
    return count;
  } catch (error) {
    console.log('Error fetching offline events count', error);
    return 0;
  }
};
