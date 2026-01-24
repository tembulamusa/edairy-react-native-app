import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image, Animated, StatusBar } from 'react-native';

interface LaunchScreenProps {
  visible: boolean;
}

const LaunchScreen: React.FC<LaunchScreenProps> = ({ visible }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [bounceAnim] = useState(new Animated.Value(0));
  const [featureAnim1] = useState(new Animated.Value(0));
  const [featureAnim2] = useState(new Animated.Value(0));
  const [featureAnim3] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      console.log('[LAUNCH] LaunchScreen visible, starting animations');

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

      // Feature animations
      setTimeout(() => {
        Animated.timing(featureAnim1, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 500);

      setTimeout(() => {
        Animated.timing(featureAnim2, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 800);

      setTimeout(() => {
        Animated.timing(featureAnim3, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1100);
    }
  }, [visible, fadeAnim, bounceAnim, featureAnim1, featureAnim2, featureAnim3]);

  console.log('[LAUNCH] LaunchScreen rendered, visible:', visible);

  if (!visible) return null;

  return (
    <>
      <StatusBar backgroundColor="#26A69A" barStyle="light-content" />
      <Animated.View style={[styles.fullScreenOverlay, { opacity: fadeAnim }]}>
        <View style={styles.container}>
          <Image
            source={require('../assets/images/profile.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color="#FFFFFF" style={styles.spinner} />
          <Animated.Text style={[styles.mainMessage, { transform: [{ translateY: bounceAnim }] }]}>
            Launching eDairy App
          </Animated.Text>
          <Text style={styles.subMessage}>
            Please wait while we prepare your experience
          </Text>
          <View style={styles.featuresContainer}>
            <Animated.Text style={[styles.featureText, { opacity: featureAnim1 }]}>
              • Track milk collections
            </Animated.Text>
            <Animated.Text style={[styles.featureText, { opacity: featureAnim2 }]}>
              • Manage member payments
            </Animated.Text>
            <Animated.Text style={[styles.featureText, { opacity: featureAnim3 }]}>
              • Monitor farm performance
            </Animated.Text>
          </View>
          <Text style={styles.instruction}>
            Setting up your dairy management system...
          </Text>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#26A69A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
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
    borderRadius: 1000,
  },
  spinner: {
    marginBottom: 20,
  },
  mainMessage: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 16,
  },
  featuresContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
    marginVertical: 2,
    fontWeight: '500',
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default LaunchScreen;