import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import ConnectScaleModal from "../../components/modals/ConnectScaleModal";
import { GlobalContext } from "../../context/GlobalContext";
import BluetoothScaleService from "../../components/services/BluetoothScaleService";
import makeRequest from "../../components/utils/makeRequest";
import {
    moderateScale,
    fontScale,
    screenWidth,
    screenHeight,
} from '../../components/common/responsive';
const MemberKilosScreen = () => {
    const [route, setRoute] = useState("");
    const [shift, setShift] = useState("");
    const [totalCans, setTotalCans] = useState("");
    const [memberId, setMemberId] = useState("");
    const [canId, setCanId] = useState();
    const [reading, setReading] = useState("");
    const [tareWeight, setTareWeight] = useState("");
    const [netWeight, setNetWeight] = useState("");
    const [sessionTotal, setSessionTotal] = useState("");
    const [isManualScaleInput, setIsManualScaleInput] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [centerId, setCenterId] = useState();
    const {
        instance,
        clientId,
        deviceUID,
        fetchOfflineEventsCount,
        connectionType,
        synchData,
        bluetoothSettings,
        updateBluetoothSettings,
        scaleConnectionState,
        updateScaleConnection,
        updateScaleConnectionStatus,
        setScaleDevice,
        scaleWeight,
        setScaleWeight,
        resetScaleConnection,
    } = useContext(GlobalContext);
    const [grossWeight, setGrossWeight] = useState('');
    const [lockedWeight, setLockedWeight] = useState(null); // Locked weight for submission
    const [isWeightLocked, setIsWeightLocked] = useState(false); // Flag to indicate weight is locked
    const [isWeightStreamingPaused, setIsWeightStreamingPaused] = useState(false); // Track streaming pause state
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [isOneCan, setIsOneCan] = useState(true);
    const [routeId, setRouteId] = useState();
    const [shiftId, setShiftId] = useState();
    const [transporterId, setTransporterId] = useState();


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

    const sendMemberKilos = async () => {
        // Get the weight to submit (locked or current)
        const submissionWeight = getSubmissionWeight();
        setLoading(true);
        try {
            const payload = {
                routeId,
                shiftId,
                canId,
                totalCans,
                centerId,
                transporterId,
                memberId,
                reading,
                tareWeight,
                isManualEntry,
                netWeight: submissionWeight, // Use locked/current weight
                sessionTotal,
                deviceUID, // from global context
            };
            Alert.alert("Required Data", JSON.stringify(payload));
            const [status, response] = await makeRequest({
                url: "member-kilos",
                method: "POST",
                data: payload
            });
            if ([200, 201].includes(status) && response?.savedRecord) {
                setMemberKilos([...memberKilos, response?.record]);
            } else {
                setErrors(response?.errors);

                Alert.alert("An Error occurred", response?.message ?? "Contact Admin");
            }
        } catch (err) {
            console.error("Error submitting Member Kilos", err);
            Alert.alert("Error", "Failed to submit member Kilos.");
        } finally {
            setLoading(false);
        }
    };

    const setupBluetoothScaleService = useCallback(() => {
        BluetoothScaleService.clearWeightCallback();
        BluetoothScaleService.clearStatusCallback();
        BluetoothScaleService.setGlobalContextUpdaters({
            updateScaleConnection,
            updateScaleConnectionStatus,
            setScaleDevice,
            resetScaleConnection,
        });

        BluetoothScaleService.setWeightUpdateInterval(75);
        BluetoothScaleService.setWeightCallback(handleBluetoothWeight);
        BluetoothScaleService.setStatusCallback((status, message, device) => {
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
    const handleModalConnectedDeviceChange = (device) => {
        // console.log('📱 Modal connected device changed:', device);
        // Note: Global device info is now automatically managed by BluetoothScaleService
    };
    const handleModalLastWeightChange = (weight) => {
        setLastBluetoothWeight(weight);
    };
    const handleModalListeningStatusChange = (isListening) => {
        setBluetoothScaleListening(isListening);
    };
    const handleModalConnectionStatusChange = (status) => {

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
            }
        } catch (error) {
            Alert.alert("ERROR", error?.message ?? JSON.stringify(error));
            // services.showNotification('Error', error.message, 'error');
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

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            {/* Route */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={route} onValueChange={setRoute}>
                    <Picker.Item label="Select Route/Transporter" value="" />
                    <Picker.Item label="Route 1" value="route1" />
                    <Picker.Item label="Route 2" value="route2" />
                </Picker>
            </View>

            {/* Shift */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={shift} onValueChange={setShift}>
                    <Picker.Item label="Select Shift" value="" />
                    <Picker.Item label="Shift A" value="ShiftA" />
                    <Picker.Item label="Shift B" value="ShiftB" />
                </Picker>
            </View>

            {/* Can no & Total Cans */}
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Can No."
                    value={canId}
                    onChangeText={setCanId}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Total Number of Cans"
                    value={totalCans}
                    onChangeText={setTotalCans}
                />
            </View>

            {/* Member number & name */}
            <TextInput
                style={styles.input}
                placeholder="Member Number"
                value={memberId}
                onChangeText={setMemberId}
            />

            {/* Can type */}
            <View style={styles.radioRow}>
                <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setTotalCans(true)}
                >
                    <View style={[styles.radioCircle, isOneCan && styles.selected]} />
                    <Text style={styles.radioLabel}>ONE CAN ONLY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setIsOneCan(false)}
                >
                    <View
                        style={[styles.radioCircle, !isOneCan && styles.selected]}
                    />
                    <Text style={styles.radioLabel}>MULTIPLE CANS</Text>
                </TouchableOpacity>
            </View>

            {/* 🔹 Button to launch ConnectScaleModal */}
            <TouchableOpacity
                style={[styles.button, { backgroundColor: "#555" }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.buttonText}>Connect Scale</Text>
            </TouchableOpacity>


            {/* Levi edit code */}
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


            {/* Reading row */}
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Reading"
                    value={scaleWeight || reading}  // 🔹 show Bluetooth weight if available
                    onChangeText={(text) => {
                        setReading(text);
                        setScaleWeight(text); // keep global in sync
                    }}
                />
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Tare Weight"
                    value={tareWeight}
                    onChangeText={setTareWeight}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Net Weight"
                    value={netWeight}
                    onChangeText={setNetWeight}
                />
            </View>
            {/* Save Button */}
            <TouchableOpacity style={styles.button} onPress={() => sendMemberKilos()}>
                <Text style={styles.buttonText}>Save Record</Text>
            </TouchableOpacity>

            {/* 🔹 ConnectScaleModal plugged here */}
            <ConnectScaleModal
                visible={modalVisible}
                filter={"scale"}
                onClose={() => setModalVisible(false)}
                onWeightReceived={handleBluetoothWeight}
                onConnectionStatusChange={handleModalConnectionStatusChange}
                onConnectedDeviceChange={handleModalConnectedDeviceChange}
                onListeningStatusChange={handleModalListeningStatusChange}
                onLastWeightChange={handleModalLastWeightChange}
            />
        </ScrollView>
    );
};

export default MemberKilosScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f4f6f8",
    },
    inputWrapper: {
        backgroundColor: "white",
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    input: {
        backgroundColor: "white",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    row: {
        flexDirection: "row",
        marginBottom: 12,
    },
    radioRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 16,
        alignItems: "center",
    },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#00897b",
        marginRight: 6,
    },
    selected: {
        backgroundColor: "#00897b",
    },
    radioLabel: {
        fontSize: 14,
        color: "#333",
    },
    button: {
        backgroundColor: "#00897b",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    buttonText: {
        color: "white",
        fontWeight: "bold",
        fontSize: 16,
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
});
