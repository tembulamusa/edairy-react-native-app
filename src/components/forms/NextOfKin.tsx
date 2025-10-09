import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { globalStyles } from '../../styles';

interface NextOfKinProps {
    onNext: (data: { fullName: string; phone: string; relationship: string }) => void;
    onPrevious: () => void;
}

const NextOfKin: React.FC<NextOfKinProps> = ({ onNext, onPrevious }) => {
    const [form, setForm] = React.useState({
        fullName: '',
        phone: '',
        relationship: '',
    });

    // Update form state dynamically
    const handleChange = (key: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleNext = () => {
        if (!form.fullName || !form.phone || !form.relationship) {
            alert("Please fill in all fields");
            return;
        }
        onNext(form);
    };

    return (
        <View style={styles.container}>
            <Text style={globalStyles.pageTitle}>Member Registration</Text>
            <Text style={globalStyles.pageSubTitle}>Next of Kin</Text>
            <View>
                <Text style={globalStyles.label}>
                    Full Name <Text style={globalStyles.required}>*</Text>
                </Text>
                <TextInput
                    style={globalStyles.input}
                    placeholder="Enter Full Name"
                    value={form.fullName}
                    onChangeText={(v) => handleChange("fullName", v)}
                />
            </View>

            <View>
                <Text style={globalStyles.label}>
                    Phone Number <Text style={globalStyles.required}>*</Text>
                </Text>
                <TextInput
                    style={globalStyles.input}
                    placeholder="Enter Phone Number"
                    value={form.phone}
                    onChangeText={(v) => handleChange("phone", v)}
                    keyboardType="numeric"
                />
            </View>

            <View>
                <Text style={globalStyles.label}>
                    Relationship <Text style={globalStyles.required}>*</Text>
                </Text>
                <TextInput
                    style={globalStyles.input}
                    placeholder="Enter Relationship"
                    value={form.relationship}
                    onChangeText={(v) => handleChange("relationship", v)}
                />
            </View>

            {/* Navigation buttons */}
            <View style={globalStyles.navRow}>
                <TouchableOpacity style={globalStyles.navButtonOutline} onPress={onPrevious}>
                    <Text style={[globalStyles.navButtonText, { color: "#009688" }]}>← Previous</Text>
                </TouchableOpacity>

                <TouchableOpacity style={globalStyles.navButtonFilled} onPress={handleNext}>
                    <Text style={globalStyles.navButtonText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default NextOfKin;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: 'flex-start' },

    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 20,
    },
    navButtonOutline: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#009688',
        paddingVertical: 12,
        marginRight: 5,
        borderRadius: 20,
        alignItems: 'center',
    },
    navButtonFilled: {
        flex: 1,
        backgroundColor: '#009688',
        paddingVertical: 12,
        marginLeft: 5,
        borderRadius: 20,
        alignItems: 'center',
    },
    navButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
