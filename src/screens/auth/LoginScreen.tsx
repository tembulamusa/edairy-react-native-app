// src/screens/LoginScreen.tsx
import React, { useState, useContext } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { globalStyles } from "../../styles";
import { AuthContext } from "../../AuthContext";
import { CORE_DATA_SETTINGS_MESSAGE } from "../../services/coreData";
import { signInWithEmailPassword } from "../../services/authSession";
import { isValidEmail } from "../../utils/loginCredentials";

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);

    const handleLogin = async () => {
        if (!isValidEmail(email)) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        if (!password) {
            Alert.alert("Error", "Please enter your password.");
            return;
        }

        setLoading(true);
        try {
            const result = await signInWithEmailPassword({
                email,
                password,
                login,
            });

            if (!result.success) {
                Alert.alert("Sign In Failed", result.errorMessage || "Unable to sign in.");
                return;
            }

            if (result.navigationTarget === "settings") {
                Alert.alert("Offline Data", CORE_DATA_SETTINGS_MESSAGE, [{ text: "OK" }]);
                navigation.reset({
                    index: 0,
                    routes: [
                        { name: "Home" },
                        { name: "Home", params: { screen: "Settings" } },
                    ],
                });
                return;
            }

            navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
            });
        } catch (error: any) {
            console.error("[LOGIN] Sign in failed:", error);
            Alert.alert("Sign In Failed", error?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "flex-end",
                    padding: 20,
                    backgroundColor: "rgba(0,0,0,0)",
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={[globalStyles.title, { color: "#fff", marginBottom: 24 }]}>
                    Sign In
                </Text>

                <Text style={[globalStyles.label, { color: "#fff" }]}>Email</Text>
                <TextInput
                    placeholder="name@example.com"
                    placeholderTextColor="#d1d5db"
                    style={globalStyles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                />

                <Text style={[globalStyles.label, { color: "#fff" }]}>Password</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        placeholder="Enter your password"
                        placeholderTextColor="#d1d5db"
                        secureTextEntry={!showPassword}
                        style={[globalStyles.input, styles.passwordInput]}
                        value={password}
                        onChangeText={setPassword}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                    >
                        <Icon
                            name={showPassword ? "visibility" : "visibility-off"}
                            size={24}
                            color="#6b7280"
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[globalStyles.button, loading && { opacity: 0.6 }]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={globalStyles.buttonText}>Sign In</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    passwordContainer: {
        position: "relative",
        marginBottom: 16,
    },
    passwordInput: {
        paddingRight: 50,
    },
    eyeIcon: {
        position: "absolute",
        right: 16,
        top: 12,
        padding: 4,
    },
});
