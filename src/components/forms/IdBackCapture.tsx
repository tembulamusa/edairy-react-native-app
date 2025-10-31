import React, { useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid, Alert } from "react-native";
import { launchCamera, launchImageLibrary, Asset } from "react-native-image-picker";
import { globalStyles } from "../../styles";

interface Props {
    onPrevious: () => void;
    onNext: (image?: Asset) => void;
}

const IdBackCapture: React.FC<Props> = ({ onPrevious, onNext }) => {
    const [image, setImage] = useState<Asset | null>(null);

    const requestCameraPermission = async (): Promise<boolean> => {
        if (Platform.OS !== "android") return true;
        try {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                    title: "Camera Permission",
                    message: "We need access to your camera to take ID photos.",
                    buttonPositive: "OK",
                }
            );
            return result === PermissionsAndroid.RESULTS.GRANTED;
        } catch (e) {
            return false;
        }
    };

    const requestGalleryPermission = async (): Promise<boolean> => {
        if (Platform.OS !== "android") return true;
        try {
            const hasReadMedia = await PermissionsAndroid.request(
                // @ts-ignore
                (PermissionsAndroid as any).PERMISSIONS.READ_MEDIA_IMAGES || PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                {
                    title: "Photos Permission",
                    message: "We need access to your photos to pick ID images.",
                    buttonPositive: "OK",
                }
            );
            return hasReadMedia === PermissionsAndroid.RESULTS.GRANTED;
        } catch (e) {
            return false;
        }
    };

    const handleTakePhoto = async () => {
        const permitted = await requestCameraPermission();
        if (!permitted) {
            Alert.alert("Permission required", "Camera permission is needed to take a photo.");
            return;
        }
        const result = await launchCamera({ mediaType: "photo", cameraType: "front" });
        if (result?.didCancel) return;
        if (result?.errorCode) {
            Alert.alert("Camera error", result.errorMessage || result.errorCode);
            return;
        }
        if (result.assets && result.assets.length > 0) {
            setImage(result.assets[0]);
        }
    };

    const handleBrowseGallery = async () => {
        const permitted = await requestGalleryPermission();
        if (!permitted) {
            Alert.alert("Permission required", "Photos permission is needed to select an image.");
            return;
        }
        const result = await launchImageLibrary({ mediaType: "photo" });
        if (result?.didCancel) return;
        if (result?.errorCode) {
            Alert.alert("Gallery error", result.errorMessage || result.errorCode);
            return;
        }
        if (result.assets && result.assets.length > 0) {
            setImage(result.assets[0]);
        }
    };

    return (
        <View style={globalStyles.container}>
            {/* Preview Box */}
            <View style={globalStyles.previewBox}>
                {image ? (
                    <Image source={{ uri: image.uri }} style={globalStyles.image} />
                ) : (
                    <Text style={globalStyles.placeholder}>ID Back Preview</Text>
                )}
            </View>

            {/* Photo buttons */}
            <View style={globalStyles.photoButtonsRow}>
                <TouchableOpacity style={globalStyles.actionButton} onPress={handleTakePhoto}>
                    <Text style={[globalStyles.actionButtonText]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={globalStyles.actionButton} onPress={handleBrowseGallery}>
                    <Text style={globalStyles.actionButtonText}>Browse Gallery</Text>
                </TouchableOpacity>
            </View>

            {/* Navigation buttons */}
            <View style={globalStyles.navRow}>
                <TouchableOpacity style={globalStyles.navButtonOutline} onPress={onPrevious}>
                    <Text style={[globalStyles.navButtonText, { color: "#009688" }]}>← Previous</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={globalStyles.navButtonFilled}
                    onPress={() => onNext(image || undefined)}
                >
                    <Text style={globalStyles.navButtonText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default IdBackCapture;