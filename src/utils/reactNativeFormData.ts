import { Platform } from "react-native";
import type { Asset } from "react-native-image-picker";

/** Strip base64 and other fields that must not be sent as form text. */
export function sanitizeImageAsset(asset: Asset): Asset {
    const { base64: _base64, ...clean } = asset;
    return clean;
}

function resolveFileName(asset: Asset, fallback: string): string {
    const raw = asset.fileName?.trim();
    if (raw) {
        return raw.includes(".") ? raw : `${raw}.jpg`;
    }
    return `${fallback}.jpg`;
}

function resolveMimeType(asset: Asset): string {
    if (asset.type?.startsWith("image/")) {
        return asset.type;
    }
    return "image/jpeg";
}

/**
 * React Native multipart file part — binary upload via uri, never base64.
 * @see https://reactnative.dev/docs/network#uploading-a-base64-encoded-image
 */
export function resolveReactNativeFormFile(asset: Asset, fallbackName: string) {
    const uri = asset.uri ?? "";
    const normalizedUri =
        Platform.OS === "ios" && uri.startsWith("file://")
            ? uri.replace("file://", "")
            : uri;

    return {
        uri: normalizedUri,
        type: resolveMimeType(asset),
        name: resolveFileName(asset, fallbackName),
    };
}

export function appendReactNativeFormFile(
    formData: FormData,
    fieldName: string,
    asset: Asset | null | undefined
) {
    if (!asset?.uri) {
        return;
    }

    const file = resolveReactNativeFormFile(sanitizeImageAsset(asset), fieldName);
    formData.append(fieldName, file as any);
}
