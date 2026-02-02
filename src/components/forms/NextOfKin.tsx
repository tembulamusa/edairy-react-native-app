import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { globalStyles } from '../../styles';

interface NextOfKinProps {
    onNext: (data: { fullName: string; phone: string; relationship: string }) => void;
    onPrevious: () => void;
    initialData?: any;
}

const NextOfKin: React.FC<NextOfKinProps> = ({ onNext, onPrevious, initialData }) => {
    const [form, setForm] = React.useState({
        nextOfKinFullName: initialData?.nextOfKinFullName || '',
        nextOfKinPhone: initialData?.nextOfKinPhone || '',
        nextOfKinRelationship: initialData?.nextOfKinRelationship || ''
    });

    // Update form state dynamically
    const handleChange = (key: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleNext = () => {
        if (!form.nextOfKinFullName || !form.nextOfKinPhone || !form.nextOfKinRelationship) {
            alert("Please fill in all fields");
            return;
        }
        onNext(form);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>Next of Kin</Text>
                <View>
                    <Text style={globalStyles.label}>
                        Full Name <Text style={globalStyles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={globalStyles.input}
                        placeholder="Enter Full Name"
                        value={form.nextOfKinFullName}
                        onChangeText={(v) => handleChange("nextOfKinFullName", v)}
                    />
                </View>

                <View style={{ marginTop: 16 }}>
                    <Text style={globalStyles.label}>
                        Phone Number <Text style={globalStyles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={globalStyles.input}
                        placeholder="Enter Phone Number"
                        value={form.nextOfKinPhone}
                        onChangeText={(v) => handleChange("nextOfKinPhone", v)}
                        keyboardType="numeric"
                    />
                </View>

                <View style={{ marginTop: 16, marginBottom: 20 }}>
                    <Text style={globalStyles.label}>
                        Relationship <Text style={globalStyles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={globalStyles.input}
                        placeholder="Enter Relationship"
                        value={form.nextOfKinRelationship}
                        onChangeText={(v) => handleChange("nextOfKinRelationship", v)}
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
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default NextOfKin;

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 200, // Extra padding for bottom tab bar (60px) + keyboard clearance + navigation buttons
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
