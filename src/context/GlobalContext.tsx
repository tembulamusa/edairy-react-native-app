// context/GlobalContext.tsx
import React, { createContext, useState, useEffect } from "react";
import DeviceInfo from "react-native-device-info";
import { Alert, StatusBar } from "react-native";

export const GlobalContext = createContext<any>(null);

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [deviceUID, setDeviceUID] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<string>("offline");

  // 🔹 Scale-related states
  const [scaleConnectionState, setScaleConnectionState] = useState<string>("disconnected");
  const [scaleDevice, setScaleDevice] = useState<any>(null);
  const [scaleWeight, setScaleWeight] = useState<string>("");

  // Device ID setup
  useEffect(() => {
    const initDeviceInfo = async () => {
      try {
        const uniqueId = await DeviceInfo.getUniqueId();
        setDeviceUID(uniqueId);
        setClientId(`client-${uniqueId}`);
      } catch (error) {
        console.error("DeviceInfo error:", error);
      }
    };
    initDeviceInfo();
  }, []);

  // Connection updates
  const updateScaleConnection = (device: any) => {
    setScaleDevice(device);
    setScaleConnectionState("connected");
    Alert.alert("Scale Connected", `Connected to ${device?.name || "Unknown device"}`);
  };

  const resetScaleConnection = () => {
    setScaleDevice(null);
    setScaleConnectionState("disconnected");
    setScaleWeight("");
  };

  return (
    <GlobalContext.Provider
      value={{
        clientId,
        deviceUID,
        connectionType,
        scaleConnectionState,
        scaleDevice,
        scaleWeight,
        setScaleWeight,
        updateScaleConnection,
        resetScaleConnection,
        setScaleDevice,
      }}
    >
      <StatusBar barStyle="dark-content" />
      {children}
    </GlobalContext.Provider>
  );
};
