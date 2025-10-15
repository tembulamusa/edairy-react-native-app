import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";
import ConnectScaleModal from "../../components/modals/ConnectScaleModal";
import useBluetoothClassic from "../../hooks/useBluetoothService.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";
import CashoutFormModal from "../../components/modals/CashoutFormModal.tsx";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const MemberKilosScreen = () => {
    // --- Local States ---
    const [modalVisible, setModalVisible] = useState(false);
    const [can, setCan] = useState<any>({});
    const [entries, setEntries] = useState<any[]>([]);
    const [commonData, setCommonData] = useState<any>({});
    const [member, setMember] = useState<any>(null);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]);
    const [userIsMemberOnly, setUserIsMemberOnly] = useState<boolean>(false);
    const [nextLevel, setNextLevel] = useState<string | null>(null);
    const [memberCreditLimit, setMemberCreditLimit] = useState<number | null>(null);
    const [fetchingCredit, setFetchingCredit] = useState(false);
    const [isCashoutModalVisible, setIsCashoutModalVisible] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);

    // --- Other Dropdowns ---
    const [transporterItems, setTransporterItems] = useState<any[]>([]);
    const [shiftItems, setShiftItems] = useState<any[]>([]);
    const [routeItems, setRouteItems] = useState<any[]>([]);
    const [centerItems, setCenterItems] = useState<any[]>([]);
    const [canItems, setCanItems] = useState<any[]>([]);

    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [centerValue, setCenterValue] = useState<number | null>(null);
    const [canValue, setCanValue] = useState<number | null>(null);

    // --- Dropdown open states ---
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [shiftOpen, setShiftOpen] = useState(false);
    const [routeOpen, setRouteOpen] = useState(false);
    const [centerOpen, setCenterOpen] = useState(false);
    const [memberOpen, setMemberOpen] = useState(false);
    const [canOpen, setCanOpen] = useState(false);

    // --- Bluetooth hook ---
    const { devices, connectToDevice, scanForDevices, lastMessage } = useBluetoothClassic();

    // --- Load Common Data + Auto-select if Member ---
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, routes, shifts, members, cans, centers] =
                    await Promise.all([
                        fetchCommonData({ name: "transporters" }),
                        fetchCommonData({ name: "routes" }),
                        fetchCommonData({ name: "shifts" }),
                        fetchCommonData({ name: "members" }),
                        fetchCommonData({ name: "cans" }),
                        fetchCommonData({ name: "centers" }),
                    ]);

                const allData = { transporters, routes, shifts, members, cans, centers };
                setCommonData(allData);

                // Load user info
                const userDataString = await AsyncStorage.getItem("user");
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    const userGroups = userData?.user_groups || [];

                    const isMemberOnly =
                        !userGroups.includes("transporter") &&
                        !userGroups.includes("employee");

                    setUserIsMemberOnly(isMemberOnly);
                    setNextLevel(userData?.member_details?.next_level || null);

                    if (isMemberOnly) {
                        const matched = members.find(
                            (m: any) => m.id === userData?.member_id
                        );
                        if (matched) {
                            setMemberValue(matched.id);
                            setMember(matched);
                            setSelectedMember(matched);
                        }
                    }
                }
            } catch (error: any) {
                Alert.alert("Error", error.message || "Failed to load data");
            }
        };
        loadCommonData();
    }, []);

    // --- Map dropdown data ---
    useEffect(() => {
        if (!commonData) return;

        setTransporterItems(
            (commonData.transporters || []).map((t: any) => ({
                label: t.full_names,
                value: t.id,
            }))
        );

        setShiftItems(
            (commonData.shifts || []).map((s: any) => ({
                label: s.name,
                value: s.id,
            }))
        );

        setRouteItems(
            (commonData.routes || []).map((r: any) => ({
                label: `${r.route_name} (${r.route_code})`,
                value: r.id,
            }))
        );

        setMemberItems(
            (commonData.members || []).map((m: any) => ({
                label: `${m.first_name} ${m.last_name}`,
                value: m.id,
            }))
        );

        setCanItems(
            (commonData.cans || []).map((c: any) => ({
                label: c.can_id || `Can ${c.id}`,
                value: c.id,
            }))
        );

        setCenterItems(
            (commonData.centers || []).map((c: any) => ({
                label: c.centre,
                value: c.id,
            }))
        );
    }, [commonData]);

    // --- Fetch Credit Limit ---
    useEffect(() => {
        const fetchCreditLimit = async () => {
            if (!memberValue) return;
            setFetchingCredit(true);
            try {
                const [status, response] = await makeRequest({
                    url: `member-credit-limit?member=${memberValue}`,
                    method: "GET",
                });

                if (![200, 201].includes(status)) {
                    Alert.alert("Error", response?.message || "Failed to fetch credit limit");
                    return;
                }
                setMemberCreditLimit(response?.data?.credit_limit ?? 0);
            } catch (err) {
                console.error(err);
            } finally {
                setFetchingCredit(false);
            }
        };

        fetchCreditLimit();
    }, [memberValue]);

    // --- Render ---
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Member Kilos</Text>

            {userIsMemberOnly ? (
                // ✅ Member-only users just see their own member dropdown (disabled)
                <DropDownPicker
                    open={memberOpen}
                    value={memberValue}
                    items={memberItems}
                    setOpen={setMemberOpen}
                    setValue={setMemberValue}
                    setItems={setMemberItems}
                    disabled
                    placeholder="Your account"
                    renderListItem={renderDropdownItem}
                    zIndex={3000}
                />
            ) : (
                // ✅ Non-member users see all dropdowns
                <>
                    {/* Transporter + Shift */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={transporterOpen}
                                value={transporterValue}
                                items={transporterItems}
                                setOpen={setTransporterOpen}
                                setValue={setTransporterValue}
                                setItems={setTransporterItems}
                                placeholder="Select transporter"
                                renderListItem={renderDropdownItem}
                                zIndex={5000}
                            />
                        </View>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={shiftOpen}
                                value={shiftValue}
                                items={shiftItems}
                                setOpen={setShiftOpen}
                                setValue={setShiftValue}
                                setItems={setShiftItems}
                                placeholder="Select shift"
                                renderListItem={renderDropdownItem}
                                zIndex={4500}
                            />
                        </View>
                    </View>

                    {/* Route + Center */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={routeOpen}
                                value={routeValue}
                                items={routeItems}
                                setOpen={setRouteOpen}
                                setValue={setRouteValue}
                                setItems={setRouteItems}
                                placeholder="Select route"
                                renderListItem={renderDropdownItem}
                                zIndex={4000}
                            />
                        </View>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={centerOpen}
                                value={centerValue}
                                items={centerItems}
                                setOpen={setCenterOpen}
                                setValue={setCenterValue}
                                setItems={setCenterItems}
                                placeholder="Select center"
                                renderListItem={renderDropdownItem}
                                zIndex={3500}
                            />
                        </View>
                    </View>

                    {/* Member + Can */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={memberOpen}
                                value={memberValue}
                                items={memberItems}
                                setOpen={setMemberOpen}
                                setValue={(val) => {
                                    setMemberValue(val);
                                    const sel = commonData.members?.find((m: any) => m.id === val);
                                    if (sel) {
                                        setMember(sel);
                                        setSelectedMember(sel);
                                    }
                                }}
                                setItems={setMemberItems}
                                placeholder="Select member"
                                renderListItem={renderDropdownItem}
                                zIndex={3000}
                            />
                        </View>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={canOpen}
                                value={canValue}
                                items={canItems}
                                setOpen={setCanOpen}
                                setValue={setCanValue}
                                setItems={setCanItems}
                                placeholder="Select can"
                                renderListItem={renderDropdownItem}
                                zIndex={2500}
                            />
                        </View>
                    </View>
                </>
            )}

            {/* Credit Limit */}
            {memberValue && (
                <View style={{ marginTop: 24, alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                        Member Credit Limit
                    </Text>
                    {fetchingCredit ? (
                        <Text>Loading...</Text>
                    ) : (
                        <>
                            <Text style={{ fontSize: 20, fontWeight: "bold", color: "green" }}>
                                {memberCreditLimit?.toFixed(2) ?? 0} KGs
                            </Text>

                            <TouchableOpacity
                                style={styles.cashoutButton}
                                onPress={() => setIsCashoutModalVisible(true)}
                            >
                                <MaterialIcons name="account-balance-wallet" size={20} color="#fff" />
                                <Text style={styles.cashoutButtonText}>Request Cashout</Text>
                            </TouchableOpacity>
                            <CashoutFormModal
                                visible={isCashoutModalVisible}
                                onClose={() => setIsCashoutModalVisible(false)}
                                selectedMember={member}
                                memberId={memberValue}
                            />
                        </>
                    )}
                </View>
            )}

            {/* Connect Scale Modal */}
            <ConnectScaleModal
                visible={modalVisible}
                filterDevice="scale"
                onClose={() => setModalVisible(false)}
                devices={devices}
                scanForDevices={scanForDevices}
                onDeviceSelect={async (device) => {
                    const connected = await connectToDevice(device.id);
                    if (connected) {
                        Alert.alert("Connected", `Connected to ${connected.name}`);
                    }
                    setModalVisible(false);
                }}
            />
        </View>
    );
};

export default MemberKilosScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#fff" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    col: { flex: 1, marginHorizontal: 4 },
    cashoutButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16a34a",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 10,
    },
    cashoutButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
        marginLeft: 8,
    },
});
