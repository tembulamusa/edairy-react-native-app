import React, { useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { launchCamera, launchImageLibrary, Asset } from "react-native-image-picker";

interface Props {
    onPrevious: () => void;
    onNext: (image?: Asset) => void;
}

const IdFrontCapture: React.FC<Props> = ({ onPrevious, onNext }) => {
    const [image, setImage] = useState<Asset | null>(null);

    const handleTakePhoto = async () => {
        const result = await launchCamera({ mediaType: "photo", cameraType: "front" });
        if (result.assets && result.assets.length > 0) {
            setImage(result.assets[0]);
        }
    };

    const handleBrowseGallery = async () => {
        const result = await launchImageLibrary({ mediaType: "photo" });
        if (result.assets && result.assets.length > 0) {
            setImage(result.assets[0]);
        }
    };

    return (
        <View style={styles.container}>
            {/* Preview Box */}
            <View style={styles.previewBox}>
                {image ? (
                    <Image source={{ uri: image.uri }} style={styles.image} />
                ) : (
                    <Text style={styles.placeholder}>ID Front Preview</Text>
                )}
            </View>

            {/* Photo buttons */}
            <View style={styles.photoButtonsRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
                    <Text style={styles.actionButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleBrowseGallery}>
                    <Text style={styles.actionButtonText}>Browse Gallery</Text>
                </TouchableOpacity>
            </View>

            {/* Navigation buttons */}
            <View style={styles.navRow}>
                <TouchableOpacity style={styles.navButtonOutline} onPress={onPrevious}>
                    <Text style={[styles.navButtonText, { color: "#009688" }]}>← Previous</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navButtonFilled}
                    onPress={() => onNext(image || undefined)}
                >
                    <Text style={styles.navButtonText}>Next →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default IdFrontCapture;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: "flex-start",
        alignItems: "center",
    },
    previewBox: {
        width: "100%",
        height: 250,
        backgroundColor: "#fff",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
    },
    image: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
        resizeMode: "cover",
    },
    placeholder: {
        color: "#aaa",
        fontSize: 16,
    },
    photoButtonsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 40,
    },
    actionButton: {
        flex: 1,
        backgroundColor: "#009688",
        paddingVertical: 12,
        marginHorizontal: 5,
        borderRadius: 20,
        alignItems: "center",
    },
    actionButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    navRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    navButtonOutline: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#009688",
        paddingVertical: 12,
        marginRight: 5,
        borderRadius: 20,
        alignItems: "center",
    },
    navButtonFilled: {
        flex: 1,
        backgroundColor: "#009688",
        paddingVertical: 12,
        marginLeft: 5,
        borderRadius: 20,
        alignItems: "center",
    },
    navButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
});
