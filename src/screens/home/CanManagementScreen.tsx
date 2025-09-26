// CanManagementScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; // For dropdowns
import Icon from 'react-native-vector-icons/Ionicons'; // For search icon

const CanManagementScreen = () => {
    const [transporter, setTransporter] = useState('');
    const [shift, setShift] = useState('');
    const [numCans, setNumCans] = useState('');
    const [canMovement, setCanMovement] = useState('out');

    const handleSave = () => {
        const record = {
            transporter,
            shift,
            numCans,
            canMovement,
        };

        // send can movement record to backend or store locally
        console.log('Saved Record:', record);
        alert('Record Saved!');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Select Transporter */}
            <Text style={styles.label}>Select Transporter</Text>
            <View style={styles.dropdownContainer}>
                <Picker
                    selectedValue={transporter}
                    onValueChange={(itemValue) => setTransporter(itemValue)}
                    style={styles.picker}
                >
                    <Picker.Item label="-- Select --" value="" />
                    <Picker.Item label="Transporter A" value="A" />
                    <Picker.Item label="Transporter B" value="B" />
                </Picker>
            </View>

            {/* Select shift */}
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

            {/* Total Number of Cans */}
            <Text style={styles.label}>Total Number of Cans</Text>
            <View style={styles.inputWithIcon}>
                <TextInput
                    style={styles.input}
                    placeholder="Enter number"
                    keyboardType="numeric"
                    value={numCans}
                    onChangeText={setNumCans}
                />
                <TouchableOpacity style={styles.iconButton}>
                    <Icon name="search" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Can Movement */}
            <Text style={styles.label}>Can Movement</Text>
            <View style={styles.radioGroup}>
                <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setCanMovement('out')}
                >
                    <View style={[styles.radioCircle, canMovement === 'out' && styles.radioSelected]} />
                    <Text style={styles.radioText}>Cans Out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setCanMovement('in')}
                >
                    <View style={[styles.radioCircle, canMovement === 'in' && styles.radioSelected]} />
                    <Text style={styles.radioText}>Cans In</Text>
                </TouchableOpacity>
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Record</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default CanManagementScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fdfdfd',
        padding: 20,
    },
    label: {
        fontSize: 14,
        marginVertical: 6,
        color: '#444',
    },
    dropdownContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 25,
        marginBottom: 12,
        paddingHorizontal: 12,
    },
    picker: {
        height: 45,
        width: '100%',
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
    radioGroup: {
        flexDirection: 'row',
        marginBottom: 20,
        marginTop: 5,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 25,
    },
    radioCircle: {
        height: 18,
        width: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#1b7f74',
        marginRight: 6,
    },
    radioSelected: {
        backgroundColor: '#1b7f74',
    },
    radioText: {
        fontSize: 14,
        color: '#444',
    },
    saveButton: {
        backgroundColor: '#1b7f74',
        paddingVertical: 14,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
