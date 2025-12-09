import BluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class BluetoothScaleService {
  constructor() {
    this.connectedDevice = null;
    this.isScanning = false;
    this.statusCallback = null;
    this.weightCallback = null;
    this.devices = [];
    this.isConnected = false;
    this.dataBuffer = '';
    this.weightReadInterval = null;
    this.dataReadInterval = null; // For continuous data reading
    this.connectionStatusInterval = null; // For periodic connection status checks

    // Throttling for weight updates
    this.lastWeightUpdate = 0;
    this.weightUpdateInterval = 100; // Update UI every 100ms for responsive updates
    this.latestWeightData = null;
    this.burstModeActive = false;
    this.burstModeStartTime = 0;
    this.burstModeInterval = 50; // 50ms during burst mode

    // Weight streaming control
    this.isWeightStreamingPaused = false;
    this.pausedForWeightLock = false;

    // Connection persistence settings - will be loaded from global context
    this.persistentConnection = false; // Enable persistent connection
    this.autoReconnect = true; // Enable auto-reconnect when connection is lost

    // Event listener subscriptions for cleanup
    this.dataReceivedSubscription = null;
    this.disconnectedSubscription = null;

    // Manual disconnect tracking
    this.isManualDisconnect = false;

    // Manually approved scale devices (for devices not automatically detected)
    this.approvedScaleDevices = new Set(); // Store device addresses manually approved as scales
    this.latestAutoConnectWeight = null; // Store latest weight from auto-connect for potential use
    this.autoReconnect = false; // Enable auto-reconnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 seconds between reconnect attempts
    this.lastConnectedDeviceId = null; // Store last connected device for reconnection

    // Connection state tracking to prevent race conditions
    this.isConnecting = false; // Track if connection is in progress
    this.connectingToDeviceId = null; // Track which device we're connecting to
    this.connectionPromises = new Map(); // Store pending connection promises to avoid duplicates

    // Auto-connect state management
    this.isAutoConnecting = false; // Track if auto-connect is in progress
    this.suppressStatusCallbacks = false; // Suppress intermediate status callbacks during auto-connect

    // Virtual Bluetooth Scale for debugging (only in dev mode)
    this.isVirtualScaleMode = false;
    this.virtualScaleInterval = null;
    this.virtualWeight = 0.0;
    this.virtualWeightDirection = 1; // 1 for increasing, -1 for decreasing
    this.virtualScaleConnected = false;

    // Initialize Bluetooth Classic
    this.initializeBluetooth();

    // Global context update functions (will be set by components using the service)
    this.globalContextUpdaters = null;
  }

  // Set global context updaters for maintaining scale connection state
  setGlobalContextUpdaters(updaters) {
    this.globalContextUpdaters = updaters;
    console.log('🌐 BluetoothScaleService: Global context updaters set');
  }

  // Helper method to update both local status callback and global context
  updateConnectionStatus(status, message = '') {
    // Call local status callback if exists
    if (this.statusCallback && !this.suppressStatusCallbacks) {
      this.statusCallback(status, message);
    }

    // Update global context if available
    if (this.globalContextUpdaters) {
      const { updateScaleConnectionStatus, setScaleDevice } = this.globalContextUpdaters;

      if (updateScaleConnectionStatus) {
        updateScaleConnectionStatus(status, message);
      }

      // Update device info when connected
      if (status === 'connected' && this.connectedDevice) {
        if (setScaleDevice) {
          setScaleDevice(this.connectedDevice.name || 'Unknown Scale', this.connectedDevice?.address);
        }
      } else if (status === 'disconnected' && setScaleDevice) {
        // Clear device info on disconnect
        setScaleDevice('', '');
      }
    }
  }

  async initializeBluetooth() {
    try {
      console.log('Initializing Bluetooth Classic...');

      // Load approved scale devices from storage
      await this.loadApprovedDevices();

      // Check if BluetoothClassic module is available
      if (!BluetoothClassic) {
        console.error('BluetoothClassic module is not available');
        if (this.statusCallback) {
          this.statusCallback('bluetooth_error', 'Bluetooth module not available');
        }
        return;
      }

      // Request permissions on Android
      if (Platform.OS === 'android') {
        await this.requestBluetoothPermissions();
      }

      // Check if Bluetooth is enabled
      const isEnabled = await BluetoothClassic?.isBluetoothEnabled();
      console.log('Bluetooth enabled:', isEnabled);

      if (!isEnabled) {
        console.log('Bluetooth is not enabled, requesting to enable...');
        try {
          await BluetoothClassic.requestBluetoothEnabled();
          if (this.statusCallback) {
            this.statusCallback('bluetooth_enabled', 'Bluetooth enabled successfully');
          }
        } catch (error) {
          console.error('Failed to enable Bluetooth:', error);
          if (this.statusCallback) {
            this.statusCallback('bluetooth_error', 'Failed to enable Bluetooth');
          }
          return;
        }
      }

      // Set up global event listeners for data and connection events
      this.setupGlobalEventListeners();

      // Attempt auto-connect to bonded scale devices after a short delay
      // DISABLED: Auto-connect is messing with the flow
      // this.scheduleAutoConnect();

    } catch (error) {
      console.error('Error initializing Bluetooth:', error);
      if (this.statusCallback) {
        this.statusCallback('bluetooth_error', `Initialization error: ${error.message}`);
      }
    }
  }

  // Set up global event listeners for Bluetooth events
  setupGlobalEventListeners() {
    try {
      console.log('Setting up global event listeners...');

      // Don't setup listeners if they already exist
      if (this.dataReceivedSubscription || this.disconnectedSubscription) {
        console.log('Event listeners already exist, skipping setup');
        return;
      }

      // Check if BluetoothClassic has event methods
      console.log('BluetoothClassic available methods:', Object.getOwnPropertyNames(BluetoothClassic));

      // Try different event listener patterns for react-native-bluetooth-classic
      if (BluetoothClassic.onDataReceived) {
        BluetoothClassic.onDataReceived((device, data) => {
          console.log('Global data received from device:', device.address, 'Data:', JSON.stringify(data));
          if (this.connectedDevice && device.address === this.connectedDevice.address) {
            this.handleIncomingData(data);
          }
        });
      }

      if (BluetoothClassic.onDeviceDisconnected) {
        BluetoothClassic.onDeviceDisconnected((device) => {
          console.log('Global device disconnected:', device.address);
          if (this.connectedDevice && device.address === this.connectedDevice.address) {
            this.handleDisconnection();
          }
        });
      }

      // Alternative: Check for event emitter pattern
      if (BluetoothClassic.addListener) {
        this.dataReceivedSubscription = BluetoothClassic.addListener('bluetoothDataReceived', (event) => {
          console.log('Bluetooth data received event:', JSON.stringify(event));
          if (this.connectedDevice && event.device && event.device.address === this.connectedDevice.address) {
            this.handleIncomingData(event.data);
          }
        });

        this.disconnectedSubscription = BluetoothClassic.addListener('bluetoothDisconnected', (event) => {
          console.log('Bluetooth disconnected event:', JSON.stringify(event));
          if (this.connectedDevice && event.device && event.device.address === this.connectedDevice.address) {
            this.handleDisconnection();
          }
        });
      }

      console.log('Global Bluetooth event listeners setup attempted');
    } catch (error) {
      console.error('Error setting up global event listeners:', error);
      console.log('Will rely on polling method for data reading');
    }
  }

  async requestBluetoothPermissions() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);

        console.log('Bluetooth permissions granted:', granted);
        return Object.values(granted).every(permission =>
          permission === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (error) {
        console.error('Permission request error:', error);
        return false;
      }
    }
    return true;
  }

  // Set status update callback
  setStatusCallback(callback) {
    console.log('Setting status callback');
    this.statusCallback = callback;
  }

  // Set weight data callback
  setWeightCallback(callback) {
    // console.log('Setting weight callback');
    // Clear any existing callback to prevent duplicates
    this.weightCallback = null;
    this.weightCallback = callback;
  }

  // Clear weight callback
  clearWeightCallback() {
    // console.log('Clearing weight callback');
    this.weightCallback = null;
  }

  // Clear status callback
  clearStatusCallback() {
    // console.log('Clearing status callback');
    this.statusCallback = null;
  }

  // Start scanning for Bluetooth Classic devices (nearby devices + bonded devices)
  async startScanning(includeNearby = true) {
    try {
      console.log('Starting Bluetooth Classic scan...');

      // Check if BluetoothClassic module is available
      if (!BluetoothClassic) {
        console.error('BluetoothClassic module is not available');
        if (this.statusCallback) {
          this.statusCallback('scan_error', 'Bluetooth module not available');
        }
        return [];
      }

      this.isScanning = true;
      this.devices = [];

      if (this.statusCallback) {
        this.statusCallback('scanning', includeNearby ? 'Scanning for nearby devices...' : 'Scanning for bonded devices...');
      }

      // Get bonded (paired) devices first - these are reliable and fast
      const bondedDevices = await BluetoothClassic.getBondedDevices();
      console.log('Bonded devices:', bondedDevices);

      // Add bonded devices to our list
      bondedDevices.forEach(device => {
        this.devices.push({
          id: device.address,
          name: device.name || 'Unknown Device',
          address: device.address,
          rssi: 0, // Not available for bonded devices
          isPaired: true,
          device: device
        });
      });

      // If includeNearby is true, also discover nearby unpaired devices
      if (includeNearby) {
        try {
          console.log('Starting device discovery for nearby devices...');

          // Start discovery for nearby devices
          const discoveredDevices = await BluetoothClassic.startDiscovery();
          console.log('Discovered nearby devices:', discoveredDevices);

          // Add discovered devices that aren't already in our bonded list
          discoveredDevices.forEach(device => {
            // Check if device is already in bonded list
            const alreadyExists = this.devices.some(existing => existing.address === device.address);

            if (!alreadyExists) {
              this.devices.push({
                id: device.address,
                name: device.name || 'Unknown Device',
                address: device.address,
                rssi: device.rssi || -50, // Use provided RSSI or default
                isPaired: false,
                device: device
              });
            } else {
              // Update RSSI for bonded devices if available
              const existingIndex = this.devices.findIndex(existing => existing.address === device.address);
              if (existingIndex !== -1 && device.rssi) {
                this.devices[existingIndex].rssi = device.rssi;
              }
            }
          });
        } catch (discoveryError) {
          console.log('Discovery failed, continuing with bonded devices only:', discoveryError.message);
          // Don't fail completely, just continue with bonded devices
        }
      }

      // Sort devices by RSSI (signal strength) - stronger signal first
      this.devices.sort((a, b) => {
        // Paired devices get priority
        if (a.isPaired && !b.isPaired) return -1;
        if (!a.isPaired && b.isPaired) return 1;

        // Then sort by signal strength (higher RSSI = stronger signal = closer)
        return (b.rssi || -100) - (a.rssi || -100);
      });

      console.log('Total devices found:', this.devices.length, '(bonded:', bondedDevices.length, 'nearby:', this.devices.length - bondedDevices.length, ')');
      this.isScanning = false;

      if (this.statusCallback) {
        this.statusCallback('scan_complete', `Found ${this.devices.length} devices`);
      }

      return this.devices;

    } catch (error) {
      console.error('Error scanning for devices:', error);
      this.isScanning = false;

      if (this.statusCallback) {
        this.statusCallback('scan_error', `Scan failed: ${error.message}`);
      }

      return [];
    }
  }

  // Stop scanning
  async stopScanning() {
    console.log('Stopping scan...');
    this.isScanning = false;

    try {
      // Cancel device discovery if it's running
      if (BluetoothClassic && typeof BluetoothClassic.cancelDiscovery === 'function') {
        await BluetoothClassic.cancelDiscovery();
        console.log('Device discovery cancelled');
      }
    } catch (error) {
      console.log('Error stopping discovery:', error.message);
      // Don't throw error, just log it
    }
  }

  // Get available scale devices from nearby devices (includes both bonded and discovered devices)
  async getAvailableScales(showAll = false, includeNearby = true) {
    const allDevices = await this.startScanning(includeNearby);

    if (showAll) {
      console.log('Returning all devices (debug mode)');
      return {
        scaleDevices: allDevices,
        allDevices: allDevices
      };
    }

    // Filter devices that might be scales
    const filteredDevices = this.filterScaleDevices(allDevices);

    console.log(`Filtered scale devices: ${filteredDevices.length} of ${allDevices.length} total devices`);

    return {
      scaleDevices: filteredDevices,
      allDevices: allDevices
    };
  }

  // Filter devices that are likely to be scales
  filterScaleDevices(devices) {
    const scaleKeywords = [
      'scale', 'weight', 'balance', 'gram', 'kg', 'lb',
      'digital', 'precision', 'measure', 'weigh',
      'hc-05', 'hc-06', 'hc05', 'hc06',  // Common Bluetooth modules used in scales
      'esp32', 'arduino', 'at-', 'linvor',
      'jdy', 'zs-040'  // Other common modules used in scales
    ];

    return devices.filter(device => {
      const deviceName = (device.name || '').toLowerCase();
      const deviceAddress = (device.address || '').toLowerCase();

      // Check if device name contains scale-related keywords
      const nameMatch = scaleKeywords.some(keyword =>
        deviceName.includes(keyword)
      );

      // Check for HC-05/HC-06 pattern in address or name (common in scales)
      const hcModulePattern = /^(hc-?05|hc-?06)/i;
      const addressMatch = hcModulePattern.test(deviceAddress) || hcModulePattern.test(deviceName);

      // Include devices with specific address patterns common in scale modules
      const commonScalePatterns = [
        /^00:18:/,  // Common HC-05 prefix
        /^00:20:/,  // Common HC-06 prefix  
        /^20:15:/,  // Another common pattern
        /^98:D3:/,  // ESP32 common pattern
        /^00:23:/,  // Another HC-06 pattern (like the user's 00:23:04:00:23:7B)
      ];

      const patternMatch = commonScalePatterns.some(pattern =>
        pattern.test(deviceAddress)
      );

      // For unnamed devices, only include if they match known scale address patterns
      // This is more restrictive than before - unnamed devices need to match a pattern
      const unnamedWithScalePattern = (!device.name || device.name.trim() === '' ||
        device.name.includes('Unknown') ||
        device.name.includes('N/A')) && patternMatch;

      // Check if device is manually approved as scale
      const manuallyApproved = this.isApprovedScale(device.address);

      const shouldInclude = nameMatch || addressMatch || unnamedWithScalePattern || manuallyApproved;

      if (shouldInclude) {
        const reasons = [];
        if (nameMatch) reasons.push('Name');
        if (addressMatch) reasons.push('HC-Module');
        if (unnamedWithScalePattern) reasons.push('Pattern');
        if (manuallyApproved) reasons.push('Manual');
        console.log(`✅ Including scale device: ${device.name || 'Unnamed'} (${device.address}) - ${reasons.join(', ')}`);
      } else {
        console.log(`❌ Excluding non-scale device: ${device.name || 'Unnamed'} (${device.address})`);
      }

      return shouldInclude;
    });
  }

  // Connect to a specific device
  async connectToDevice(deviceId) {
    try {
      // Check if we're already connecting to this device
      if (this.isConnecting && this.connectingToDeviceId === deviceId) {
        console.log(`⏳ Already connecting to device ${deviceId}, returning existing promise`);
        // Return the existing promise to avoid duplicate connections
        if (this.connectionPromises.has(deviceId)) {
          return await this.connectionPromises.get(deviceId);
        }
      }

      // Check if we're already connecting to a different device
      if (this.isConnecting && this.connectingToDeviceId !== deviceId) {
        console.log(`⏸️ Already connecting to ${this.connectingToDeviceId}, canceling connection to ${deviceId}`);
        throw new Error(`Already connecting to device ${this.connectingToDeviceId}. Please wait for current connection to complete.`);
      }

      // Mark that we're starting a connection attempt
      this.isConnecting = true;
      this.connectingToDeviceId = deviceId;

      // Create and store the connection promise
      const connectionPromise = this._performConnection(deviceId);
      this.connectionPromises.set(deviceId, connectionPromise);

      try {
        const result = await connectionPromise;
        return result;
      } finally {
        // Clean up connection state
        this.isConnecting = false;
        this.connectingToDeviceId = null;
        this.connectionPromises.delete(deviceId);
      }

    } catch (error) {
      // Clean up connection state on error
      this.isConnecting = false;
      this.connectingToDeviceId = null;
      this.connectionPromises.delete(deviceId);
      throw error;
    }
  }

  // Internal method that performs the actual connection
  async _performConnection(deviceId) {
    try {
      console.log('Connecting to Bluetooth Classic device:', deviceId);

      if (this.statusCallback && !this.suppressStatusCallbacks) {
        this.statusCallback('connecting', 'Connecting to device...');
      }

      // Disconnect any existing connection
      if (this.isConnected && this.connectedDevice) {
        await this.disconnect();
      }

      // Find the device object
      const device = this.devices.find(d => d.address === deviceId);
      if (!device) {
        throw new Error('Device not found in scanned devices');
      }

      // Connect to the device
      const connectedDevice = await BluetoothClassic.connectToDevice(deviceId);

      this.connectedDevice = connectedDevice;
      this.isConnected = true;
      this.lastConnectedDeviceId = deviceId; // Store for reconnection
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      // Reset manual disconnect flag since we're connecting again
      this.isManualDisconnect = false;

      console.log('Successfully connected to device:', deviceId);
      console.log('Connected device object:', connectedDevice);

      // Re-establish global event listeners if they were removed
      this.setupGlobalEventListeners();

      // Set up data listeners
      this.setupDataListeners(connectedDevice);

      if (this.statusCallback) {
        console.log('🟢 BluetoothScaleService: Calling status callback with CONNECTED');
      }

      // Update connection status in both local callback and global context
      this.updateConnectionStatus('connected', 'Successfully connected to scale');

      // Setup default weight callback for manual connections too
      this.setupDefaultWeightCallbackIfNeeded();

      // Start connection monitoring with persistence
      this.startConnectionStatusCheck();

      // Don't start the old weight reading interval since we have continuous data reading now

      return true;

    } catch (error) {
      console.error('Error connecting to device:', error);
      this.isConnected = false;
      this.connectedDevice = null;

      if (this.statusCallback && !this.suppressStatusCallbacks) {
        console.log('🔴 BluetoothScaleService: Calling status callback with CONNECTION_FAILED:', error.message);
        this.statusCallback('connection_failed', `Connection failed: ${error.message}`);
      } else if (this.suppressStatusCallbacks) {
        console.log('🔇 BluetoothScaleService: Suppressed CONNECTION_FAILED status callback during auto-connect');
      }

      return false;
    }
  }

  // Handle incoming data from global event listeners
  handleIncomingData(data) {
    // Guard: Don't process data if we shouldn't be listening
    if (!this.isConnected || !this.weightCallback) {
      console.log('Ignoring data - not connected or no weight callback:', { isConnected: this.isConnected, hasCallback: !!this.weightCallback });
      return;
    }

    // If we receive data, we must be connected. Let's ensure the state reflects that.
    if (!this.isConnected && this.connectedDevice) {
      console.log('Data received while in disconnected state. Forcing state to connected.');
      this.isConnected = true;
      if (this.statusCallback) {
        this.statusCallback('connected', 'Connection re-established by data stream.');
      }

      // Setup default weight callback when re-establishing connection
      this.setupDefaultWeightCallbackIfNeeded();
    }

    // console.log('Raw data from scale (stringified):', JSON.stringify(data, null, 2));
    // console.log('Raw data type:', typeof data);

    // Append to buffer
    this.dataBuffer += data;

    // Process complete lines (assuming data ends with \n or \r\n)
    const lines = this.dataBuffer.split(/[\r\n]+/);

    // Keep the last incomplete line in buffer
    this.dataBuffer = lines.pop() || '';

    // Process each complete line
    lines.forEach(line => {
      if (line.trim()) {
        this.parseWeightData(line.trim());
      }
    });
  }

  // Handle disconnection from global event listeners
  handleDisconnection() {
    console.log('Device disconnected via global event');

    const wasConnected = this.isConnected;

    this.connectedDevice = null;
    this.isConnected = false;

    // Clear intervals
    if (this.weightReadInterval) {
      clearInterval(this.weightReadInterval);
      this.weightReadInterval = null;
    }
    if (this.dataReadInterval) {
      clearInterval(this.dataReadInterval);
      this.dataReadInterval = null;
    }
    if (this.connectionStatusInterval) {
      clearInterval(this.connectionStatusInterval);
      this.connectionStatusInterval = null;
    }

    if (this.statusCallback) {
      this.statusCallback('device_disconnected', 'Scale disconnected');
    }

    // Handle persistent connection and auto-reconnect
    if (this.persistentConnection && wasConnected && !this.isManualDisconnect) {
      console.log('🔗 Persistent connection enabled, handling disconnection...');

      if (this.autoReconnect) {
        console.log('🔄 Auto-reconnect enabled, scheduling reconnection...');
        // Schedule reconnection attempt after a short delay
        setTimeout(() => {
          this.attemptReconnection();
        }, this.reconnectDelay);
      } else {
        console.log('🔗 Persistent connection enabled but auto-reconnect disabled');
        if (this.statusCallback) {
          this.statusCallback('connection_lost', 'Connection lost - persistent mode active');
        }
      }
    } else if (this.isManualDisconnect) {
      console.log('🛑 Manual disconnect detected - skipping auto-reconnect');
    }
  }

  // Start periodic connection status check
  startConnectionStatusCheck() {
    if (this.connectionStatusInterval) {
      clearInterval(this.connectionStatusInterval);
    }

    // Only do lightweight connection monitoring in persistent mode
    const checkInterval = this.persistentConnection ? 5000 : 2000; // 5s for persistent, 2s for normal

    this.connectionStatusInterval = setInterval(async () => {
      if (this.connectedDevice) {
        try {
          const isConnected = await this.connectedDevice.isConnected();
          if (isConnected && !this.isConnected) {
            // Device is connected but our status shows disconnected - update status
            console.log('🔄 Connection status sync: Device is connected, updating status');
            this.isConnected = true;
            this.reconnectAttempts = 0; // Reset reconnect attempts
            if (this.statusCallback) {
              this.statusCallback('connected', 'Scale connection restored');
            }

            // Setup default weight callback when connection is restored
            this.setupDefaultWeightCallbackIfNeeded();
          } else if (!isConnected && this.isConnected) {
            // Device is disconnected but our status shows connected
            console.log('🔄 Connection status sync: Device is disconnected');

            if (this.persistentConnection) {
              // In persistent mode, don't immediately trigger disconnection
              // Just update status and let auto-reconnect handle it
              console.log('� Persistent mode: Connection lost, will attempt reconnection');
              this.isConnected = false;
              this.connectedDevice = null;

              if (this.autoReconnect) {
                this.attemptReconnection();
              } else if (this.statusCallback) {
                this.statusCallback('connection_lost', 'Connection lost - reconnect manually');
              }
            } else {
              // Normal mode: trigger full disconnection handler
              this.handleDisconnection();
            }
          }
        } catch (error) {
          console.log('Connection status check failed:', error.message);

          // If we can't check status and we're in persistent mode, assume disconnection
          if (this.persistentConnection && this.isConnected) {
            console.log('🔗 Persistent mode: Status check failed, assuming disconnection');
            this.isConnected = false;
            this.connectedDevice = null;

            if (this.autoReconnect) {
              this.attemptReconnection();
            }
          }
        }
      }
    }, checkInterval);
  }

  // Set up data listeners for the connected device
  setupDataListeners(device) {
    console.log('Setting up data listeners for device:', device.address);

    try {
      // Global event listeners are already set up in initializeBluetooth
      // Just start the backup polling method
      this.startDataReading();

    } catch (error) {
      console.error('Error setting up data listeners:', error);
      if (this.statusCallback) {
        this.statusCallback('device_error', `Failed to setup data listeners: ${error.message}`);
      }
    }
  }

  // Start continuous data reading
  startDataReading() {
    if (this.dataReadInterval) {
      clearInterval(this.dataReadInterval);
    }

    // Start in burst mode for first 10 seconds to get initial readings quickly
    this.burstModeActive = true;
    this.burstModeStartTime = Date.now();

    this.dataReadInterval = setInterval(async () => {
      if (this.isConnected && this.connectedDevice) {
        try {
          // Check if device is still connected
          const isConnected = await this.connectedDevice.isConnected();
          if (!isConnected) {
            console.log('Device disconnected during read');
            this.handleDisconnection();
            return;
          }

          // Try to read available data
          const available = await this.connectedDevice.available();
          if (available > 0) {
            const data = await this.connectedDevice.read();
            if (data) {
              console.log('Read data from scale:', JSON.stringify(data));
              this.handleIncomingData(data);
            }
          }

          // Check if we should exit burst mode
          if (this.burstModeActive && (Date.now() - this.burstModeStartTime) > 10000) {
            // console.log('🔄 Exiting burst mode, switching to normal polling frequency');
            this.burstModeActive = false;
            // Restart with normal frequency
            this.startDataReading();
            return;
          }
        } catch (error) {
          console.log('Error reading data:', error);
          // Don't handle as disconnection unless it's a connection error
          if (error.message && error.message.includes('disconnected')) {
            this.handleDisconnection();
          }
        }
      }
    }, this.burstModeActive ? 25 : 50); // 25ms in burst mode, 50ms normal (was 100ms)
  }

  // Connect to scale (alias for connectToDevice - expected by modal)
  async connectToScale(deviceId) {
    return await this.connectToDevice(deviceId);
  }

  // Auto-connect to the first available scale device
  // DISABLED: Auto-connect is messing with the flow
  /*
  async autoConnectToScale() {
    try {
      console.log('🔍 Auto-connecting to scale...');
      
      // Set flag to suppress intermediate connection status callbacks
      this.suppressStatusCallbacks = true;
      this.isAutoConnecting = true;
      
      // First, try to reconnect to the last successfully connected device if available
      if (this.lastConnectedDeviceId) {
        console.log('🔄 Attempting to reconnect to last device:', this.lastConnectedDeviceId);
        try {
          const success = await this.connectToDevice(this.lastConnectedDeviceId);
          if (success) {
            console.log('✅ Successfully reconnected to last device');
            // Re-enable status callbacks and notify success
            this.suppressStatusCallbacks = false;
            this.isAutoConnecting = false;
            
            // Set up a basic weight callback if none exists (for auto-connect scenarios)
            this.setupDefaultWeightCallbackIfNeeded();
            
            if (this.statusCallback) {
              this.statusCallback('connected', 'Auto-connected to scale');
            }
            return { address: this.lastConnectedDeviceId, name: 'Last Connected Device', reconnected: true };
          }
        } catch (error) {
          console.log('❌ Failed to reconnect to last device:', error.message);
        }
      }
      
      // If last device reconnection failed, scan for available scales
      console.log('🔍 Scanning for available scale devices...');
      const result = await this.getAvailableScales();
      const scaleDevices = result.scaleDevices || [];
      const allDevices = result.allDevices || [];
      
      if (scaleDevices.length === 0 && allDevices.length === 0) {
        throw new Error('No scale devices found');
      }
      
      // Create a prioritized list of devices to try
      const devicesToTry = [];
      
      // Priority 1: Bonded scale devices (most reliable)
      const bondedScales = scaleDevices.filter(device => device.isPaired);
      devicesToTry.push(...bondedScales);
      console.log(`📱 Found ${bondedScales.length} bonded scale devices`);
      
      // Priority 2: Other scale devices (detected as scales but not bonded)
      const unbondedScales = scaleDevices.filter(device => !device.isPaired);
      devicesToTry.push(...unbondedScales);
      console.log(`🔍 Found ${unbondedScales.length} unbonded scale devices`);
      
      console.log(`📊 Total scale devices to try: ${devicesToTry.length} (${bondedScales.length} bonded + ${unbondedScales.length} unbonded)`);
      
      if (devicesToTry.length === 0) {
        throw new Error('No weighing scale devices found for auto-connect');
      }
      
      // Try to connect to scale devices in priority order
      for (let i = 0; i < devicesToTry.length; i++) {
        const device = devicesToTry[i];
        console.log(`🔌 Attempting to connect to device ${i + 1}/${devicesToTry.length}: ${device.name} (${device.address})`);
        
        try {
          const success = await this.connectToDevice(device.address);
          if (success) {
            console.log(`✅ Successfully connected to ${device.name}`);
            // Re-enable status callbacks and notify success
            this.suppressStatusCallbacks = false;
            this.isAutoConnecting = false;
            
            // Set up a basic weight callback if none exists (for auto-connect scenarios)
            this.setupDefaultWeightCallbackIfNeeded();
            
            if (this.statusCallback) {
              this.statusCallback('connected', 'Auto-connected to scale');
            }
            return device;
          }
        } catch (error) {
          console.log(`❌ Failed to connect to ${device.name}: ${error.message}`);
          // Continue to next device
        }
      }
      
      throw new Error(`Failed to connect to any of ${devicesToTry.length} available devices`);
      
    } catch (error) {
      console.error('🚫 Auto-connect failed:', error);
      // Re-enable status callbacks and notify failure
      this.suppressStatusCallbacks = false;
      this.isAutoConnecting = false;
      if (this.statusCallback) {
        this.statusCallback('connection_failed', 'Auto-connect failed - no scales available');
      }
      throw error;
    }
  }
  */

  // Schedule an auto-connect attempt after service initialization
  // DISABLED: Auto-connect is messing with the flow
  /*
  scheduleAutoConnect() {
    // Wait a bit to ensure Bluetooth is fully initialized
    setTimeout(async () => {
      try {
        console.log('🚀 Attempting automatic connection to bonded scales...');
        
        // Only attempt if not already connected or connecting
        if (this.isConnected) {
          console.log('✅ Already connected, skipping auto-connect');
          return;
        }
        
        if (this.isConnecting) {
          console.log('⏳ Connection already in progress, skipping auto-connect');
          return;
        }
        
        // Try auto-connect silently (don't show errors to user)
        await this.autoConnectToScale();
        console.log('🎉 Auto-connect successful!');
        
        // If successful, enable persistent connection for seamless experience
        this.enablePersistentConnection(true);
        
      } catch (error) {
        // Silently fail - user can manually connect if needed
        console.log('💡 Auto-connect failed, user will need to connect manually:', error.message);
        
        // Set status to disconnected so user knows they need to connect
        if (this.statusCallback) {
          this.statusCallback('disconnected', 'No bonded scale found - tap to connect');
        }
      }
    }, 2000); // 2 second delay to ensure Bluetooth is ready
  }
  */

  // Quick connect method for UI - attempts auto-connect with user feedback
  async quickConnect() {
    try {
      console.log('🎯 Quick connect requested by user...');

      if (this.isConnected) {
        return { success: true, message: 'Already connected', device: this.connectedDevice };
      }

      if (this.isConnecting) {
        return {
          success: false,
          message: 'Connection already in progress. Please wait for current connection to complete.',
          suggestions: ['Wait for the current connection to finish', 'Try again in a few seconds']
        };
      }

      // Update status to show we're attempting connection
      if (this.statusCallback) {
        this.statusCallback('connecting', 'Searching for bonded scales...');
      }

      const connectedDevice = await this.autoConnectToScale();

      // Enable persistent connection for better experience
      this.enablePersistentConnection(true);

      return {
        success: true,
        message: `Connected to ${connectedDevice.name}`,
        device: connectedDevice,
        reconnected: connectedDevice.reconnected || false
      };

    } catch (error) {
      console.error('Quick connect failed:', error);

      // Update status to show failure
      if (this.statusCallback) {
        this.statusCallback('disconnected', 'Connection failed - tap to browse devices');
      }

      return {
        success: false,
        message: error.message,
        suggestions: [
          'Make sure your Bluetooth scale is powered on',
          'Ensure the scale is paired with this device',
          'Try moving closer to the scale',
          'Browse available devices manually'
        ]
      };
    }
  }

  // Start periodic weight reading
  startWeightReading() {
    // console.log('Starting weight reading...');

    // Clear any existing interval
    if (this.weightReadInterval) {
      clearInterval(this.weightReadInterval);
    }

    // Request weight data every 500ms (was 1000ms)
    this.weightReadInterval = setInterval(async () => {
      if (this.isConnected && this.connectedDevice) {
        try {
          // Send weight request command (common commands for scales)
          await this.connectedDevice.write('W\r\n');  // Request weight
          // Alternative commands: 'WEIGHT\r\n', 'GET\r\n', 'READ\r\n'
        } catch (error) {
          // console.log('Error requesting weight data:', error);
        }
      }
    }, 500); // Was 1000ms, now 500ms for more frequent requests
  }

  // Parse weight data from the scale
  parseWeightData(data) {
    // console.log('Parsing weight data:', JSON.stringify(data));

    try {
      // Common weight data formats:
      // "WEIGHT: 1.23 KG"
      // "1.23 kg"
      // "1230 g"
      // "W 1.23"
      // "123.4"
      // "ST,GS,    0.00KG\r" (your scale format)

      let weight = null;
      let unit = 'kg';

      // Handle your specific scale format: ST,GS,    0.00KG
      if (data.includes('ST,GS,')) {
        // Extract the weight part after ST,GS,
        const weightPart = data.replace(/^ST,GS,\s*/, '').trim();
        // console.log('Extracted weight part:', JSON.stringify(weightPart));

        // Match weight and unit from the extracted part
        const scaleMatch = weightPart.match(/([+-]?\d*\.?\d+)\s*(kg|g|lb|oz)?/i);
        // console.log('Scale match result:', scaleMatch);

        if (scaleMatch) {
          weight = parseFloat(scaleMatch[1]);
          unit = (scaleMatch[2] || 'kg').toLowerCase();
          // console.log('Parsed weight:', weight, 'unit:', unit);
        }
      } else {
        // Remove common prefixes for other formats
        let cleanData = data.replace(/^(WEIGHT:|W\s+|SCALE:|S\s+)/i, '').trim();

        // Extract number and unit
        const weightMatch = cleanData.match(/([+-]?\d*\.?\d+)\s*(kg|g|lb|oz|gram|kilogram|pound|ounce)?/i);

        if (weightMatch) {
          weight = parseFloat(weightMatch[1]);
          const extractedUnit = weightMatch[2];

          if (extractedUnit) {
            unit = extractedUnit.toLowerCase();
          }
        }
      }

      if (weight !== null && !isNaN(weight)) {
        // Normalize units
        if (unit.includes('gram') || unit === 'g') {
          unit = 'g';
        } else if (unit.includes('kilogram') || unit === 'kg') {
          unit = 'kg';
        } else if (unit.includes('pound') || unit === 'lb') {
          unit = 'lb';
        } else if (unit.includes('ounce') || unit === 'oz') {
          unit = 'oz';
        }

        // Convert grams to kg if needed
        if (unit === 'g' && weight > 0) {
          weight = weight / 1000;
          unit = 'kg';
        }

        const weightData = {
          weight: weight,
          unit: unit,
          timestamp: new Date().toISOString(),
          raw: data,
          // For gross weight input - just the numeric value without unit
          numericValue: weight
        };

        // console.log('✅ Successfully parsed weight data:', JSON.stringify(weightData, null, 2));

        // Store the latest weight data
        this.latestWeightData = weightData;
        this.lastWeightData = weightData;

        // Dynamic throttling: burst mode for first 10 seconds, then normal
        const currentUpdateInterval = this.burstModeActive ? this.burstModeInterval : this.weightUpdateInterval;

        // Throttle weight callback updates to prevent UI crashes
        const now = Date.now();
        if (now - this.lastWeightUpdate >= currentUpdateInterval) {
          // Check if weight streaming is paused (e.g., during weight lock)
          if (this.isWeightStreamingPaused || this.strictWeightLockMode) {
            // console.log('⏸️ Weight streaming paused, skipping callback');
            return;
          }

          if (this.weightCallback && weight !== null) {
            // Prepare weight data object for callback
            const weightDataForCallback = {
              ...weightData,
              value: weight, // Just the number for input field
              displayValue: `${weight} ${unit}` // Formatted value for display
            };

            // Debug: Log exactly what we're sending to the UI
            // console.log('=== BLUETOOTH SERVICE CALLBACK DEBUG ===');
            // console.log('Sending weight data to UI:', JSON.stringify(weightDataForCallback, null, 2));
            // console.log('Weight value being sent:', weight);
            // console.log('Weight type:', typeof weight);
            // console.log('Timestamp:', new Date().toISOString());
            // console.log('=== END BLUETOOTH SERVICE CALLBACK DEBUG ===');

            // Pass weight data to the callback
            this.weightCallback(weightDataForCallback);
          }
          this.lastWeightUpdate = now;
          const mode = this.burstModeActive ? 'BURST' : 'NORMAL';
          // console.log(`📊 Weight data sent to UI (${mode} mode):`, weight);
        } else {
          // console.log('⏳ Weight update throttled, skipping UI update');
        }
      } else {
        // console.log('❌ Could not parse weight from data:', JSON.stringify(data));
        // console.log('Weight value:', weight, 'isNaN:', isNaN(weight));
      }

    } catch (error) {
      console.error('Error parsing weight data:', error);
    }
  }

  // Get the last weight reading
  getLastWeight() {
    return this.lastWeightData;
  }

  // Get the latest weight data (most recent, may not have been sent to UI due to throttling)
  getLatestWeight() {
    return this.latestWeightData;
  }

  // Force immediate weight update (bypasses throttling)
  forceWeightUpdate() {
    if (this.latestWeightData && this.weightCallback) {
      const weight = this.latestWeightData.weight;
      this.weightCallback({
        ...this.latestWeightData,
        value: weight, // Just the number for input field
        displayValue: `${weight} ${this.latestWeightData.unit}` // Formatted value for display
      });
      this.lastWeightUpdate = Date.now();
      // console.log('🔄 Forced weight update:', weight);
      return true;
    }
    return false;
  }

  // Set weight update interval (in milliseconds)
  setWeightUpdateInterval(intervalMs) {
    this.weightUpdateInterval = Math.max(50, intervalMs); // Minimum 50ms (was 500ms)
    // console.log('⏱️ Weight update interval set to:', this.weightUpdateInterval, 'ms');
  }

  // Enable burst mode for faster initial readings
  enableBurstMode(durationMs = 10000) {
    this.burstModeActive = true;
    this.burstModeStartTime = Date.now();
    // console.log('🚀 Burst mode enabled for', durationMs, 'ms');

    // Auto-disable after duration
    setTimeout(() => {
      if (this.burstModeActive) {
        this.burstModeActive = false;
        // console.log('🔄 Burst mode auto-disabled');
      }
    }, durationMs);
  }

  // Disable burst mode
  disableBurstMode() {
    this.burstModeActive = false;
    console.log('⏹️ Burst mode disabled');
  }

  // Handle disconnection
  handleDisconnection() {
    console.log('Device disconnected');
    this.isConnected = false;
    this.connectedDevice = null;

    // Clear intervals
    if (this.weightReadInterval) {
      clearInterval(this.weightReadInterval);
      this.weightReadInterval = null;
    }

    if (this.dataReadInterval) {
      clearInterval(this.dataReadInterval);
      this.dataReadInterval = null;
    }

    if (this.connectionStatusInterval) {
      clearInterval(this.connectionStatusInterval);
      this.connectionStatusInterval = null;
    }

    // Reset throttling variables
    this.lastWeightUpdate = 0;
    this.latestWeightData = null;
    this.burstModeActive = false;

    // Update connection status in both local callback and global context
    this.updateConnectionStatus('disconnected', 'Device disconnected');
  }

  // Disconnect from device
  async disconnect(force = false) {
    try {
      console.log('Disconnecting from device... (force:', force, ', persistent:', this.persistentConnection, ')');

      // If persistent connection is enabled and this is not a forced disconnect, just pause
      if (this.persistentConnection && !force) {
        console.log('🔗 Persistent connection enabled - pausing connection instead of disconnecting');

        // Stop data streaming but keep the connection
        if (this.dataReadInterval) {
          clearInterval(this.dataReadInterval);
          this.dataReadInterval = null;
        }

        // Clear weight callback to stop weight listening
        this.weightCallback = null;

        // Keep connection monitoring active
        if (this.statusCallback) {
          this.statusCallback('paused', 'Connection paused - scale remains connected');
        }

        return;
      }

      // If this is a forced disconnect (manual), disable persistent connection to prevent auto-reconnect
      if (force) {
        console.log('🛑 Manual disconnect - setting flag to prevent auto-reconnect');
        this.isManualDisconnect = true;
      }

      // Clear intervals
      if (this.weightReadInterval) {
        clearInterval(this.weightReadInterval);
        this.weightReadInterval = null;
      }

      if (this.dataReadInterval) {
        clearInterval(this.dataReadInterval);
        this.dataReadInterval = null;
      }

      if (this.connectionStatusInterval) {
        clearInterval(this.connectionStatusInterval);
        this.connectionStatusInterval = null;
      }

      // Clear weight callback to stop weight listening
      this.weightCallback = null;

      // Remove global event listeners to stop data processing
      if (this.dataReceivedSubscription) {
        this.dataReceivedSubscription.remove();
        this.dataReceivedSubscription = null;
      }
      if (this.disconnectedSubscription) {
        this.disconnectedSubscription.remove();
        this.disconnectedSubscription = null;
      }

      if (this.isConnected && this.connectedDevice) {
        await this.connectedDevice.disconnect();
      }

      this.isConnected = false;
      this.connectedDevice = null;
      this.dataBuffer = '';

      // Clear connection state to prevent race conditions
      this.isConnecting = false;
      this.connectingToDeviceId = null;
      this.connectionPromises.clear();

      // Only clear lastConnectedDeviceId if force disconnect
      if (force) {
        this.lastConnectedDeviceId = null;
      }

      // Update connection status in both local callback and global context
      this.updateConnectionStatus('disconnected', force ? 'Force disconnected from device' : 'Disconnected from device');

      console.log('Successfully disconnected');

    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Check if connected
  isDeviceConnected() {
    return this.isConnected;
  }

  // Check if connection is in progress
  isConnectionInProgress() {
    return this.isConnecting;
  }

  // Get connecting device info
  getConnectingDeviceId() {
    return this.connectingToDeviceId;
  }

  // Get connected device info
  getConnectedDevice() {
    return this.connectedDevice;
  }

  // Get connection status (expected by modal)
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      connectedDevice: this.connectedDevice,
      lastWeight: this.lastWeightData
    };
  }

  // Send custom command to scale
  async sendCommand(command) {
    try {
      if (!this.isConnected || !this.connectedDevice) {
        throw new Error('Not connected to any device');
      }

      console.log('Sending command to scale:', command);
      await this.connectedDevice.write(command + '\r\n');

      return true;
    } catch (error) {
      console.error('Error sending command:', error);
      return false;
    }
  }

  // Enable persistent connection mode
  enablePersistentConnection(autoReconnect = true) {
    console.log('🔗 Enabling persistent connection mode');
    this.persistentConnection = true;
    this.autoReconnect = autoReconnect;
    this.reconnectAttempts = 0;
    console.log('Persistent connection enabled, auto-reconnect:', autoReconnect);
  }

  // Disable persistent connection mode  
  disablePersistentConnection() {
    console.log('🔗 Disabling persistent connection mode');
    this.persistentConnection = false;
    this.autoReconnect = false;
    this.reconnectAttempts = 0;
  }

  // Update settings from global context
  updateSettingsFromGlobal(bluetoothSettings) {
    console.log('📱 Updating Bluetooth service settings from global context:', bluetoothSettings);
    this.persistentConnection = bluetoothSettings.persistentConnection || false;
    this.autoReconnect = bluetoothSettings.autoReconnect !== undefined ? bluetoothSettings.autoReconnect : true;
  }

  // Manually approve a device as a scale (for devices not automatically detected)
  approveDeviceAsScale(deviceAddress) {
    this.approvedScaleDevices.add(deviceAddress);
    console.log(`✅ Device ${deviceAddress} manually approved as scale`);
    this.saveApprovedDevices(); // Persist to storage
  }

  // Remove device from approved scales list
  removeDeviceAsScale(deviceAddress) {
    this.approvedScaleDevices.delete(deviceAddress);
    console.log(`❌ Device ${deviceAddress} removed from approved scales`);
    this.saveApprovedDevices(); // Persist to storage
  }

  // Check if device is manually approved as scale
  isApprovedScale(deviceAddress) {
    return this.approvedScaleDevices.has(deviceAddress);
  }

  // Set up a basic weight callback if none exists (useful for auto-connect scenarios)
  setupDefaultWeightCallbackIfNeeded() {
    if (!this.weightCallback) {
      console.log('📊 Setting up default weight callback for auto-connected scale');
      this.setWeightCallback((weightData) => {
        console.log(`⚖️ Weight data received from auto-connected scale: ${weightData.weight} ${weightData.unit} (${weightData.status})`);
        // Store latest weight data for potential use
        this.latestAutoConnectWeight = weightData;
      });
    } else {
      console.log('📊 Weight callback already exists, skipping default setup');
    }
  }

  // Load approved scale devices from AsyncStorage
  async loadApprovedDevices() {
    try {
      const approvedDevices = await AsyncStorage.getItem('approvedScaleDevices');
      if (approvedDevices) {
        const deviceArray = JSON.parse(approvedDevices);
        this.approvedScaleDevices = new Set(deviceArray);
        console.log(`📱 Loaded ${deviceArray.length} approved scale devices from storage`);
      }
    } catch (error) {
      console.error('Error loading approved scale devices:', error);
    }
  }

  // Save approved scale devices to AsyncStorage
  async saveApprovedDevices() {
    try {
      const deviceArray = Array.from(this.approvedScaleDevices);
      await AsyncStorage.setItem('approvedScaleDevices', JSON.stringify(deviceArray));
      console.log(`💾 Saved ${deviceArray.length} approved scale devices to storage`);
    } catch (error) {
      console.error('Error saving approved scale devices:', error);
    }
  }

  // Attempt to reconnect to the last connected device
  async attemptReconnection() {
    if (!this.autoReconnect || !this.lastConnectedDeviceId) {
      return false;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`🔴 Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      if (this.statusCallback) {
        this.statusCallback('reconnect_failed', 'Unable to reconnect after multiple attempts');
      }
      return false;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} to ${this.lastConnectedDeviceId}`);

    if (this.statusCallback) {
      this.statusCallback('reconnecting', `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    }

    try {
      const success = await this.connectToDevice(this.lastConnectedDeviceId);
      if (success) {
        console.log('✅ Reconnection successful');
        this.reconnectAttempts = 0; // Reset on success
        return true;
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
    }

    // Schedule next reconnection attempt
    setTimeout(() => {
      this.attemptReconnection();
    }, this.reconnectDelay);

    return false;
  }

  // Check if persistent connection is enabled
  isPersistentConnectionEnabled() {
    return this.persistentConnection;
  }

  // Get connection persistence status
  getConnectionPersistenceStatus() {
    return {
      persistent: this.persistentConnection,
      autoReconnect: this.autoReconnect,
      reconnectAttempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      lastDeviceId: this.lastConnectedDeviceId
    };
  }

  // Start weight monitoring
  startWeightMonitoring() {
    // console.log('Starting weight monitoring...');
    this.isListening = true;

    if (this.statusCallback) {
      this.statusCallback('monitoring', 'Weight monitoring started');
    }
  }

  // Stop weight monitoring
  stopWeightMonitoring() {
    // console.log('Stopping weight monitoring...');
    this.isListening = false;

    if (this.weightReadInterval) {
      clearInterval(this.weightReadInterval);
      this.weightReadInterval = null;
    }

    if (this.statusCallback) {
      this.statusCallback('monitoring_stopped', 'Weight monitoring stopped');
    }
  }

  // Cleanup
  destroy() {
    console.log('Destroying BluetoothScaleService...');

    this.stopScanning();
    this.stopWeightMonitoring();
    this.disconnect();

    // Clean up any remaining references
    this.statusCallback = null;
    this.weightCallback = null;
    this.devices = [];
    this.lastWeightUpdate = 0;
    this.latestWeightData = null;
  }

  // =================== WEIGHT STREAMING CONTROL ===================

  /**
   * Pause weight data streaming to UI (useful during weight lock)
   * This prevents new weight readings from updating the UI while weight is locked
   * @param {string} reason - Reason for pausing (for logging)
   */
  pauseWeightStreaming(reason = 'Weight locked for submission') {
    if (this.isWeightStreamingPaused) {
      // console.log('⏸️ Weight streaming already paused');
      return;
    }

    this.isWeightStreamingPaused = true;
    this.pausedForWeightLock = reason.includes('lock');

    // If this is for weight lock, set additional strict mode
    if (this.pausedForWeightLock) {
      this.strictWeightLockMode = true;
      console.log('🔒 STRICT WEIGHT LOCK MODE: All weight processing suspended for submission');
    }

    // console.log(`⏸️ Weight streaming PAUSED: ${reason}`);
    // console.log('📊 Scale will continue reading but UI updates are suspended');

    // Continue collecting data but don't send to UI
    // This ensures we maintain connection and data flow
  }

  /**
   * Resume weight data streaming to UI
   * @param {string} reason - Reason for resuming (for logging) 
   */
  resumeWeightStreaming(reason = 'Weight unlocked') {
    if (!this.isWeightStreamingPaused) {
      // console.log('▶️ Weight streaming already active');
      return;
    }

    this.isWeightStreamingPaused = false;
    const wasPausedForLock = this.pausedForWeightLock;
    this.pausedForWeightLock = false;

    // Clear strict mode
    this.strictWeightLockMode = false;

    // console.log(`▶️ Weight streaming RESUMED: ${reason}`);
    // console.log('📊 UI will now receive weight updates again');

    // If we have recent weight data, send it immediately to sync UI
    if (this.latestWeightData && wasPausedForLock) {
      // console.log('🔄 Sending latest weight data to sync UI after resume');
      setTimeout(() => {
        if (this.weightCallback && this.latestWeightData) {
          const syncData = {
            ...this.latestWeightData,
            value: this.latestWeightData.weight,
            displayValue: `${this.latestWeightData.weight} ${this.latestWeightData.unit}`
          };
          this.weightCallback(syncData);
        }
      }, 100); // Small delay to ensure UI is ready
    }
  }

  /**
   * Check if weight streaming is currently paused
   * @returns {boolean} True if streaming is paused
   */
  isWeightStreamingCurrentlyPaused() {
    return this.isWeightStreamingPaused;
  }

  /**
   * Get weight streaming status info
   * @returns {object} Status information
   */
  getWeightStreamingStatus() {
    return {
      isPaused: this.isWeightStreamingPaused,
      pausedForWeightLock: this.pausedForWeightLock,
      hasLatestData: !!this.latestWeightData,
      isConnected: this.isConnected,
      isVirtualMode: this.isVirtualScaleMode && this.virtualScaleConnected
    };
  }

  // =================== VIRTUAL BLUETOOTH SCALE FOR DEBUGGING ===================

  /**
   * Toggle virtual scale mode (only works in development)
   * @param {boolean} enabled - Whether to enable virtual scale mode
   */
  setVirtualScaleMode(enabled) {
    if (!__DEV__) {
      console.warn('Virtual scale mode is only available in development builds');
      return false;
    }

    console.log(`${enabled ? 'Enabling' : 'Disabling'} virtual Bluetooth scale mode`);
    this.isVirtualScaleMode = enabled;

    if (enabled) {
      this.startVirtualScale();
    } else {
      this.stopVirtualScale();
    }

    return true;
  }

  /**
   * Check if virtual scale mode is active
   * @returns {boolean}
   */
  isVirtualScaleActive() {
    return __DEV__ && this.isVirtualScaleMode && this.virtualScaleConnected;
  }

  /**
   * Start the virtual Bluetooth scale
   */
  startVirtualScale() {
    if (!__DEV__ || !this.isVirtualScaleMode) return;

    console.log('🔄 Starting virtual Bluetooth scale...');

    // Disconnect any real device first
    if (this.isConnected && this.connectedDevice) {
      this.disconnect();
    }

    // Set initial virtual weight
    this.virtualWeight = 0.0;
    this.virtualWeightDirection = 1;
    this.virtualScaleConnected = true;
    this.isConnected = true;

    // Create a virtual device object
    this.connectedDevice = {
      name: '🧪 Virtual Scale (Debug)',
      address: 'VIRTUAL:00:00:00:00:00',
      id: 'virtual-scale-debug'
    };

    // Notify UI of connection
    if (this.statusCallback) {
      this.statusCallback('connected', this.connectedDevice);
    }

    // Start weight simulation
    this.startVirtualWeightSimulation();

    console.log('✅ Virtual Bluetooth scale started successfully');
  }

  /**
   * Stop the virtual Bluetooth scale
   */
  stopVirtualScale() {
    console.log('🛑 Stopping virtual Bluetooth scale...');

    if (this.virtualScaleInterval) {
      clearInterval(this.virtualScaleInterval);
      this.virtualScaleInterval = null;
    }

    this.virtualScaleConnected = false;
    this.isConnected = false;
    this.connectedDevice = null;

    // Notify UI of disconnection
    if (this.statusCallback) {
      this.statusCallback('disconnected', null);
    }

    console.log('✅ Virtual Bluetooth scale stopped');
  }

  /**
   * Start simulating weight data from virtual scale
   */
  startVirtualWeightSimulation() {
    if (!__DEV__ || !this.isVirtualScaleMode || !this.virtualScaleConnected) return;

    // console.log('📊 Starting virtual weight simulation...');

    // Clear any existing interval
    if (this.virtualScaleInterval) {
      clearInterval(this.virtualScaleInterval);
    }

    // Simulate weight changes every 500ms
    this.virtualScaleInterval = setInterval(() => {
      if (!this.virtualScaleConnected) return;

      // Simulate realistic weight changes
      this.updateVirtualWeight();

      // Format the weight data in the same format as real scale: "ST,GS,    X.XXKG"
      const formattedWeight = this.virtualWeight.toFixed(2);
      const virtualScaleData = `ST,GS,    ${formattedWeight}KG\r`;

      // Process the virtual data through the same parsing logic
      this.parseWeightData(virtualScaleData);

    }, 500); // Update every 500ms for realistic simulation

    // console.log('✅ Virtual weight simulation started');
  }

  /**
   * Update virtual weight with realistic patterns
   */
  updateVirtualWeight() {
    // Simulate realistic weight patterns
    const patterns = [
      // Gradual increase (adding items)
      () => {
        if (this.virtualWeight < 5.0) {
          this.virtualWeight += Math.random() * 0.1 + 0.02; // 0.02-0.12 kg increments
        } else {
          this.virtualWeightDirection = -1; // Start decreasing
        }
      },
      // Gradual decrease (removing items)
      () => {
        if (this.virtualWeight > 0.1) {
          this.virtualWeight -= Math.random() * 0.08 + 0.01; // 0.01-0.09 kg decrements
        } else {
          this.virtualWeightDirection = 1; // Start increasing
          this.virtualWeight = Math.random() * 0.5; // Small random start weight
        }
      },
      // Stable weight with minor fluctuations
      () => {
        const fluctuation = (Math.random() - 0.5) * 0.02; // ±0.01 kg fluctuation
        this.virtualWeight += fluctuation;
      }
    ];

    // Choose pattern based on direction and random chance
    if (this.virtualWeightDirection === 1) {
      // 70% chance to increase, 20% stable, 10% decrease
      const rand = Math.random();
      if (rand < 0.7) {
        patterns[0](); // Increase
      } else if (rand < 0.9) {
        patterns[2](); // Stable
      } else {
        patterns[1](); // Decrease
      }
    } else {
      // 70% chance to decrease, 20% stable, 10% increase
      const rand = Math.random();
      if (rand < 0.7) {
        patterns[1](); // Decrease
      } else if (rand < 0.9) {
        patterns[2](); // Stable
      } else {
        patterns[0](); // Increase
      }
    }

    // Keep weight within reasonable bounds
    if (this.virtualWeight < 0) {
      this.virtualWeight = 0;
      this.virtualWeightDirection = 1;
    } else if (this.virtualWeight > 10) {
      this.virtualWeight = 10;
      this.virtualWeightDirection = -1;
    }

    // Round to 2 decimal places for realistic precision
    this.virtualWeight = Math.round(this.virtualWeight * 100) / 100;
  }

  /**
   * Manually set virtual scale weight (for testing specific values)
   * @param {number} weight - Weight to set in kg
   */
  setVirtualWeight(weight) {
    if (!__DEV__ || !this.isVirtualScaleMode) {
      console.warn('Virtual scale mode must be enabled to set virtual weight');
      return;
    }

    if (typeof weight !== 'number' || weight < 0) {
      console.warn('Invalid weight value. Must be a positive number.');
      return;
    }

    this.virtualWeight = Math.round(weight * 100) / 100; // Round to 2 decimal places
    // console.log(`🎯 Virtual scale weight set to: ${this.virtualWeight} kg`);

    // Immediately send this weight
    const formattedWeight = this.virtualWeight.toFixed(2);
    const virtualScaleData = `ST,GS,    ${formattedWeight}KG\r`;
    this.parseWeightData(virtualScaleData);
  }

  /**
   * Get virtual scale control methods for UI
   * @returns {object|null} Virtual scale controls or null if not available
   */
  getVirtualScaleControls() {
    if (!__DEV__) return null;

    return {
      isEnabled: this.isVirtualScaleMode,
      isConnected: this.virtualScaleConnected,
      currentWeight: this.virtualWeight,
      enable: () => this.setVirtualScaleMode(true),
      disable: () => this.setVirtualScaleMode(false),
      setWeight: (weight) => this.setVirtualWeight(weight),
      addWeight: (amount = 0.5) => this.setVirtualWeight(this.virtualWeight + amount),
      removeWeight: (amount = 0.5) => this.setVirtualWeight(Math.max(0, this.virtualWeight - amount)),
      reset: () => this.setVirtualWeight(0),
    };
  }

  // =================== END VIRTUAL BLUETOOTH SCALE ===================
}

// Export singleton instance
const bluetoothScaleService = new BluetoothScaleService();
export default bluetoothScaleService;
