import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Switch,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import { renderDropdownItem } from "../../assets/styles/all";
import { resolveDropDownPickerValue } from "../../utils/dropdownItems";
import {
    createEmptyNextOfKin,
    EMPTY_MEMBER_CONTACTS,
    NEXT_OF_KIN_RELATIONSHIPS,
    type MemberContactsInfo,
    type MemberContactsStepData,
    type MemberNextOfKinInfo,
} from "../../types/memberRegistration";

interface NextOfKinProps {
    isIndividual: boolean;
    onNext: (data: MemberContactsStepData) => void;
    onPrevious: () => void;
    initialContacts?: Partial<MemberContactsInfo>;
    initialData?: MemberNextOfKinInfo[];
}

const normalizeKin = (kin: Partial<MemberNextOfKinInfo>, fallbackPrimary = false): MemberNextOfKinInfo => ({
    ...createEmptyNextOfKin(fallbackPrimary),
    ...kin,
    is_primary: Boolean(kin.is_primary),
    status: kin.status !== false,
});

const SectionHeader = ({
    icon,
    title,
    subtitle,
}: {
    icon: string;
    title: string;
    subtitle: string;
}) => (
    <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
            <Icon name={icon} size={22} color="#009688" />
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
);

const FormRow = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.formRow}>{children}</View>
);

const FormCol = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.formCol}>{children}</View>
);

