import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useConnectivity } from '../context/ConnectivityContext';
import ConnectivityIndicator from './ConnectivityIndicator';

const ConnectivityExample: React.FC = () => {
  const {
    isConnected,
    connectionType,
    isInternetReachable,
    connectionQuality,
    lastConnectedAt,
    checkConnectivity,
  } = useConnectivity();

  const handleTestConnection = async () => {
    try {
      await checkConnectivity();
      Alert.alert(
        'Connection Test',
        `Status: ${isConnected && isInternetReachable ? 'Connected' : 'Disconnected'}\n` +
        `Type: ${connectionType}\n` +
        `Quality: ${connectionQuality}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to test connection');
    }
  };

  const handleNetworkOperation = async () => {
    if (!isConnected || !isInternetReachable) {
      Alert.alert(
        'No Internet',
        'This operation requires an internet connection. Please check your network settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Simulate a network operation
    Alert.alert('Success', 'Network operation completed successfully!');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Connectivity Status</Text>
      
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Current Status</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.label}>Connection:</Text>
          <Text style={[styles.value, { color: isConnected ? '#16a34a' : '#dc2626' }]}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Internet:</Text>
          <Text style={[styles.value, { color: isInternetReachable ? '#16a34a' : '#dc2626' }]}>
            {isInternetReachable ? 'Reachable' : 'Unreachable'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{connectionType}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Quality:</Text>
          <Text style={[styles.value, { 
            color: connectionQuality === 'excellent' ? '#16a34a' : 
                   connectionQuality === 'good' ? '#2563eb' : 
                   connectionQuality === 'poor' ? '#d97706' : '#dc2626' 
          }]}>
            {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
          </Text>
        </View>

        {lastConnectedAt && (
          <View style={styles.statusRow}>
            <Text style={styles.label}>Last Connected:</Text>
            <Text style={styles.value}>
              {lastConnectedAt.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.indicatorSection}>
        <Text style={styles.cardTitle}>Connectivity Indicators</Text>
        
        <View style={styles.indicatorRow}>
          <Text style={styles.indicatorLabel}>Small:</Text>
          <ConnectivityIndicator size="small" showText />
        </View>

        <View style={styles.indicatorRow}>
          <Text style={styles.indicatorLabel}>Medium:</Text>
          <ConnectivityIndicator size="medium" showText />
        </View>

        <View style={styles.indicatorRow}>
          <Text style={styles.indicatorLabel}>Large:</Text>
          <ConnectivityIndicator size="large" showText />
        </View>

        <View style={styles.indicatorRow}>
          <Text style={styles.indicatorLabel}>Icon Only:</Text>
          <ConnectivityIndicator size="medium" showText={false} />
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.cardTitle}>Actions</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleTestConnection}
        >
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            (!isConnected || !isInternetReachable) && styles.disabledButton
          ]}
          onPress={handleNetworkOperation}
          disabled={!isConnected || !isInternetReachable}
        >
          <Text style={[
            styles.buttonText,
            (!isConnected || !isInternetReachable) && styles.disabledButtonText
          ]}>
            Simulate Network Operation
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.cardTitle}>How to Use</Text>
        <Text style={styles.infoText}>
          • The connectivity status is automatically monitored in the background{'\n'}
          • Red indicators mean no connection{'\n'}
          • Green indicators mean good connection{'\n'}
          • Yellow indicators mean poor connection{'\n'}
          • Network operations will be blocked when offline{'\n'}
          • Use the ConnectivityIndicator component in your headers/navigation{'\n'}
          • Use useConnectivity hook for custom connectivity logic
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  indicatorSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  indicatorLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  actionsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#16a34a',
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
});

export default ConnectivityExample;
