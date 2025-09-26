import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Alert, Platform, PermissionsAndroid } from "react-native";
import { WebView } from "react-native-webview";
import { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

export default function WebViewScreen({ route }: any) {
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

    // JS injected into WebView to hook console logs
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

    const handleMessage = (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "log") console.log("📜 [WebView LOG]:", ...data.message);
            else if (data.type === "error") {
                console.error("❌ [WebView ERROR]:", ...data.message);
                Alert.alert("WebView Error", JSON.stringify(data.message));
            }
        } catch (err) {
            console.warn("[WebView RAW]:", event.nativeEvent.data);
        }
    };

    if (!permissionGranted) {
        return <View style={styles.container} />;
    }

    return (
        <View style={styles.container}>
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
                onMessage={handleMessage}
                injectedJavaScript={injectedJS}
                geolocationEnabled
                allowFileAccess
                allowUniversalAccessFromFileURLs
                // Grant permissions requested by WebView (Android only)
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
});
