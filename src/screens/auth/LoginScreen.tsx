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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { globalStyles } from "../../styles";
import makeRequest from "../../components/utils/makeRequest";
import { AuthContext } from "../../AuthContext";

export default function LoginScreen({ navigation }: any) {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);

    const handleLogin = async () => {
        if (!phoneNumber || !password) {
            Alert.alert("Error", "Please enter both phone number and password.");
            return;
        }

        setLoading(true);
        try {
            const endpoint = "member-token";
            const data = { phone_number: phoneNumber, password };
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data,
            });

            if ([200, 201].includes(status) && response?.access_token) {
                const token = response.access_token;

                await login(token);
                await AsyncStorage.setItem("user", JSON.stringify(response));

                navigation.reset({
                    index: 0,
                    routes: [{ name: "Home" }],
                });
            } else {
                Alert.alert("Login Failed", "Invalid phone number or password.");
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Login Failed", error?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View
            style={{
                flex: 1,
                justifyContent: "flex-end",
                padding: 20,
                backgroundColor: "rgba(0,0,0,0)", // explicitly transparent
            }}
        >
            <Text style={[globalStyles.title, { color: "#fff" }]}>Sign In</Text>

            <Text style={[globalStyles.label, { color: "#fff" }]}>Phone Number</Text>
            <TextInput
                placeholder="254792924299"
                placeholderTextColor="#d1d5db"
                style={globalStyles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoCapitalize="none"
            />

            <Text style={[globalStyles.label, { color: "#fff" }]}>Password</Text>
            <TextInput
                placeholder="password"
                placeholderTextColor="#d1d5db"
                secureTextEntry
                style={globalStyles.input}
                value={password}
                onChangeText={setPassword}
            />

            <TouchableOpacity
                style={globalStyles.button}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={globalStyles.buttonText}>Login</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

