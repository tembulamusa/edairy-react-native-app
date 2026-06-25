import React, { useState } from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    PermissionsAndroid,
    Alert,
    ActivityIndicator,
} from "react-native";
import { launchCamera, launchImageLibrary, Asset } from "react-native-image-picker";
import { globalStyles } from "../../styles";
import { compressImageForID } from "../utils/imageCompression";
import { sanitizeImageAsset } from "../../utils/reactNativeFormData";
import type { MemberPhotoUploads } from "../../types/memberRegistration";

type PhotoKey = keyof MemberPhotoUploads;

interface MemberPhotosFormProps {
    isIndividual: boolean;
    onPrevious: () => void;
    onNext: (photos: MemberPhotoUploads) => void;
    initialData?: Partial<MemberPhotoUploads>;
}

const PHOTO_LABELS: Record<PhotoKey, string> = {
    id_front_photo: "ID Front",
    id_back_photo: "ID Back",
    passport_photo: "Passport Photo",
};

const MemberPhotosForm: React.FC<MemberPhotosFormProps> = ({
    isIndividual,
    onPrevious,
    onNext,
    initialData,
}) => {
    const [photos, setPhotos] = useState<MemberPhotoUploads>({
        id_front_photo: initialData?.id_front_photo ?? null,
        id_back_photo: initialData?.id_back_photo ?? null,
        passport_photo: initialData?.passport_photo ?? null,
    });
    const [compressingKey, setCompressingKey] = useState<PhotoKey | null>(null);

    const requestCameraPermission = async (): Promise<boolean> => {
        if (Platform.OS !== "android") return true;
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        return result === PermissionsAndroid.RESULTS.GRANTED;
    };

    const processImage = async (key: PhotoKey, asset: Asset) => {
        setCompressingKey(key);
        try {
            const compressed = await compressImageForID(asset);
            setPhotos((prev) => ({ ...prev, [key]: sanitizeImageAsset(compressed) }));
        } catch {
            setPhotos((prev) => ({ ...prev, [key]: sanitizeImageAsset(asset) }));
        } finally {
            setCompressingKey(null);
        }
    };

    const pickImage = async (key: PhotoKey, source: "camera" | "gallery") => {
        if (source === "camera") {
            const permitted = await requestCameraPermission();
            if (!permitted) {
                Alert.alert("Permission required", "Camera permission is needed.");
                return;
            }
            const result = await launchCamera({
                mediaType: "photo",
                cameraType: "back",
                includeBase64: false,
            });
            if (result.assets?.[0]) {
                await processImage(key, result.assets[0]);
            }
            return;
        }

        const result = await launchImageLibrary({ mediaType: "photo", includeBase64: false });
        if (result.assets?.[0]) {
            await processImage(key, result.assets[0]);
        }
    };

    const handleNext = () => {
        if (isIndividual) {
            if (!photos.id_front_photo || !photos.id_back_photo || !photos.passport_photo) {
                Alert.alert("Missing Photos", "Please capture ID front, ID back, and passport photo.");
                return;
            }
        }

        onNext({
            id_front_photo: isIndividual ? photos.id_front_photo : null,
            id_back_photo: isIndividual ? photos.id_back_photo : null,
            passport_photo: photos.passport_photo,
        });
    };

    const photoKeys = (isIndividual
        ? (Object.keys(PHOTO_LABELS) as PhotoKey[])
        : (["passport_photo"] as PhotoKey[]));

    const renderPhotoSlot = (key: PhotoKey) => {
        const asset = photos[key];
        const isCompressing = compressingKey === key;

        return (
            <View key={key} style={styles.photoCard}>
                <Text style={styles.photoTitle}>{PHOTO_LABELS[key]}</Text>
                <View style={styles.previewBox}>
                    {isCompressing ? (
                        <ActivityIndicator size="large" color="#009688" />
                    ) : asset?.uri ? (
                        <Image source={{ uri: asset.uri }} style={styles.image} />
                    ) : (
                        <Text style={styles.placeholder}>No image</Text>
                    )}
                </View>
                <View style={styles.photoButtonsRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => pickImage(key, "camera")}
                        disabled={!!compressingKey}
                    >
                        <Text style={styles.actionButtonText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => pickImage(key, "gallery")}
                        disabled={!!compressingKey}
                    >
                        <Text style={styles.actionButtonText}>Gallery</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={globalStyles.pageTitle}>Member Registration</Text>
            <Text style={globalStyles.pageSubTitle}>
                {isIndividual ? "ID & Passport Photos" : "Photo (Optional)"}
            </Text>

            {photoKeys.map(renderPhotoSlot)}

            <View style={globalStyles.navRow}>
                <TouchableOpacity style={globalStyles.navButtonOutline} onPress={onPrevious}>
                    <Text style={[globalStyles.navButtonText, { color: "#009688" }]}>← Previous</Text>
                </TouchableOpacity>
                <TouchableOpacity style={globalStyles.navButtonFilled} onPress={handleNext}>
                    <Text style={globalStyles.navButtonText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 100,
    },
    photoCard: {
        marginBottom: 20,
    },
    photoTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        color: "#111827",
    },
    previewBox: {
        width: "100%",
        aspectRatio: 1.586,
        backgroundColor: "#f5f5f5",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ddd",
        marginBottom: 10,
    },
    image: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
        resizeMode: "contain",
    },
    placeholder: {
        color: "#9ca3af",
    },
    photoButtonsRow: {
        flexDirection: "row",
        gap: 8,
    },
    actionButton: {
        flex: 1,
        backgroundColor: "#009688",
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: "center",
    },
    actionButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
});

export default MemberPhotosForm;
