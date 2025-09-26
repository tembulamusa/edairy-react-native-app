import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { globalStyles } from "../../styles";
import makeRequest from "../../components/utils/makeRequest.ts";

export default function LoginScreen({ navigation }: any) {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // ✅ Check if user exists on mount
    useEffect(() => {
        const checkUser = async () => {
            try {
                const storedUser = await AsyncStorage.getItem("user");
                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);

                    // check if token expired
                    if (parsedUser?.expiry && parsedUser.expiry > Date.now()) {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: "Home" }], // redirect to Dashboard/Home
                        });
                    } else {
                        // expired -> clear it
                        await AsyncStorage.removeItem("user");
                    }
                }
            } catch (err) {
                console.error("Error checking stored user", err);
            }
        };

        checkUser();
    }, []);

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

            if ([200, 201].includes(status)) {
                if (response?.access_token) {
                    // calculate expiration timestamp
                    const expiresIn = response?.expires_in ?? 3600; // default 1hr
                    const expiryTimestamp = Date.now() + expiresIn * 1000;

                    const userData = {
                        ...response,
                        expiry: expiryTimestamp,
                    };

                    // Save in AsyncStorage
                    await AsyncStorage.setItem("user", JSON.stringify(userData));

                    // redirect to Home/Dashboard
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "Home" }],
                    });
                } else {
                    Alert.alert("Login Failed", "Phone number or password wrong");
                }
            } else {
                Alert.alert("Login Failed", JSON.stringify(response) || "Unexpected error");
                return;
            }
        } catch (error: any) {
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
                backgroundColor: "transparent",
            }}
        >
            {/* Title */}
            <Text style={[globalStyles.title, { color: "#fff" }]}>Sign In</Text>

            {/* Phone Number */}
            <Text style={[globalStyles.label, { color: "#fff" }]}>Phone Number</Text>
            <TextInput
                placeholder="254792924299"
                placeholderTextColor="#d1d5db"
                style={globalStyles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoCapitalize="none"
            />

            {/* Password */}
            <Text style={[globalStyles.label, { color: "#fff" }]}>Password</Text>
            <TextInput
                placeholder="password"
                placeholderTextColor="#d1d5db"
                secureTextEntry
                style={globalStyles.input}
                value={password}
                onChangeText={setPassword}
            />

            {/* Login Button */}
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
