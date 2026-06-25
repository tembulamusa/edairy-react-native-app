import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import { resolveDropDownPickerValue } from "../../utils/dropdownItems";
import {
    toMemberDropdownItems,
    toPersonDropdownItems,
    toStoreDropdownItems,
    toStockDropdownItems,
    toTransporterDropdownItems,
    pickDefaultStoreValue,
    getStockItemName,
    getStockAvailableQuantity,
} from "../../utils/storeSales";
import { fetchStoreStocks } from "../../services/storeSalesReferenceData";
import makeRequest from "../utils/makeRequest";
import BluetoothConnectionModal from "./BluetoothConnectionModal";
import useBluetoothService from "../../hooks/useBluetoothService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureClassicBluetoothEnabled } from "../../utils/bluetoothPermissions";
import { checkConnectivity } from "../../services/offlineSync";
import {
    insertOfflineData,
    OFFLINE_SYNC_ENDPOINTS,
    STORE_SALES_SYNC_KEY,
} from "../../services/offlineDatabase";
import { useSync } from "../../context/SyncContext";
import {
    assertOfflineReferenceAvailable,
    getOfflineBlockedMessage,
} from "../../utils/offlineSaveGate";

type CustomerType = "member" | "employee" | "vendor" | "transporter" | "supplier" | "guest";

type StoreSaleModalProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    commonData: {
        members?: { id: number; first_name: string; last_name: string; member_no?: string }[];
        employees?: { id: number; first_name: string; last_name: string; employee_no?: string }[];
        vendors?: { id: number; first_name: string; last_name: string; vendor_no?: string }[];
        transporters?: { id: number; first_name: string; last_name: string; transporter_no?: string }[];
        suppliers?: { id: number; first_name: string; last_name: string; supplier_no?: string }[];
        stores: { id: number; description: string }[];
    };
};

const DROPDOWN_STACK = {
    customerType: { zIndex: 5000, zIndexInverse: 1000 },
    member: { zIndex: 4500, zIndexInverse: 1500 },
    store: { zIndex: 4000, zIndexInverse: 2000 },
    stock: { zIndex: 3500, zIndexInverse: 2500 },
} as const;

const getDropdownColStyle = (zIndex: number) => ({
    zIndex,
    elevation: zIndex / 1000,
});

