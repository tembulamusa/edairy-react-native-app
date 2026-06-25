import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import { renderDropdownItem } from "../../assets/styles/all";
import { resolveDropDownPickerValue, toMemberTypeDropdownItems } from "../../utils/dropdownItems";
import { fetchMemberTypes } from "../../utils/memberType";
import type { MemberTypeSelection } from "../../types/memberRegistration";

interface MemberTypeStepProps {
    onNext: (selection: MemberTypeSelection) => void;
    initialData?: Partial<MemberTypeSelection>;
}

const MemberTypeStep: React.FC<MemberTypeStepProps> = ({ onNext, initialData }) => {
    const [loading, setLoading] = useState(true);
    const [memberTypeOpen, setMemberTypeOpen] = useState(false);
    const [memberTypeValue, setMemberTypeValue] = useState<number | null>(
        initialData?.member_type_id ? parseInt(initialData.member_type_id, 10) : null
    );
    const [memberTypeItems, setMemberTypeItems] = useState<{ label: string; value: number }[]>([]);

    useEffect(() => {
        const loadMemberTypes = async () => {
            setLoading(true);
            try {
                const types = await fetchMemberTypes();
                const items = toMemberTypeDropdownItems(types);

                setMemberTypeItems(items);

                if (items.length === 0) {
                    Alert.alert("No Member Types", "No member types were returned from the server.");
                    return;
                }

                if (memberTypeValue && !items.some((item) => item.value === memberTypeValue)) {
                    setMemberTypeValue(null);
                }
            } catch {
                Alert.alert("Error", "Failed to load member types.");
            } finally {
                setLoading(false);
            }
        };
        loadMemberTypes();
    }, []);

    const handleNext = () => {
        if (!memberTypeValue) {
            Alert.alert("Member Type Required", "Please select a member type to continue.");
            return;
        }

        const selected = memberTypeItems.find((item) => item.value === memberTypeValue);
        if (!selected) {
            Alert.alert("Member Type Required", "Please select a valid member type.");
            return;
        }

        onNext({
            member_type_id: selected.value.toString(),
            member_type_name: selected.label,
        });
    };

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={globalStyles.pageTitle}>Member Registration</Text>
            <Text style={globalStyles.pageSubTitle}>Select Member Type</Text>
            <Text style={styles.hint}>
                Choose the type of member you are registering, then continue to enter their details.
            </Text>

            {loading ? (
                <ActivityIndicator size="large" color="#009688" style={{ marginTop: 24 }} />
            ) : (
                <View style={styles.dropdownCol}>
                    <Text style={globalStyles.label}>
                        Member Type <Text style={styles.required}>*</Text>
                    </Text>
                    <DropDownPicker
                        {...getDropdownPickerModalProps("Select member type")}
                        open={memberTypeOpen}
                        value={memberTypeValue}
                        items={memberTypeItems}
                        setOpen={setMemberTypeOpen}
                        setValue={(valueOrCallback) => {
                            const nextValue = resolveDropDownPickerValue(valueOrCallback, memberTypeValue);
                            const numericValue =
                                nextValue == null || !Number.isFinite(Number(nextValue))
                                    ? null
                                    : Number(nextValue);
                            setMemberTypeValue(numericValue);
                        }}
                        setItems={setMemberTypeItems}
                        placeholder="Select member type"
                        searchable
                        searchPlaceholder="Search member type..."
                        renderListItem={renderDropdownItem}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={[
                            globalStyles.basedropdown,
                            globalStyles.dropdownListContainer,
                        ]}
                        zIndex={8000}
                        zIndexInverse={1000}
                    />
                </View>
            )}

            <TouchableOpacity
                style={[globalStyles.nextButton, (loading || memberTypeItems.length === 0) && styles.disabledButton]}
                onPress={handleNext}
                disabled={loading || memberTypeItems.length === 0}
            >
                <Text style={globalStyles.nextButtonText}>Next</Text>
                <Icon name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 100,
    },
    hint: {
        color: "#6b7280",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    dropdownCol: {
        zIndex: 8000,
        elevation: 8,
        marginBottom: 24,
    },
    required: {
        color: "#ef4444",
    },
    disabledButton: {
        opacity: 0.6,
    },
});

export default MemberTypeStep;
