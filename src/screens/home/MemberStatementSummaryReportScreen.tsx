import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import DropDownPicker from 'react-native-dropdown-picker';

const MemberStatementSummaryReportScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const [saleType, setSaleType] = useState('all');

    // Member dropdown state
    const [open, setOpen] = useState(false);
    const [member, setMember] = useState(null);
    const [members, setMembers] = useState([
        { label: 'John Doe - #1001', value: '1001' },
        { label: 'Jane Smith - #1002', value: '1002' },
        { label: 'Mike Johnson - #1003', value: '1003' },
        { label: 'Alice Brown - #1004', value: '1004' },
        { label: 'Bob White - #1005', value: '1005' },
    ]);

    const onChangeFromDate = (event, selectedDate) => {
        setShowFromPicker(false);
        if (selectedDate && selectedDate <= new Date()) {
            setFromDate(selectedDate);
            if (selectedDate > toDate) {
                setToDate(selectedDate);
            }
        }
    };

    const onChangeToDate = (event, selectedDate) => {
        setShowToPicker(false);
        if (selectedDate && selectedDate <= new Date() && selectedDate >= fromDate) {
            setToDate(selectedDate);
        }
    };

    const handleGenerate = () => {
        const filters = {
            from: fromDate.toDateString(),
            to: toDate.toDateString(),
            member,
        };
        console.log('Generate Report with filters:', filters);
        alert('Report Generated!');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* From Date */}
            <Text style={styles.label}>From</Text>
            <View style={styles.inputWithIcon}>
                <TextInput
                    style={styles.input}
                    placeholder="Select From Date"
                    value={fromDate.toDateString()}
                    editable={false}
                />
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setShowFromPicker(true)}
                >
                    <Icon name="calendar" size={22} color="#fff" />
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

            {/* To Date */}
            <Text style={styles.label}>To</Text>
            <View style={styles.inputWithIcon}>
                <TextInput
                    style={styles.input}
                    placeholder="Select To Date"
                    value={toDate.toDateString()}
                    editable={false}
                />
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setShowToPicker(true)}
                >
                    <Icon name="calendar" size={22} color="#fff" />
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

            {/* Store Picker */}

            {/* Member Dropdown */}
            <Text style={styles.label}>Select Member (Optional)</Text>
            <View style={{ zIndex: 2000, marginBottom: 12 }}>
                <DropDownPicker
                    open={open}
                    value={member}
                    items={members}
                    setOpen={setOpen}
                    setValue={setMember}
                    setItems={setMembers}
                    searchable={true}
                    placeholder="Search or Select Member"
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownBox}
                    listMode="SCROLLVIEW" // 👈 anchored dropdown
                    ListHeaderComponent={() => (
                        <Text style={styles.dropdownHeading}>Available Members</Text>
                    )}
                />
            </View>

            {/* Generate Button */}
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                <Text style={styles.generateButtonText}>Generate</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default MemberStatementSummaryReportScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f2f2',
        padding: 20,
    },
    label: {
        fontSize: 14,
        marginVertical: 6,
        color: '#444',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 25,
        paddingHorizontal: 15,
        height: 45,
        backgroundColor: '#fff',
    },
    iconButton: {
        marginLeft: 8,
        backgroundColor: '#1b7f74',
        padding: 10,
        borderRadius: 25,
    },
    dropdownContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 25,
        marginBottom: 12,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    },
    picker: {
        height: 45,
        width: '100%',
    },
    dropdown: {
        borderRadius: 25,
        borderColor: '#d1d5db',
        height: 45, // 👈 same as other inputs
        paddingHorizontal: 12,
    },
    dropdownBox: {
        borderColor: '#d1d5db',
    },
    dropdownHeading: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1b7f74',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        backgroundColor: '#f9f9f9',
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
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 20,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
