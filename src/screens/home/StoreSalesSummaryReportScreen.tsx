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
    ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from 'react-native-vector-icons/MaterialIcons';
import DropDownPicker from 'react-native-dropdown-picker';
import StoreSaleModal from '../../components/modals/StoreSaleModal';
import fetchCommonData from '../../components/utils/fetchCommonData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useBluetoothService from '../../hooks/useBluetoothService';

const SalesReportScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [saleType, setSaleType] = useState('all');
    const [modalVisible, setModalVisible] = useState(false);
    const [commonData, setCommonData] = useState<any>({});
    const [storeSalesSummary, setStoreSalesSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Dropdowns
    const [storeOpen, setStoreOpen] = useState(false);
    const [storeValue, setStoreValue] = useState<number | null>(null);
    const [storeItems, setStoreItems] = useState<any[]>([]);

    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]);

    const [stockOpen, setStockOpen] = useState(false);
    const [stockValue, setStockValue] = useState<number | null>(null);
    const [stockItems, setStockItems] = useState<any[]>([]);

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


    // Load static common data once
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [members, stores, stock_items] = await Promise.all([
                    fetchCommonData({ name: 'members' }),
                    fetchCommonData({ name: 'stores' }),
                    fetchCommonData({ name: 'stock_items' }),
                ]);
                const allData = { members, stores, stock_items };
                setCommonData(allData);

                setMemberItems(
                    members?.map((m: any) => ({
                        label: `${m.first_name} ${m.last_name}`,
                        value: m.id,
                    })) || []
                );
                setStoreItems(
                    stores?.map((s: any) => ({
                        label: s.description || s.name || `Store ${s.id}`,
                        value: s.id,
                    })) || []
                );
                setStockItems(
                    stock_items?.map((s: any) => ({
                        label: s.name,
                        value: s.id,
                        unit_price: s.unit_price,
                    })) || []
                );
            } catch (error: any) {
                Alert.alert('Error', `Failed to load common data: ${error.message || error}`);
            }
        };

        loadCommonData();
    }, []);

    useEffect(() => {
        const loadSalesData = async () => {
            try {
                // if no store selected, clear summary
                if (!storeValue) {
                    setStoreSalesSummary([]);
                    return;
                }

                setLoading(true);

                // format dates
                const today = new Date();
                const from = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                const to = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];

                // build filters dynamically
                const params: any = {
                    "created_at_gte": from,
                    // "created_at_lte": to,
                    "store_id": storeValue,
                };

                if (memberValue) params["member_id"] = memberValue;
                if (saleType && saleType !== "all") params["sale_type"] = saleType;

                const data = await fetchCommonData({
                    name: "store_sales",
                    cachable: false,
                    params,
                });
                setStoreSalesSummary(data || []);
            } catch (error) {
                console.error("Error loading sales report:", error);
                Alert.alert("Error", "Failed to load sales report");
            } finally {
                setLoading(false);
            }
        };
        loadSalesData();
    }, [fromDate, toDate, storeValue, memberValue, saleType]);


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




    const totalAmount = storeSalesSummary.reduce(
        (sum, s) => sum + parseFloat(s.total_amount || '0'),
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
            console.error('persistLastPrinter error', error);
        }
    }, []);

    const formatSummaryReceipt = useCallback(() => {
        const selectedStore = commonData?.stores?.find((s: any) => s.id === storeValue);
        const selectedMember = commonData?.members?.find((m: any) => m.id === memberValue);

        let receipt = '';
        receipt += '================================\n';
        receipt += '      STORE SALES SUMMARY\n';
        receipt += '================================\n';
        receipt += `Generated: ${new Date().toISOString()}\n`;
        receipt += `From: ${fromDate.toISOString().split('T')[0]}\n`;
        receipt += `To: ${toDate.toISOString().split('T')[0]}\n`;
        receipt += `Store: ${selectedStore?.description || selectedStore?.name || storeValue || 'All'}\n`;
        receipt += `Member: ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'All'}\n`;
        receipt += `Sale Type: ${saleType.toUpperCase()}\n`;
        receipt += '--------------------------------\n';

        if (storeSalesSummary.length === 0) {
            receipt += 'No sales records found.\n';
        } else {
            storeSalesSummary.forEach((item, index) => {
                const date = item?.created_at
                    ? new Date(item.created_at).toISOString().split('T')[0]
                    : 'N/A';
                const amount = parseFloat(item?.total_amount || '0');
                receipt += `${index + 1}. ${date}  ${amount.toFixed(2)} KES\n`;
            });
        }

        receipt += '--------------------------------\n';
        receipt += `Entries: ${storeSalesSummary.length}\n`;
        receipt += `Total Amount: ${totalAmount.toFixed(2)} KES\n`;
        receipt += '================================\n';
        receipt += 'Thank you for using eDairy\n';
        receipt += '================================\n\n';

        return receipt;
    }, [commonData, storeValue, memberValue, saleType, fromDate, toDate, storeSalesSummary, totalAmount]);

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
            console.error('connectToStoredPrinter error', error);
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

            if (!innerPrinter) {
                return null;
            }

            const deviceId = innerPrinter?.id || innerPrinter?.address || innerPrinter?.address_or_id;
            if (!deviceId) return null;

            const result = await connectToPrinterDevice(deviceId);
            if (result) {
                await persistLastPrinter(result);
                return result;
            }
        } catch (error) {
            console.error('connectToInnerPrinter error', error);
        }
        return null;
    }, [scanForPrinters, connectToPrinterDevice, persistLastPrinter, wait]);

    const handlePrintReport = useCallback(async () => {
        if (printing || isConnectingPrinter) return;
        if (!storeSalesSummary || storeSalesSummary.length === 0) {
            Alert.alert('No Data', 'There are no sales records to print.');
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
            Alert.alert('Success', 'Report sent to printer.');
        } catch (error) {
            console.error('handlePrintReport error', error);
            Alert.alert('Print Error', 'Failed to print the report. Please try again.');
        } finally {
            setPrinting(false);
        }
    }, [
        printing,
        isConnectingPrinter,
        storeSalesSummary,
        connectedPrinter,
        connectToStoredPrinter,
        connectToInnerPrinter,
        printText,
        formatSummaryReceipt,
        persistLastPrinter,
    ]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header row */}
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Store Sales</Text>
                <TouchableOpacity
                    style={styles.newSaleButton}
                    onPress={() => setModalVisible(true)}
                >
                    <Icon name="add-circle-outline" size={22} color="#fff" />
                    <Text style={styles.newSaleText}>New Sale</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer}>
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

                {/* Store & Member in same row */}
                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Store</Text>
                        <DropDownPicker
                            open={storeOpen}
                            value={storeValue}
                            items={storeItems}
                            setOpen={setStoreOpen}
                            setValue={setStoreValue}
                            setItems={setStoreItems}
                            placeholder="Select Store"
                            zIndex={2500}
                            zIndexInverse={2000}
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            searchable={true}   // ✅ Added searchable
                            searchPlaceholder="Search store..." // optional
                        />
                    </View>

                    <View style={styles.col}>
                        <Text style={styles.label}>Member</Text>
                        <DropDownPicker
                            open={memberOpen}
                            value={memberValue}
                            items={memberItems}
                            setOpen={setMemberOpen}
                            setValue={setMemberValue}
                            setItems={setMemberItems}
                            searchable={true}
                            placeholder="Select Member"
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            zIndex={2000}
                            zIndexInverse={2500}
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
                ) : null}

                {!loading && (
                    <View style={styles.summarySection}>
                        <View style={styles.summaryListWrapper}>
                            {storeSalesSummary?.length === 0 ? (
                                <View style={styles.summaryEmptyState}>
                                    <Text style={styles.emptySummaryText}>
                                        No sales records found
                                    </Text>
                                </View>
                            ) : (
                                <FlatList
                                    style={styles.summaryList}
                                    data={storeSalesSummary}
                                    keyExtractor={(item, idx) => idx.toString()}
                                    renderItem={({ item }) => (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryText}>
                                                {new Date(item?.created_at).toISOString().split("T")[0]}
                                            </Text>
                                            <Text style={styles.summaryAmount}>
                                                {isNaN(item?.total_amount) ? '0.00' : parseFloat(item.total_amount).toFixed(2)}
                                            </Text>
                                        </View>
                                    )}
                                    contentContainerStyle={styles.summaryContent}
                                    showsVerticalScrollIndicator={false}
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
                        </View>

                        {/* Print Report Button */}
                        <TouchableOpacity
                            style={[
                                styles.generateButton,
                                (printing || isConnectingPrinter || !storeSalesSummary?.length) && { opacity: 0.6 },
                            ]}
                            onPress={handlePrintReport}
                            disabled={printing || isConnectingPrinter || !storeSalesSummary?.length}
                        >
                            <Text style={styles.generateButtonText}>
                                {printing || isConnectingPrinter ? 'Printing…' : 'Print Report'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Modal */}
            <StoreSaleModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={async (data) => {
                    console.log('New Sale Data:', data);
                    Alert.alert('Success', 'New sale saved!');
                    setModalVisible(false);
                    return;
                }}
                commonData={commonData}
            />
        </SafeAreaView>
    );
};

export default SalesReportScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f2f2',
        padding: 20,
    },
    contentContainer: {
        paddingBottom: 32,
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
    summarySection: {
        flex: 1,
        marginTop: 20,
        minHeight: 280,
    },
    summaryListWrapper: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    summaryList: {
        flex: 1,
    },
    summaryContent: {
        flexGrow: 1,
        paddingBottom: 24,
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
    summaryEmptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptySummaryText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
    },
    generateButton: {
        backgroundColor: '#1b7f74',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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
