import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { getBaseUrl } from '../repositories/Repository';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import AppFooter from '../components/AppFooter';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  DocumentText,
  TickCircle,
  CloseCircle,
  Scan,
  Warning2,
  Lock,
  Bluetooth,
  Weight,
} from 'iconsax-react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import NfcManager, { NfcTech, NfcEvents } from 'react-native-nfc-manager';
import { Picker } from '@react-native-picker/picker';

// Local imports
import { GlobalContext } from '../context/GlobalContext';
import SyncLoader from '../components/SyncLoader';
import BasicDropdown from '../components/BasicDropdown';
import BluetoothScaleModal from '../components/BluetoothScaleModal';
import BluetoothScaleService from '../services/BluetoothScaleService';
import services from '../database/services';
import SQLiteSvc from '../database/SQLiteSvc';
import {
  moderateScale,
  fontScale,
  screenWidth,
  screenHeight,
} from '../common/responsive';
import HarvestSuccessModal from '../components/HarvestSuccessModal';
import HarvestQCModal from '../components/HarvestQCModal';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const HarvestWizardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    instance,
    clientId,
    deviceUID,
    fetchOfflineEventsCount,
    connectionType,
    synchData,
    bluetoothSettings,
    updateBluetoothSettings,
    // Scale connection state
    scaleConnectionState,
    updateScaleConnection,
    updateScaleConnectionStatus,
    setScaleDevice,
    resetScaleConnection,
  } = useContext(GlobalContext);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Please wait...');
  const [loaderHeading, setLoaderHeading] = useState('Initializing');

  // QC state
  const [qcCompleted, setQcCompleted] = useState(false);
  const [checkingQcStatus, setCheckingQcStatus] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState(null);
  const [successModalCumulative, setSuccessModalCumulative] = useState(null);

  // QC Modal state
  const [showQCModal, setShowQCModal] = useState(false);

  // --- BLUETOOTH STATE ---
  // Bluetooth connection state is now managed in global context
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [bluetoothScaleListening, setBluetoothScaleListening] = useState(false);
  const [lastBluetoothWeight, setLastBluetoothWeight] = useState(null);

  // State for the modal's device list
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAllDevices, setShowAllDevices] = useState(false);

  // Derived state for convenience - using global scale connection state
  const bluetoothScaleConnected = scaleConnectionState.isConnected;
  const bluetoothStatus = scaleConnectionState.connectionStatus;
  const bluetoothConnectedDevice = scaleConnectionState.deviceName ? {
    name: scaleConnectionState.deviceName,
    address: scaleConnectionState.deviceAddress,
  } : null;

  // NFC state
  const [nfcListeningActive, setNfcListeningActive] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('waiting');
  const [nfcScanType, setNfcScanType] = useState('staff');
  const nfcScanTypeRef = useRef('staff');
  const [staffData, setStaffData] = useState(null);
  const [supervisorData, setSupervisorData] = useState(null);
  const [formValidationErrors, setFormValidationErrors] = useState({});
  const [showStaffScanModal, setShowStaffScanModal] = useState(false);
  const [staffScanModalData, setStaffScanModalData] = useState(null);

  // Refs for immediate access to data
  const staffDataRef = useRef(null);
  const supervisorDataRef = useRef(null);
  const formValuesRef = useRef(null);
  const nfcTimeoutRef = useRef(null);
  const lockedWeightRef = useRef(null); // Store the fresh locked weight value
  const isWeightLockedRef = useRef(false); // Store the immediate lock status (bypasses React state delays)

  // Data for dropdowns
  const [sites, setSites] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [cropSpecs, setCropSpecs] = useState([]);
  const [cropVarieties, setCropVarieties] = useState([]);

  // Selected values
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedCropSpec, setSelectedCropSpec] = useState(null);
  const [selectedCropVariety, setSelectedCropVariety] = useState(null);

  // Weight input values
  const [grossWeight, setGrossWeight] = useState('');
  const [lockedWeight, setLockedWeight] = useState(null); // Locked weight for submission
  const [isWeightLocked, setIsWeightLocked] = useState(false); // Flag to indicate weight is locked
  const [isWeightStreamingPaused, setIsWeightStreamingPaused] = useState(false); // Track streaming pause state

  // Wizard steps configuration (5 steps ending at QC)
  const steps = [
    {
      title: 'Select Site',
      subtitle: 'Choose the farm site',
      field: 'site',
      data: sites,
      selectedValue: selectedSite,
      onSelect: setSelectedSite,
      placeholder: 'Select Site',
      required: true,
    },
    {
      title: 'Select Block',
      subtitle: 'Choose the block within the site',
      field: 'block',
      data: blocks,
      selectedValue: selectedBlock,
      onSelect: setSelectedBlock,
      placeholder: 'Select Block',
      required: true,
      dependsOn: 'site',
    },
    {
      title: 'Select Crop',
      subtitle: 'Choose the crop',
      field: 'cropSpec',
      data: cropSpecs,
      selectedValue: selectedCropSpec,
      onSelect: setSelectedCropSpec,
      placeholder: 'Select Crop',
      required: true,
    },
    {
      title: 'Select Crop Variety',
      subtitle: 'Choose the crop variety',
      field: 'cropVariety',
      data: cropVarieties,
      selectedValue: selectedCropVariety,
      onSelect: setSelectedCropVariety,
      placeholder: 'Select Crop Variety',
      required: true,
      dependsOn: 'cropSpec',
    },
    {
      title: 'Quality Control',
      subtitle: 'Complete QC assessment to begin harvesting',
      field: 'qc',
      isQcStep: true,
    },
  ];

  // State to track if we're in harvesting phase (after QC completion)
  const [isHarvestingPhase, setIsHarvestingPhase] = useState(false);

  // Validation schema
  const validationSchema = Yup.object().shape({
    grossWeight: Yup.number()
      .required('Gross weight is required')
      .positive('Gross weight must be positive')
      .typeError('Gross weight must be a number'),
  });

  // Function to handle sync from footer
  const handleSyncData = async () => {
    try {
      if (synchData) {
        await synchData(true, setLoading, setLoaderHeading, setLoadingText);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setLoading(false);
      services.showNotification(
        'Sync Error',
        'An error occurred during synchronization',
        'error',
      );
    }
  };

  // Setup Bluetooth Scale Service (for weight callbacks when modal is closed)
  const setupBluetoothScaleService = useCallback(() => {
    // console.log('=== SETTING UP BLUETOOTH SCALE SERVICE (WIZARD SCREEN) ===');

    // Clear any existing callbacks first to prevent duplicates
    BluetoothScaleService.clearWeightCallback();
    BluetoothScaleService.clearStatusCallback();

    // Set up global context updaters for maintaining scale connection state
    BluetoothScaleService.setGlobalContextUpdaters({
      updateScaleConnection,
      updateScaleConnectionStatus,
      setScaleDevice,
      resetScaleConnection,
    });

    // Optimize for faster weight updates
    BluetoothScaleService.setWeightUpdateInterval(75); // 75ms for responsive updates

    // Set up both weight and status callbacks for auto-connect support
    BluetoothScaleService.setWeightCallback(handleBluetoothWeight);
    BluetoothScaleService.setStatusCallback((status, message, device) => {
      // console.log('🔄 BluetoothScaleService status callback:', status, message, device);
      handleModalConnectionStatusChange(status);
      if (device) {
        handleModalConnectedDeviceChange(device);
      }
    });
    // console.log('Weight and status callbacks set up for Bluetooth scale in wizard screen');

    // console.log('Bluetooth scale service setup complete (wizard screen)');
  }, [handleBluetoothWeight, updateScaleConnection, updateScaleConnectionStatus, setScaleDevice, resetScaleConnection]); // Updated dependencies

  // Sync Bluetooth settings from global context to BluetoothScaleService
  useEffect(() => {
    if (bluetoothSettings && BluetoothScaleService) {
      console.log('🔄 Syncing Bluetooth settings from global context to service');
      BluetoothScaleService.updateSettingsFromGlobal(bluetoothSettings);
    }
  }, [bluetoothSettings]);

  // Handle weight received from Bluetooth scale
  const handleBluetoothWeight = useCallback((weightData) => {
    const timestamp = new Date().toISOString();
    // console.log('=== HARVEST WIZARD WEIGHT RECEIVED ===');
    // console.log('Weight received:', weightData);
    // console.log('Received at:', timestamp);
    // console.log('Current gross weight:', grossWeight || 'empty');
    // console.log('Current lastBluetoothWeight:', lastBluetoothWeight || 'empty');
    // console.log('⚖️ Weight received from scale - isWeightLockedRef.current:', isWeightLockedRef.current);
    // console.log('Weight data type:', typeof weightData);
    // console.log('Weight data structure:', JSON.stringify(weightData, null, 2));

    // Don't update if weight is locked for submission
    if (isWeightLockedRef.current) {
      // console.log('⚖️ Weight is LOCKED (via ref) - skipping update. Weight data:', weightData);
      return;
    }

    // Extract the numeric value from the weight data
    const weight = typeof weightData === 'object' ? weightData.value || weightData.weight || weightData.numericValue : weightData;

    // console.log('⚖️ Extracted weight value:', weight, 'at:', timestamp);
    // console.log('Weight type after extraction:', typeof weight);
    // console.log('Is weight a valid number?', !isNaN(weight) && weight !== null && weight !== undefined);

    // Validate weight before updating
    if (weight !== null && weight !== undefined && !isNaN(weight)) {
      const weightString = weight.toString();
      // console.log('⚖️ Setting gross weight to:', weightString);
      setLastBluetoothWeight(weight);
      setGrossWeight(weightString);
      // console.log('Weight field updated to:', weightString);
      // console.log('Weight validation: parseFloat result =', parseFloat(weightString));
    } else {
      // console.warn('Invalid weight received, not updating field:', weight);
    }

    // console.log('=== END WEIGHT HANDLING ===');
  }, []); // No state dependencies needed since we use refs for immediate values

  // Lock current weight value for submission
  const lockWeightForSubmission = () => {
    // console.log('🔐 === LOCK WEIGHT DEBUG ===');
    // console.log('🔐 grossWeight state:', grossWeight);
    // console.log('🔐 lastBluetoothWeight state:', lastBluetoothWeight);

    // Get the most current weight directly from the service (bypasses React state delays)
    let currentWeight = null;

    // Try to get current weight from BluetoothScaleService first (most recent)
    try {
      const latestWeightData = BluetoothScaleService.getLatestWeight();
      if (latestWeightData && latestWeightData.weight && !isNaN(latestWeightData.weight) && latestWeightData.weight > 0) {
        currentWeight = latestWeightData.weight;
        // console.log('🔐 Using latest weight from BluetoothScaleService:', currentWeight);
      } else {
        // console.log('🔐 Latest weight data from service:', latestWeightData);
      }
    } catch (error) {
      // console.log('🔐 Could not get weight from service, trying state values:', error.message);
    }

    // Fallback to state values if service doesn't have current weight
    if (!currentWeight) {
      // Get weight from different sources
      const grossWeightValue = grossWeight ? parseFloat(grossWeight) : null;
      const lastBluetoothWeightValue = lastBluetoothWeight ? (typeof lastBluetoothWeight === 'number' ? lastBluetoothWeight : parseFloat(lastBluetoothWeight)) : null;

      // console.log('🔐 Parsed grossWeight:', grossWeightValue);
      // console.log('🔐 Parsed lastBluetoothWeight:', lastBluetoothWeightValue);

      // Determine the best weight to use (prefer Bluetooth weight when available, then gross weight)
      if (lastBluetoothWeightValue && !isNaN(lastBluetoothWeightValue) && lastBluetoothWeightValue > 0) {
        currentWeight = lastBluetoothWeightValue;
        // console.log('🔐 Using lastBluetoothWeight as current weight:', currentWeight);
      } else if (grossWeightValue && !isNaN(grossWeightValue) && grossWeightValue > 0) {
        currentWeight = grossWeightValue;
        // console.log('🔐 Using grossWeight as current weight:', currentWeight);
      }
    }

    // console.log('🔐 Final currentWeight to lock:', currentWeight);

    if (currentWeight && !isNaN(currentWeight) && currentWeight > 0) {
      // Round to 2 decimal places to ensure consistency
      const roundedWeight = Math.round(currentWeight * 100) / 100;

      // console.log('🔐 SETTING lockedWeight to:', roundedWeight);
      setLockedWeight(roundedWeight);
      setIsWeightLocked(true);
      isWeightLockedRef.current = true; // Set ref immediately for instant blocking
      setIsWeightStreamingPaused(true); // Update UI state

      // Store the fresh locked weight in ref for submission - this is the FINAL value
      lockedWeightRef.current = roundedWeight;

      // Immediately pause Bluetooth weight streaming to prevent ANY further interference
      if (BluetoothScaleService) {
        BluetoothScaleService.pauseWeightStreaming('Weight locked for submission');
      }

      // console.log('🔐 Weight locked for submission:', roundedWeight);
      // console.log('🔐 lockedWeightRef.current set to:', lockedWeightRef.current);
      // console.log('🔐 === END LOCK WEIGHT DEBUG ===');
      services.showNotification('Info', `Weight locked: ${roundedWeight} kg`, 'info');
      return roundedWeight; // Return the actual locked weight
    } else {
      // console.log('🔐 No valid weight found for locking');
      // console.log('🔐 === END LOCK WEIGHT DEBUG ===');
      return null;
    }
  };

  // Unlock weight to allow updates from scale
  const unlockWeight = (forceUnlock = false) => {
    // console.log('🔓 UNLOCK WEIGHT called - loading state:', loading, 'forceUnlock:', forceUnlock);
    // Prevent unlocking during submission process unless forced
    if (loading && !forceUnlock) {
      console.warn('Cannot unlock weight during submission process (use forceUnlock=true to override)');
      return;
    }

    // console.log('🔓 Unlocking weight - setting isWeightLocked to false');
    setLockedWeight(null);
    setIsWeightLocked(false);
    isWeightLockedRef.current = false; // Clear ref immediately for instant unblocking
    setIsWeightStreamingPaused(false); // Update UI state

    // Clear the locked weight ref
    lockedWeightRef.current = null;
    // console.log('🔓 lockedWeightRef.current cleared');
    // console.log('🔓 isWeightLockedRef.current set to:', isWeightLockedRef.current);

    // Resume Bluetooth weight streaming
    if (BluetoothScaleService) {
      BluetoothScaleService.resumeWeightStreaming('Weight unlocked after submission');
      // console.log('🔓 Bluetooth weight streaming resumed');
    }

    // console.log('🔓 Weight unlock complete - isWeightLocked should now be false');
  };

  // Get weight value to use for submission
  const getSubmissionWeight = (lockedWeightOverride = null) => {
    // Use the override value if provided (from fresh lock operation)
    if (lockedWeightOverride !== null) {
      // console.log('Using fresh locked weight for submission:', lockedWeightOverride);
      return lockedWeightOverride;
    }

    if (isWeightLocked && lockedWeight !== null) {
      // console.log('Using stored locked weight for submission:', lockedWeight);
      return lockedWeight;
    }
    const currentWeight = parseFloat(grossWeight) || 0;
    // console.log('Using current gross weight for submission:', currentWeight);
    return currentWeight;
  };

  // Disconnect from Bluetooth scale
  const disconnectDevice = async () => {
    try {
      if (BluetoothScaleService && typeof BluetoothScaleService.disconnect === 'function') {
        // Force disconnect to stop all listening and fully disconnect
        await BluetoothScaleService.disconnect(true);
        services.showNotification('Success', 'Scale disconnected successfully.', 'success');
      }
    } catch (error) {
      console.error('Error disconnecting from scale:', error);
      services.showNotification('Error', 'Failed to disconnect from scale.', 'error');
    }
  };

  const startListening = () => {
    try {
      if (BluetoothScaleService && typeof BluetoothScaleService.startListening === 'function') {
        BluetoothScaleService.startListening(handleBluetoothWeight);
        setBluetoothScaleListening(true);
        services.showNotification('Info', 'Started listening for scale weight.', 'info');
      }
    } catch (error) {
      services.showNotification('Error', error.message, 'error');
    }
  };

  const stopListening = () => {
    try {
      if (BluetoothScaleService && typeof BluetoothScaleService.stopListening === 'function') {
        BluetoothScaleService.stopListening();
        setBluetoothScaleListening(false);
        services.showNotification('Info', 'Stopped listening for scale weight.', 'info');
      }
    } catch (error) {
      services.showNotification('Error', error.message, 'error');
    }
  };

  const requestWeight = async () => {
    try {
      if (BluetoothScaleService && typeof BluetoothScaleService.requestWeight === 'function') {
        await BluetoothScaleService.requestWeight();
      }
    } catch (error) {
      services.showNotification('Error', 'Failed to request weight: ' + error.message, 'error');
    }
  };

  // Background sync function
  const backgroundSyncData = async () => {
    if (!isConnected) return;

    try {
      console.log('Starting background sync...');
      await services.synchronizeHarvestChecks(
        instance,
        false,
        null,
        null,
        null,
        fetchOfflineEventsCount,
      );
      await services.synchronizeQcFieldAssessments(
        instance,
        false,
        null,
        null,
        null,
        fetchOfflineEventsCount,
      );
      console.log('Background sync completed successfully');
    } catch (error) {
      console.log('Background sync failed (will retry later):', error);
    }
  };

  // Check network connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = isConnected;
      setIsConnected(state.isConnected);

      if (!wasConnected && state.isConnected) {
        console.log('Network connectivity restored, starting background sync...');
        setTimeout(() => {
          backgroundSyncData();
        }, 2000);
      }
    });
    return () => unsubscribe();
  }, [isConnected]);

  // Cleanup NFC on unmount
  useEffect(() => {
    // Initialize Bluetooth scale service
    setupBluetoothScaleService();

    return () => {
      stopNfcListening();
      // Cleanup Bluetooth scale
      try {
        if (BluetoothScaleService && typeof BluetoothScaleService.stopListening === 'function') {
          BluetoothScaleService.stopListening();
        }
        if (BluetoothScaleService && typeof BluetoothScaleService.clearWeightCallback === 'function') {
          BluetoothScaleService.clearWeightCallback();
        }
        if (BluetoothScaleService && typeof BluetoothScaleService.disconnect === 'function') {
          BluetoothScaleService.disconnect(true);
        }
      } catch (error) {
        console.error('Error cleaning up Bluetooth service:', error);
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadSites();
    loadCropSpecs();
    loadLastSelectedItems();
  }, []);

  // Load last selected items from AsyncStorage
  const loadLastSelectedItems = async () => {
    try {
      const [
        savedSiteJson,
        savedBlockJson,
        savedCropSpecJson,
        savedCropVarietyJson
      ] = await Promise.all([
        AsyncStorage.getItem('lastSelectedSite'),
        AsyncStorage.getItem('lastSelectedBlock'),
        AsyncStorage.getItem('lastSelectedCropSpec'),
        AsyncStorage.getItem('lastSelectedCropVariety')
      ]);

      if (savedSiteJson) {
        const savedSite = JSON.parse(savedSiteJson);
        setSelectedSite(savedSite);

        if (savedSite && savedSite.id) {
          loadBlocks(savedSite.id);

          if (savedBlockJson) {
            const savedBlock = JSON.parse(savedBlockJson);
            setSelectedBlock(savedBlock);
          }
        }
      }

      if (savedCropSpecJson) {
        const savedCropSpec = JSON.parse(savedCropSpecJson);
        setSelectedCropSpec(savedCropSpec);

        if (savedCropSpec && savedCropSpec.id) {
          loadCropVarieties(savedCropSpec.id);

          if (savedCropVarietyJson) {
            const savedCropVariety = JSON.parse(savedCropVarietyJson);
            setSelectedCropVariety(savedCropVariety);
          }
        }
      }
    } catch (error) {
      console.error('Error loading last selected items:', error);
    }
  };

  // Load blocks when site is selected
  useEffect(() => {
    if (selectedSite) {
      loadBlocks(selectedSite.id);
    } else {
      setBlocks([]);
      setSelectedBlock(null);
    }
  }, [selectedSite]);

  // Load crop varieties when crop spec is selected
  useEffect(() => {
    if (selectedCropSpec) {
      loadCropVarieties(selectedCropSpec.id);
    } else {
      setCropVarieties([]);
      setSelectedCropVariety(null);
    }
  }, [selectedCropSpec]);

  // Check QC status when block or crop variety is selected
  useEffect(() => {
    if (selectedBlock && selectedCropVariety) {
      checkQcStatus();
    } else if (selectedBlock) {
      checkQcStatus();
    } else {
      setQcCompleted(false);
    }
  }, [selectedBlock, selectedCropVariety]);

  // Transition to harvesting phase when QC is completed
  useEffect(() => {
    if (qcCompleted && selectedSite && selectedBlock && selectedCropSpec && selectedCropVariety) {
      setIsHarvestingPhase(true);
    }
  }, [qcCompleted, selectedSite, selectedBlock, selectedCropSpec, selectedCropVariety]);

  // Check if form is ready for NFC scanning
  const isFormReadyForNfc = () => {
    // Check for valid weight from any source
    const hasGrossWeight = grossWeight && parseFloat(grossWeight) > 0;
    const hasBluetoothWeight = lastBluetoothWeight && parseFloat(lastBluetoothWeight) > 0;
    const hasLockedWeight = isWeightLocked && lockedWeight && parseFloat(lockedWeight) > 0;

    const hasValidWeight = hasGrossWeight || hasBluetoothWeight || hasLockedWeight;

    return (
      qcCompleted &&
      selectedSite &&
      selectedBlock &&
      selectedCropSpec &&
      selectedCropVariety &&
      hasValidWeight
    );
  };

  // Check QC status
  const checkQcStatus = async () => {
    if (!selectedBlock) return;

    setCheckingQcStatus(true);

    const loadingTimeout = setTimeout(() => {
      setLoading(true);
      setLoaderHeading('Initializing');
      setLoadingText('Checking QC status...');
    }, 200);

    try {
      const cropVarietyId = selectedCropVariety ? selectedCropVariety.id : null;
      const result = await services.userHasDoneFieldQc(
        selectedBlock.id,
        cropVarietyId,
      );

      clearTimeout(loadingTimeout);
      setQcCompleted(result.hasDoneQc);
    } catch (error) {
      console.error('Error checking QC status:', error);
      clearTimeout(loadingTimeout);
      setQcCompleted(false);
    } finally {
      setCheckingQcStatus(false);
      setLoading(false);
    }
  };

  // Load sites from database
  const loadSites = () => {
    try {
      if (SQLiteSvc.getLookupData) {
        SQLiteSvc.getLookupData(
          results => {
            if (results.sites) {
              setSites(results.sites);
            }
          },
          error => {
            console.error('Error loading lookup data:', error);
            loadSitesIndividual();
          }
        );
      } else {
        loadSitesIndividual();
      }
    } catch (error) {
      console.error('Error in loadSites:', error);
      loadSitesIndividual();
    }
  };

  // Fallback individual site loading
  const loadSitesIndividual = () => {
    SQLiteSvc.getRecords(
      'sites',
      {},
      null,
      res => {
        const sitesArray = [];
        const count = res.rows.length;
        for (let i = 0; i < count; i++) {
          const site = res.rows.item(i);
          sitesArray.push({
            id: site.site_id,
            name: site.site_name,
          });
        }
        setSites(sitesArray);
      },
      error => {
        console.error('Error loading sites:', error);
        // services.showNotification('Error', 'Failed to load farms', 'error');
      },
    );
  };

  // Load blocks for a specific site
  const loadBlocks = siteId => {
    try {
      if (SQLiteSvc.getBlocksBySite) {
        SQLiteSvc.getBlocksBySite(
          siteId,
          res => {
            const blocksArray = [];
            const count = res.rows.length;
            for (let i = 0; i < count; i++) {
              const block = res.rows.item(i);
              blocksArray.push({
                id: block.iid,
                name: block.name,
              });
            }
            setBlocks(blocksArray);
          },
          error => {
            console.error('Error loading blocks:', error);
            // services.showNotification('Error', 'Failed to load blocks', 'error');
          }
        );
      } else {
        services.getBlocks(
          siteId,
          res => {
            setBlocks(res);
          },
          error => {
            console.error('Error loading blocks:', error);
            // services.showNotification('Error', 'Failed to load blocks', 'error');
          },
        );
      }
    } catch (error) {
      console.error('Error in loadBlocks:', error);
    }
  };

  // Load crop specifications
  const loadCropSpecs = () => {
    try {
      services.getCropSpecs(
        res => {
          setCropSpecs(res);
        },
        error => {
          console.error('Error loading crop specs:', error);
          // services.showNotification(
          //   'Error',
          //   'Failed to load crop specifications',
          //   'error',
          // );
        },
      );
    } catch (error) {
      console.error('Error in loadCropSpecs:', error);
    }
  };

  // Load crop varieties for a specific crop specification
  const loadCropVarieties = cropSpecId => {
    try {
      services.getCropVarieties(
        cropSpecId,
        res => {
          const varietiesArray = [];
          for (let i = 0; i < res.length; i++) {
            const variety = res[i];
            varietiesArray.push({
              id: variety.iid,
              name: variety.name,
            });
          }
          setCropVarieties(varietiesArray);
        },
        error => {
          console.error('Error loading crop varieties:', error);
          // services.showNotification(
          //   'Error',
          //   'Failed to load crop varieties',
          //   'error',
          // );
        },
      );
    } catch (error) {
      console.error('Error in loadCropVarieties:', error);
    }
  };

  // Calculate quality score
  const calculateQualityScore = (grossWeight, estReject = 0) => {
    if (!grossWeight) return 'N/A';
    const gross = parseFloat(grossWeight);
    const reject = parseFloat(estReject);

    const rejectPercentage = (reject / gross) * 100;

    if (rejectPercentage <= 5) return 'Excellent';
    if (rejectPercentage <= 10) return 'Good';
    if (rejectPercentage <= 20) return 'Average';
    if (rejectPercentage <= 30) return 'Poor';
    return 'Very Poor';
  };

  // Navigation functions
  const goToNextStep = () => {
    const currentStepConfig = steps[currentStep];

    if (currentStepConfig.required && !currentStepConfig.selectedValue && !currentStepConfig.isQcStep && !currentStepConfig.isWeightStep) {
      return;
    }

    if (currentStepConfig.isQcStep && !qcCompleted) {
      services.showNotification(
        'Error',
        'Please complete QC assessment first',
        'error',
      );
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle dropdown selection
  const handleDropdownSelection = (item, step) => {
    step.onSelect(item);

    // Save to AsyncStorage
    const storageKey = `lastSelected${step.field.charAt(0).toUpperCase() + step.field.slice(1)}`;
    AsyncStorage.setItem(storageKey, JSON.stringify(item));

    // Clear dependent selections
    if (step.field === 'site') {
      setSelectedBlock(null);
    } else if (step.field === 'cropSpec') {
      setSelectedCropVariety(null);
    }
  };

  // Open QC modal
  const openQCModal = () => {
    console.log("Opening QC modal...");
    if (!selectedSite || !selectedBlock || !selectedCropSpec || !selectedCropVariety) {
      services.showNotification(
        'Error',
        'Please complete all previous steps first',
        'error',
      );
      return;
    }

    console.log("Opening QC modal checks done...");

    // Open modal immediately for better responsiveness
    setShowQCModal(true);

    // Stop NFC in background to avoid blocking UI
    setTimeout(() => {
      stopNfcListening();
    }, 0);
  };

  // Handle QC completion
  const handleQCComplete = () => {
    setQcCompleted(true);
    checkQcStatus(); // Refresh QC status
  };

  // NFC Functions (simplified versions from original)
  const startAutoNfcListening = async () => {
    try {
      const isSupported = await NfcManager.isSupported();
      if (!isSupported) {
        setNfcStatus('error');
        services.showNotification('Error', 'NFC is not supported on this device.', 'error');
        return;
      }

      const isEnabled = await NfcManager.isEnabled();
      if (!isEnabled) {
        setNfcStatus('error');
        services.showNotification('Error', 'NFC is not enabled. Please enable NFC in your device settings.', 'error');
        return;
      }

      await NfcManager.start();
      setNfcListeningActive(true);
      setNfcStatus('listening_staff');
      setNfcScanType('staff');
      nfcScanTypeRef.current = 'staff';

      NfcManager.setEventListener(NfcEvents.DiscoverTag, tag => {
        if (tag && tag.id) {
          processNfcTag(tag.id);
        }
      });

      await NfcManager.registerTagEvent();
    } catch (error) {
      console.error('Error starting NFC listening:', error);
      setNfcStatus('error');
      restartNfcListening();
    }
  };

  const stopNfcListening = async () => {
    try {
      setNfcListeningActive(false);
      setNfcStatus('waiting');

      if (nfcTimeoutRef.current) {
        clearTimeout(nfcTimeoutRef.current);
        nfcTimeoutRef.current = null;
      }

      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      await NfcManager.unregisterTagEvent();
      await NfcManager.cancelTechnologyRequest();
    } catch (error) {
      console.error('Error stopping NFC scan:', error);
    }
  };

  const restartNfcListening = () => {
    stopNfcListening();
    nfcTimeoutRef.current = setTimeout(() => {
      if (isFormReadyForNfc()) {
        startAutoNfcListening();
      }
    }, 2000);
  };

  const processNfcTag = async tagId => {
    try {
      setNfcStatus('validating');

      const staffRecord = await services.getStaff({ nfc_serial: tagId });

      if (!staffRecord || Object.keys(staffRecord).length === 0) {
        services.showNotification(
          'Error',
          `${nfcScanType === 'staff' ? 'Staff' : 'Supervisor'} not found with this card. Please try again.`,
          'error',
        );
        restartNfcListening();
        return;
      }

      if (nfcScanTypeRef.current === 'staff') {
        if (!isFormReadyForNfc()) {
          services.showNotification('Error', 'Form is not complete. Please fill all required fields.', 'error');
          restartNfcListening();
          return;
        }

        // Auto-lock weight when staff card is scanned
        // console.log('🔐 Attempting to lock weight for staff card...');
        const lockedWeightValue = lockWeightForSubmission();
        // console.log('🔐 Weight locking result:', lockedWeightValue);

        if (!lockedWeightValue) {
          services.showNotification('Error', 'Please ensure a valid weight is available before scanning staff card.', 'error');
          restartNfcListening();
          return;
        }

        // Store the fresh locked weight in ref for submission
        // This is the FINAL weight that will be submitted - no further modifications allowed
        lockedWeightRef.current = lockedWeightValue;
        // console.log('🔐 lockedWeightRef.current set to:', lockedWeightRef.current);
        // console.log('🔐 isWeightLocked state:', isWeightLocked);

        // Freeze the reference to prevent accidental modification
        Object.freeze({ weight: lockedWeightValue });

        setStaffData(staffRecord);
        staffDataRef.current = staffRecord;

        setStaffScanModalData({
          name: staffRecord.name || staffRecord.nfc_serial,
          id: staffRecord.staff_id,
        });
        setShowStaffScanModal(true);

        // console.log('Weight automatically locked for staff:', staffRecord.name || staffRecord.nfc_serial, 'Weight:', lockedWeightValue);

        setNfcStatus('listening_supervisor');
        setNfcScanType('supervisor');
        nfcScanTypeRef.current = 'supervisor';
      } else if (nfcScanTypeRef.current === 'supervisor') {
        setShowStaffScanModal(false);
        setNfcStatus('processing');

        setLoading(true);
        setLoaderHeading('Saving Record');
        setLoadingText('Processing harvest record...');

        supervisorDataRef.current = staffRecord;
        await stopNfcListening();

        services.showNotification('Success', `Supervisor verified: ${staffRecord.name || staffRecord.nfc_serial}`, 'success');

        setTimeout(() => {
          submitHarvestRecord();
        }, 100);
      }
    } catch (error) {
      console.error('Error processing NFC tag:', error);
      setLoading(false);
      setNfcStatus('waiting');
      services.showNotification('Error', 'Failed to process NFC card. Please try again.', 'error');
      restartNfcListening();
    }
  };

  const submitHarvestRecord = async () => {
    const staffDataToUse = staffDataRef.current;
    const supervisorDataToUse = supervisorDataRef.current;

    // Use ONLY the locked weight from ref - no fallback to ensure consistency
    const finalWeight = lockedWeightRef.current;

    // Strict validation: ensure we have a locked weight (use ref as primary source of truth)
    if (!staffDataToUse || !supervisorDataToUse || !finalWeight || finalWeight <= 0) {
      setLoading(false);
      if (!finalWeight || finalWeight <= 0) {
        services.showNotification('Error', 'Weight must be locked before submission. Please scan staff card first.', 'error');
        console.log('🚨 Submission failed - Weight validation:');
        console.log('- finalWeight (lockedWeightRef.current):', finalWeight);
        console.log('- isWeightLocked state:', isWeightLocked);
        console.log('- staffDataToUse:', !!staffDataToUse);
        console.log('- supervisorDataToUse:', !!supervisorDataToUse);
      } else {
        services.showNotification('Error', 'Missing required data for submission.', 'error');
      }
      restartNfcListening();
      return;
    }

    try {
      const currentDate = Date.now().toString();

      // Debug: Log the current state values
      // console.log('=== SUBMISSION DEBUG START ===');
      // console.log('Raw grossWeight state value:', grossWeight);
      // console.log('grossWeight type:', typeof grossWeight);
      // console.log('grossWeight length:', grossWeight?.length);
      // console.log('lastBluetoothWeight:', lastBluetoothWeight);
      // console.log('isWeightLocked:', isWeightLocked);
      // console.log('lockedWeight state:', lockedWeight);
      // console.log('lockedWeightRef.current:', lockedWeightRef.current);
      // console.log('finalWeight for submission:', finalWeight);

      // console.log('✅ Proceeding with submission using locked weight:', finalWeight);
      const grossWeightNum = finalWeight; // Use the LOCKED final weight - guaranteed consistency
      // console.log('Using grossWeightNum:', grossWeightNum);
      // console.log('grossWeightNum type:', typeof grossWeightNum);
      // console.log('Is grossWeightNum valid?', !isNaN(grossWeightNum) && grossWeightNum > 0);

      const estReject = 0;
      const netWeight = grossWeightNum - estReject;
      const qualityScore = calculateQualityScore(grossWeightNum, estReject);

      // console.log('Final calculated values:');
      // console.log('- grossWeightNum:', grossWeightNum);
      // console.log('- estReject:', estReject);
      // console.log('- netWeight:', netWeight);
      // console.log('- qualityScore:', qualityScore);
      // console.log('=== SUBMISSION DEBUG END ===');

      const dataObj = {
        date: currentDate,
        farm: selectedSite.id,
        block: selectedBlock.id,
        crop_spec: selectedCropSpec.id,
        crop_variety: selectedCropVariety.id,
        gross_weight: grossWeightNum,
        est_reject: estReject,
        score: qualityScore,
        serial: staffDataToUse.nfc_serial,
        staff_id: staffDataToUse.staff_id,
        supervisor: supervisorDataToUse.nfc_serial,
        sync_status: 0,
      };

      setLoadingText('Saving record...');

      await SQLiteSvc.insertRecord('harvest_records', dataObj);

      const offlineEventsCount = Number(await AsyncStorage.getItem('offline-events-count')) || 0;
      const newCount = offlineEventsCount + 1;
      await AsyncStorage.setItem('offline-events-count', newCount.toString());
      fetchOfflineEventsCount();

      setLoading(false);
      setNfcStatus('waiting');

      const successData = {
        ...dataObj,
        siteName: selectedSite.name,
        blockName: selectedBlock.name,
        cropSpecName: selectedCropSpec.name,
        cropVarietyName: selectedCropVariety.name,
        formattedDate: new Date(parseInt(currentDate)).toLocaleString(),
        netWeight: netWeight.toFixed(2),
        staffName: staffDataToUse.name || staffDataToUse.nfc_serial,
        supervisorName: supervisorDataToUse.name || supervisorDataToUse.nfc_serial,
      };

      const today = new Date();
      const cumulativeData = await services.getStaffCumulativeWeight(staffDataToUse.staff_id, today);

      setSuccessModalData(successData);
      setSuccessModalCumulative(cumulativeData);
      setShowSuccessModal(true);

      services.showNotification('Success', 'Harvest record saved successfully!', 'success');

      // Clear the weight and unlock for next harvest
      setGrossWeight('');
      unlockWeight(true); // Force unlock even if loading state hasn't updated yet

      // Clear the locked weight ref for next harvest
      lockedWeightRef.current = null;

      // Background synchronization
      if (isConnected) {
        setTimeout(async () => {
          try {
            const baseUrl = await getBaseUrl();
            const url = `${baseUrl}/${instance}/web/ShiftControl/storeHarvestCheck/`.replace(/\s+/g, '');

            const formData = new FormData();
            formData.append('date', currentDate);
            formData.append('farm-name', dataObj.farm.toString());
            formData.append('block', dataObj.block.toString());
            formData.append('crop-spec', dataObj.crop_spec.toString());
            formData.append('crop-variety', dataObj.crop_variety.toString());
            formData.append('gross-weight', grossWeightNum.toString());
            formData.append('est-reject', estReject.toString());
            formData.append('overall-score', dataObj.score);
            formData.append('serial', dataObj.serial);
            formData.append('supervisor', dataObj.supervisor);

            const response = await axios.post(url, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 5000,
            });

            if (response.data.status === 'success') {
              await SQLiteSvc.updateRecord(
                'harvest_records',
                { sync_status: 1 },
                { date: currentDate, serial: staffDataToUse.nfc_serial },
                'AND'
              );

              const currentOfflineCount = Number(await AsyncStorage.getItem('offline-events-count')) || 0;
              const reducedCount = Math.max(0, currentOfflineCount - 1);
              await AsyncStorage.setItem('offline-events-count', reducedCount.toString());
              fetchOfflineEventsCount();

              console.log('Background sync successful for harvest record');
            }
          } catch (syncError) {
            console.log('Background sync failed, record remains offline:', syncError);
          }
        }, 200);
      }

    } catch (error) {
      console.error('Error saving harvest record:', error);
      setLoading(false);
      setNfcStatus('waiting');

      // Unlock weight on error so user can try again
      unlockWeight(true); // Force unlock even if loading state hasn't updated yet

      // Clear the locked weight ref on error
      lockedWeightRef.current = null;

      services.showNotification('Error', 'Failed to save harvest record', 'error');
      restartNfcListening();
    }
  };

  // Get NFC status message
  const getNfcStatusMessage = () => {
    switch (nfcStatus) {
      case 'waiting':
        return 'Complete required fields to enable scanning';
      case 'listening_staff':
        return isWeightLocked
          ? 'Weight locked - ready for staff card...'
          : 'Ready - scan staff card (weight will be locked)';
      case 'validating':
        return 'Validating form...';
      case 'listening_supervisor':
        return 'Scan supervisor card to complete';
      case 'processing':
        return 'Processing submission...';
      case 'error':
        return 'NFC error - please check settings';
      default:
        return 'Preparing...';
    }
  };

  // Get NFC status color
  const getNfcStatusColor = () => {
    switch (nfcStatus) {
      case 'listening_staff':
      case 'listening_supervisor':
        return '#22C55E';
      case 'validating':
      case 'processing':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Monitor bluetoothScaleConnected state changes
  useEffect(() => {
    // console.log('🔍 bluetoothScaleConnected state changed to:', bluetoothScaleConnected);
  }, [bluetoothScaleConnected]);

  // Bluetooth Scale Modal Callback Functions
  const handleModalConnectionStatusChange = (status) => {
    // console.log('📡 Modal connection status changed:', status);
    // Note: Global connection status is now automatically managed by BluetoothScaleService

    // Handle different connection states for local UI state only
    switch (status) {
      case 'connected':
        // Auto-start listening when connected with burst mode for faster initial readings
        setTimeout(() => {
          console.log('Auto-starting listening after connection with burst mode...');
          BluetoothScaleService.enableBurstMode(8000); // Enable burst mode
          startListening();
        }, 500); // Small delay to ensure connection is stable
        break;
      case 'disconnected':
      case 'connection_failed':
        setBluetoothScaleListening(false);
        setLastBluetoothWeight(null);
        break;
      case 'connecting':
        // Keep current connected state while connecting
        break;
      default:
        // For other statuses, maintain current state
        break;
    }
  };

  const handleModalConnectedDeviceChange = (device) => {
    // console.log('📱 Modal connected device changed:', device);
    // Note: Global device info is now automatically managed by BluetoothScaleService
  };

  const handleModalListeningStatusChange = (isListening) => {
    // console.log('🎧 Modal listening status changed:', isListening);
    setBluetoothScaleListening(isListening);
  };

  const handleModalLastWeightChange = (weight) => {
    // console.log('⚖️ Modal weight changed:', weight);
    setLastBluetoothWeight(weight);
  };

  // Auto-start NFC when form is ready
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const isReady = isFormReadyForNfc();

      if (isReady && !nfcListeningActive && nfcStatus === 'waiting') {
        startAutoNfcListening();
      } else if (!isReady && nfcListeningActive) {
        stopNfcListening();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [grossWeight, qcCompleted, nfcListeningActive, nfcStatus]);

  // Handle ending harvest session
  const handleEndHarvest = () => {
    Alert.alert(
      'End Harvest Session',
      'Are you sure you want to end this harvest session? All selected items will be cleared.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            // Clear all selections
            setSelectedSite(null);
            setSelectedBlock(null);
            setSelectedCropSpec(null);
            setSelectedCropVariety(null);
            setQcCompleted(false);
            setIsHarvestingPhase(false);
            setCurrentStep(0);
            setGrossWeight('');

            // Unlock weight when ending session
            unlockWeight();

            // Clear from AsyncStorage
            AsyncStorage.multiRemove([
              'lastSelectedSite',
              'lastSelectedBlock',
              'lastSelectedCropSpec',
              'lastSelectedCropVariety'
            ]);

            // Stop NFC
            stopNfcListening();

            services.showNotification('Success', 'Harvest session ended', 'success');
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  // Render harvesting phase
  const renderHarvestingPhase = () => {
    return (
      <View style={styles.harvestingContainer}>
        {/* Weight Entry Section */}
        <View style={styles.weightContainer}>
          {/* Bluetooth Scale Connection Section */}
          <View style={styles.bluetoothScaleSection}>
            <Text style={styles.bluetoothSectionTitle}>Bluetooth Scale</Text>

            {bluetoothScaleConnected && bluetoothConnectedDevice ? (
              // --- CONNECTED STATE ---
              <View>
                <View style={styles.bluetoothConnectedContainer}>
                  <View style={styles.bluetoothConnectedInfo}>
                    <TickCircle size={20} color="#22C55E" variant="Bold" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.bluetoothConnectedText}>Scale Connected</Text>
                      <Text style={styles.bluetoothDeviceName} numberOfLines={1}>{bluetoothConnectedDevice.name}</Text>
                    </View>
                  </View>
                </View>

                {/* Control Buttons */}
                <View style={styles.controlSection}>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.controlButton, styles.dangerButton]}
                      onPress={disconnectDevice}>
                      <CloseCircle size={16} color="#FFFFFF" variant="Bold" />
                      <Text style={styles.controlButtonText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {lastBluetoothWeight !== null && (
                  <Text style={styles.lastWeightText}>
                    Last reading: {typeof lastBluetoothWeight === 'number' ? lastBluetoothWeight.toFixed(2) : lastBluetoothWeight} kg
                  </Text>
                )}
              </View>
            ) : (
              // --- DISCONNECTED STATE ---
              <TouchableOpacity
                style={styles.bluetoothConnectButton}
                onPress={() => setShowBluetoothModal(true)}
                activeOpacity={0.7}
              >
                <Bluetooth size={18} color="#3B82F6" variant="Bold" />
                <Text style={styles.bluetoothConnectButtonText}>Connect Scale</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Gross Weight (kg) <Text style={styles.required}>*</Text>
              {isWeightLocked && (
                <Text style={styles.lockedIndicator}> 🔒 LOCKED</Text>
              )}
              {isWeightStreamingPaused && !isWeightLocked && bluetoothStatus === 'connected' && (
                <Text style={styles.pausedIndicator}> ⏸️ PAUSED</Text>
              )}
            </Text>

            <TextInput
              style={[
                styles.textInput,
                !grossWeight && styles.textInputError,
                bluetoothStatus === 'connected' && styles.disabledInput,
                isWeightLocked && styles.lockedInput,
              ]}
              placeholder={
                bluetoothStatus === 'connected'
                  ? (isWeightStreamingPaused ? "Weight streaming paused" : "Weight from Bluetooth scale")
                  : "Enter gross weight or use Bluetooth scale"
              }
              value={isWeightLocked && lockedWeight ? `${lockedWeight} kg (LOCKED)` : grossWeight}
              onChangeText={setGrossWeight}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
              editable={bluetoothStatus !== 'connected' && !isWeightLocked}
            />
            {!grossWeight && !isWeightLocked && (
              <Text style={styles.errorText}>Gross weight is required</Text>
            )}

            {/* Weight lock status info */}
            {bluetoothStatus === 'connected' && isWeightLocked && (
              <Text style={styles.weightLockInfo}>
                Weight locked when NFC card was scanned
              </Text>
            )}
          </View>

          {/* NFC Status Section */}
          <View style={styles.nfcStatusContainer}>
            <View style={styles.nfcStatusHeader}>
              <Scan size={18} color={getNfcStatusColor()} variant="Bold" />
              <Text style={styles.nfcStatusTitle}>Scan Staff Card</Text>
            </View>
            <View
              style={[
                styles.nfcStatusIndicator,
                { backgroundColor: getNfcStatusColor() + '20' },
              ]}>
              <Text
                style={[
                  styles.nfcStatusMessage,
                  { color: getNfcStatusColor(), textAlign: 'center' },
                ]}>
                {getNfcStatusMessage()}
              </Text>
            </View>
          </View>
        </View>

        {/* End Harvest Button */}
        <View style={styles.endHarvestContainer}>
          <TouchableOpacity
            style={styles.endHarvestButton}
            onPress={handleEndHarvest}
            activeOpacity={0.6}>
            <CloseCircle size={20} color="#EF4444" variant="Bold" />
            <Text style={styles.endHarvestButtonText}>End Harvest Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render current step
  const renderCurrentStep = () => {
    // If in harvesting phase, show harvesting UI
    if (isHarvestingPhase) {
      return renderHarvestingPhase();
    }

    const step = steps[currentStep];

    if (step.isQcStep) {
      return (
        <View style={styles.stepContainer}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
          </View>

          <View style={styles.qcContainer}>
            {selectedBlock && !checkingQcStatus && (
              <View style={styles.qcStatusContainer}>
                {qcCompleted ? (
                  <View style={styles.qcStatusSuccess}>
                    <TickCircle size={20} color="#22C55E" variant="Bold" />
                    <Text style={styles.qcStatusText}>QC Completed</Text>
                  </View>
                ) : (
                  <View style={styles.qcStatusPending}>
                    <Warning2 size={20} color="#F59E0B" variant="Bold" />
                    <Text style={styles.qcStatusText}>QC Required</Text>
                    <TouchableOpacity
                      style={styles.qcButton}
                      onPress={openQCModal}
                      activeOpacity={0.6}>
                      <Text style={styles.qcButtonText}>Start QC</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    // Regular dropdown step
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
        </View>

        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={step.selectedValue ? step.selectedValue.id : ''}
            onValueChange={(itemValue) => {
              if (itemValue && itemValue !== '') {
                // Find the full object from step.data
                const selectedObj = step.data.find(obj => obj.id === itemValue);
                if (selectedObj) {
                  handleDropdownSelection(selectedObj, step);
                }
              }
            }}
            style={styles.pickerStyle}
            enabled={step.data.length > 0}
            mode="dropdown"
          >
            <Picker.Item
              label={step.placeholder}
              value=""
              color="#9CA3AF"
            />
            {step.data.map((item) => (
              <Picker.Item
                key={item.id}
                label={item.name}
                value={item.id}
                color="#1F2937"
              />
            ))}
          </Picker>

          {/* Show selection summary - moved inside dropdown container to avoid z-index conflicts */}
          {step.selectedValue && (
            <View style={styles.selectionSummary}>
              <TickCircle size={16} color="#22C55E" variant="Bold" />
              <Text style={styles.selectionText}>
                Selected: {step.selectedValue.name}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar hidden={true} />

      {/* Header */}
      <AppHeader
        showBackButton={true}
        title={isHarvestingPhase ? `Harvesting: ${selectedSite?.name}, ${selectedBlock?.name}, ${selectedCropSpec?.name}, ${selectedCropVariety?.name}` : "Harvest Setup"}
        subtitle={isHarvestingPhase ? "Enter weights and scan cards" : `Step ${currentStep + 1} of ${steps.length}`}
        onBackPress={() => {
          if (isHarvestingPhase) {
            handleEndHarvest();
          } else if (currentStep > 0) {
            goToPreviousStep();
          } else {
            navigation.navigate('Home');
          }
        }}
        showSettings={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>

        {/* Progress Indicator - Hide during harvesting phase */}
        {!isHarvestingPhase && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((currentStep + 1) / steps.length) * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentStep + 1} of {steps.length}
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation Buttons - Hide during harvesting phase */}
        {!isHarvestingPhase && (
          <View style={styles.navigationContainer}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={goToPreviousStep}
                activeOpacity={0.6}>
                <ArrowLeft size={20} color="#6B7280" variant="Bold" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {currentStep < steps.length - 1 && (
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  currentStep === 0 && styles.nextButtonFull
                ]}
                onPress={goToNextStep}
                activeOpacity={0.6}>
                <Text style={styles.nextButtonText}>Next</Text>
                <ArrowRight size={20} color="#FFFFFF" variant="Bold" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Loading Overlay */}
      {loading && (
        <SyncLoader
          visible={true}
          loaderHeading={loaderHeading}
          loadingText={loadingText}
        />
      )}

      {/* Success Modal */}
      <HarvestSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        data={successModalData}
        cumulativeData={successModalCumulative}
      />

      {/* QC Modal */}
      <HarvestQCModal
        visible={showQCModal}
        onClose={() => setShowQCModal(false)}
        onQCComplete={handleQCComplete}
        site={selectedSite}
        block={selectedBlock}
        cropSpec={selectedCropSpec}
        cropVariety={selectedCropVariety}
      />

      {/* Bluetooth Scale Modal */}
      <BluetoothScaleModal
        visible={showBluetoothModal}
        onClose={() => {
          console.log('🔴 BluetoothScaleModal onClose called - bluetoothScaleConnected:', bluetoothScaleConnected);
          setShowBluetoothModal(false);
        }}
        onWeightReceived={handleBluetoothWeight}
        onConnectionStatusChange={handleModalConnectionStatusChange}
        onConnectedDeviceChange={handleModalConnectedDeviceChange}
        onListeningStatusChange={handleModalListeningStatusChange}
        onLastWeightChange={handleModalLastWeightChange}
      />

      {/* Staff Scan Modal */}
      {showStaffScanModal && (
        <Modal
          visible={showStaffScanModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStaffScanModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <TickCircle size={48} color="#10B981" variant="Bold" />
              </View>
              <Text style={styles.modalTitle}>Staff Verified!</Text>
              <View style={styles.modalInfoContainer}>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Name:</Text>
                  <Text style={styles.modalValue}>{staffScanModalData?.name}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Staff ID:</Text>
                  <Text style={styles.modalValue}>{staffScanModalData?.id}</Text>
                </View>
              </View>
              <View style={styles.modalInstructionContainer}>
                <Scan size={24} color="#6B7280" variant="Bold" />
                <Text style={styles.modalInstruction}>
                  Now scan the supervisor card to complete the harvest record
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalDismissButton}
                onPress={() => setShowStaffScanModal(false)}
                activeOpacity={0.6}>
                <Text style={styles.modalDismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <AppFooter
        navigation={navigation}
        currentRoute="Harvest"
        onSyncPress={() => handleSyncData()}
        syncLoading={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: moderateScale(isTablet ? 30 : 18),
    paddingVertical: moderateScale(8),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  progressBar: {
    height: moderateScale(8),
    backgroundColor: '#E2E8F0',
    borderRadius: moderateScale(6),
    marginBottom: moderateScale(6),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: moderateScale(6),
  },
  progressText: {
    fontSize: fontScale(13),
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: moderateScale(80),
  },
  stepContainer: {
    padding: moderateScale(isTablet ? 16 : 16),
    minHeight: screenHeight * 0.6,
  },
  stepHeader: {
    marginBottom: moderateScale(8),
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: fontScale(isTablet ? 20 : 16),
    fontWeight: '600',
    color: '#374151',
    marginBottom: moderateScale(4),
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  stepSubtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: fontScale(18),
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  pickerStyle: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: fontScale(16),
    fontWeight: '600',
    width: '100%',
    flex: 1,
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FFFA',
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
    marginTop: moderateScale(8),
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  selectionText: {
    fontSize: fontScale(15),
    color: '#0F766E',
    fontWeight: '600',
    marginLeft: moderateScale(8),
    letterSpacing: 0.1,
  },
  qcContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  qcStatusContainer: {
    marginBottom: moderateScale(8),
  },
  qcStatusSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FFFA',
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  qcStatusPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  qcStatusText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginLeft: moderateScale(8),
    flex: 1,
    color: '#0F172A',
  },
  qcButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(8),
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  qcButtonText: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  weightContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  formGroup: {
    marginBottom: moderateScale(8),
  },
  label: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#374151',
    marginBottom: moderateScale(6),
    letterSpacing: 0.1,
    lineHeight: fontScale(18),
  },
  required: {
    color: '#EF4444',
    fontWeight: '800',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    fontSize: fontScale(16),
    color: '#374151',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    minHeight: moderateScale(48),
    lineHeight: fontScale(18),
    fontWeight: '500',
  },
  textInputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  disabledInput: {
    backgroundColor: '#F8FAFC',
    color: '#6B7280',
    borderColor: '#D1D5DB',
  },
  lockedInput: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    borderColor: '#D97706',
    borderWidth: 2,
  },
  lockedIndicator: {
    color: '#D97706',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  pausedIndicator: {
    color: '#7C3AED',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  weightLockInfo: {
    fontSize: fontScale(12),
    color: '#059669',
    marginTop: moderateScale(4),
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: fontScale(14),
    color: '#EF4444',
    marginTop: moderateScale(6),
    fontWeight: '600',
  },
  nfcStatusContainer: {
    backgroundColor: '#FFFFFF',
    padding: moderateScale(12),
    marginTop: moderateScale(8),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(6),
    justifyContent: 'center',
  },
  nfcStatusTitle: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#374151',
    marginLeft: moderateScale(6),
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: fontScale(18),
  },
  nfcStatusIndicator: {
    backgroundColor: '#F8FAFC',
    borderRadius: moderateScale(12),
    padding: moderateScale(10),
    marginTop: moderateScale(4),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  nfcStatusMessage: {
    fontSize: fontScale(14),
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: fontScale(16),
    letterSpacing: 0.1,
    padding: moderateScale(8),
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: fontScale(15),
    color: '#475569',
    fontWeight: '700',
    marginLeft: moderateScale(6),
    letterSpacing: 0.3,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    backgroundColor: '#22C55E',
    borderRadius: moderateScale(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  nextButtonFull: {
    flex: 1,
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: fontScale(15),
    color: '#FFFFFF',
    fontWeight: '800',
    marginRight: moderateScale(6),
    letterSpacing: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: moderateScale(16),
  },
  modalContent: {
    width: '90%',
    maxWidth: moderateScale(400),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: moderateScale(72),
    height: moderateScale(72),
    borderRadius: moderateScale(36),
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(12),
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  modalTitle: {
    fontSize: fontScale(22),
    fontWeight: '800',
    color: '#374151',
    marginBottom: moderateScale(16),
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalInfoContainer: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    marginBottom: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(6),
  },
  modalLabel: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#475569',
  },
  modalValue: {
    fontSize: fontScale(16),
    fontWeight: '800',
    color: '#374151',
    flex: 1,
    textAlign: 'right',
  },
  modalInstructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
    marginBottom: moderateScale(16),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  modalInstruction: {
    fontSize: fontScale(14),
    color: '#92400E',
    fontWeight: '700',
    marginLeft: moderateScale(8),
    flex: 1,
    textAlign: 'center',
    lineHeight: fontScale(18),
  },
  modalDismissButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(10),
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  modalDismissButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: fontScale(14),
    letterSpacing: 0.3,
  },
  harvestingContainer: {
    padding: moderateScale(isTablet ? 16 : 12),
    minHeight: screenHeight * 0.5,
  },
  summaryBanner: {
    backgroundColor: '#E6FFFA',
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    marginBottom: moderateScale(16),
    borderLeftWidth: 6,
    borderLeftColor: '#22C55E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  summaryTitle: {
    fontSize: fontScale(16),
    fontWeight: '800',
    color: '#0D9488',
    marginLeft: moderateScale(6),
    letterSpacing: 0.5,
  },
  summaryContent: {
    gap: moderateScale(6),
  },
  summaryText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#0D9488',
    lineHeight: fontScale(20),
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(2),
  },
  summaryLabel: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#0D9488',
    flex: 1,
  },
  summaryValue: {
    fontSize: fontScale(15),
    fontWeight: '800',
    color: '#374151',
    flex: 2,
    textAlign: 'right',
  },
  endHarvestContainer: {
    marginTop: moderateScale(12),
    alignItems: 'center',
  },
  endHarvestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: '#FECACA',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  endHarvestButtonText: {
    fontSize: fontScale(15),
    color: '#DC2626',
    fontWeight: '700',
    marginLeft: moderateScale(8),
    letterSpacing: 0.3,
  },
  // Bluetooth Scale Styles
  bluetoothScaleSection: {
    backgroundColor: '#F1F5F9',
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    marginBottom: moderateScale(16),
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  bluetoothSectionTitle: {
    fontSize: fontScale(15),
    fontWeight: '800',
    color: '#374151',
    marginBottom: moderateScale(8),
    letterSpacing: 0.3,
  },
  bluetoothConnectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    marginBottom: moderateScale(8),
  },
  bluetoothConnectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: moderateScale(12),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  bluetoothConnectButtonConnected: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  bluetoothConnectButtonText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#22C55E',
    marginLeft: moderateScale(6),
    letterSpacing: 0.3,
  },
  bluetoothConnectButtonTextConnected: {
    color: '#FFFFFF',
  },
  bluetoothListenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#22C55E',
    borderRadius: moderateScale(12),
    minWidth: moderateScale(80),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  bluetoothListenButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  bluetoothListenButtonText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#22C55E',
    marginLeft: moderateScale(4),
    letterSpacing: 0.3,
  },
  bluetoothListenButtonTextActive: {
    color: '#FFFFFF',
  },
  bluetoothStatusContainer: {
    marginTop: moderateScale(8),
    padding: moderateScale(8),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bluetoothStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bluetoothStatusDot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    marginRight: moderateScale(8),
  },
  bluetoothStatusText: {
    fontSize: fontScale(13),
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
  },
  lastWeightText: {
    fontSize: fontScale(12),
    color: '#64748B',
    marginTop: moderateScale(4),
    fontStyle: 'italic',
    fontWeight: '600',
  },
  // Control button styles
  controlSection: {
    marginTop: moderateScale(12),
    marginBottom: moderateScale(8),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(8),
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    borderRadius: moderateScale(12),
    marginHorizontal: moderateScale(4),
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  primaryButton: {
    backgroundColor: '#22C55E',
    borderWidth: 0,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    borderWidth: 0,
  },
  controlButtonText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: moderateScale(4),
    letterSpacing: 0.3,
  },
  bluetoothConnectedContainer: {
    backgroundColor: '#E6FFFA',
    borderRadius: moderateScale(16),
    padding: moderateScale(10),
    borderWidth: 2,
    borderColor: '#ABEFC6',
    marginBottom: moderateScale(8),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  bluetoothConnectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bluetoothConnectedText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#0D9488',
  },
  bluetoothDeviceName: {
    fontSize: fontScale(11),
    color: '#0D9488',
    marginTop: moderateScale(2),
    fontWeight: '600',
  },
  bluetoothSectionTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: moderateScale(8),
    letterSpacing: 0.3,
  },
});

export default HarvestWizardScreen;
