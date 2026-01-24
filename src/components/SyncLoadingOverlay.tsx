import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Modal, StyleSheet, Image, Animated, StatusBar } from 'react-native';
import CustomHeader from './CustomHeader';

interface SyncLoadingOverlayProps {
  visible: boolean;
  message?: string;
}

const SyncLoadingOverlay: React.FC<SyncLoadingOverlayProps> = ({
  visible,
  message = 'Syncing data...'
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [bounceAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Bouncing text animation
      const bounceAnimation = () => {
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -10,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (visible) {
            setTimeout(bounceAnimation, 1000);
          }
        });
      };

      bounceAnimation();
    }
  }, [visible, fadeAnim, bounceAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={() => {}} // Prevent closing
      presentationStyle="overFullScreen"
    >
      <StatusBar backgroundColor="#26A69A" barStyle="light-content" />
      <Animated.View style={[styles.fullScreenOverlay, { opacity: fadeAnim }]}>
        <CustomHeader scene={null} previous={null} navigation={null} />
        <View style={styles.contentContainer}>
          <View style={styles.container}>
            <Image
              source={require('../assets/images/profile.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Animated.Text style={[styles.message, { transform: [{ translateY: bounceAnim }] }]}>
              {message}
            </Animated.Text>
            <Text style={styles.subMessage}>
              Please wait while we sync your offline data
            </Text>
            <Text style={styles.instruction}>
              This process ensures your data is up to date before you continue.
            </Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: '#26A69A',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'transparent',
    borderRadius: 40,
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