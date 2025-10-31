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
import fetchCommonData from '../../components/utils/fetchCommonData';
import ReceiptPrinter from '../../components/utils/ReceiptPrinter';

const ShiftSummaryReportScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [commonData, setCommonData] = useState<any>({});
    const [userSummary, setUserSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Transporter state
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    // Shift filter state
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<string>('all');
    const [shiftItems, setShiftItems] = useState([
        { label: 'All', value: 'all' },
        { label: 'AM', value: 'am' },
        { label: 'Noon', value: 'noon' },
        { label: 'PM', value: 'pm' },
    ]);

    // Route filter state
    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, routes] = await Promise.all([
                    fetchCommonData({ name: 'transporters' }),
                    fetchCommonData({ name: 'routes' }),
                ]);

                const allData = { transporters, routes };
                setCommonData(allData);

                setTransporterItems(
                    (transporters || []).map((t: any) => ({
                        label: `${t?.first_name + ' ' + t?.last_name || 'Unnamed Transporter'}`,
                        value: t.id,
                    }))
                );

                setRouteItems(
                    (routes || []).map((r: any) => ({
                        label: r?.name || 'Unnamed Route',
                        value: r.id,
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
        const loadReport = async () => {
            if (transporterValue) {
                try {
                    setUserSummary([]);
                    setLoading(true);
                    const today = new Date();
                    const from = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                    const to = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];

                    const filters: any = {
                        from,
                        to,
                        transporter: transporterValue,
                    };

                    if (shiftValue && shiftValue !== 'all') {
                        filters.shift = shiftValue;
                    }

                    if (routeValue) {
                        filters.route = routeValue;
                    }

                    const shifts = await fetchCommonData({
                        name: "transporter_shift_summary",
                        params: filters,
                    });

                    if (shifts['error']) {
                        Alert.alert("Error", shifts?.message);
                        return;
                    }
                    setUserSummary(shifts || []);

                } catch (error) {
                    console.error("Error loading user summary:", error);
                    Alert.alert("Error", `Failed to load user summary report ${JSON.stringify(error)}`);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadReport();
    }, [fromDate, toDate, transporterValue, shiftValue, routeValue]);

    const handleGenerate = () => {
        const filters = {
            from: fromDate.toDateString(),
            to: toDate.toDateString(),
            transporter: transporterValue,
            shift: shiftValue,
            route: routeValue,
        };
        Alert.alert('Success', 'Report Generated!');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View>
                <Text style={[{ marginBottom: 10, marginTop: 5, fontWeight: 'bold', fontSize: 18 }]}>
                    Transporter Balance Statements
                </Text>
            </View>

            <View style={{ flex: 1 }}>
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
                                <I name="calendar-today" size={20} color="#666" />
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
                            searchable={true}
                            placeholder="Select transporter"
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            zIndex={2000}
                            zIndexInverse={2500}
                        />
                    </View>
                </View>

                {/* Shift + Route Filters Row */}
                <View style={[styles.row]}>
                    <View style={styles.col}>
                        <Text style={styles.label}>Shift</Text>
                        <DropDownPicker
                            open={shiftOpen}
                            value={shiftValue}
                            items={shiftItems}
                            setOpen={setShiftOpen}
                            setValue={setShiftValue}
                            setItems={setShiftItems}
                            placeholder="Select shift"
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            zIndex={1800}
                            zIndexInverse={2800}
                        />
                    </View>

                    <View style={styles.col}>
                        <Text style={styles.label}>Route</Text>
                        <DropDownPicker
                            open={routeOpen}
                            value={routeValue}
                            items={routeItems}
                            setOpen={setRouteOpen}
                            setValue={setRouteValue}
                            setItems={setRouteItems}
                            searchable={true}
                            placeholder="Select route"
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            zIndex={1700}
                            zIndexInverse={2900}
                        />
                    </View>
                </View>
            </View>
            <View>
                <Text style={[styles.label, { marginTop: 20 }]}>Transporter Shift Summary</Text>
                {loading ? (
                    <ActivityIndicator size="large" color="#1b7f74" style={{ marginTop: 20 }} />
                ) : userSummary.length === 0 ? (
                    <Text style={{ textAlign: 'center', marginVertical: 20, color: '#666' }}>
                        No records found
                    </Text>
                ) : (
                    <FlatList
                        data={userSummary}
                        keyExtractor={(item, idx) => idx.toString()}
                        renderItem={({ item }) => (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryText}>
                                    {item?.transporter?.name ?? 'N/A'} - ({item.sale_type ?? 'sale'})
                                </Text>
                                <Text style={styles.summaryAmount}>
                                    {item.total_amount?.toFixed(2) || '0.00'}
                                </Text>
                            </View>
                        )}
                        ListFooterComponent={() => (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total</Text>
                                <Text style={styles.totalValue}>
                                    {userSummary.reduce((sum, item) => sum + (item.total_amount || 0), 0).toFixed(2)}
                                </Text>
                            </View>
                        )}
                    />
                )}

                <View style={{ marginTop: 20 }}>
                    <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                        <Text style={styles.generateButtonText}>Print Report</Text>
                    </TouchableOpacity>
                    {userSummary.length > 0 && (
                        <ReceiptPrinter 
                            data={{
                                type: 'shift_summary',
                                from_date: fromDate.toDateString(),
                                to_date: toDate.toDateString(),
                                transporter: transporterItems.find(item => item.value === transporterValue)?.label || 'All Transporters',
                                shift: shiftValue === 'all' ? 'All Shifts' : shiftValue.toUpperCase(),
                                route: routeItems.find(item => item.value === routeValue)?.label || 'All Routes',
                                summary_data: userSummary,
                                total_amount: userSummary.reduce((sum, item) => sum + (item.total_amount || 0), 0),
                                generated_at: new Date().toISOString()
                            }}
                        />
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

export default ShiftSummaryReportScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f2f2',
        padding: 20,
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
