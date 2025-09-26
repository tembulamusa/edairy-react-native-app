import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    SafeAreaView,
    Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';

const TransporterSummaryReportScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState({ type: '', visible: false });
    const [shift, setShift] = useState('');
    const [transporter, setTransporter] = useState('');

    const today = new Date();

    const onChangeDate = (event, selectedDate) => {
        if (event.type === 'dismissed') {
            setShowPicker({ type: '', visible: false });
            return;
        }

        if (selectedDate) {
            if (showPicker.type === 'from') {
                setFromDate(selectedDate);

                // Adjust "To Date" if it's now before the new "From Date"
                if (selectedDate > toDate) {
                    setToDate(selectedDate);
                }
            } else if (showPicker.type === 'to') {
                setToDate(selectedDate);
            }
        }

        setShowPicker({ type: '', visible: false });
    };

    const handleGenerate = () => {
        const filters = {
            fromDate: fromDate.toDateString(),
            toDate: toDate.toDateString(),
            shift,
            transporter,
        };
        console.log('Generate Report with filters:', filters);
        Alert.alert('Success', 'Report Generated!');
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
                    onPress={() => setShowPicker({ type: 'from', visible: true })}
                >
                    <Icon name="calendar" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

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
                    onPress={() => setShowPicker({ type: 'to', visible: true })}
                >
                    <Icon name="calendar" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Date Picker */}
            {showPicker.visible && (
                <DateTimePicker
                    value={showPicker.type === 'from' ? fromDate : toDate}
                    mode="date"
                    display="default"
                    maximumDate={today} // Prevent future dates always
                    minimumDate={showPicker.type === 'to' ? fromDate : undefined} // To-date can't be before fromDate
                    onChange={onChangeDate}
                />
            )}

            {/* Shift Picker */}
            <Text style={styles.label}>Select Shift</Text>
            <View style={styles.dropdownContainer}>
                <Picker
                    selectedValue={shift}
                    onValueChange={(itemValue) => setShift(itemValue)}
                    style={styles.picker}
                >
                    <Picker.Item label="-- Select --" value="" />
                    <Picker.Item label="Morning" value="morning" />
                    <Picker.Item label="Afternoon" value="afternoon" />
                    <Picker.Item label="Evening" value="evening" />
                </Picker>
            </View>

            {/* Transporter Picker */}
            <Text style={styles.label}>Select Route/Transporter (Optional)</Text>
            <View style={styles.dropdownContainer}>
                <Picker
                    selectedValue={transporter}
                    onValueChange={(itemValue) => setTransporter(itemValue)}
                    style={styles.picker}
                >
                    <Picker.Item label="-- Optional --" value="" />
                    <Picker.Item label="Route A - Transporter X" value="A-X" />
                    <Picker.Item label="Route B - Transporter Y" value="B-Y" />
                    <Picker.Item label="Route C - Transporter Z" value="C-Z" />
                </Picker>
            </View>

            {/* Generate Button */}
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
                <Text style={styles.generateButtonText}>Generate</Text>
            </TouchableOpacity>

        </SafeAreaView>
    );
};

export default TransporterSummaryReportScreen;

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
