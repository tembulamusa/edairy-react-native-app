import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated, StatusBar } from 'react-native';

interface WelcomeScreenProps {
  visible: boolean;
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ visible, onComplete }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [textAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(textAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-advance after 4 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [visible, fadeAnim, scaleAnim, textAnim, onComplete]);

  if (!visible) return null;

  return (
    <>
      <StatusBar backgroundColor="#26A69A" barStyle="light-content" />
      <Animated.View
        style={[styles.fullScreenOverlay, { opacity: fadeAnim }]}
        onTouchEnd={onComplete}
      >
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/profile.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <Animated.View style={[styles.textContainer, { opacity: textAnim }]}>
            <Text style={styles.welcomeText}>Welcome to eDairy</Text>
            <Text style={styles.taglineText}>
              Where milk farming{'\n'}gives you wings
            </Text>
          </Animated.View>

          <View style={styles.bottomText}>
            <Text style={styles.continueText}>Tap to continue</Text>
          </View>
        </Animated.View>
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
    zIndex: 9998,
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  taglineText: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    opacity: 0.9,
  },
  bottomText: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.7,
  },
});

export default WelcomeScreen;