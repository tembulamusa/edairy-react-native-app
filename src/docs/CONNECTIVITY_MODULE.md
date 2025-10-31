# Internet Connectivity Module

This module provides comprehensive internet connectivity monitoring and management for the eDairyApp.

## Features

- **Real-time connectivity monitoring** - Automatically detects when internet connection is lost or restored
- **Connection quality assessment** - Evaluates connection quality (excellent, good, poor, none)
- **Visual indicators** - Provides status banners and indicators throughout the app
- **Automatic retry mechanisms** - Built-in retry logic for failed network requests
- **User-friendly alerts** - Clear notifications when connectivity issues occur

## Components

### 1. ConnectivityProvider
The main context provider that wraps your app and provides connectivity state.

**Location**: `src/context/ConnectivityContext.tsx`

**Usage**:
```tsx
import { ConnectivityProvider } from './src/context/ConnectivityContext';

// Wrap your app
<ConnectivityProvider>
  <YourApp />
</ConnectivityProvider>
```

### 2. ConnectivityStatus
A banner component that appears at the top of the screen when connectivity is lost.

**Location**: `src/components/ConnectivityStatus.tsx`

**Features**:
- Animated slide-in/out
- Retry button
- Dismiss option
- Configurable position (top/bottom)

**Usage**:
```tsx
import ConnectivityStatus from './src/components/ConnectivityStatus';

// Basic usage
<ConnectivityStatus />

// With custom options
<ConnectivityStatus 
  showBanner={true}
  position="top"
  onRetry={() => console.log('Retry pressed')}
/>
```

### 3. ConnectivityIndicator
A small indicator component for showing connection status in headers or navigation.

**Location**: `src/components/ConnectivityIndicator.tsx`

**Features**:
- Multiple sizes (small, medium, large)
- Optional text labels
- Clickable with onPress callback

**Usage**:
```tsx
import ConnectivityIndicator from './src/components/ConnectivityIndicator';

// Icon only
<ConnectivityIndicator size="medium" />

// With text
<ConnectivityIndicator size="medium" showText />

// Clickable
<ConnectivityIndicator 
  size="large" 
  showText 
  onPress={() => checkConnectivity()}
/>
```

### 4. useConnectivity Hook
A custom hook for accessing connectivity state in your components.

**Location**: `src/context/ConnectivityContext.tsx`

**Returns**:
- `isConnected`: Boolean - Basic network connectivity
- `isInternetReachable`: Boolean - Internet accessibility
- `connectionType`: String - Type of connection (WiFi, Mobile Data, etc.)
- `connectionQuality`: String - Quality assessment (excellent, good, poor, none)
- `lastConnectedAt`: Date - Timestamp of last successful connection
- `showOfflineBanner`: Boolean - Whether to show offline banner
- `checkConnectivity`: Function - Manual connectivity check

**Usage**:
```tsx
import { useConnectivity } from './src/context/ConnectivityContext';

const MyComponent = () => {
  const { 
    isConnected, 
    isInternetReachable, 
    connectionType,
    checkConnectivity 
  } = useConnectivity();

  const handleNetworkOperation = async () => {
    if (!isConnected || !isInternetReachable) {
      Alert.alert('No Internet', 'Please check your connection');
      return;
    }
    
    // Proceed with network operation
  };

  return (
    <View>
      <Text>Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Text>Type: {connectionType}</Text>
    </View>
  );
};
```

### 5. useConnectivityCheck Hook
A specialized hook for performing connectivity checks with custom options.

**Location**: `src/hooks/useConnectivityCheck.ts`

**Usage**:
```tsx
import { useConnectivityCheck } from './src/hooks/useConnectivityCheck';

const MyComponent = () => {
  const { 
    isConnected, 
    isLoading, 
    error, 
    retry 
  } = useConnectivityCheck({
    showAlert: true,
    alertTitle: 'Connection Required',
    alertMessage: 'This feature requires internet access',
    retryOnFailure: true,
    maxRetries: 3
  });

  return (
    <View>
      {isLoading && <Text>Checking connection...</Text>}
      {error && <Text>Error: {error}</Text>}
    </View>
  );
};
```

## Integration

### 1. App-level Integration
The ConnectivityProvider is already integrated in `App.tsx`:

```tsx
<AuthProvider>
  <Store>
    <GlobalProvider>
      <ConnectivityProvider>  {/* ← Already added */}
        <NavigationContainer>
          {/* Your app content */}
        </NavigationContainer>
      </ConnectivityProvider>
    </GlobalProvider>
  </Store>
</AuthProvider>
```

### 2. Layout Integration
The ConnectivityStatus banner is integrated in `DashboardLayout.tsx`:

```tsx
<SafeAreaView>
  <StatusBar />
  <ConnectivityStatus />  {/* ← Already added */}
  <View>
    {children}
  </View>
</SafeAreaView>
```

### 3. Network Request Integration
The `makeRequest` utility automatically checks connectivity before making requests:

```tsx
// Already integrated - no changes needed
const [status, response] = await makeRequest({
  url: 'some-endpoint',
  method: 'GET'
});
```

## Configuration

### Connection Quality Thresholds
The system automatically determines connection quality based on:
- **Excellent**: WiFi connections
- **Good**: 4G/5G cellular connections
- **Poor**: 2G/3G cellular connections
- **None**: No connection or unreachable internet

### Alert Customization
You can customize alerts by modifying the `ConnectivityContext.tsx`:

```tsx
Alert.alert(
  'Custom Title',
  'Custom message',
  [
    { text: 'OK', onPress: () => {} },
    { text: 'Retry', onPress: checkConnectivity }
  ]
);
```

## Best Practices

1. **Always check connectivity before network operations**:
   ```tsx
   const { isConnected, isInternetReachable } = useConnectivity();
   if (!isConnected || !isInternetReachable) {
     // Handle offline state
     return;
   }
   ```

2. **Provide offline alternatives**:
   - Cache data locally
   - Show cached content
   - Queue operations for when connectivity is restored

3. **Use appropriate indicators**:
   - ConnectivityStatus for full-screen notifications
   - ConnectivityIndicator for subtle status display

4. **Handle retry scenarios gracefully**:
   ```tsx
   const handleRetry = async () => {
     await checkConnectivity();
     if (isConnected && isInternetReachable) {
       // Retry the operation
     }
   };
   ```

## Troubleshooting

### Common Issues

1. **Banner not showing**: Ensure ConnectivityStatus is rendered in your layout
2. **Incorrect status**: Check that NetInfo permissions are granted
3. **Performance issues**: The module uses efficient event listeners and minimal re-renders

### Debug Information
The module logs detailed connectivity information to the console:
```
Network Status: {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
  quality: 'excellent',
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

## Dependencies

- `@react-native-community/netinfo` - Network state detection
- `react-native-vector-icons` - Status icons

Both dependencies are already installed in your project.

## Example Usage

See `src/components/ConnectivityExample.tsx` for a comprehensive example of all connectivity features.
