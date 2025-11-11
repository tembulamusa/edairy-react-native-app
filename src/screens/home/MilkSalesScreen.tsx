import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from 'react-native-vector-icons/MaterialIcons';
import DropDownPicker from 'react-native-dropdown-picker';
import fetchCommonData from '../../components/utils/fetchCommonData';
import MilkSaleModal from '../../components/modals/MilkSaleModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useBluetoothService from '../../hooks/useBluetoothService';

const MilkSalesScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [saleType, setSaleType] = useState('all');
    const [modalVisible, setModalVisible] = useState(false);
    const [commonData, setCommonData] = useState<any>({});
    const [milkSalesSummary, setMilkSalesSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Dropdowns
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState<any[]>([]);

    const [customerOpen, setCustomerOpen] = useState(false);
    const [customerValue, setCustomerValue] = useState<number | null>(null);
    const [customerItems, setCustomerItems] = useState<any[]>([]);

    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    const [printing, setPrinting] = useState(false);

    const {
        devices: printerDevices,
        connectToDevice: connectToPrinterDevice,
        scanForDevices: scanForPrinters,
        connectedDevice: connectedPrinter,
        isConnecting: isConnectingPrinter,
        printText,
    } = useBluetoothService({ deviceType: 'printer' });

    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    const autoConnectAttemptedRef = useRef(false);


    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, customers, shifts] = await Promise.all([
                    fetchCommonData({ name: 'transporters' }),
                    fetchCommonData({ name: 'customers' }),
                    fetchCommonData({ name: 'shifts' }),
                ]);
                const allData = { transporters, customers, shifts };
                setCommonData(allData);

                // ✅ Transporters
                setTransporterItems(
                    (transporters || []).map((transporter: any) => ({
                        label:
                            transporter?.full_names ||
                            transporter?.name ||
                            transporter?.registration_number ||
                            `Transporter ${transporter?.id}`,
                        value: transporter?.id,
                    }))
                );

                // ✅ Customers
                setCustomerItems(
                    customers?.map((s: any) => ({
                        label: `${s.customer?.first_name} ${s?.customer?.last_name}`,
                        value: s.id,
                    })) || []
                );

                setShiftItems([
                    { label: "All Shifts", value: "all" },
                    ...(shifts || []).map((shift: any) => ({
                        label: shift.description || `Shift ${shift.id}`,
                        value: shift.id,
                    }))
                ]);


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
        const loadReport = async () => {
            try {
                setMilkSalesSummary([]);
                setLoading(true);
                const today = new Date();
                const from = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                const to = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];

                const sales = await fetchCommonData({
                    name: "milk_sales",
                    params: {
                        from,
                        to,
                        customer: customerValue,
                        saleType,
                    },
                });

                setMilkSalesSummary(sales || []);
            } catch (error) {
                console.error("Error loading sales report:", error);
                Alert.alert("Error", "Failed to load sales report");
            } finally {
                setLoading(false);
            }
        };

        loadReport();
    }, [fromDate, toDate, customerValue, saleType]);


    const totalAmount = milkSalesSummary.reduce(
        (sum, s) => sum + (s.total_amount || 0),
        0
    );

    const wait = useCallback(
        (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms)),
        []
    );

    const persistLastPrinter = useCallback(async (device: any) => {
        if (!device) return;
        try {
            const payload = {
                id: device?.id || device?.address || device?.address_or_id,
                address: device?.address || device?.id || device?.address_or_id,
                name: device?.name || device?.label || 'Printer',
                type: device?.type || 'classic',
                saved_at: new Date().toISOString(),
            };

            if (!payload.id || !payload.address) return;

            await AsyncStorage.setItem('last_device_printer', JSON.stringify(payload));
        } catch (error) {
            console.error('[MilkSales] persistLastPrinter error', error);
        }
    }, []);

    const formatSummaryReceipt = useCallback(() => {
        const transporter = transporterItems.find(item => item.value === transporterValue);
        const customer = customerItems.find(item => item.value === customerValue);
        const shift = shiftItems.find(item => item.value === shiftValue);

        let receipt = '';
        receipt += '================================\n';
        receipt += '      MILK SALES SUMMARY\n';
        receipt += '================================\n';
        receipt += `Generated: ${new Date().toISOString()}\n`;
        receipt += `From: ${fromDate.toISOString().split('T')[0]}\n`;
        receipt += `To: ${toDate.toISOString().split('T')[0]}\n`;
        receipt += `Sale Type: ${saleType.toUpperCase()}\n`;
        receipt += `Transporter: ${transporter?.label || 'All'}\n`;
        receipt += `Customer: ${customer?.label || 'All'}\n`;
        receipt += `Shift: ${shift?.label || 'All'}\n`;
        receipt += '--------------------------------\n';

        if (milkSalesSummary.length === 0) {
            receipt += 'No milk sales found.\n';
        } else {
            milkSalesSummary.forEach((item, index) => {
                const date = item?.transaction_date
                    ? new Date(item.transaction_date).toISOString().split('T')[0]
                    : 'N/A';
                const amount = parseFloat(item?.total_amount || item?.quantity || '0');
                receipt += `${index + 1}. ${date}  ${amount.toFixed(2)} KES\n`;
            });
        }

        receipt += '--------------------------------\n';
        receipt += `Entries: ${milkSalesSummary.length}\n`;
        receipt += `Total Amount: ${totalAmount.toFixed(2)} KES\n`;
        receipt += '================================\n';
        receipt += 'Thank you for using eDairy\n';
        receipt += '================================\n\n';

        return receipt;
    }, [transporterItems, transporterValue, customerItems, customerValue, shiftItems, shiftValue, milkSalesSummary, saleType, fromDate, toDate, totalAmount]);

    const connectToStoredPrinter = useCallback(async () => {
        if (connectedPrinter) {
            await persistLastPrinter(connectedPrinter);
            return connectedPrinter;
        }

        try {
            const stored = await AsyncStorage.getItem('last_device_printer');
            if (!stored) return null;

            const data = JSON.parse(stored);
            const deviceId = data?.id || data?.address || data?.address_or_id;
            if (!deviceId) return null;

            const result = await connectToPrinterDevice(deviceId);
            if (result) {
                await persistLastPrinter(result);
                return result;
            }
        } catch (error) {
            console.error('[MilkSales] connectToStoredPrinter error', error);
        }
        return null;
    }, [connectedPrinter, connectToPrinterDevice, persistLastPrinter]);

    const connectToInnerPrinter = useCallback(async () => {
        try {
            await scanForPrinters();
            await wait(2000);
            const devices = printerDevicesRef.current || [];
            const innerPrinter = devices.find((device: any) => {
                const name = (device?.name || device?.label || '').toLowerCase();
                return name.includes('innerprinter');
            });

            if (!innerPrinter) return null;

            const deviceId = innerPrinter?.id || innerPrinter?.address || innerPrinter?.address_or_id;
            if (!deviceId) return null;

            const result = await connectToPrinterDevice(deviceId);
            if (result) {
                await persistLastPrinter(result);
                return result;
            }
        } catch (error) {
            console.error('[MilkSales] connectToInnerPrinter error', error);
        }
        return null;
    }, [scanForPrinters, connectToPrinterDevice, persistLastPrinter, wait]);

    const handlePrintReport = useCallback(async () => {
        if (printing || isConnectingPrinter) return;
        if (!milkSalesSummary || milkSalesSummary.length === 0) {
            Alert.alert('No Data', 'There are no milk sales to print.');
            return;
        }

        setPrinting(true);
        try {
            let printer = connectedPrinter;
            if (!printer) {
                printer = await connectToStoredPrinter();
            }
            if (!printer) {
                printer = await connectToInnerPrinter();
            }

            if (!printer) {
                Alert.alert(
                    'Printer Not Found',
                    'Unable to connect to InnerPrinter. Please ensure it is powered on and within range.'
                );
                return;
            }

            if (!printText) {
                Alert.alert('Print Error', 'Printer interface not available.');
                return;
            }

            const receipt = formatSummaryReceipt();
            await printText(receipt);
            await persistLastPrinter(printer);
            Alert.alert('Success', 'Milk sales report sent to printer.');
        } catch (error) {
            console.error('[MilkSales] handlePrintReport error', error);
            Alert.alert('Print Error', 'Failed to print the report. Please try again.');
        } finally {
            setPrinting(false);
        }
    }, [
        printing,
        isConnectingPrinter,
        milkSalesSummary,
        connectedPrinter,
        connectToStoredPrinter,
        connectToInnerPrinter,
        printText,
        formatSummaryReceipt,
        persistLastPrinter,
    ]);

    useEffect(() => {
        if (autoConnectAttemptedRef.current) return;
        autoConnectAttemptedRef.current = true;

        (async () => {
            let printer = connectedPrinter;
            if (!printer) {
                printer = await connectToStoredPrinter();
            }
            if (!printer) {
                await connectToInnerPrinter();
            }
        })();
    }, [connectedPrinter, connectToStoredPrinter, connectToInnerPrinter]);


    return (
        <SafeAreaView style={styles.container}>
            {/* Header row */}
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Transporter Milk Sales</Text>
                <TouchableOpacity
                    style={styles.newSaleButton}
                    onPress={() => setModalVisible(true)}
                >
                    <Icon name="add-circle-outline" size={22} color="#fff" />
                    <Text style={styles.newSaleText}>New Sale</Text>
                </TouchableOpacity>
            </View>

            {/* From & To in same row */}
            <View style={styles.row}>
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

            {/*  */}
            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.label}>Transporter</Text>
                    <DropDownPicker
                        open={transporterOpen}
                        value={transporterValue}
                        items={transporterItems}
                        setOpen={setTransporterOpen}
                        setValue={setTransporterValue}
                        setItems={setTransporterItems}
                        placeholder="Select Transporter"
                        zIndex={2500}
                        zIndexInverse={2000}
                        style={styles.dropdown}
                        dropDownContainerStyle={styles.dropdownBox}
                        searchable={true}   // ✅ Added searchable
                        searchPlaceholder="Search transporter..." // optional
                    />
                </View>

                <View style={styles.col}>
                    <Text style={styles.label}>customer</Text>
                    <DropDownPicker
                        open={customerOpen}
                        value={customerValue}
                        items={customerItems}
                        setOpen={setCustomerOpen}
                        setValue={setCustomerValue}
                        setItems={setCustomerItems}
                        searchable={true}
                        placeholder="Select customer"
                        style={styles.dropdown}
                        dropDownContainerStyle={styles.dropdownBox}
                        zIndex={2000}
                        zIndexInverse={2500}
                    />
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.col}>
                    <DropDownPicker
                        open={shiftOpen}
                        value={shiftValue}
                        items={shiftItems}
                        setOpen={setShiftOpen}
                        setValue={setShiftValue}
                        setItems={setShiftItems}
                        searchable={true}
                        placeholder="Select Shift"  // ✅ Fix this
                        style={styles.dropdown}
                        dropDownContainerStyle={styles.dropdownBox}
                        zIndex={1000}
                        zIndexInverse={500}
                    />

                </View>
            </View>

            {/* Sale Type */}
            <Text style={styles.label}>Sale Type</Text>
            <View style={styles.radioContainer}>
                {['all', 'cash', 'credit'].map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={styles.radioOption}
                        onPress={() => setSaleType(type)}
                    >
                        <View
                            style={[
                                styles.radioCircle,
                                saleType === type && styles.radioCircleSelected,
                            ]}
                        />
                        <Text style={styles.radioLabel}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Summary List */}
            <Text style={[styles.label, { marginTop: 20 }]}>Sales Summary</Text>
            {loading ? (
                <ActivityIndicator size="large" color="#1b7f74" style={{ marginTop: 20 }} />
            ) : milkSalesSummary.length === 0 ? (
                <Text style={{ textAlign: 'center', marginVertical: 20, color: '#666' }}>
                    No sales records found
                </Text>
            ) : (
                <FlatList
                    data={milkSalesSummary}
                    keyExtractor={(item, idx) => idx.toString()}
                    renderItem={({ item }) => (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>
                                {item?.transporter?.first_name ?? 'DBU'} - {item.shift?.description}
                            </Text>
                            <Text style={styles.summaryAmount}>
                                {item.total_amount?.toFixed(2) || '0.00'}
                            </Text>
                        </View>
                    )}
                    ListFooterComponent={() => (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total:</Text>
                            <Text style={styles.totalValue}>
                                {totalAmount.toFixed(2)}
                            </Text>
                        </View>
                    )}
                />
            )}

            {/* Print Report Button */}
            <TouchableOpacity
                style={[styles.generateButton, (printing || isConnectingPrinter || !milkSalesSummary.length) && { opacity: 0.6 }]}
                onPress={handlePrintReport}
                disabled={printing || isConnectingPrinter || !milkSalesSummary.length}
            >
                <Text style={styles.generateButtonText}>
                    {printing || isConnectingPrinter ? 'Printing…' : 'Print Report'}
                </Text>
            </TouchableOpacity>

            {/* Modal */}
            <MilkSaleModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={async (data) => {
                    console.log('New Sale Data:', data);
                    Alert.alert('Success', 'New sale saved!');
                    setModalVisible(false);
                    return;
                }}
                commonData={{
                    customers: commonData?.customers,
                    shifts: commonData?.shifts,
                    transporters: commonData?.transporters
                }}
            />
        </SafeAreaView>
    );
};

export default MilkSalesScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f2f2',
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1b7f74',
    },
    newSaleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1b7f74',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    newSaleText: {
        marginLeft: 6,
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
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
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 45,
        backgroundColor: '#fff',
    },
    iconInside: {
        position: 'absolute',
        right: 12,
    },
    dropdown: {
        borderRadius: 12,
        borderColor: '#d1d5db',
        height: 45,
        paddingHorizontal: 12,
    },
    dropdownBox: {
        borderColor: '#d1d5db',
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
    generateButton: {
        backgroundColor: '#1b7f74',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    summaryText: {
        fontSize: 14,
        color: '#333',
    },
    summaryAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1b7f74',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#ccc',
        marginTop: 6,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#222',
    },
    totalValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1b7f74',
    },
});
