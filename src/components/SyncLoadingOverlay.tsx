import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Animated } from 'react-native';
// @ts-ignore
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface SyncLoadingOverlayProps {
  visible: boolean;
  message?: string;
}

const SyncLoadingOverlay: React.FC<SyncLoadingOverlayProps> = ({
  visible,
  message = 'Syncing...',
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      spinAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [visible, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={styles.backdrop} pointerEvents="box-none">
        <View style={styles.card}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialIcons name="sync" size={40} color="#1b7f74" />
          </Animated.View>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  card: {
    minWidth: 180,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
});

export default SyncLoadingOverlay;
