import React, { useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { launchCamera, launchImageLibrary, Asset } from "react-native-image-picker";
import { globalStyles } from "../../styles";

interface Props {
    onPrevious: () => void;
    onNext: (image?: Asset) => void;
}

const IdBackCapture: React.FC<Props> = ({ onPrevious, onNext }) => {
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