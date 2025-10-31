import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated
} from 'react-native';
import {
  TickCircle,
  CloseCircle,
  Warning2,
  Bluetooth,
} from 'iconsax-react-nativejs';
import { fontScale, moderateScale } from '../common/responsive';

const BluetoothConnectionModal = ({ 
  visible, 
  onClose,
  type = 'success', // 'success', 'error', 'warning'
  title,
  message,
  deviceName,
  autoCloseDelay = 3000, // Auto close after 3 seconds for success
  showCloseButton = true,
  onRetry = null,
  suggestions = []
}) => {
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [scaleAnim] = React.useState(new Animated.Value(0.3));

  React.useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close for success messages
      if (type === 'success' && autoCloseDelay > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoCloseDelay);

        return () => clearTimeout(timer);
      }
    } else {
      // Reset animations when modal closes
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.3);
    }
  }, [visible, type, autoCloseDelay]);

  const handleClose = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onClose) {
        onClose();
      }
    });
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <TickCircle size={48} color="#22C55E" variant="Bold" />,
          backgroundColor: '#F0FDF4',
          borderColor: '#22C55E',
          titleColor: '#16A34A',
          primaryButtonColor: '#22C55E',
          primaryButtonText: 'Great!',
        };
      case 'error':
        return {
          icon: <CloseCircle size={48} color="#EF4444" variant="Bold" />,
          backgroundColor: '#FEF2F2',
          borderColor: '#EF4444',
          titleColor: '#DC2626',
          primaryButtonColor: '#EF4444',
          primaryButtonText: 'Try Again',
        };
      case 'warning':
        return {
          icon: <Warning2 size={48} color="#F59E0B" variant="Bold" />,
          backgroundColor: '#FFFBEB',
          borderColor: '#F59E0B',
          titleColor: '#D97706',
          primaryButtonColor: '#F59E0B',
          primaryButtonText: 'Okay',
        };
      default:
        return {
          icon: <Bluetooth size={48} color="#3B82F6" variant="Bold" />,
          backgroundColor: '#EBF2FF',
          borderColor: '#3B82F6',
          titleColor: '#1D4ED8',
          primaryButtonColor: '#3B82F6',
          primaryButtonText: 'Okay',
        };
    }
  };

  const config = getTypeConfig();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}>
      <Animated.View 
        style={[
          styles.modalContainer,
          { opacity: fadeAnim }
        ]}>
        <Animated.View 
          style={[
            styles.modalContent,
            {
              backgroundColor: config.backgroundColor,
              borderColor: config.borderColor,
              transform: [{ scale: scaleAnim }]
            }
          ]}>
          
          {/* Close Button */}
          {showCloseButton && (
            <TouchableOpacity 
              onPress={handleClose}
              style={styles.closeButton}>
              <CloseCircle size={20} color="#64748B" variant="Bold" />
            </TouchableOpacity>
          )}

          {/* Icon */}
          <View style={styles.iconContainer}>
            {config.icon}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: config.titleColor }]}>
            {title}
          </Text>

          {/* Device Name */}
          {deviceName && (
            <View style={styles.deviceContainer}>
              <Bluetooth size={16} color="#64748B" variant="Bold" />
              <Text style={styles.deviceName}>{deviceName}</Text>
            </View>
          )}

          {/* Message */}
          <Text style={styles.message}>
            {message}
          </Text>

          {/* Suggestions for error messages */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Troubleshooting tips:</Text>
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <View key={index} style={styles.suggestionItem}>
                  <View style={styles.suggestionBullet} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {type === 'error' && onRetry && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: config.primaryButtonColor }]}
                onPress={() => {
                  handleClose();
                  setTimeout(() => onRetry(), 300);
                }}
                activeOpacity={0.8}>
                <Text style={styles.primaryButtonText}>
                  {config.primaryButtonText}
                </Text>
              </TouchableOpacity>
            )}
            
            {type === 'success' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: config.primaryButtonColor }]}
                onPress={handleClose}
                activeOpacity={0.8}>
                <Text style={styles.primaryButtonText}>
                  {config.primaryButtonText}
                </Text>
              </TouchableOpacity>
            )}

            {(type === 'error' || type === 'warning') && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleClose}
                activeOpacity={0.8}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Auto-close indicator for success */}
          {type === 'success' && autoCloseDelay > 0 && (
            <View style={styles.autoCloseIndicator}>
              <Text style={styles.autoCloseText}>
                This will close automatically in {Math.ceil(autoCloseDelay / 1000)} seconds
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: moderateScale(20),
  },
  modalContent: {
    width: '100%',
    maxWidth: moderateScale(380),
    borderRadius: moderateScale(24),
    borderWidth: 2,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    padding: moderateScale(24),
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: moderateScale(16),
    right: moderateScale(16),
    padding: moderateScale(8),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: moderateScale(8),
    letterSpacing: -0.5,
  },
  deviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(12),
  },
  deviceName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#475569',
    marginLeft: moderateScale(6),
    letterSpacing: 0.1,
  },
  message: {
    fontSize: fontScale(16),
    color: '#374151',
    textAlign: 'center',
    lineHeight: fontScale(22),
    marginBottom: moderateScale(20),
    paddingHorizontal: moderateScale(8),
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    width: '100%',
    marginBottom: moderateScale(20),
  },
  suggestionsTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: moderateScale(12),
    letterSpacing: 0.2,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(8),
  },
  suggestionBullet: {
    width: moderateScale(4),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: '#3B82F6',
    marginRight: moderateScale(12),
    marginTop: moderateScale(8),
  },
  suggestionText: {
    fontSize: fontScale(13),
    color: '#4B5563',
    lineHeight: fontScale(18),
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: moderateScale(12),
  },
  primaryButton: {
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryButtonText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.2,
  },
  autoCloseIndicator: {
    marginTop: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: moderateScale(12),
  },
  autoCloseText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default BluetoothConnectionModal;
