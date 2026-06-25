import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import { renderDropdownItem } from "../../assets/styles/all";
import { resolveDropDownPickerValue } from "../../utils/dropdownItems";
import { fetchBanks, getBankName, toBankDropdownItems, type BankRecord } from "../../utils/bank";
import type { MemberBankingInfo } from "../../types/memberRegistration";

interface BankingInfoFormProps {
    onNext: (data: MemberBankingInfo) => void;
    onPrevious: () => void;
    initialData?: Partial<MemberBankingInfo>;
}

const BankingInfoForm: React.FC<BankingInfoFormProps> = ({ onNext, onPrevious, initialData }) => {
    const [loading, setLoading] = useState(true);
    const [bankOpen, setBankOpen] = useState(false);
    const [bankValue, setBankValue] = useState<number | null>(
        initialData?.bank_id ? parseInt(initialData.bank_id, 10) : null
    );
    const [bankItems, setBankItems] = useState<{ label: string; value: number }[]>([]);
    const [banks, setBanks] = useState<BankRecord[]>([]);

    const [form, setForm] = useState<MemberBankingInfo>({
        bank_id: initialData?.bank_id || "",
        bank_name: initialData?.bank_name || "",
        bank_branch: initialData?.bank_branch || "",
        account_no: initialData?.account_no || "",
        account_name: initialData?.account_name || "",
    });

    useEffect(() => {
        const loadBanks = async () => {
            setLoading(true);
            try {
                const bankList = await fetchBanks();
                setBanks(bankList);
                setBankItems(toBankDropdownItems(bankList));

                if (bankValue && !bankList.some((bank) => bank.id === bankValue)) {
                    setBankValue(null);
                    setForm((prev) => ({ ...prev, bank_id: "", bank_name: "" }));
                } else if (bankValue) {
                    const selected = bankList.find((bank) => bank.id === bankValue);
                    if (selected) {
                        setForm((prev) => ({
                            ...prev,
                            bank_id: String(selected.id),
                            bank_name: getBankName(selected),
                        }));
                    }
                }
            } catch {
                Alert.alert("Error", "Failed to load banks.");
            } finally {
                setLoading(false);
            }
        };
        loadBanks();
    }, []);

    const handleChange = (field: keyof MemberBankingInfo, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleBankSelect = (bankId: number | null) => {
        const numericBankId =
            bankId == null || !Number.isFinite(Number(bankId)) ? null : Number(bankId);

        setBankValue(numericBankId);

        if (numericBankId == null) {
            setForm((prev) => ({ ...prev, bank_id: "", bank_name: "" }));
            return;
        }

        const selected = banks.find((bank) => bank.id === numericBankId);
        setForm((prev) => ({
            ...prev,
            bank_id: String(numericBankId),
            bank_name: getBankName(selected),
        }));
    };

    const handleNext = () => {
        if (!bankValue || !form.bank_branch || !form.account_no || !form.account_name) {
            Alert.alert("Missing Fields", "Please fill in all banking details.");
            return;
        }
        onNext({
            ...form,
            bank_id: String(bankValue),
        });
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
            <ScrollView
                nestedScrollEnabled
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => bankOpen && setBankOpen(false)}
            >
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>Banking Details</Text>

                <View style={styles.dropdownCol}>
                    <Text style={globalStyles.label}>
                        Bank <Text style={styles.required}>*</Text>
                    </Text>
                    {loading ? (
                        <ActivityIndicator size="small" color="#009688" style={{ marginVertical: 12 }} />
                    ) : (
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select bank")}
                            open={bankOpen}
                            value={bankValue}
                            items={bankItems}
                            setOpen={setBankOpen}
                            setValue={(valueOrCallback) => {
                                const nextValue = resolveDropDownPickerValue(valueOrCallback, bankValue);
                                handleBankSelect(nextValue as number | null);
                            }}
                            setItems={setBankItems}
                            placeholder="Select bank"
                            searchable
                            searchPlaceholder="Search bank..."
                            renderListItem={renderDropdownItem}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndex={8000}
                            zIndexInverse={1000}
                        />
                    )}
                </View>

                <View>
                    <Text style={globalStyles.label}>
                        Bank Branch <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.bank_branch}
                        onChangeText={(v) => handleChange("bank_branch", v)}
                        placeholder="Branch name or code"
                    />
                </View>

                <View>
                    <Text style={globalStyles.label}>
                        Account Number <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.account_no}
                        onChangeText={(v) => handleChange("account_no", v)}
                        placeholder="Account number"
                    />
                </View>

                <View>
                    <Text style={globalStyles.label}>
                        Account Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.account_name}
                        onChangeText={(v) => handleChange("account_name", v)}
                        placeholder="Name on account"
                    />
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

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 100,
    },
    dropdownCol: {
        zIndex: 8000,
        elevation: 8,
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
    },
    required: {
        color: "#ef4444",
    },
});

export default BankingInfoForm;
