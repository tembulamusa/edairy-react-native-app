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
    FlatList,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";
import makeRequest from "../utils/makeRequest";
import BluetoothConnectionModal from "./BluetoothConnectionModal";
import useBluetoothService from "../../hooks/useBluetoothService";
import AsyncStorage from "@react-native-async-storage/async-storage";

type StoreSaleModalProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    commonData: {
        members: { id: number; first_name: string; last_name: string }[];
        stores: { id: number; description: string }[];
        stock_items: Array<{
            id: number;
            name?: string;
            unit_price?: number;
            selling_price?: number;
            item?: {
                description?: string;
                selling_price?: number;
                unit_price?: number;
                name?: string;
            };
            [key: string]: any;
        }>;
    };
};

const StoreSaleModal: React.FC<StoreSaleModalProps> = ({
    visible,
    onClose,
    onSave,
    commonData,
}) => {
    const [errors, setErrors] = useState<any | null>({});
    const [transactionDate, setTransactionDate] = useState<Date>(new Date());
    const [saving, setSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

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
    } = useBluetoothService({ deviceType: 'printer' });

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

    // Load dropdowns whenever commonData changes
    useEffect(() => {
        if (commonData?.members) {
            setMemberItems([
                { label: "No Member / Guest", value: null },
                ...commonData.members.map((m) => ({
                    label: `${m?.first_name} ${m?.last_name}`,
                    value: m.id,
                })),
            ]);
        }
        if (commonData?.stores) {
            setStoreItems(
                commonData.stores.map((s) => ({
                    label: s.description || `Store ${s.id}`,
                    value: s.id,
                }))
            );
        }
        if (commonData?.stock_items) {
            setStockItems(
                commonData.stock_items.map((s) => {
                    const itemName = s?.item?.description
                        ? String(s.item.description)
                        : s?.name
                        ? String(s.name)
                        : `Item ${s.id}`;
                    
                    // Get available stock quantity (check multiple possible field names)
                    const stockQty = s?.quantity ?? s?.stock ?? s?.available_quantity ?? s?.stock_quantity ?? s?.available_stock ?? null;
                    
                    // Add quantity in brackets if available (remove decimals)
                    const label = stockQty !== null && stockQty !== undefined
                        ? `${itemName} (${Math.floor(Number(stockQty))})`
                        : itemName;
                    
                    return {
                        label,
                        value: s.id,
                    };
                })
            );
        }
    }, [commonData]);

    // Reset payment type if member unselected
    useEffect(() => {
        if (!memberValue) setPaymentType("cash");
    }, [memberValue]);

    const addStockEntry = (stockId: number) => {
        const stock = commonData.stock_items.find((s) => s.id === stockId);
        if (stock && !entries.find((e) => e.id === stock.id)) {
            // Get available stock quantity (check multiple possible field names)
            const availableStock = stock?.quantity ?? stock?.stock ?? stock?.available_quantity ?? stock?.stock_quantity ?? stock?.available_stock ?? null;
            
            setEntries([
                ...entries,
                {
                    ...stock,
                    unit_price:
                        Number(
                            stock?.selling_price ??
                            stock?.unit_price ??
                            stock?.item?.selling_price ??
                            stock?.item?.unit_price ??
                            0
                        ) || 0,
                    quantity: "1",
                    // Store available stock for validation
                    available_stock: availableStock,
                },
            ]);
        }
        // setStockValue(null);
    };
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

                // First, trigger a scan to discover devices
                console.log('[StoreSale] AUTO-CONNECT PRINTER: Starting device scan to find saved printer...');
                scanForPrinters(); // Don't await - let it run in background

                // Wait for scan to complete (18 seconds for full scan)
                console.log('[StoreSale] AUTO-CONNECT PRINTER: Waiting for scan to complete (18 seconds)...');
                await new Promise<void>(r => setTimeout(() => r(), 18000)); // Wait 18 seconds for scan to finish

                // Re-check printerDevices after waiting
                await new Promise<void>(r => setTimeout(() => r(), 500));

                console.log('[StoreSale] AUTO-CONNECT PRINTER: Checking for printer after scan...');
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
            const requestedQty = parseFloat(entry?.quantity || "0");
            const availableStock = entry?.available_stock ?? entry?.quantity ?? entry?.stock ?? entry?.available_quantity ?? entry?.stock_quantity ?? null;
            
            if (availableStock !== null && availableStock !== undefined) {
                const maxQty = parseFloat(String(availableStock)) || 0;
                if (requestedQty > maxQty) {
                    const itemName = entry?.item?.description || entry?.name || entry?.label || `Item ${entry.id}`;
                    Alert.alert(
                        "Invalid Quantity",
                        `${itemName}: Requested quantity (${requestedQty}) exceeds available stock (${maxQty}).`
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
                member_id: memberValue,
                store_id: storeValue,
                transaction_date: transactionDate.toISOString().split("T")[0],
                sale_type: paymentType,
                items,
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
                Alert.alert("Success", "Sale recorded successfully");
                
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
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                >
                    {/* Member */}
                    <Text style={styles.label}>Member</Text>
                    <DropDownPicker
                        open={memberOpen}
                        value={memberValue}
                        items={memberItems}
                        setOpen={setMemberOpen}
                        setValue={setMemberValue}
                        setItems={setMemberItems}
                        placeholder="Select Member"
                        listMode="SCROLLVIEW"
                        zIndex={3000}
                        zIndexInverse={1000}
                        searchable={true}
                        searchPlaceholder="Search members..."
                        style={styles.dropdown}
                        dropDownContainerStyle={styles.dropdownBox}
                        scrollViewProps={{ nestedScrollEnabled: true }}
                    />

                    {/* Pair: Store + Date */}
                    <View style={styles.row}>
                        <View style={styles.half}>
                            <Text style={styles.label}>Store</Text>
                            <DropDownPicker
                                open={storeOpen}
                                value={storeValue}
                                items={storeItems}
                                setOpen={setStoreOpen}
                                setValue={setStoreValue}
                                setItems={setStoreItems}
                                placeholder="Select Store"
                                listMode="SCROLLVIEW"
                                zIndex={2500}
                                zIndexInverse={2000}
                                searchable={true}
                                searchPlaceholder="Search stores..."
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>

                        <View style={styles.half}>
                            <Text style={styles.label}>Transaction Date</Text>
                            <TouchableOpacity
                                style={styles.datePicker}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.dateText}>{transactionDate.toISOString().split("T")[0]}</Text>
                                <Icon name="date-range" size={20} color="#333" />
                            </TouchableOpacity>
                            <DateTimePickerModal
                                isVisible={showDatePicker}
                                mode="date"
                                date={transactionDate}
                                maximumDate={new Date()}
                                onConfirm={(date) => {
                                    setTransactionDate(date);
                                    setShowDatePicker(false);
                                }}
                                onCancel={() => setShowDatePicker(false)}
                            />
                        </View>
                    </View>

                    {/* // Stock selection */}
                    <Text style={styles.label}>Add Stock Item</Text>

                    <DropDownPicker
                        open={stockOpen}
                        value={stockValue}
                        items={stockItems}
                        setOpen={setStockOpen}
                        setValue={setStockValue}
                        setItems={setStockItems}
                        placeholder="Select Stock Item"
                        listMode="SCROLLVIEW"
                        searchable={true}
                        searchPlaceholder="Search stock..."
                        onChangeValue={(val) => {
                            setStockValue(val);
                            if (val) {
                                addStockEntry(val);  // ✅ Add entry when selected
                            }
                        }}
                        renderListItem={renderDropdownItem as any}
                        zIndex={1000}
                        zIndexInverse={2000}
                        style={styles.dropdown}
                        dropDownContainerStyle={styles.dropdownBox}
                        scrollViewProps={{ nestedScrollEnabled: true }}
                    />

                    {/* Entries list */}
                    <Text style={[styles.label, { marginTop: 12 }]}>Selected items</Text>
                    <FlatList
                        data={entries}
                        keyExtractor={(item) => item.id.toString()}
                        nestedScrollEnabled
                        scrollEnabled={false}
                        style={styles.entriesList}
                        contentContainerStyle={
                            entries.length === 0 ? styles.emptyEntriesContainer : undefined
                        }
                        ListEmptyComponent={
                            <Text style={styles.emptyEntriesText}>No items added yet.</Text>
                        }
                        renderItem={({ item, index }) => {
                            const itemName = item?.item?.description || item?.name || item?.label || `Item ${index + 1}`;
                            // Get available stock quantity (check multiple possible field names)
                            const availableStock = item?.available_stock ?? item?.quantity ?? item?.stock ?? item?.available_quantity ?? item?.stock_quantity ?? null;
                            // Add quantity in brackets if available (remove decimals)
                            const displayName = availableStock !== null && availableStock !== undefined
                                ? `${itemName} (${Math.floor(Number(availableStock))})`
                                : itemName;
                            
                            return (
                            <View style={styles.entry}>
                                <Text style={styles.entryDescription}>
                                    {displayName}
                                </Text>
                                <TextInput
                                    style={[
                                        styles.entryInput,
                                        saving && { backgroundColor: "#f5f5f5", color: "#888" },
                                    ]}
                                    keyboardType="numeric"
                                    placeholder="1"
                                    value={item.quantity?.toString() ?? "1"}
                                    onChangeText={(val) => {
                                        if (!saving) {
                                            // Get available stock for this item
                                            const availableStock = item?.available_stock ?? item?.quantity ?? item?.stock ?? item?.available_quantity ?? item?.stock_quantity ?? null;
                                            
                                            // Allow empty string for clearing the input
                                            if (val === '' || val === '.') {
                                                const updated = [...entries];
                                                updated[index].quantity = val;
                                                setEntries(updated);
                                                return;
                                            }
                                            
                                            // Parse input value
                                            const inputQty = parseFloat(val);
                                            
                                            // Validate: don't allow quantity to exceed available stock
                                            if (availableStock !== null && availableStock !== undefined && !isNaN(inputQty)) {
                                                const maxQty = parseFloat(String(availableStock)) || 0;
                                                if (inputQty > maxQty) {
                                                    // Silently cap at max available quantity
                                                    val = String(maxQty);
                                                }
                                            }
                                            
                                            const updated = [...entries];
                                            updated[index].quantity = val;
                                            setEntries(updated);
                                        }
                                    }}
                                    editable={!saving}   // ✅ disable editing
                                />
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
                                    disabled={saving}   // ✅ disable deleting
                                >
                                    <Icon name="delete" size={22} color="#d11a2a" />
                                </TouchableOpacity>
                            </View>
                            );
                        }}
                    />
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
                            onPress={() => memberValue && setPaymentType("credit")}
                            disabled={!memberValue}
                        >
                            <Icon
                                name={
                                    paymentType === "credit"
                                        ? "radio-button-checked"
                                        : "radio-button-unchecked"
                                }
                                size={20}
                                color={memberValue ? "#007AFF" : "#ccc"}
                            />
                            <Text
                                style={[
                                    styles.radioText,
                                    { color: memberValue ? "#000" : "#aaa" },
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
    dateText: {
        color: "#1f2937",
    },
    entriesList: {
        maxHeight: 220,
        marginTop: 8,
    },
    entryDescription: {
        flex: 1,
        textTransform: "capitalize",
    },
    entry: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    entryInput: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 6,
        padding: 6,
        width: 60,
        marginHorizontal: 10,
        textAlign: "center",
    },
    priceText: { fontWeight: "600" },
    emptyEntriesContainer: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 16,
    },
    emptyEntriesText: {
        color: "#6b7280",
        fontStyle: "italic",
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
});
