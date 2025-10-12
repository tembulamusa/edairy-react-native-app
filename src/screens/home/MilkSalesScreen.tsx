import React, { useEffect, useState } from 'react';
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
import Icon from 'react-native-vector-icons/MaterialIcons';
import DropDownPicker from 'react-native-dropdown-picker';
import StoreSaleModal from '../../components/modals/StoreSaleModal';
import fetchCommonData from '../../components/utils/fetchCommonData';
import MilkSaleModal from '../../components/modals/MilkSaleModal';

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


    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, milk_sales, customers, shifts] = await Promise.all([
                    fetchCommonData({ name: 'transporters' }),
                    fetchCommonData({ name: 'milk_sales' }),
                    fetchCommonData({ name: 'customers' }),
                    fetchCommonData({ name: 'shifts' }),
                ]);
                const allData = { transporters, milk_sales, customers, shifts };
                setCommonData(allData);

                // ✅ Transporters
                setTransporterItems(
                    transporters?.customer?.map((m: any) => ({
                        label: `${m.first_name} ${m.last_name}`,
                        value: m.id,
                    })) || []
                );

                // ✅ Milk Sales
                setMilkSaleItems(
                    milk_sales?.map((s: any) => ({
                        label: s.item?.description || s.name || `Store ${s.id}`,
                        value: s.id,
                    })) || []
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
                    filters: {
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


    const handleGenerate = () => {
        const filters = {
            from: fromDate.toDateString(),
            to: toDate.toDateString(),
            customer: customerValue,
            saleType,
        };
        console.log('Generate Report with filters:', filters);
        alert('Report Generated!');
    };

    const totalAmount = milkSalesSummary.reduce(
        (sum, s) => sum + (s.total_amount || 0),
        0
    );


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
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                <Text style={styles.generateButtonText}>Print Report</Text>
            </TouchableOpacity>

            {/* Modal */}
            <MilkSaleModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={(data) => {
                    console.log('New Sale Data:', data);
                    alert('New Sale Saved!');
                    setModalVisible(false);
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
        borderColor: '#ddd',
        height: 45,
        paddingHorizontal: 12,
    },
    dropdownBox: {
        borderColor: '#ddd',
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
