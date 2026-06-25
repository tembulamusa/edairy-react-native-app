import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

/** Runtime Bluetooth permissions required before any adapter / Classic BT API call. */
export async function requestAndroidBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") {
        return true;
    }

    try {
        const apiLevel =
            typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10);

        if (apiLevel >= 31) {
            const result = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]);
            return Object.values(result).every(
                (value) => value === PermissionsAndroid.RESULTS.GRANTED
            );
        }

        const location = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return location === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
        console.warn("[Bluetooth] Permission request failed:", error);
        return false;
    }
}

type EnsureBluetoothEnabledOptions = {
    /** When false, only checks state without showing a prompt. */
    promptIfDisabled?: boolean;
};

/**
 * Check Classic adapter state after permissions are granted.
 * Avoids requestBluetoothEnabled() which crashes on many Android 12+ devices
 * when BLUETOOTH_CONNECT is missing or the activity result fails.
 */
export async function ensureClassicBluetoothEnabled(
    options: EnsureBluetoothEnabledOptions = {}
): Promise<boolean> {
    const { promptIfDisabled = true } = options;

    const permitted = await requestAndroidBluetoothPermissions();
    if (!permitted) {
        if (promptIfDisabled) {
            Alert.alert(
                "Permissions required",
                "Allow Bluetooth permissions so the app can connect to scales and printers."
            );
        }
        return false;
    }

    try {
        const enabled = RNBluetoothClassic?.isBluetoothEnabled
            ? await RNBluetoothClassic.isBluetoothEnabled()
            : false;

        if (enabled) {
            return true;
        }

        if (!promptIfDisabled) {
            return false;
        }

        await new Promise<void>((resolve) => {
            Alert.alert(
                "Bluetooth is off",
                "Turn on Bluetooth in your device settings, then return to the app and try again.",
                [
                    { text: "Cancel", style: "cancel", onPress: () => resolve() },
                    {
                        text: "Open Settings",
                        onPress: () => {
                            Linking.openSettings().catch(() => {});
                            resolve();
                        },
                    },
                ],
                { cancelable: true, onDismiss: () => resolve() }
            );
        });

        return RNBluetoothClassic?.isBluetoothEnabled
            ? await RNBluetoothClassic.isBluetoothEnabled()
            : false;
    } catch (error) {
        console.warn("[Bluetooth] Classic enable check failed:", error);
        return false;
    }
}
