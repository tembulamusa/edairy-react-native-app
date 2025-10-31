import React from "react";
import { View, StyleSheet, ImageBackground, StatusBar } from "react-native";
import LinearGradient from "react-native-linear-gradient";

type Props = {
    children: React.ReactNode;
};

export default function AuthLayout({ children }: Props) {
    return (
        <ImageBackground
            source={require("../../assets/backgrounds/cow.jpg")}
            style={styles.imageBackground}
            resizeMode="cover"
        >
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <LinearGradient
                colors={[
                    "rgba(224, 247, 250, 0.1)", // very light top
                    "rgba(0, 105, 92, 0.1)",    // very light bottom
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
    imageBackground: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0)",
    },
    backgroundGradient: { 
        flex: 1,
        backgroundColor: "rgba(0,0,0,0)",
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0)",
        paddingHorizontal: 20,
        paddingTop: 20,
        justifyContent: "center",
    },
    innerContainer: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0)",
        paddingBottom: 40,
    },
});
