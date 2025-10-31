import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, TextInput, ScrollView } from 'react-native';
import bluetoothScaleService from '../../components/levi/BluetoothScaleService.js';

type DeviceItem = { id: string; name?: string; address?: string };

const LeviTestScreen = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<string>('idle');
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [connectedName, setConnectedName] = useState<string>('');
    const [connectedAddr, setConnectedAddr] = useState<string>('');
    const [lastReading, setLastReading] = useState<string | null>(null);
    const [cmd, setCmd] = useState('');
    const mountedRef = useRef(true);
    const [logs, setLogs] = useState<string[]>([]);

    const log = (message: string, obj?: any) => {
        const line = obj !== undefined ? `${message} ${typeof obj === 'string' ? obj : JSON.stringify(obj)}` : message;
        console.log('[Levi]', line);
        setLogs(prev => [line, ...prev].slice(0, 100));
    };

    useEffect(() => {
        mountedRef.current = true;
        // Hook status + weight callbacks
        bluetoothScaleService.setStatusCallback((s: string, msg: any) => {
            if (!mountedRef.current) return;
            setStatus(s);
            setStatusMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
            log(`STATUS: ${s}`, msg);
        });
        bluetoothScaleService.setWeightCallback((data: any) => {
            if (!mountedRef.current) return;
            const display = data?.displayValue || (data?.weight != null ? `${data.weight} ${data.unit || 'kg'}` : '');
            setLastReading(display);
            log('WEIGHT:', data);
        });
        // Expose basic updaters (optional)
        bluetoothScaleService.setGlobalContextUpdaters({
            updateScaleConnectionStatus: (s: string, msg: string) => {
                if (!mountedRef.current) return;
                setStatus(s);
                setStatusMsg(msg);
                log(`CTX STATUS: ${s} ${msg}`);
            },
            setScaleDevice: (name: string, address: string) => {
                if (!mountedRef.current) return;
                setConnectedName(name);
                setConnectedAddr(address);
                log('DEVICE SET:', { name, address });
            }
        });
        return () => {
            mountedRef.current = false;
            bluetoothScaleService.clearStatusCallback();
            bluetoothScaleService.clearWeightCallback();
        };
    }, []);

    const scan = async () => {
        setIsScanning(true);
        try {
            log('Scan requested');
            const result = await bluetoothScaleService.getAvailableScales(true, true);
            setDevices(result.allDevices || []);
            log('Scan result count:', (result.allDevices || []).length);
        } catch (e: any) {
            setStatus('scan_error');
            setStatusMsg(String(e?.message || e));
            log('Scan error:', e?.message || e);
        } finally {
            setIsScanning(false);
        }
    };

    const connect = async (address: string) => {
        try {
            log('Connect requested:', address);
            await bluetoothScaleService.connectToScale(address);
            setConnectedAddr(address);
            setConnectedName(devices.find(d => d.address === address)?.name || '');
            log('Connected to:', { name: devices.find(d => d.address === address)?.name, address });
            // Kick off periodic weight requests and send an initial nudge
            try {
                log('Starting periodic weight requests');
                // Start W polling inside the service
                if (typeof (bluetoothScaleService as any).startWeightReading === 'function') {
                    (bluetoothScaleService as any).startWeightReading();
                }
            } catch (e: any) {
                log('Failed to start weight reading:', String(e?.message || e));
            }
            try {
                log('Sending initial nudge CRLF');
                await bluetoothScaleService.sendCommand(''); // sends "\r\n"
                log('Sending initial W');
                await bluetoothScaleService.sendCommand('W');
            } catch (e: any) {
                log('Initial nudge error:', String(e?.message || e));
            }
            // Try forcing a UI update shortly after connect in case data was parsed
            setTimeout(() => {
                try {
                    const forced = (bluetoothScaleService as any).forceWeightUpdate?.();
                    log('Force weight update result:', String(!!forced));
                } catch {}
            }, 800);
        } catch (e: any) {
            setStatus('connection_failed');
            setStatusMsg(String(e?.message || e));
            log('Connect error:', e?.message || e);
        }
    };

    const disconnect = async () => {
        log('Disconnect requested');
        await bluetoothScaleService.disconnect(true);
    };

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Levi Test (Bluetooth Classic via levi service)</Text>

            <View style={styles.statusCard}>
                <Text style={styles.statusRow}>Status: <Text style={styles.statusVal}>{status}</Text></Text>
                {!!statusMsg && <Text style={styles.statusMsg}>{statusMsg}</Text>}
                {connectedAddr ? (
                    <Text style={styles.statusRow}>Connected: {connectedName || 'Unknown'} ({connectedAddr})</Text>
                ) : (
                    <Text style={styles.statusRow}>Connected: None</Text>
                )}
            </View>

            <View style={styles.dataCard}>
                <Text style={styles.statusRow}>Last Reading</Text>
                <Text style={styles.reading}>{lastReading || '--'}</Text>
            </View>

            <View style={styles.buttonsRow}>
                <TouchableOpacity style={[styles.button, { backgroundColor: '#3b82f6' }]} onPress={scan} disabled={isScanning}>
                    <Text style={styles.buttonText}>{isScanning ? 'Scanning...' : 'Scan'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { backgroundColor: '#ef4444' }]} onPress={disconnect}>
                    <Text style={styles.buttonText}>Disconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#10b981' }]}
                    onPress={async () => {
                        log('Manual Nudge: CRLF + W');
                        try { await bluetoothScaleService.sendCommand(''); } catch (e: any) { log('CRLF error:', String(e?.message || e)); }
                        try { await bluetoothScaleService.sendCommand('W'); } catch (e: any) { log('W error:', String(e?.message || e)); }
                    }}
                >
                    <Text style={styles.buttonText}>Nudge</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={devices}
                keyExtractor={(item) => String(item.address || item.id)}
                style={{ marginTop: 12 }}
                nestedScrollEnabled
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.deviceRow} onPress={() => connect(String(item.address || item.id))}>
                        <Text style={styles.deviceName}>{item.name || 'Unnamed'}</Text>
                        <Text style={styles.deviceId}>{item.address || item.id}</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={!isScanning ? (
                    <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 8 }}>No devices yet. Tap Scan.</Text>
                ) : null}
            />

            <View style={{ marginTop: 12 }}>
                <Text style={{ marginBottom: 6, color: '#374151' }}>Send Custom Command</Text>
                <View style={{ flexDirection: 'row' }}>
                    <TextInput
                        style={[styles.input, { flex: 1, marginRight: 8 }]}
                        placeholder="Type command (e.g. W)"
                        value={cmd}
                        onChangeText={setCmd}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#111827', paddingHorizontal: 16 }]}
                        onPress={async () => {
                            if (!cmd.trim()) return;
                            log('Send custom command:', cmd.trim());
                            await bluetoothScaleService.sendCommand(cmd.trim());
                        }}
                    >
                        <Text style={styles.buttonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: '600', marginBottom: 6 }}>Logs (latest first)</Text>
                <FlatList
                    data={logs}
                    keyExtractor={(item, idx) => String(idx)}
                    renderItem={({ item }) => (
                        <Text style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{item}</Text>
                    )}
                    style={{ maxHeight: 180 }}
                    nestedScrollEnabled
                />
            </View>
        </ScrollView>
    );
};

export default LeviTestScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    scroll: { flex: 1, backgroundColor: '#fff' },
    contentContainer: { padding: 16, paddingBottom: 24 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    statusCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    statusRow: { color: '#374151' },
    statusVal: { fontWeight: '600' },
    statusMsg: { color: '#6b7280', marginTop: 4 },
    dataCard: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 16 },
    reading: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#111827', marginTop: 6 },
    buttonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
    buttonText: { color: '#fff', fontWeight: '700' },
    deviceRow: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
    deviceName: { fontWeight: '600', color: '#111827' },
    deviceId: { color: '#6b7280', fontSize: 12, marginTop: 2 },
    input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }
});


