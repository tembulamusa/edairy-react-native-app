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
        const loadReport = async (customerValue) => {
            if (customerValue) {

                try {
                    setUserSummary([]);
                    setLoading(true);
                    const today = new Date();
                    const from = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                    const to = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                    const activities = await fetchCommonData({
                        name: "user_balance_statements",
                        filters: {
                            from,
                            to,
                            member: customerValue,
                        },
                    });
                    if (activities['error']) {
                        Alert.alert("Error", activities?.message ?? JSON.stringify(activities));
                        return
                    }
                    setUserSummary(activities || []);
                    setMemberTotals(activities, cacheable = false);

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

    const handleGenerate = () => {
        const filters = {
            from: fromDate.toDateString(),
            to: toDate.toDateString(),
            customer: customerValue,
            transactionType,
        };
        console.log('Generate Report with filters:', filters);
        alert('Report Generated!');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View>
                <Text style={[styles?.header, { marginBottom: 10, marginTop: 5, fontWeight: 'bold' }]}>User Balance Statements</Text>
            </View>
            <View style={styles.content}>
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
            </View>
            {/* <View style={styles.row}> */}
            {/* Select Customer */}
            <View style={styles.col}>
                <Text style={styles.label}>Customer</Text>
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
            {/* </View> */}
            {/* Transaction Type */}
            {/* <View style={[ , { zIndex: 1000, marginBottom: 10, marginTop: 20 }]}>
                    <Text style={styles.label}>Transaction Type</Text>
                    <View style={styles.radioContainer}>
                        {['all', 'deliveries', 'deductions'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={styles.radioOption}
                                onPress={() => setTransactionType(type as any)}
                            >
                                <View
                                    style={[
                                        styles.radioCircle,
                                        transactionType === type && styles.radioCircleSelected,
                                    ]}
                                />
                                <Text style={styles.radioLabel}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View> */}
            {/* Summary List */}
            <Text style={[styles.label, { marginTop: 20 }]}>User transactions Summary</Text>
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
                                {item?.customer?.first_name ?? 'N/A'} {item?.customer?.last_name ?? ''}
                                - ({item.sale_type ?? 'sale'})
                            </Text>
                            <Text style={styles.summaryAmount}>
                                {item.total_amount?.toFixed(2) || '0.00'}
                            </Text>
                        </View>
                    )}
                    ListFooterComponent={() => (
                        <View>
                            <View>
                                {/* if member, add milk deliveries */}
                                <View style={styles.row}>
                                    <Text>Total Milk Supplied</Text>
                                    <Text>1000</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text>Total Deductions</Text>
                                    <Text>100</Text>
                                </View>
                            </View>

                            <View>
                                {/* If Vendor */}
                                <View style={styles.row}>
                                    <Text>Total Supplied</Text>
                                    <Text>1000</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text>Total Deductions</Text>
                                    <Text>100</Text>
                                </View>
                            </View>
                            <View>
                                {/* If Employee */}
                                <View style={styles.row}>
                                    <Text>Total Salary</Text>
                                    <Text>1000</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text>Total Deductions</Text>
                                    <Text>100</Text>
                                </View>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Current Balance:</Text>
                                <Text style={styles.totalValue}>
                                    {memberTotals?.total?.toFixed(2) ?? '0.00'}
                                </Text>


                                <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                                    <Text style={styles.generateButtonText}>Request Cashout</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Fixed Footer */}
            <View style={styles.footer}>

                <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                    <Text style={styles.generateButtonText}>Print Report</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );

};

export default UserBalanceSummaryScreen;

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
