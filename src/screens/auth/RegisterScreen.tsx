import React from "react";
import { View, Text, Button } from "react-native";

export default function RegisterScreen({ navigation }: any) {
    return (
        <View>
            <Text style={{ fontSize: 24, marginBottom: 20 }}>Register</Text>
            <Button
                title="Back to Login"
                onPress={() => navigation.navigate("Login")}
            />
        </View>
    );
}
