import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Alert, Platform, PermissionsAndroid, TouchableOpacity, Text } from "react-native";
import { WebView } from "react-native-webview";
import { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function WebViewScreen({ route, navigation }: any) {
    const { url } = route.params;
    const webviewRef = useRef<WebView>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Request camera permission on Android
    useEffect(() => {
        async function requestCamera() {
            if (Platform.OS === "android") {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: "Camera Permission",
                        message: "This app needs access to your camera for Liveness Check",
                        buttonNeutral: "Ask Me Later",
                        buttonNegative: "Cancel",
                        buttonPositive: "OK",
                    }
                );
                setPermissionGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert("Camera permission denied");
                }
            } else {
                setPermissionGranted(true);
            }
        }
        requestCamera();
    }, []);

    // JS injected into WebView to forward console logs to RN
    const injectedJS = `
        (function() {
            const oldLog = console.log;
            console.log = function(...args) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: "log", message: args }));
                oldLog.apply(console, args);
            };
            const oldError = console.error;
            console.error = function(...args) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: args }));
                oldError.apply(console, args);
            };
        })();
        true;
    `;

    const handleMessage = (msg: any) => {
        try {
            if (msg.status === "success") {
                Alert.alert("Success", "Liveness Test completed", [
                    {
                        text: "OK",
                        onPress: () => navigation.navigate("Members"),
                    },
                ]);
            } else {
                Alert.alert("Notice", msg.message || "Unknown message from WebView");
            }
        } catch (err) {
            Alert.alert("Error", "Unable to handle Liveness message");
        }
    };

    const handleExitToCashouts = () => {
        // Navigate to Cashouts tab in the Home stack
        navigation.navigate("Cashouts", {
        });
    };

    if (!permissionGranted) {
        return <View style={styles.container} />;
    }

    return (
        <View style={styles.container}>
            {/* Exit Button */}
            <TouchableOpacity
                style={styles.exitButton}
                onPress={handleExitToCashouts}
                activeOpacity={0.7}
            >
                <Icon name="close" size={24} color="#fff" />
                <Text style={styles.exitButtonText}>Exit to Cashouts</Text>
            </TouchableOpacity>

            <WebView
                ref={webviewRef}
                source={{ uri: url }}
                style={{ flex: 1 }}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={["*"]}
                mixedContentMode="always"
                startInLoadingState
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                allowsFullscreenVideo
                injectedJavaScript={injectedJS}
                geolocationEnabled
                allowFileAccess
                allowUniversalAccessFromFileURLs
                onMessage={(event: WebViewMessageEvent) => {
                    try {
                        const msg = JSON.parse(event.nativeEvent.data);
                        if (msg.status === "success") {
                            console.log("✅ Liveness done:", msg.data);
                            handleMessage(msg);
                        } else if (msg.type === "log") {
                            console.log("[WebView log]", ...msg.message);
                        } else if (msg.type === "error") {
                            console.error("[WebView error]", ...msg.message);
                        }
                    } catch (err) {
                        console.error("Invalid message from WebView:", event.nativeEvent.data);
                    }
                }}
                onPermissionRequest={(event) => {
                    event.grant(event.resources);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    exitButton: {
        position: "absolute",
        top: Platform.OS === "ios" ? 50 : 20,
        right: 20,
        zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.3)",
    },
    exitButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        marginLeft: 8,
    },
});
