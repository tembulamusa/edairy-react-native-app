import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';

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
            <View>
                <Text style={styles.label}>
                    Full Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter Full Name"
                    value={form.fullName}
                    onChangeText={(v) => handleChange("fullName", v)}
                />
            </View>

            <View>
                <Text style={styles.label}>
                    Phone Number <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter Phone Number"
                    value={form.phone}
                    onChangeText={(v) => handleChange("phone", v)}
                    keyboardType="numeric"
                />
            </View>

            <View>
                <Text style={styles.label}>
                    Relationship <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter Relationship"
                    value={form.relationship}
                    onChangeText={(v) => handleChange("relationship", v)}
                />
            </View>

            {/* Navigation buttons */}
            <View style={styles.navRow}>
                <TouchableOpacity style={styles.navButtonOutline} onPress={onPrevious}>
                    <Text style={[styles.navButtonText, { color: "#009688" }]}>← Previous</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navButtonFilled} onPress={handleNext}>
                    <Text style={styles.navButtonText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default NextOfKin;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: 'center' },
    label: { fontSize: 18, marginBottom: 10 },
    required: { color: "red" },
    input: {
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: "#111827",
        elevation: 1,
        marginBottom: 10,
    },
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