const StoreSaleModal: React.FC<StoreSaleModalProps> = ({
    visible,
    onClose,
    onSave,
    commonData,
}) => {
    const [errors, setErrors] = useState<any | null>({});
    const [transactionDate, setTransactionDate] = useState<Date>(new Date());
    const [saving, setSaving] = useState(false);
    const {
        collectionGate,
        isSyncing,
        enableCollectionGateCheck,
        refreshCollectionGate,
    } = useSync();
    const { requiresOnlinePush } = collectionGate;
    const isOfflineSaveBlocked = isSyncing || requiresOnlinePush;

    // Customer type selection
    const [customerType, setCustomerType] = useState<CustomerType>("guest");
    const [customerTypeItems] = useState([
        { label: "Member", value: "member" },
        { label: "Employee", value: "employee" },
        { label: "Vendor", value: "vendor" },
        { label: "Transporter", value: "transporter" },
        { label: "Supplier", value: "supplier" },
        { label: "Guest", value: "guest" },
    ]);
    const [customerTypeOpen, setCustomerTypeOpen] = useState(false);

    // Members
    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]);

    // Stores
    const [storeOpen, setStoreOpen] = useState(false);
    const [storeValue, setStoreValue] = useState<number | null>(null);
    const [storeItems, setStoreItems] = useState<any[]>([]);

    // Stock selection
    const [stockOpen, setStockOpen] = useState(false);
    const [stockValue, setStockValue] = useState<number | null>(null);
    const [stockItems, setStockItems] = useState<{ label: string; value: number }[]>([]);
    const [storeStocks, setStoreStocks] = useState<any[]>([]);
    const [loadingStocks, setLoadingStocks] = useState(false);

    const closeOtherDropdowns = useCallback((current: string) => {
        if (current !== "customerType") setCustomerTypeOpen(false);
        if (current !== "member") setMemberOpen(false);
        if (current !== "store") setStoreOpen(false);
        if (current !== "stock") setStockOpen(false);
    }, []);

    const isAnyDropdownOpen = customerTypeOpen || memberOpen || storeOpen || stockOpen;

    type EntryItem = {
        id: number;
        quantity: string;
        name?: string;
        label?: string;
        unit_price?: number;
        selling_price?: number;
        available_stock?: number | null;
        item?: {
            description?: string;
            selling_price?: number;
            unit_price?: number;
            name?: string;
        };
        [key: string]: any;
    };

    // Entries list
    const [entries, setEntries] = useState<EntryItem[]>([]);

    // Payment type
    const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");

    // Bluetooth Printer
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [pendingPrintData, setPendingPrintData] = useState<any | null>(null);
    const {
        devices: printerDevices,
        connectToDevice: connectToPrinter,
        scanForDevices: scanForPrinters,
        connectedDevice: connectedPrinter,
        isScanning: isScanningPrinters,
        isConnecting: isConnectingPrinter,
        printText,
        printRaw
    } = useBluetoothService({ deviceType: 'printer', autoConnectOnMount: true });

    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    const persistLastPrinter = useCallback(async (device: any) => {
        if (!device) return;
        try {
            const payload = {
                id: device?.id || device?.address || device?.address_or_id,
                address: device?.address || device?.id || device?.address_or_id,
                name: device?.name || device?.label || "Printer",
                type: device?.type || "classic",
                saved_at: new Date().toISOString(),
            };

            if (!payload.id || !payload.address) {
                console.log("[StoreSale] persistLastPrinter: Missing id/address, skipping save");
                return;
            }

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
            console.log("[StoreSale] persistLastPrinter: Saved printer", payload.name);
        } catch (error) {
            console.error("[StoreSale] persistLastPrinter: Failed to save printer", error);
        }
    }, []);

    const connectToAnyAvailablePrinter = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[StoreSale] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinters();

            // Wait a bit for scan to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get the latest devices from the ref (updated by useEffect)
            const devices = printerDevicesRef.current || [];
            console.log("[StoreSale] AUTO-CONNECT: Found", devices.length, "printer devices");

            if (devices.length === 0) {
                console.log("[StoreSale] AUTO-CONNECT: No printers found in scan");
                return false;
            }

            // Filter for InnerPrinter devices first (case-insensitive)
            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            let targetPrinter;
            if (innerPrinters.length > 0) {
                targetPrinter = innerPrinters[0];
                console.log("[StoreSale] AUTO-CONNECT: Found InnerPrinter device:", targetPrinter.name || targetPrinter.id);
            } else {
                // Fallback to first available printer if no InnerPrinter found
                targetPrinter = devices[0];
                console.log("[StoreSale] AUTO-CONNECT: No InnerPrinter found, using first available printer:", targetPrinter.name || targetPrinter.id);
            }

            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;

            if (!deviceId) {
                console.log("[StoreSale] AUTO-CONNECT: Target printer missing device id");
                return false;
            }

            console.log("[StoreSale] AUTO-CONNECT: Attempting connection to", targetPrinter.name || deviceId);
            const result = await connectToPrinter(deviceId);
            const success = !!result;
            console.log("[StoreSale] AUTO-CONNECT:", success ? "✓ Connected" : "✗ Connection failed");

            if (success) {
                await persistLastPrinter(result);
            }

            return success;
        } catch (error) {
            console.error("[StoreSale] AUTO-CONNECT: Error connecting to printer:", error);
            return false;
        }
    }, [scanForPrinters, connectToPrinter, persistLastPrinter]);

    const attemptAutoConnectPrinter = useCallback(async (): Promise<boolean> => {
        if (connectedPrinter || isConnectingPrinter) {
            return true;
        }

        try {
            // First, try stored printer
            const stored = await AsyncStorage.getItem("last_device_printer");
            if (stored) {
                let data: any = null;
                try {
                    data = JSON.parse(stored);
                } catch (parseError) {
                    console.error("[StoreSale] AUTO-CONNECT: Failed to parse stored printer:", parseError);
                }

                if (data) {
                    const deviceId = data?.id || data?.address || data?.address_or_id;
                    if (deviceId) {
                        console.log("[StoreSale] AUTO-CONNECT: Scanning for saved printer...");
                        await scanForPrinters();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        console.log("[StoreSale] AUTO-CONNECT: Attempting connection to stored printer", deviceId);
                        const result = await connectToPrinter(deviceId);
                        const success = !!result;
                        console.log("[StoreSale] AUTO-CONNECT:", success ? "✓ Connected to stored printer" : "✗ Stored printer connection failed");

                        if (success) {
                            await persistLastPrinter(result);
                            return true;
                        }
                    }
                }
            }

            // If stored printer failed or doesn't exist, try any available printer
            console.log("[StoreSale] AUTO-CONNECT: Trying to connect to any available printer...");
            return await connectToAnyAvailablePrinter();
        } catch (error) {
            console.error("[StoreSale] AUTO-CONNECT: Unexpected error:", error);
            return false;
        }
    }, [connectToPrinter, scanForPrinters, connectedPrinter, isConnectingPrinter, persistLastPrinter, connectToAnyAvailablePrinter]);

    // Load dropdowns whenever commonData or customerType changes
    useEffect(() => {
        setMemberItems([]);
        setMemberValue(null);
        setMemberOpen(false);

        if (customerType === "member") {
            if (commonData?.members) {
                setMemberItems(toMemberDropdownItems(commonData.members));
            } else {
                console.log("StoreSaleModal: Members data not available yet");
                setMemberItems([]);
            }
        } else if (customerType === "employee") {
            if (commonData?.employees) {
                setMemberItems(toPersonDropdownItems(commonData.employees, "employee_no"));
            } else {
                console.log("StoreSaleModal: Employees data not available yet");
                setMemberItems([]);
            }
        } else if (customerType === "vendor") {
            if (commonData?.vendors) {
                setMemberItems(toPersonDropdownItems(commonData.vendors, "vendor_no"));
            } else {
                console.log("StoreSaleModal: Vendors data not available yet");
                setMemberItems([]);
            }
        } else if (customerType === "transporter") {
            if (commonData?.transporters) {
                setMemberItems(toTransporterDropdownItems(commonData.transporters));
            } else {
                console.log("StoreSaleModal: Transporters data not available yet");
                setMemberItems([]);
            }
        } else if (customerType === "supplier") {
            if (commonData?.suppliers) {
                setMemberItems(toPersonDropdownItems(commonData.suppliers, "supplier_no"));
            } else {
                console.log("StoreSaleModal: Suppliers data not available yet");
                setMemberItems([]);
            }
        } else if (customerType === "guest") {
            setMemberItems([]);
            setMemberValue(null);
            setMemberOpen(false);
        }

        if (commonData?.stores) {
            const items = toStoreDropdownItems(commonData.stores);
            setStoreItems(items);
            setStoreValue((current) => pickDefaultStoreValue(items, current));
        }
    }, [commonData, customerType]);

    useEffect(() => {
        if (!visible || !storeValue) {
            setStoreStocks([]);
            setStockItems([]);
            setStockValue(null);
            return;
        }

        let cancelled = false;

        const loadStoreStocks = async () => {
            setLoadingStocks(true);
            try {
                const stocks = await fetchStoreStocks(storeValue, "StoreSale");
                if (cancelled) {
                    return;
                }
                setStoreStocks(stocks);
                setStockItems(toStockDropdownItems(stocks));
                setStockValue(null);
                setEntries([]);
            } catch (error) {
                console.error("[StoreSale] Failed to load store stocks:", error);
                if (!cancelled) {
                    setStoreStocks([]);
                    setStockItems([]);
                    setStockValue(null);
                }
            } finally {
                if (!cancelled) {
                    setLoadingStocks(false);
                }
            }
        };

        loadStoreStocks();

        return () => {
            cancelled = true;
        };
    }, [storeValue, visible]);

    // Reset member selection when customer type changes
    useEffect(() => {
        setMemberValue(null);
        setMemberOpen(false);
        // Note: memberItems will be updated by the other useEffect
    }, [customerType]);

    // Reset payment type based on customer type
    useEffect(() => {
        // Guests can only use cash, others can choose
        if (customerType === "guest") {
            setPaymentType("cash");
        }
    }, [customerType]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        setTransactionDate(new Date());

        if (commonData?.stores?.length) {
            const items = toStoreDropdownItems(commonData.stores);
            setStoreValue((current) => pickDefaultStoreValue(items, current));
        }
    }, [visible, commonData?.stores]);

    const addStockEntry = useCallback((stockId: number) => {
        const stock = storeStocks.find((s) => s.id === stockId);
        if (!stock) {
            return;
        }

        const availableStock = getStockAvailableQuantity(stock);
        const maxQty =
            availableStock != null ? Math.floor(availableStock) : Number.POSITIVE_INFINITY;
        const unitPrice =
            Number(
                stock?.selling_price ??
                    stock?.unit_price ??
                    stock?.item?.selling_price ??
                    stock?.item?.unit_price ??
                    0
            ) || 0;

        setEntries((prev) => {
            const existingIndex = prev.findIndex((entry) => entry.id === stock.id);
            if (existingIndex >= 0) {
                const updated = [...prev];
                const currentQty = parseInt(updated[existingIndex].quantity || "0", 10) || 0;
                const nextQty = Math.min(currentQty + 1, maxQty);
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: String(nextQty),
                };
                return updated;
            }

            return [
                ...prev,
                {
                    ...stock,
                    item_name: getStockItemName(stock),
                    unit_price: unitPrice,
                    quantity: "1",
                    available_stock: availableStock,
                },
            ];
        });
    }, [storeStocks]);

    const renderStoreStockListItem = useCallback(
        (props: any) => {
            const isSelected = entries.some((entry) => entry.id === props.item.value);

            return (
                <TouchableOpacity
                    style={{
                        padding: 12,
                        backgroundColor: isSelected ? "#d1fae5" : "#fff",
                        borderBottomWidth: 1,
                        borderBottomColor: "#f3f4f6",
                    }}
                    onPress={() => props.onPress(props)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={{
                            color: isSelected ? "#065f46" : "#111827",
                            fontWeight: isSelected ? "600" : "400",
                        }}
                    >
                        {props.item.label}
                    </Text>
                </TouchableOpacity>
            );
        },
        [entries]
    );

    const updateEntryQuantity = useCallback((index: number, rawValue: string) => {
        setEntries((prev) => {
            const entry = prev[index];
            if (!entry) {
                return prev;
            }

            const digitsOnly = rawValue.replace(/[^0-9]/g, "");
            const maxQty =
                entry.available_stock ?? getStockAvailableQuantity(entry);
            const maxAllowed =
                maxQty != null ? Math.floor(Number(maxQty)) : Number.POSITIVE_INFINITY;

            let nextQuantity = digitsOnly;
            if (digitsOnly !== "") {
                const parsed = parseInt(digitsOnly, 10);
                if (Number.isFinite(parsed) && parsed > maxAllowed) {
                    nextQuantity = String(maxAllowed);
                }
            }

            const updated = [...prev];
            updated[index] = { ...updated[index], quantity: nextQuantity };
            return updated;
        });
    }, []);

    const finalizeEntryQuantity = useCallback((index: number) => {
        setEntries((prev) => {
            const entry = prev[index];
            if (!entry) {
                return prev;
            }

            const maxQty =
                entry.available_stock ?? getStockAvailableQuantity(entry);
            const maxAllowed =
                maxQty != null ? Math.floor(Number(maxQty)) : Number.POSITIVE_INFINITY;

            let parsed = parseInt(entry.quantity || "0", 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                parsed = 1;
            } else if (parsed > maxAllowed) {
                parsed = maxAllowed;
            }

            const updated = [...prev];
            updated[index] = { ...updated[index], quantity: String(parsed) };
            return updated;
        });
    }, []);
    const getEntryPrice = useCallback((entry: any): number => {
        const price =
            entry?.selling_price ??
            entry?.unit_price ??
            entry?.item?.selling_price ??
            entry?.item?.unit_price ??
            0;
        const parsed = parseFloat(`${price}`);
        return Number.isFinite(parsed) ? parsed : 0;
    }, []);

    const formatAmount = useCallback((value: number): string => {
        if (!Number.isFinite(value)) return "0.00";
        return value.toFixed(2);
    }, []);

    // ✅ Compute overall total
    const overallTotal = entries.reduce((sum, entry) => {
        const qty = parseFloat(entry?.quantity || "0");
        const price = getEntryPrice(entry);
        return sum + qty * price;
    }, 0);

    // Format receipt for printing
    const formatReceipt = useCallback(
        (saleData: any) => {
            const selectedStore = commonData.stores?.find(s => s.id === storeValue);
            const selectedMember = commonData.members?.find(m => m.id === memberValue);

            let receipt = "";
            receipt += "================================\n";
            receipt += "        STORE SALE RECEIPT\n";
            receipt += "================================\n";
            receipt += `Store: ${selectedStore?.description || 'N/A'}\n`;
            receipt += `Date: ${transactionDate.toISOString().split("T")[0]}\n`;
            receipt += `Member: ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'Guest'}\n`;
            receipt += `Payment: ${paymentType.toUpperCase()}\n`;
            receipt += "--------------------------------\n";

            entries.forEach((item, index) => {
                const qty = parseFloat(item?.quantity || "0");
                const safeQty = Number.isFinite(qty) ? qty : 0;
                const price = getEntryPrice(item);
                const lineTotal = safeQty * price;
                const itemName =
                    item?.item?.description ||
                    item?.name ||
                    item?.label ||
                    `Item ${index + 1}`;

                receipt += `${index + 1}. ${itemName}\n`;
                receipt += `   Qty: ${formatAmount(safeQty)} x ${formatAmount(price)} = ${formatAmount(lineTotal)}\n`;
            });

            receipt += "--------------------------------\n";
            receipt += `TOTAL: ${formatAmount(overallTotal)} KES\n`;
            receipt += "================================\n";
            receipt += "Thank you for your business!\n";
            receipt += "================================\n\n\n";

            return receipt;
        },
        [commonData, storeValue, transactionDate, memberValue, paymentType, entries, formatAmount, overallTotal]
    );

    // Print receipt function
    const printReceipt = useCallback(
        async (saleData: any) => {
            if (!connectedPrinter || !printText) {
                console.log("No printer connected or print function not available");
                return;
            }

            try {
                const receiptText = formatReceipt(saleData);
                console.log("🖨️ Printing receipt...");
                await printText(receiptText);
                console.log("✅ Receipt printed successfully");
                await persistLastPrinter(connectedPrinter);
            } catch (error) {
                console.error("❌ Print error:", error);
                Alert.alert("Print Error", "Failed to print receipt. Please check printer connection.");
            }
        },
        [connectedPrinter, printText, formatReceipt, persistLastPrinter]
    );

    const handlePrintAfterSale = async (saleData: any) => {
        if (connectedPrinter && printText) {
            await printReceipt(saleData);
            return;
        }

        const bluetoothReady = await ensureClassicBluetoothEnabled({ promptIfDisabled: true });
        if (!bluetoothReady) {
            return;
        }

        setPendingPrintData(saleData);
        const autoConnected = await attemptAutoConnectPrinter();

        if (!autoConnected) {
            Alert.alert(
                "Printer Not Connected",
                "Unable to auto-connect to a printer. Please select a printer manually to complete printing.",
                [
                    {
                        text: "OK",
                        onPress: () => setPrinterModalVisible(true),
                    },
                ]
            );
        }
    };

    useEffect(() => {
        if (connectedPrinter && pendingPrintData) {
            (async () => {
                await printReceipt(pendingPrintData);
                setPendingPrintData(null);
            })();
        }
    }, [connectedPrinter, pendingPrintData, printReceipt]);

    useEffect(() => {
        if (connectedPrinter) {
            persistLastPrinter(connectedPrinter);
        }
    }, [connectedPrinter, persistLastPrinter]);

    // Auto-connect printer when modal opens: Check AsyncStorage and connect to InnerPrinter
    useEffect(() => {
        if (!visible) {
            // Don't auto-connect if modal is not visible
            return;
        }

        const autoConnectToLastPrinter = async () => {
            try {
                const bluetoothReady = await ensureClassicBluetoothEnabled({ promptIfDisabled: false });
                if (!bluetoothReady) {
                    console.log('[StoreSale] AUTO-CONNECT PRINTER: Bluetooth not ready, skipping silent auto-connect');
                    return;
                }

                // Skip if already connected
                if (connectedPrinter) {
                    try {
                        let stillConnected = false;
                        if (connectedPrinter.type === 'ble' && connectedPrinter.bleDevice) {
                            stillConnected = (connectedPrinter.bleDevice as any).isConnected === true;
                        } else if (connectedPrinter.type === 'classic' && connectedPrinter.classicDevice) {
                            stillConnected = await connectedPrinter.classicDevice.isConnected();
                        }
                        if (stillConnected) {
                            console.log('[StoreSale] AUTO-CONNECT PRINTER: Already connected, skipping');
                            return;
                        }
                    } catch { }
                }

                // Retrieve last printer from AsyncStorage
                const lastPrinter = await AsyncStorage.getItem('last_device_printer');
                if (!lastPrinter) {
                    console.log('[StoreSale] AUTO-CONNECT PRINTER: No last printer found in storage, will scan for InnerPrinter');
                    // If no saved printer, try to connect to any InnerPrinter
                    try {
                        console.log('[StoreSale] AUTO-CONNECT PRINTER: Scanning for InnerPrinter...');
                        await scanForPrinters();
                        await new Promise<void>(r => setTimeout(() => r(), 2000));

                        const innerPrinters = printerDevicesRef.current.filter(device => {
                            const deviceName = (device.name || '').toLowerCase();
                            return deviceName.includes('innerprinter') || deviceName.includes('inner');
                        });

                        if (innerPrinters.length > 0) {
                            const firstInnerPrinter = innerPrinters[0];
                            const innerPrinterId = firstInnerPrinter.id || firstInnerPrinter.address;
                            console.log('[StoreSale] AUTO-CONNECT PRINTER: Trying to connect to first InnerPrinter found:', innerPrinterId);
                            await connectToPrinter(innerPrinterId);
                            console.log('[StoreSale] AUTO-CONNECT PRINTER: ✓ Connected to InnerPrinter');
                        }
                    } catch (innerPrinterErr) {
                        console.error('[StoreSale] AUTO-CONNECT PRINTER: Error connecting to InnerPrinter:', innerPrinterErr);
                    }
                    return;
                }

                let printerData: any = null;
                try {
                    printerData = typeof lastPrinter === 'string' ? JSON.parse(lastPrinter) : lastPrinter;
                    console.log('[StoreSale] AUTO-CONNECT PRINTER: Last printer found:', printerData);
                } catch (parseError) {
                    console.error('[StoreSale] AUTO-CONNECT PRINTER: Error parsing stored printer:', parseError);
                    return;
                }

                const deviceId = printerData.id || printerData.address || printerData.address_or_id;
                if (!deviceId) {
                    console.log('[StoreSale] AUTO-CONNECT PRINTER: No valid printer ID found');
                    return;
                }

                // Scan briefly for the saved printer, then connect
                console.log('[StoreSale] AUTO-CONNECT PRINTER: Scanning for saved printer...');
                await scanForPrinters();
                await new Promise<void>((r) => setTimeout(() => r(), 2500));

                console.log('[StoreSale] AUTO-CONNECT PRINTER: Looking for printer ID:', deviceId);

                try {
                    await connectToPrinter(deviceId);
                    console.log('[StoreSale] AUTO-CONNECT PRINTER: ✓ Connection attempt completed');
                } catch (connectError) {
                    console.error('[StoreSale] AUTO-CONNECT PRINTER: Connection error:', connectError);
                    // If saved printer fails, try to find any InnerPrinter
                    try {
                        const innerPrinters = printerDevicesRef.current.filter(device => {
                            const deviceName = (device.name || '').toLowerCase();
                            return deviceName.includes('innerprinter') || deviceName.includes('inner');
                        });

                        if (innerPrinters.length > 0) {
                            const firstInnerPrinter = innerPrinters[0];
                            const innerPrinterId = firstInnerPrinter.id || firstInnerPrinter.address;
                            console.log('[StoreSale] AUTO-CONNECT PRINTER: Trying to connect to first InnerPrinter found:', innerPrinterId);
                            await connectToPrinter(innerPrinterId);
                            console.log('[StoreSale] AUTO-CONNECT PRINTER: ✓ Connected to InnerPrinter');
                        }
                    } catch (innerPrinterErr) {
                        console.error('[StoreSale] AUTO-CONNECT PRINTER: Error connecting to InnerPrinter:', innerPrinterErr);
                    }
                }
            } catch (error) {
                console.error('[StoreSale] AUTO-CONNECT PRINTER: Failed:', error);
                // Don't show alert - just log the error
            }
        };

        // Run auto-connect after a short delay to allow modal to mount
        const timeout = setTimeout(() => {
            autoConnectToLastPrinter();
        }, 2000); // Delay 2 seconds to allow modal to fully mount

        return () => clearTimeout(timeout);
    }, [visible, connectedPrinter, scanForPrinters, connectToPrinter]); // Run when modal becomes visible

    const handleSave = async () => {
        if (!storeValue || !transactionDate || entries.length === 0) {
            Alert.alert("Validation", "Please complete store, date, and items.");
            return;
        }

        // Validate quantities don't exceed available stock
        for (const entry of entries) {
            const requestedQty = parseInt(entry?.quantity || "0", 10);
            if (!Number.isFinite(requestedQty) || requestedQty < 1) {
                Alert.alert(
                    "Invalid Quantity",
                    `${getStockItemName(entry)}: Enter a quantity of at least 1.`
                );
                return;
            }

            const availableStock =
                entry?.available_stock ?? getStockAvailableQuantity(entry);

            if (availableStock !== null && availableStock !== undefined) {
                const maxQty = Math.floor(Number(availableStock));
                if (requestedQty > maxQty) {
                    Alert.alert(
                        "Invalid Quantity",
                        `${getStockItemName(entry)}: Requested quantity (${requestedQty}) exceeds available stock (${maxQty}).`
                    );
                    return;
                }
            }
        }

        setSaving(true);
        setErrors({});
        try {
            let items = entries.map((entry) => {
                const quantity = parseFloat(entry?.quantity || "0");
                const unitPrice = getEntryPrice(entry);
                return {
                    stock_id: entry.id,
                    quantity,
                    unit_price: unitPrice,
                    total: quantity * unitPrice,
                };
            });

            const data: any = {
                customer_id: customerType !== "guest" ? memberValue : null,
                customer_type: customerType,
                store_id: storeValue,
                transaction_date: transactionDate.toISOString().split("T")[0],
                sale_type: paymentType,
                items,
            };

            const online = await checkConnectivity();

            if (!online) {
                if (isOfflineSaveBlocked) {
                    Alert.alert(
                        "Go Online to Push",
                        getOfflineBlockedMessage({
                            isSyncing,
                            requiresOnlinePush,
                            maxOfflineHours: Math.round(
                                collectionGate.maxOfflineIntakeMs / (60 * 60 * 1000)
                            ) || undefined,
                        })
                    );
                    return;
                }

                const moduleReady = await assertOfflineReferenceAvailable(STORE_SALES_SYNC_KEY);
                if (!moduleReady.allowed) {
                    Alert.alert("Offline Unavailable", moduleReady.message || "Cannot save offline.");
                    return;
                }

                const storeLabel =
                    storeItems.find((item) => item.value === storeValue)?.label || "Store sale";
                await insertOfflineData({
                    endpoint: OFFLINE_SYNC_ENDPOINTS.STORE_SALE,
                    data,
                    summary_label: storeLabel,
                });

                enableCollectionGateCheck();
                await refreshCollectionGate();

                await handlePrintAfterSale({
                    ...data,
                    offline: true,
                    items: entries,
                });

                setEntries([]);
                setMemberValue(null);
                setStoreValue(null);
                onSave({ offline: true, ...data });
                onClose();
                return;
            }

            const [status, response] = await makeRequest({
                url: "store-sale",
                method: "POST",
                data,
            });

            if (![200, 201].includes(status)) {
                if (!response?.errors) {
                    Alert.alert("Error", response?.message || "Failed to save sale");
                }
                else {
                    setErrors(response?.errors || {});
                    Alert.alert("Error", JSON.stringify(response));
                }
                return;
            } else {
                await handlePrintAfterSale(response?.data);

                setEntries([]);
                setMemberValue(null);
                setStoreValue(null);
                onSave(response?.data);
                onClose();
            }

        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to save sale");
            return
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <View style={styles.fullModal}>
                    {/* Header with close button */}
                    <View style={styles.headerWrapper}>
                        <View style={styles.header}>
                            <Text style={styles.title}>New Store Sale</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Icon name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.contentScroll}
                        contentContainerStyle={styles.contentContainer}
                        keyboardShouldPersistTaps="always"
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={!isAnyDropdownOpen}
                        onScrollBeginDrag={() => {
                            if (customerTypeOpen) setCustomerTypeOpen(false);
                            if (memberOpen) setMemberOpen(false);
                            if (storeOpen) setStoreOpen(false);
                            if (stockOpen) setStockOpen(false);
                        }}
                    >
                        {/* Customer Type Selection */}
                        <View style={getDropdownColStyle(DROPDOWN_STACK.customerType.zIndex)}>
                            <Text style={styles.customerTypeLabel}>Customer Type</Text>
                            <DropDownPicker
                                {...getDropdownPickerModalProps("Select customer type")}
                                open={customerTypeOpen}
                                value={customerType}
                                items={customerTypeItems}
                                setOpen={(open) => {
                                    setCustomerTypeOpen(open);
                                    if (open) closeOtherDropdowns("customerType");
                                }}
                                setValue={(callback) => {
                                    const next = resolveDropDownPickerValue(callback, customerType);
                                    if (next) setCustomerType(next as CustomerType);
                                }}
                                setItems={() => {}}
                                placeholder="Select Customer Type"
                                searchable
                                searchPlaceholder="Search customer type..."
                                renderListItem={renderDropdownItem}
                                zIndex={DROPDOWN_STACK.customerType.zIndex}
                                zIndexInverse={DROPDOWN_STACK.customerType.zIndexInverse}
                                style={globalStyles.basedropdown}
                                dropDownContainerStyle={[
                                    globalStyles.basedropdown,
                                    globalStyles.dropdownListContainer,
                                ]}
                            />
                        </View>

                        {/* Customer Selection - Only shown for non-guest types */}
                        {customerType !== "guest" && (
                            <View style={getDropdownColStyle(DROPDOWN_STACK.member.zIndex)}>
                                <Text style={styles.label}>
                                    {customerType === "member" ? "Select Member" :
                                        customerType === "employee" ? "Select Employee" :
                                            customerType === "vendor" ? "Select Vendor" :
                                                customerType === "transporter" ? "Select Transporter" :
                                                    customerType === "supplier" ? "Select Supplier" : "Select Customer"}
                                </Text>
                                <DropDownPicker
                                    {...getDropdownPickerModalProps(
                                        customerType === "member" ? "Select member" :
                                        customerType === "employee" ? "Select employee" :
                                        customerType === "vendor" ? "Select vendor" :
                                        customerType === "transporter" ? "Select transporter" :
                                        customerType === "supplier" ? "Select supplier" : "Select customer"
                                    )}
                                    open={memberOpen}
                                    value={memberValue}
                                    items={memberItems}
                                    setOpen={(open) => {
                                        setMemberOpen(open);
                                        if (open) closeOtherDropdowns("member");
                                    }}
                                    setValue={(callback) => {
                                        const next = resolveDropDownPickerValue(callback, memberValue);
                                        setMemberValue(next as number | null);
                                    }}
                                    setItems={setMemberItems}
                                    placeholder={
                                        customerType === "member" ? "Select Member" :
                                            customerType === "employee" ? "Select Employee" :
                                                customerType === "vendor" ? "Select Vendor" :
                                                    customerType === "transporter" ? "Select Transporter" :
                                                        customerType === "supplier" ? "Select Supplier" : "Select Customer"
                                    }
                                    searchable
                                    searchPlaceholder={
                                        customerType === "member" ? "Search members..." :
                                            customerType === "employee" ? "Search employees..." :
                                                customerType === "vendor" ? "Search vendors..." :
                                                    customerType === "transporter" ? "Search transporters..." :
                                                        customerType === "supplier" ? "Search suppliers..." : "Search customers..."
                                    }
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.member.zIndex}
                                    zIndexInverse={DROPDOWN_STACK.member.zIndexInverse}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={[
                                        globalStyles.basedropdown,
                                        globalStyles.dropdownListContainer,
                                    ]}
                                />
                            </View>
                        )}

                        {/* Pair: Store + Date */}
                        <View style={styles.row}>
                            <View style={[styles.half, getDropdownColStyle(DROPDOWN_STACK.store.zIndex)]}>
                                <Text style={styles.label}>Store</Text>
                                <DropDownPicker
                                    {...getDropdownPickerModalProps("Select store")}
                                    open={storeOpen}
                                    value={storeValue}
                                    items={storeItems}
                                    setOpen={(open) => {
                                        setStoreOpen(open);
                                        if (open) closeOtherDropdowns("store");
                                    }}
                                    setValue={(callback) => {
                                        const next = resolveDropDownPickerValue(callback, storeValue);
                                        setStoreValue(next as number | null);
                                    }}
                                    setItems={setStoreItems}
                                    placeholder="Select Store"
                                    searchable
                                    searchPlaceholder="Search stores..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.store.zIndex}
                                    zIndexInverse={DROPDOWN_STACK.store.zIndexInverse}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={[
                                        globalStyles.basedropdown,
                                        globalStyles.dropdownListContainer,
                                    ]}
                                />
                            </View>

                            <View style={styles.half}>
                                <Text style={styles.label}>Transaction Date</Text>
                                <View style={[styles.datePicker, styles.datePickerDisabled]}>
                                    <Text style={styles.dateText}>
                                        {transactionDate.toISOString().split("T")[0]}
                                    </Text>
                                    <Icon name="date-range" size={20} color="#9ca3af" />
                                </View>
                            </View>
                        </View>

                        {/* Stock selection */}
                        <View style={getDropdownColStyle(DROPDOWN_STACK.stock.zIndex)}>
                            <Text style={styles.label}>Add Stock Item</Text>
                            <DropDownPicker
                                {...getDropdownPickerModalProps("Select stock item")}
                                open={stockOpen}
                                value={stockValue}
                                items={stockItems}
                                closeAfterSelecting={false}
                                setOpen={(open) => {
                                    setStockOpen(open);
                                    if (open) closeOtherDropdowns("stock");
                                }}
                                setValue={(callback) => {
                                    const next = resolveDropDownPickerValue(callback, stockValue);
                                    setStockValue(next as number | null);
                                }}
                                onSelectItem={(item) => {
                                    if (item?.value != null) {
                                        addStockEntry(item.value as number);
                                    }
                                }}
                                setItems={setStockItems}
                                placeholder={
                                    loadingStocks
                                        ? "Loading stock..."
                                        : !storeValue
                                          ? "Select a store first"
                                          : "Tap items to add"
                                }
                                searchable
                                searchPlaceholder="Search stock..."
                                disabled={loadingStocks || !storeValue}
                                renderListItem={renderStoreStockListItem}
                                selectedItemContainerStyle={{
                                    backgroundColor: "#d1fae5",
                                }}
                                selectedItemLabelStyle={{
                                    color: "#065f46",
                                    fontWeight: "600",
                                }}
                                zIndex={DROPDOWN_STACK.stock.zIndex}
                                zIndexInverse={DROPDOWN_STACK.stock.zIndexInverse}
                                style={globalStyles.basedropdown}
                                dropDownContainerStyle={[
                                    globalStyles.basedropdown,
                                    globalStyles.dropdownListContainer,
                                ]}
                            />
                        </View>

                        {/* Entries list */}
                        <Text style={[styles.label, { marginTop: 12 }]}>Selected items</Text>
                        <View style={styles.entriesList}>
                            {entries.length === 0 ? (
                                <Text style={styles.emptyEntriesText}>No items added yet.</Text>
                            ) : (
                                entries.map((item, index) => {
                                    const itemName = getStockItemName(item);
                                    const availableStock =
                                        item.available_stock ?? getStockAvailableQuantity(item);
                                    const maxQty =
                                        availableStock != null
                                            ? Math.floor(Number(availableStock))
                                            : null;

                                    return (
                                        <View key={item.id.toString()} style={styles.entry}>
                                            <Text style={styles.entryDescription} numberOfLines={2}>
                                                {itemName}
                                                {maxQty != null ? ` (max ${maxQty})` : ""}
                                            </Text>
                                            <View style={styles.qtyFieldWrap}>
                                                <Text style={styles.qtyLabel}>Qty</Text>
                                                <TextInput
                                                    style={[
                                                        styles.entryInput,
                                                        saving && styles.entryInputDisabled,
                                                    ]}
                                                    keyboardType="number-pad"
                                                    placeholder="1"
                                                    placeholderTextColor="#9ca3af"
                                                    maxLength={maxQty != null ? String(maxQty).length : 6}
                                                    value={item.quantity ?? ""}
                                                    onChangeText={(val) => {
                                                        if (!saving) {
                                                            updateEntryQuantity(index, val);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (!saving) {
                                                            finalizeEntryQuantity(index);
                                                        }
                                                    }}
                                                    selectTextOnFocus
                                                    editable={!saving}
                                                />
                                            </View>
                                            <Text style={styles.priceText}>
                                                @ {getEntryPrice(item).toFixed(2)} ={" "}
                                                {(() => {
                                                    const qty = parseFloat(item?.quantity || "0");
                                                    const price = getEntryPrice(item);
                                                    const total = qty * price;
                                                    return Number.isFinite(total) ? total.toFixed(2) : "0.00";
                                                })()}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() =>
                                                    !saving &&
                                                    setEntries(entries.filter((e) => e.id !== item.id))
                                                }
                                                style={[styles.removeButton, saving && { opacity: 0.4 }]}
                                                disabled={saving}
                                            >
                                                <Icon name="delete" size={22} color="#d11a2a" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                        {/* Overall Total */}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Overall Total:</Text>
                            <Text style={styles.totalValue}>{overallTotal.toFixed(2)}</Text>
                        </View>

                        {/* Payment type */}
                        <Text style={styles.label}>Payment Type</Text>
                        <View style={styles.radioGroup}>
                            <TouchableOpacity
                                style={styles.radioOption}
                                onPress={() => setPaymentType("cash")}
                            >
                                <Icon
                                    name={
                                        paymentType === "cash"
                                            ? "radio-button-checked"
                                            : "radio-button-unchecked"
                                    }
                                    size={20}
                                    color="#007AFF"
                                />
                                <Text style={styles.radioText}>Cash</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.radioOption}
                                onPress={() => customerType !== "guest" && setPaymentType("credit")}
                                disabled={customerType === "guest"}
                            >
                                <Icon
                                    name={
                                        paymentType === "credit"
                                            ? "radio-button-checked"
                                            : "radio-button-unchecked"
                                    }
                                    size={20}
                                    color={customerType !== "guest" ? "#007AFF" : "#ccc"}
                                />
                                <Text
                                    style={[
                                        styles.radioText,
                                        { color: customerType !== "guest" ? "#000" : "#aaa" },
                                    ]}
                                >
                                    Credit
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Printer Connection Section */}
                        {!connectedPrinter && (
                            <View style={styles.printerSection}>
                                <Text style={styles.label}>Printer</Text>
                                <View style={styles.printerStatusContainer}>
                                    <View style={styles.printerDisconnected}>
                                        <View style={[styles.printerStatusIndicator, { backgroundColor: '#ef4444' }]} />
                                        <Text style={styles.printerStatusText}>
                                            {isConnectingPrinter
                                                ? "Connecting to InnerPrinter..."
                                                : "No printer connected"}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.printerButton, isConnectingPrinter && { opacity: 0.6 }]}
                                        onPress={() => setPrinterModalVisible(true)}
                                        disabled={isConnectingPrinter}
                                    >
                                        <Text style={styles.printerButtonText}>
                                            {isConnectingPrinter ? "Connecting..." : "Connect Printer"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                    </ScrollView>

                    {/* Buttons */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                            disabled={saving}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>submit</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Bluetooth Printer Connection Modal */}
                    <BluetoothConnectionModal
                        visible={printerModalVisible}
                        onClose={() => setPrinterModalVisible(false)}
                        type="device-list"
                        deviceType="printer"
                        title="Select Printer Device"
                        devices={printerDevices}
                        connectToDevice={connectToPrinter}
                        scanForDevices={scanForPrinters}
                        isScanning={isScanningPrinters}
                        isConnecting={isConnectingPrinter}
                        connectedDevice={connectedPrinter}
                    />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default StoreSaleModal;

const styles = StyleSheet.create({
    fullModal: {
        flex: 1,
        backgroundColor: "#fff",
        padding: 20,
        paddingTop: 40,
    },
    headerWrapper: {
        marginHorizontal: -20,
        marginTop: -40,
        marginBottom: 20,
        paddingTop: 52,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: "#047857",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    title: { fontSize: 20, fontWeight: "700", color: "#fff" },
    contentScroll: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 24,
    },
    label: { marginTop: 12, fontWeight: "600", fontSize: 14 },
    customerTypeLabel: { marginTop: 12, fontWeight: "700", fontSize: 18, marginBottom: 16 },
    dropdown: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
    },
    dropdownBox: {
        borderColor: "#e2e8f0",
        borderWidth: 1,
        borderRadius: 8,
    },
    row: { flexDirection: "row", justifyContent: "space-between" },
    half: { flex: 1, marginRight: 8 },
    datePicker: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 6,
        padding: 10,
        marginTop: 6,
    },
    datePickerDisabled: {
        backgroundColor: "#f3f4f6",
        borderColor: "#e5e7eb",
    },
    dateText: {
        color: "#6b7280",
    },
    entriesList: {
        marginTop: 8,
    },
    entryDescription: {
        flex: 1,
        flexShrink: 1,
        textTransform: "capitalize",
        marginRight: 8,
    },
    entry: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    qtyFieldWrap: {
        alignItems: "center",
        marginHorizontal: 8,
    },
    qtyLabel: {
        fontSize: 11,
        color: "#6b7280",
        marginBottom: 2,
    },
    entryInput: {
        borderWidth: 1,
        borderColor: "#0f766e",
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        minWidth: 56,
        minHeight: 40,
        backgroundColor: "#fff",
        color: "#111827",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    entryInputDisabled: {
        backgroundColor: "#f5f5f5",
        color: "#888",
        borderColor: "#e2e8f0",
    },
    priceText: { fontWeight: "600" },
    emptyEntriesText: {
        color: "#6b7280",
        fontStyle: "italic",
        textAlign: "center",
        paddingVertical: 16,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 20,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        marginLeft: 10,
    },
    cancelButton: { backgroundColor: "#ccc" },
    saveButton: { backgroundColor: "#16a34a" },
    buttonText: { color: "#fff", fontWeight: "600" },
    radioGroup: {
        flexDirection: "row",
        marginTop: 8,
    },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 20,
    },
    radioText: {
        marginLeft: 6,
        fontSize: 14,
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "700",
        color: "#007AFF",
    },
    removeButton: {
        padding: 6,
        marginLeft: 12,
        borderRadius: 6,
        backgroundColor: "#fee2e2",
    },
    printerSection: {
        marginTop: 24,
        borderWidth: 1,
        borderColor: "#f3f4f6",
        borderRadius: 8,
        padding: 12,
    },
    printerStatusContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },
    printerDisconnected: {
        flexDirection: "row",
        alignItems: "center",
    },
    printerStatusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#22c55e",
        marginRight: 8,
    },
    printerStatusText: {
        fontSize: 14,
        color: "#111827",
    },
    printerButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: "#047857",
    },
    printerButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
    customerTypeDropdown: {
        backgroundColor: "#0f766e",
        borderWidth: 1,
        borderColor: "#0f766e",
        borderRadius: 8,
        minHeight: 50,
    },
    customerTypeDropdownText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "500",
    },
    customerTypeDropdownBox: {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 8,
    },
    customerTypeListItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    customerTypeListItemText: {
        color: "#374151",
        fontSize: 16,
        fontWeight: "500",
    },
    customerTypeSelectedItem: {
        backgroundColor: "#0f766e",
    },
});
