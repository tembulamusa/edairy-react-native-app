import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    SafeAreaView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';

const ShiftSummaryReportScreen = () => {
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [shift, setShift] = useState('');
    const [transporter, setTransporter] = useState('');

    const onChangeDate = (event, selectedDate) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setDate(selectedDate);
        }
    };

    const handleGenerate = () => {
        const filters = {
            date: date.toDateString(),
            shift,
            transporter,
        };
        console.log('Generate Report with filters:', filters);
        alert('Report Generated!');
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* Date Picker */}
            <Text style={styles.label}>Select Date</Text>
            <View style={styles.inputWithIcon}>
                <TextInput
                    style={styles.input}
                    placeholder="Choose date"
                    value={date.toDateString()}
                    editable={false}
                />
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Icon name="calendar" size={22} color="#fff" />
                </TouchableOpacity>
            </View>
            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={onChangeDate}
                />
            )}

            {/* shift Picker */}
            <Text style={styles.label}>Select shift</Text>
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
            <Text style={styles.label}>Select Rout/Transporter (Optional)</Text>
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

export default ShiftSummaryReportScreen;

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
