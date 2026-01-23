import React from 'react';
import { View, Text, ActivityIndicator, Modal, StyleSheet, Image } from 'react-native';

interface SyncLoadingOverlayProps {
  visible: boolean;
  message?: string;
}

const SyncLoadingOverlay: React.FC<SyncLoadingOverlayProps> = ({
  visible,
  message = 'Syncing data...'
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={() => {}} // Prevent closing
      presentationStyle="overFullScreen"
    >
      <View style={styles.fullScreenOverlay}>
        <View style={styles.container}>
          <Image
            source={require('../assets/images/profile.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.subMessage}>
            Please wait while we sync your offline data
          </Text>
          <Text style={styles.instruction}>
            This process ensures your data is up to date before you continue.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: '#26A69A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 320,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 20,
    borderRadius: 40,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  subMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.9,
    marginTop: 12,
    textAlign: 'center',
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SyncLoadingOverlay;