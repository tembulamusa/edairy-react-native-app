import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { CORE_DATA_SETTINGS_MESSAGE } from "../services/coreData";

export const REFERENCE_DATA_SETTINGS_HINT = CORE_DATA_SETTINGS_MESSAGE;

type ReferenceDataMissingBannerProps = {
    visible: boolean;
    title?: string;
    message?: string;
};

const ReferenceDataMissingBanner: React.FC<ReferenceDataMissingBannerProps> = ({
    visible,
    title = "Core Data Missing",
    message = CORE_DATA_SETTINGS_MESSAGE,
}) => {
    if (!visible) {
        return null;
    }

    return (
        <View style={styles.banner} accessibilityRole="alert">
            <MaterialIcons name="cloud-off" size={22} color="#b45309" style={styles.icon} />
            <View style={styles.textWrap}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>
            </View>
        </View>
    );
};

export default ReferenceDataMissingBanner;

const styles = StyleSheet.create({
    banner: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#fffbeb",
        borderWidth: 1,
        borderColor: "#f59e0b",
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        gap: 10,
    },
    icon: {
        marginTop: 2,
    },
    textWrap: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: "700",
        color: "#92400e",
        marginBottom: 4,
    },
    message: {
        fontSize: 13,
        lineHeight: 18,
        color: "#78350f",
    },
});