const NextOfKin: React.FC<NextOfKinProps> = ({
    isIndividual,
    onNext,
    onPrevious,
    initialContacts,
    initialData,
}) => {
    const [contacts, setContacts] = useState<MemberContactsInfo>({
        ...EMPTY_MEMBER_CONTACTS,
        ...initialContacts,
    });
    const [kins, setKins] = useState<MemberNextOfKinInfo[]>(() => {
        if (!isIndividual) {
            return [];
        }
        if (initialData?.length) {
            return initialData.map((kin, index) =>
                normalizeKin(kin, index === 0 && !initialData.some((k) => k.is_primary))
            );
        }
        return [createEmptyNextOfKin(true)];
    });
    const [relationshipOpenIndex, setRelationshipOpenIndex] = useState<number | null>(null);

    const relationshipItems = useMemo(
        () => NEXT_OF_KIN_RELATIONSHIPS.map((rel) => ({ label: rel, value: rel })),
        []
    );

    const updateContact = (field: keyof MemberContactsInfo, value: string) => {
        setContacts((prev) => ({ ...prev, [field]: value }));
    };

    const updateKin = (index: number, key: keyof MemberNextOfKinInfo, value: string | boolean) => {
        setKins((prev) => prev.map((kin, i) => (i === index ? { ...kin, [key]: value } : kin)));
    };

    const setPrimary = (index: number, enabled: boolean) => {
        setKins((prev) => {
            if (enabled) {
                return prev.map((kin, i) => ({ ...kin, is_primary: i === index }));
            }

            const next = prev.map((kin, i) => ({ ...kin, is_primary: i === index ? false : kin.is_primary }));
            if (!next.some((kin) => kin.is_primary) && next.length > 0) {
                next[0] = { ...next[0], is_primary: true };
            }
            return next;
        });
    };

    const addKin = () => {
        setRelationshipOpenIndex(null);
        setKins((prev) => [...prev, createEmptyNextOfKin(false)]);
    };

    const removeKin = (index: number) => {
        setKins((prev) => {
            const next = prev.filter((_, i) => i !== index);
            if (next.length === 0) {
                return [createEmptyNextOfKin(true)];
            }
            if (!next.some((kin) => kin.is_primary)) {
                next[0] = { ...next[0], is_primary: true };
            }
            return next;
        });
        setRelationshipOpenIndex(null);
    };

    const handleNext = () => {
        if (!contacts.primary_phone.trim()) {
            Alert.alert("Missing Fields", "Primary phone is required.");
            return;
        }

        if (!isIndividual) {
            onNext({
                primary_phone: contacts.primary_phone.trim(),
                secondary_phone: contacts.secondary_phone.trim(),
                email: contacts.email.trim(),
                next_of_kins: [],
            });
            return;
        }

        const validKins = kins.filter((kin) => kin.full_name.trim() && kin.relationship.trim());
        if (validKins.length === 0) {
            Alert.alert("Missing Fields", "Add at least one next of kin with full name and relationship.");
            return;
        }

        const primaryIndex = validKins.findIndex((kin) => kin.is_primary);
        const normalizedKins = validKins.map((kin, index) => ({
            ...kin,
            relationship: kin.relationship.trim().toUpperCase(),
            is_primary: primaryIndex >= 0 ? kin.is_primary : index === 0,
            status: kin.status !== false,
        }));

        if (!normalizedKins.some((kin) => kin.is_primary)) {
            normalizedKins[0] = { ...normalizedKins[0], is_primary: true };
        }

        onNext({
            primary_phone: contacts.primary_phone.trim(),
            secondary_phone: contacts.secondary_phone.trim(),
            email: contacts.email.trim(),
            next_of_kins: normalizedKins,
        });
    };

    const renderKinForm = (kin: MemberNextOfKinInfo, index: number) => (
        <View
            key={`kin-${index}`}
            style={[styles.kinCard, { zIndex: relationshipOpenIndex === index ? 2000 : 1 }]}
        >
            {kins.length > 1 && (
                <TouchableOpacity onPress={() => removeKin(index)} style={styles.removeBtn}>
                    <Icon name="delete-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
            )}

            <FormRow>
                <FormCol>
                    <Text style={globalStyles.label}>Full Name</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.full_name}
                        onChangeText={(v) => updateKin(index, "full_name", v)}
                        placeholder="Full name"
                    />
                </FormCol>
                <FormCol>
                    <Text style={globalStyles.label}>Relationship</Text>
                    <DropDownPicker
                        {...getDropdownPickerModalProps("Select relationship")}
                        open={relationshipOpenIndex === index}
                        value={kin.relationship || null}
                        items={relationshipItems}
                        setOpen={(open) => setRelationshipOpenIndex(open ? index : null)}
                        setValue={(callback) => {
                            const nextValue = resolveDropDownPickerValue(callback, kin.relationship || null);
                            updateKin(index, "relationship", nextValue || "");
                        }}
                        setItems={() => {}}
                        placeholder="Relationship"
                        searchable
                        searchPlaceholder="Search..."
                        renderListItem={renderDropdownItem}
                        zIndex={3000 - index}
                        zIndexInverse={1000 + index}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={[globalStyles.basedropdown, globalStyles.dropdownListContainer]}
                    />
                </FormCol>
            </FormRow>

            <FormRow>
                <FormCol>
                    <Text style={globalStyles.label}>Phone Number</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.phone_number}
                        onChangeText={(v) => updateKin(index, "phone_number", v)}
                        keyboardType="phone-pad"
                        placeholder="Phone number"
                    />
                </FormCol>
                <FormCol>
                    <Text style={globalStyles.label}>Alternative Phone</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.alternative_phone_number}
                        onChangeText={(v) => updateKin(index, "alternative_phone_number", v)}
                        keyboardType="phone-pad"
                        placeholder="Alternative phone"
                    />
                </FormCol>
            </FormRow>

            <FormRow>
                <FormCol>
                    <Text style={globalStyles.label}>Email Address</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.email_address}
                        onChangeText={(v) => updateKin(index, "email_address", v)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholder="Email address"
                    />
                </FormCol>
                <FormCol>
                    <Text style={globalStyles.label}>National ID No</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.national_id_no}
                        onChangeText={(v) => updateKin(index, "national_id_no", v)}
                        placeholder="National ID number"
                    />
                </FormCol>
            </FormRow>

            <FormRow>
                <FormCol>
                    <Text style={globalStyles.label}>Postal Address</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.postal_address}
                        onChangeText={(v) => updateKin(index, "postal_address", v)}
                        placeholder="Postal address"
                    />
                </FormCol>
                <FormCol>
                    <Text style={globalStyles.label}>Physical Address</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.physical_address}
                        onChangeText={(v) => updateKin(index, "physical_address", v)}
                        placeholder="Physical address"
                    />
                </FormCol>
            </FormRow>

            <FormRow>
                <FormCol>
                    <Text style={globalStyles.label}>Occupation</Text>
                    <TextInput
                        style={globalStyles.input}
                        value={kin.occupation}
                        onChangeText={(v) => updateKin(index, "occupation", v)}
                        placeholder="Occupation"
                    />
                </FormCol>
                <FormCol>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Is Active?</Text>
                        <Switch
                            value={kin.status !== false}
                            onValueChange={(value) => updateKin(index, "status", value)}
                            trackColor={{ false: "#d1d5db", true: "#80cbc4" }}
                            thumbColor={kin.status !== false ? "#009688" : "#f4f4f5"}
                        />
                    </View>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Is Primary?</Text>
                        <Switch
                            value={Boolean(kin.is_primary)}
                            onValueChange={(value) => setPrimary(index, value)}
                            trackColor={{ false: "#d1d5db", true: "#80cbc4" }}
                            thumbColor={kin.is_primary ? "#009688" : "#f4f4f5"}
                        />
                    </View>
                </FormCol>
            </FormRow>

            <View style={styles.remarksCol}>
                <Text style={globalStyles.label}>Remarks</Text>
                <TextInput
                    style={[globalStyles.input, styles.remarksInput]}
                    value={kin.remarks}
                    onChangeText={(v) => updateKin(index, "remarks", v)}
                    placeholder="Remarks"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                />
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>Contacts</Text>

                <View style={styles.formCard}>
                    <SectionHeader
                        icon="contact-phone"
                        title="Contacts"
                        subtitle="Provide the member's contact information"
                    />

                    <FormRow>
                        <FormCol>
                            <Text style={globalStyles.label}>
                                Primary Phone <Text style={globalStyles.required}>*</Text>
                            </Text>
                            <TextInput
                                style={globalStyles.input}
                                value={contacts.primary_phone}
                                onChangeText={(v) => updateContact("primary_phone", v)}
                                keyboardType="phone-pad"
                                placeholder="07XXXXXXXX"
                            />
                        </FormCol>
                        <FormCol>
                            <Text style={globalStyles.label}>Secondary Phone</Text>
                            <TextInput
                                style={globalStyles.input}
                                value={contacts.secondary_phone}
                                onChangeText={(v) => updateContact("secondary_phone", v)}
                                keyboardType="phone-pad"
                                placeholder="Alternative phone"
                            />
                        </FormCol>
                    </FormRow>

                    <View style={styles.singleField}>
                        <Text style={globalStyles.label}>Email</Text>
                        <TextInput
                            style={globalStyles.input}
                            value={contacts.email}
                            onChangeText={(v) => updateContact("email", v)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholder="Email address"
                        />
                    </View>

                    {isIndividual && (
                        <View style={styles.nokSection}>
                            <SectionHeader
                                icon="people-outline"
                                title="Next of Kin(s)"
                                subtitle="Provide next of kin information"
                            />

                            <View style={styles.kinList}>{kins.map(renderKinForm)}</View>

                            <TouchableOpacity style={styles.addButton} onPress={addKin}>
                                <Icon name="add" size={20} color="#009688" />
                                <Text style={styles.addButtonText}>Add Next of Kin</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

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
    scrollContent: {
        padding: 16,
        paddingBottom: 200,
    },
    formCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 16,
        marginBottom: 20,
        shadowColor: "#959da5",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 4,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#009688",
    },
    sectionSubtitle: {
        marginTop: 8,
        fontSize: 14,
        color: "#6b7280",
    },
    formRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
    },
    formCol: {
        flex: 1,
        minWidth: 0,
    },
    singleField: {
        marginBottom: 12,
    },
    nokSection: {
        marginTop: 8,
    },
    kinList: {
        gap: 12,
    },
    kinCard: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        backgroundColor: "#f9fafb",
        position: "relative",
    },
    removeBtn: {
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 10,
        padding: 4,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
    },
    switchLabel: {
        fontSize: 14,
        color: "#374151",
        fontWeight: "500",
    },
    remarksCol: {
        marginTop: 4,
    },
    remarksInput: {
        minHeight: 72,
    },
    addButton: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        paddingVertical: 8,
    },
    addButtonText: {
        color: "#009688",
        fontWeight: "600",
        fontSize: 15,
    },
});
