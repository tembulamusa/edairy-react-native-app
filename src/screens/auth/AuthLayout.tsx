import React from "react";
import { View, StyleSheet, ImageBackground } from "react-native";
import LinearGradient from "react-native-linear-gradient";

type Props = {
    children: React.ReactNode;
};

export default function AuthLayout({ children }: Props) {
    return (
        <ImageBackground
            source={require("../../assets/backgrounds/cow.jpg")}
            style={{ flex: 1 }}
            resizeMode="cover"
        >
            <LinearGradient
                colors={[
                    "rgba(224, 247, 250, 0.3)", // light top with 30% opacity
                    "rgba(0, 105, 92, 0.9)",    // deep bottom with 90% opacity
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.backgroundGradient}
            >
                <View style={styles.overlay}>
                    <View style={styles.innerContainer}>{children}</View>
                </View>
            </LinearGradient>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    backgroundGradient: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.3)", // optional dark overlay for readability
        paddingHorizontal: 20,
        paddingTop: 20,
        justifyContent: "center",
    },
    innerContainer: {
        flex: 1,
        justifyContent: "flex-end", // content stays at the bottom
        backgroundColor: "transparent",
        paddingBottom: 40,
    },
});
