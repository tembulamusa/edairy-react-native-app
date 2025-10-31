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




    const handleGenerate = () => {
        const filters = {
            from: fromDate.toDateString(),
            to: toDate.toDateString(),
            store: storeValue,
            member: memberValue,
            saleType,
        };
        console.log('Generate Report with filters:', filters);
        alert('Report Generated!');
    };

    const totalAmount = storeSalesSummary.reduce(
        (sum, s) => sum + parseFloat(s.total_amount || '0'),
        0
    );

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
            ) : storeSalesSummary.length === 0 ? (
                <Text style={{ textAlign: 'center', marginVertical: 20, color: '#666' }}>
                    No sales records found
                </Text>
            ) : (
                <FlatList
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
            <StoreSaleModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={(data) => {
                    console.log('New Sale Data:', data);
                    alert('New Sale Saved!');
                    setModalVisible(false);
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
