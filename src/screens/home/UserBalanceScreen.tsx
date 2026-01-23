import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    SafeAreaView,
    Alert,
    FlatList,
    ActivityIndicator,
    Modal,
    ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialIcons';
import DropDownPicker from 'react-native-dropdown-picker';
import fetchCommonData from '../../components/utils/fetchCommonData';
import useBluetoothService from '../../hooks/useBluetoothService';
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserBalanceSummaryScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [commonData, setCommonData] = useState<any>({});
    const [userSummary, setUserSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [memberTotals, setMemberTotals] = useState<any>([]);
    const [transactionType, setTransactionType] = useState<"all" | "delivery" | "deduction">("all");
    const [customerOpen, setCustomerOpen] = useState(false);
    const [customerValue, setCustomerValue] = useState<number | null>(null);
    const [customerItems, setCustomerItems] = useState<any[]>([]);
    const [transactionDetailsModalVisible, setTransactionDetailsModalVisible] = useState(false);
    const [selectedTransactionDetails, setSelectedTransactionDetails] = useState<any>(null);
    const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // Printer hook
    const printerBluetooth = useBluetoothService({ deviceType: "printer" });
    const {
        devices: printerDevices,
        connectToDevice: connectToPrinterDevice,
        scanForDevices: scanForPrinterDevices,
        connectedDevice: connectedPrinterDevice,
        isScanning: isScanningPrinter,
        isConnecting: isConnectingPrinter,
        disconnect: disconnectPrinter,
        printText: printTextToPrinter,
    } = printerBluetooth;

    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    const isMountedRef = useRef(true);

    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);


    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [members] = await Promise.all([
                    fetchCommonData({ name: 'members' }),
                ]);
                const allData = { members };
                setCommonData(allData);
                setCustomerItems(
                    (members || []).map((c: any) => ({
                        label: `${c.first_name} ${c.last_name}(${c.primary_phone})`,
                        value: c.id,
                    }))
                );

            } catch (error: any) {
                Alert.alert('Error', `Failed to load common data: ${error.message || error}`);
            }
        };

        loadCommonData();
    }, []);

    const onChangeFromDate = (event: any, selectedDate?: Date) => {
        setShowFromPicker(false);
        if (selectedDate && selectedDate <= new Date()) {
            setFromDate(selectedDate);
            if (selectedDate > toDate) {
                setToDate(selectedDate);
            }
        }
    };

    const onChangeToDate = (event: any, selectedDate?: Date) => {
        setShowToPicker(false);
        if (selectedDate && selectedDate <= new Date() && selectedDate >= fromDate) {
            setToDate(selectedDate);
        }
    };

    useEffect(() => {
        const loadReport = async (customerValue: number | null) => {
            if (customerValue) {
                try {
                    setUserSummary([]);
                    setLoading(true);
                    const today = new Date();
                    const created_at_gte = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                    const created_at_lte = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                    const activities = await fetchCommonData({
                        name: "customer_delivery_summary",
                        params: {
                            created_at_gte,
                            created_at_lte,
                            member_id: customerValue,
                        },
                    });
                    if (activities['error']) {
                        Alert.alert("Error", activities?.message ?? JSON.stringify(activities));
                        return
                    }
                    setUserSummary(activities || []);
                    setMemberTotals(activities);

                } catch (error) {
                    console.error("Error loading user summary:", error);
                    Alert.alert("Error", `Failed to load user summary report ${JSON.stringify(error)}`);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadReport(customerValue);
    }, [fromDate, toDate, customerValue]);

    // Helper: Connect to saved printer or scan and connect to first InnerPrinter
    const connectToPrinterForPrinting = useCallback(async (): Promise<boolean> => {
        try {
            console.log('[PRINT] Checking for saved printer...');
            const lastPrinter = await AsyncStorage.getItem('last_device_printer');
            if (lastPrinter) {
                try {
                    const printerData = JSON.parse(lastPrinter);
                    const deviceId = printerData.id || printerData.address || printerData.address_or_id;
                    if (deviceId) {
                        console.log('[PRINT] Found saved printer:', printerData.name || deviceId);
                        const result = await connectToPrinterDevice(deviceId);
                        if (result) {
                            console.log('[PRINT] Connected to saved printer');
                            return true;
                        }
                    }
                } catch (parseErr) {
                    console.warn('[PRINT] Error with saved printer:', parseErr);
                }
            }

            console.log('[PRINT] Scanning for InnerPrinter devices...');
            await scanForPrinterDevices();
            await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

            const innerPrinters = printerDevices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            if (innerPrinters.length > 0) {
                const firstInnerPrinter = innerPrinters[0];
                const deviceId = firstInnerPrinter.id || firstInnerPrinter.address;
                console.log('[PRINT] Found InnerPrinter:', firstInnerPrinter.name || deviceId);
                const result = await connectToPrinterDevice(deviceId);
                if (result) {
                    const printerInfo = {
                        id: firstInnerPrinter.id,
                        address: firstInnerPrinter.id,
                        name: firstInnerPrinter.name || 'InnerPrinter',
                        type: 'classic',
                        address_or_id: firstInnerPrinter.id,
                        saved_at: new Date().toISOString()
                    };
                    await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerInfo));
                    console.log('[PRINT] Connected to InnerPrinter');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('[PRINT] Error connecting to printer:', error);
            return false;
        }
    }, [connectToPrinterDevice, scanForPrinterDevices, printerDevices]);

    // Helper: Print receipt using connected printer
    const printReceipt = useCallback(async (receiptText: string, deviceOverride?: any): Promise<boolean> => {
        console.log('[PRINTER] Printing receipt...');
        let printerDevice = deviceOverride || connectedPrinterDevice;

        if (!printerDevice) {
            console.error('[PRINT] No printer connected');
            Alert.alert("Printer Not Available", "No printer connected. Please connect a printer to print the receipt.");
            return false;
        }

        if (!printTextToPrinter) {
            console.error('[PRINT] Print function not available');
            Alert.alert("Printer Not Available", "Print function is not available. Please check printer connection.");
            return false;
        }

        try {
            await printTextToPrinter(receiptText);
            console.log('[PRINT] Receipt printed successfully');
            return true;
        } catch (error) {
            console.error('[PRINT] Print error:', error);
            Alert.alert("Print Error", "An error occurred while printing. Please check the printer and try again.");
            return false;
        }
    }, [connectedPrinterDevice, printTextToPrinter]);

    const handleTransactionClick = async (transactionItem: any) => {
        try {
            setLoadingTransactionDetails(true);
            setTransactionDetailsModalVisible(true);

            // Fetch detailed transaction data including shift details
            const transactionDetails = await fetchCommonData({
                cachable: false,
                name: "transaction_details",
                params: {
                    transaction_id: transactionItem.id,
                    member: customerValue,
                },
            });

            if (transactionDetails && !transactionDetails['error']) {
                setSelectedTransactionDetails({
                    ...transactionItem,
                    details: transactionDetails,
                });
            } else {
                // If API doesn't exist or fails, show basic info
                setSelectedTransactionDetails(transactionItem);
            }
        } catch (error) {
            console.error("Error loading transaction details:", error);
            // Show basic info even if detailed fetch fails
            setSelectedTransactionDetails(transactionItem);
        } finally {
            setLoadingTransactionDetails(false);
        }
    };

    const formatTransactionReceipt = (deliveryData: any) => {
        const member = (commonData?.members || []).find((m: any) => m.id === customerValue);
        const deliveryDate = deliveryData?.created_at || deliveryData?.transaction_date
            ? new Date(deliveryData.created_at || deliveryData.transaction_date).toLocaleDateString()
            : 'N/A';
        const shiftName = deliveryData?.shift?.name || deliveryData?.shift_name || 'N/A';
        const quantity = parseFloat(deliveryData?.quantity || deliveryData?.kgs || deliveryData?.total_quantity || 0);
        const cans = deliveryData?.details?.cans || deliveryData?.cans || [];
        const transporter = deliveryData?.transporter || deliveryData?.details?.transporter;
        const route = deliveryData?.route || deliveryData?.details?.route;
        const center = deliveryData?.center || deliveryData?.details?.center;

        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      MEMBER KILOS RECEIPT\n";
        receipt += "================================\n";
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];
        receipt += `Date: ${dateStr} ${timeStr}\n`;
        receipt += `Member: ${member ? `${member.first_name} ${member.last_name}` : 'N/A'}\n`;
        if (member) {
            const memberNo = member.member_no || member.membership_no || member.membershipNo;
            if (memberNo) {
                receipt += `Member No: ${memberNo}\n`;
            }
        }
        receipt += `Transporter: ${transporter?.full_names || transporter?.name || 'N/A'}\n`;
        receipt += `Shift: ${shiftName}\n`;
        receipt += `Route: ${route?.route_name || route?.name || 'N/A'}\n`;
        receipt += `Center: ${center?.center || center?.name || 'N/A'}\n`;
        receipt += "--------------------------------\n";
        receipt += `Total Cans: ${cans.length || 0}\n`;
        receipt += `Total Quantity: ${quantity.toFixed(2)} KG\n`;
        receipt += "--------------------------------\n";
        receipt += "Cans Details:\n";

        (cans || []).forEach((can: any, index: number) => {
            const canLabel = can.can_label || can.can_id || `Can ${can.can_number || index + 1}`;
            const netWeight = parseFloat(can.net || can.net_weight || can.quantity || 0);
            receipt += `${index + 1}. ${canLabel} - Net: ${netWeight.toFixed(2)} KG\n`;
        });

        receipt += "--------------------------------\n";
        receipt += `TOTAL NET WEIGHT: ${quantity.toFixed(2)} KG\n`;
        receipt += "================================\n";
        receipt += "Thank you for your delivery!\n";
        receipt += "================================\n";
        receipt += "Powered by eDairy.africa\n";
        receipt += "\n\n";

        return receipt;
    };

    const handlePrintTransactionDetails = async () => {
        if (!selectedTransactionDetails) return;

        const receiptText = formatTransactionReceipt(selectedTransactionDetails);
        setIsPrinting(true);

        try {
            let connectedPrinter: any = null;

            if (connectedPrinterDevice) {
                try {
                    let isStillConnected = false;
                    if (connectedPrinterDevice.type === 'ble' && connectedPrinterDevice.bleDevice) {
                        isStillConnected = (connectedPrinterDevice.bleDevice as any).isConnected === true;
                    } else if (connectedPrinterDevice.type === 'classic' && connectedPrinterDevice.classicDevice) {
                        isStillConnected = await connectedPrinterDevice.classicDevice.isConnected();
                    }
                    if (isStillConnected) {
                        connectedPrinter = connectedPrinterDevice;
                    }
                } catch (checkErr) {
                    console.warn('[PRINT] Error checking existing connection:', checkErr);
                }
            }

            if (!connectedPrinter) {
                try {
                    const connected = await connectToPrinterForPrinting();
                    if (connected) {
                        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
                        if (connectedPrinterDevice) {
                            connectedPrinter = connectedPrinterDevice;
                        }
                    }
                } catch (connectErr) {
                    console.error('[PRINT] Error connecting:', connectErr);
                }
            }

            if (!connectedPrinter) {
                setIsPrinting(false);
                setPrinterModalVisible(true);
                await AsyncStorage.setItem('pending_receipt', receiptText);
                return;
            }

            await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));

            const printSuccess = await printReceipt(receiptText, connectedPrinter);
            if (printSuccess) {
                Alert.alert("Success", "Delivery receipt printed successfully!");
                setTransactionDetailsModalVisible(false);
            }
        } catch (error) {
            console.error("[PRINT] Error:", error);
            Alert.alert("Error", "Failed to print. Please try again.");
        } finally {
            setIsPrinting(false);
        }
    };

    const handleGenerate = () => {
        const filters = {
            from: fromDate.toDateString(),
            to: toDate.toDateString(),
            customer: customerValue,
            transactionType,
        };
        console.log('Generate Report with filters:', filters);
        Alert.alert('Success', 'Report Generated!');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
            >
                <Text style={styles.title}>Member Milk Delivery</Text>
                
                <View style={styles.filtersContainer}>
                    <View style={styles.row}>
                    {/* From Date */}
                    <View style={styles.col}>
                        <Text style={styles.label}>From</Text>
                        <View style={styles.inputWithIcon}>
                            <TextInput
                                style={styles.input}
                                placeholder="Select From Date"
                                value={fromDate.toDateString()}
                                editable={false}
                            />
                            <TouchableOpacity
                                style={styles.iconInside}
                                onPress={() => setShowFromPicker(true)}
                            >
                                <Icon name="calendar-today" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                        {showFromPicker && (
                            <DateTimePicker
                                value={fromDate}
                                mode="date"
                                maximumDate={new Date()}
                                display="default"
                                onChange={onChangeFromDate}
                            />
                        )}
                    </View>

                    {/* To Date */}
                    <View style={styles.col}>
                        <Text style={styles.label}>To</Text>
                        <View style={styles.inputWithIcon}>
                            <TextInput
                                style={styles.input}
                                placeholder="Select To Date"
                                value={toDate.toDateString()}
                                editable={false}
                            />
                            <TouchableOpacity
                                style={styles.iconInside}
                                onPress={() => setShowToPicker(true)}
                            >
                                <Icon name="calendar-today" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                        {showToPicker && (
                            <DateTimePicker
                                value={toDate}
                                mode="date"
                                minimumDate={fromDate}
                                maximumDate={new Date()}
                                display="default"
                                onChange={onChangeToDate}
                            />
                        )}
                    </View>
                </View>

                {/* Select Customer */}
                <View style={[styles.col, { marginHorizontal: 0, marginBottom: 16 }]}>
                    <Text style={styles.label}>Member</Text>
                    <DropDownPicker
                    open={customerOpen}
                    value={customerValue}
                    items={customerItems}
                    setOpen={setCustomerOpen}
                    setValue={setCustomerValue}
                    setItems={setCustomerItems}
                    searchable={true}
                    placeholder="Select customer"
                    listMode="SCROLLVIEW"
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownBox}
                    zIndex={2000}
                    zIndexInverse={2500}
                    scrollViewProps={{ nestedScrollEnabled: true }}
                />
                </View>
                </View>

                {/* Milk Deliveries List */}
                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Milk Deliveries</Text>
                    {loading ? (
                        <ActivityIndicator size="large" color="#1b7f74" style={{ marginTop: 20 }} />
                    ) : userSummary.length === 0 ? (
                        <Text style={styles.noDataText}>
                            No deliveries found for the selected period
                        </Text>
                    ) : (
                            <FlatList
                            data={userSummary}
                            keyExtractor={(item, idx) => idx.toString()}
                            scrollEnabled={false}
                            nestedScrollEnabled={true}
                            renderItem={({ item }) => {
                                const deliveryDate = item?.created_at || item?.transaction_date
                                    ? new Date(item.created_at || item.transaction_date).toLocaleDateString()
                                    : 'N/A';
                                const shiftName = item?.shift?.name || item?.shift_name || 'N/A';
                                const quantity = parseFloat(item?.quantity || item?.kgs || 0);

                                return (
                                    <TouchableOpacity
                                        style={styles.deliveryRow}
                                        onPress={() => handleTransactionClick(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.deliveryLeft}>
                                            <Text style={styles.deliveryDate}>{deliveryDate}</Text>
                                            <Text style={styles.deliveryShift}>{shiftName}</Text>
                                        </View>
                                        <View style={styles.deliveryRight}>
                                            <Text style={styles.deliveryQuantity}>
                                                {quantity.toFixed(2)} KG
                                            </Text>
                                            <Icon name="chevron-right" size={20} color="#999" />
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            ListFooterComponent={() => {
                                // Calculate total quantity
                                const totalQuantity = userSummary.reduce((sum, item) => {
                                    const quantity = parseFloat(item?.quantity || item?.kgs || 0);
                                    return sum + quantity;
                                }, 0);

                                return (
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>Total Milk Delivered:</Text>
                                        <Text style={styles.totalValue}>{totalQuantity.toFixed(2)} KG</Text>
                                    </View>
                                );
                            }}
                        />
                    )}
                </View>

                {/* Print Button */}
                <TouchableOpacity 
                    style={[styles.printReportButton, (loading || userSummary.length === 0) && { opacity: 0.5 }]} 
                    onPress={handleGenerate}
                    disabled={loading || userSummary.length === 0}
                >
                    <Icon name="print" size={20} color="#fff" />
                    <Text style={styles.printReportButtonText}>Print Report</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Transaction Details Modal */}
            <Modal
                visible={transactionDetailsModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setTransactionDetailsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Delivery Details</Text>
                            <TouchableOpacity onPress={() => setTransactionDetailsModalVisible(false)}>
                                <Icon name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        {loadingTransactionDetails ? (
                            <View style={styles.modalLoading}>
                                <ActivityIndicator size="large" color="#1b7f74" />
                                <Text style={styles.loadingText}>Loading delivery details...</Text>
                            </View>
                        ) : selectedTransactionDetails ? (
                            <ScrollView style={styles.modalContent}>
                                {/* Delivery Information */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailSectionTitle}>Delivery Information</Text>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Date:</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedTransactionDetails.created_at || selectedTransactionDetails.transaction_date
                                                ? new Date(selectedTransactionDetails.created_at || selectedTransactionDetails.transaction_date).toLocaleDateString()
                                                : 'N/A'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Member:</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedTransactionDetails.customer?.first_name || selectedTransactionDetails.member?.first_name || 'N/A'} {selectedTransactionDetails.customer?.last_name || selectedTransactionDetails.member?.last_name || ''}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Shift:</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedTransactionDetails.shift?.name || selectedTransactionDetails.shift_name || 'N/A'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Total Quantity:</Text>
                                        <Text style={[styles.detailValue, styles.detailHighlight]}>
                                            {parseFloat(selectedTransactionDetails.quantity || selectedTransactionDetails.kgs || selectedTransactionDetails.total_quantity || 0).toFixed(2)} KG
                                        </Text>
                                    </View>
                                    {(selectedTransactionDetails.transporter || selectedTransactionDetails.details?.transporter) && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Transporter:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedTransactionDetails.transporter?.full_names || selectedTransactionDetails.transporter?.name || selectedTransactionDetails.details?.transporter?.full_names || 'N/A'}
                                            </Text>
                                        </View>
                                    )}
                                    {(selectedTransactionDetails.route || selectedTransactionDetails.details?.route) && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Route:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedTransactionDetails.route?.route_name || selectedTransactionDetails.route?.name || selectedTransactionDetails.details?.route?.route_name || 'N/A'}
                                            </Text>
                                        </View>
                                    )}
                                    {(selectedTransactionDetails.center || selectedTransactionDetails.details?.center) && (
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Center:</Text>
                                            <Text style={styles.detailValue}>
                                                {selectedTransactionDetails.center?.center || selectedTransactionDetails.center?.name || selectedTransactionDetails.details?.center?.center || 'N/A'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Cans Delivered */}
                                {((selectedTransactionDetails.details?.cans && selectedTransactionDetails.details.cans.length > 0) ||
                                    (selectedTransactionDetails.cans && selectedTransactionDetails.cans.length > 0)) ? (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailSectionTitle}>Cans Delivered</Text>
                                        {(selectedTransactionDetails.details?.cans || selectedTransactionDetails.cans || []).map((can: any, index: number) => {
                                            const canLabel = can.can_label || can.can_id || `Can ${can.can_number || index + 1}`;
                                            const netWeight = parseFloat(can.net || can.net_weight || can.quantity || can.kgs || 0);
                                            return (
                                                <View key={index} style={styles.canItem}>
                                                    <View style={styles.canNumberBadge}>
                                                        <Text style={styles.canNumberText}>
                                                            {canLabel}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.canQuantity}>
                                                        {netWeight.toFixed(2)} KG
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailSectionTitle}>Cans Delivered</Text>
                                        <Text style={styles.noDataText}>No can details available for this delivery</Text>
                                    </View>
                                )}
                            </ScrollView>
                        ) : null}

                        {/* Print Button */}
                        {!loadingTransactionDetails && selectedTransactionDetails && (
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={[styles.printButton, isPrinting && { opacity: 0.6 }]}
                                    onPress={handlePrintTransactionDetails}
                                    disabled={isPrinting}
                                >
                                    {isPrinting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Icon name="print" size={20} color="#fff" />
                                            <Text style={styles.printButtonText}>Print Delivery Receipt</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Printer Connection Modal */}
            <BluetoothConnectionModal
                visible={printerModalVisible}
                onClose={() => setPrinterModalVisible(false)}
                type="device-list"
                deviceType="printer"
                title="Select Printer"
                devices={printerDevices}
                connectToDevice={async (id: string) => {
                    try {
                        const result = await connectToPrinterDevice(id);
                        if (result) {
                            const printerInfo = {
                                id: result.id,
                                address: result.id,
                                name: result.name || 'Printer',
                                type: result.type || 'classic',
                                address_or_id: result.id,
                                saved_at: new Date().toISOString()
                            };
                            await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerInfo));

                            const pendingReceipt = await AsyncStorage.getItem('pending_receipt');
                            if (pendingReceipt) {
                                setIsPrinting(true);
                                const printSuccess = await printReceipt(pendingReceipt);
                                if (printSuccess) {
                                    await AsyncStorage.removeItem('pending_receipt');
                                    Alert.alert("Success", "Delivery receipt printed successfully!");
                                }
                                setIsPrinting(false);
                            }
                            setPrinterModalVisible(false);
                        }
                        return result;
                    } catch (err) {
                        console.error('[PRINT] Error in printer modal connect:', err);
                        return null;
                    }
                }}
                scanForDevices={scanForPrinterDevices}
                isScanning={isScanningPrinter}
                isConnecting={isConnectingPrinter}
                connectedDevice={connectedPrinterDevice}
                disconnect={disconnectPrinter}
            />
        </SafeAreaView>
    );

};

