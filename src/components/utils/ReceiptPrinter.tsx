import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    FlatList,
} from "react-native";
import useBluetoothClassic from "../../hooks/useBluetoothService";

type DynamicPrinterProps = {
    data: any; // the object containing your dynamic print data
};

export default function ReceiptPrinter({ data }: DynamicPrinterProps) {
    const {
        devices,
        connectedDevice,
        isScanning,
        scanForDevices,
        connectToDevice,
        disconnect,
    } = useBluetoothClassic({ deviceType: 'printer' });

    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        // Automatically scan when the component mounts
        scanForDevices();
    }, [scanForDevices]);

    const buildReceiptLines = (data: any) => {
        if (data.type === 'shift_summary') {
            // Shift Summary Report Format
            const lines = [
                { text: "E-DAIRY SHIFT SUMMARY", bold: true, center: true },
                "--------------------------------",
                `Period: ${data.from_date} to ${data.to_date}`,
                `Transporter: ${data.transporter}`,
                `Shift: ${data.shift}`,
                `Route: ${data.route}`,
                "--------------------------------",
                "SUMMARY:",
            ];

            // Add summary data lines
            if (data.summary_data && data.summary_data.length > 0) {
                data.summary_data.forEach((item: any) => {
                    lines.push(`${item.transporter?.name || 'N/A'} - ${item.sale_type || 'sale'}: ${item.total_amount?.toFixed(2) || '0.00'}/=`);
                });
            }

            lines.push(
                "--------------------------------",
                `TOTAL AMOUNT: ${data.total_amount?.toFixed(2) || '0.00'}/=`,
                `Generated: ${new Date(data.generated_at).toLocaleString()}`,
                "\nThank you for using E-Dairy!\n"
            );

            return lines;
        } else {
            // Original individual receipt format
            return [
                { text: "E-DAIRY RECEIPT", bold: true, center: true },
                "--------------------------------",
                `Date: ${new Date(data.created_at).toLocaleString()}`,
                `Farmer: ${data.member_name}`,
                `Can ID: ${data.can_id}`,
                `Kgs: ${data.kilos}`,
                `Rate: ${data.rate}/=`,
                "--------------------------------",
                `TOTAL: ${data.total}/=`,
                "\nThank you for your delivery!\n",
            ];
        }
    };

    const handlePrint = async () => {
        if (!connectedDevice) {
            Alert.alert("No Printer", "Please connect to a printer first.");
            return;
        }

        try {
            setPrinting(true);
            const lines = buildReceiptLines(data);

            for (const line of lines) {
                const message = typeof line === "string" ? line : line.text;
                await connectedDevice.write(`${message}\n`);
            }

            await connectedDevice.write("\n\n\n");
            Alert.alert("Success", "Receipt printed successfully!");
        } catch (err) {
            Alert.alert("Print Error", String(err));
        } finally {
            setPrinting(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            {!connectedDevice ? (
                <>
                    <TouchableOpacity
                        onPress={scanForDevices}
                        style={{
                            backgroundColor: "#2563eb",
                            padding: 12,
                            borderRadius: 8,
                            marginBottom: 10,
                        }}
                    >
                        <Text style={{ color: "#fff", textAlign: "center" }}>
                            {isScanning ? "Scanning..." : "Scan for Devices"}
                        </Text>
                    </TouchableOpacity>

                    {isScanning && <ActivityIndicator size="small" color="#2563eb" />}

                    <FlatList
                        data={devices}
                        keyExtractor={(item) => item.address}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={{
                                    padding: 12,
                                    borderBottomWidth: 1,
                                    borderColor: "#e5e7eb",
                                }}
                                onPress={() => connectToDevice(item.address)}
                            >
                                <Text style={{ fontWeight: "500" }}>{item.name}</Text>
                                <Text style={{ color: "#6b7280" }}>{item.address}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </>
            ) : (
                <View style={{ marginBottom: 20 }}>
                    <Text>✅ Connected to: {connectedDevice.name}</Text>
                    <TouchableOpacity
                        onPress={disconnect}
                        style={{
                            marginTop: 8,
                            backgroundColor: "#dc2626",
                            padding: 10,
                            borderRadius: 8,
                        }}
                    >
                        <Text style={{ color: "#fff", textAlign: "center" }}>
                            Disconnect
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity
                onPress={handlePrint}
                disabled={!connectedDevice || printing}
                style={{
                    backgroundColor: connectedDevice ? "#16a34a" : "#9ca3af",
                    padding: 14,
                    borderRadius: 8,
                    marginTop: 20,
                }}
            >
                {printing ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={{ color: "#fff", textAlign: "center" }}>Print Receipt</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}