export default UserBalanceSummaryScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    filtersContainer: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    col: {
        flex: 1,
        marginHorizontal: 4,
    },
    label: {
        fontSize: 14,
        marginBottom: 6,
        color: '#444',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 8,
        paddingRight: 40,
        backgroundColor: '#fff',
        fontSize: 14,
        color: '#333',
    },
    iconInside: {
        position: 'absolute',
        right: 8,
        padding: 4,
    },
    dropdown: {
        borderRadius: 6,
        borderColor: '#ddd',
        backgroundColor: '#fff',
        minHeight: 40,
    },
    dropdownBox: {
        borderColor: '#ddd',
        backgroundColor: '#fff',
        borderRadius: 6,
    },
    summarySection: {
        marginTop: 20,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    noDataText: {
        textAlign: 'center',
        marginVertical: 20,
        color: '#666',
        fontSize: 14,
    },
    radioContainer: {
        flexDirection: 'row',
        marginVertical: 10,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    radioCircle: {
        height: 18,
        width: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#1b7f74',
        marginRight: 6,
    },
    radioCircleSelected: {
        backgroundColor: '#1b7f74',
    },
    radioLabel: {
        fontSize: 14,
        color: '#444',
    },
    deliveryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    deliveryLeft: {
        flex: 1,
    },
    deliveryDate: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        marginBottom: 2,
    },
    deliveryShift: {
        fontSize: 13,
        color: '#666',
    },
    deliveryRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deliveryQuantity: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1b7f74',
        minWidth: 80,
        textAlign: 'right',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderTopWidth: 2,
        borderColor: '#1b7f74',
        marginTop: 6,
        backgroundColor: '#f0f9ff',
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#222',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1b7f74',
    },
    printReportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1b7f74',
        paddingVertical: 14,
        borderRadius: 8,
        marginTop: 20,
        gap: 8,
    },
    printReportButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        width: '100%',
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalLoading: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    modalContent: {
        padding: 16,
        maxHeight: 400,
    },
    detailSection: {
        marginBottom: 20,
    },
    detailSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    detailLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    detailHighlight: {
        color: '#1b7f74',
        fontSize: 16,
    },
    canItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#1b7f74',
    },
    canNumberBadge: {
        backgroundColor: '#1b7f74',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    canNumberText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    canQuantity: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    descriptionText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    printButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1b7f74',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    printButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});
