# Offline Milk Collection Feature

## Overview

The Offline Milk Collection feature allows users to record milk deliveries even when there is no internet connection. The data is stored locally in SQLite and automatically synced to the server when connectivity is restored.

## Features

- ✅ **No Internet Required**: Record collections without internet connection
- ✅ **Local SQLite Storage**: All data is safely stored on the device
- ✅ **Auto-Sync**: Automatically uploads data when internet is available
- ✅ **Network Detection**: Monitors connectivity and triggers sync
- ✅ **Bluetooth Scale Support**: Connect to Bluetooth scales for weight measurement
- ✅ **Collection History**: View all saved collections (synced and unsynced)
- ✅ **Manual Sync**: Trigger sync manually when needed
- ✅ **Persistent Storage**: Data is retained even if the app is closed

## Architecture

### 1. Database Layer (`src/services/offlineDatabase.ts`)

The database layer provides functions to:
- Initialize SQLite database
- Store offline collections
- Retrieve unsynced collections
- Mark collections as synced
- Delete synced collections
- Track sync attempts and errors

**Database Schema:**

```sql
CREATE TABLE offline_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_number TEXT NOT NULL,
    member_name TEXT,
    shift_id INTEGER,
    shift_name TEXT,
    transporter_id INTEGER,
    transporter_name TEXT,
    route_id INTEGER,
    route_name TEXT,
    center_id INTEGER,
    center_name TEXT,
    measuring_can_id INTEGER,
    measuring_can_name TEXT,
    total_cans INTEGER NOT NULL,
    total_quantity REAL NOT NULL,
    cans_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    sync_attempts INTEGER DEFAULT 0,
    last_sync_attempt TEXT,
    error_message TEXT
);
```

### 2. Sync Service (`src/services/offlineSync.ts`)

The sync service handles:
- Network connectivity monitoring
- Automatic login with stored credentials
- Uploading offline collections to server
- Auto-sync at regular intervals (default: 5 minutes)
- Network state change listener

**Key Functions:**

- `syncAllCollections()`: Syncs all unsynced collections
- `startAutoSync(intervalMinutes)`: Starts periodic auto-sync
- `setupNetworkListener()`: Sets up network state monitoring
- `checkConnectivity()`: Checks if device is online

### 3. UI Screen (`src/screens/home/OfflineMilkCollectionScreen.tsx`)

The screen provides:
- Member information input (number and name)
- Optional collection details (shift, transporter, route, center)
- Bluetooth scale connection
- Weight recording with tare weight support
- Manual weight entry (when scale is not connected)
- List of recorded cans
- Save to local database
- Manual sync button
- Collection history viewer
- Online/offline status indicator
- Unsynced records counter

## How It Works

### Recording Collections

1. **Enter Member Information** (Required):
   - Member Number
   - Member Name (optional but recommended)

2. **Enter Collection Details** (Optional):
   - Shift (e.g., Morning, Evening)
   - Center
   - Transporter
   - Route
   - Measuring Can

3. **Connect Bluetooth Scale** (Optional):
   - Tap "Connect Scale" to connect to a Bluetooth scale
   - Scale weight will be automatically displayed
   - If no scale is connected, enter weight manually

4. **Record Cans**:
   - Enter or read scale weight
   - Enter tare weight
   - Net weight is automatically calculated
   - Tap "Take Record" to add the can to the list
   - Repeat for all cans

5. **Save Collection**:
   - Review the list of recorded cans
   - Tap "Save Collection" to store locally
   - Collection is saved to SQLite database

### Syncing to Server

#### Automatic Sync

The app automatically syncs offline collections in the following scenarios:

1. **Periodic Auto-Sync**: Every 5 minutes (configurable)
2. **Network State Change**: When device connects to internet
3. **App Launch**: When the app starts

#### Manual Sync

- Tap the "Sync Now" button on the Offline Collection screen
- Requires internet connection
- Shows sync results (success/failed count)

### Authentication for Sync

The sync service uses stored credentials from the Settings screen to automatically log in when syncing. Ensure that:

1. User has saved their credentials in Settings
2. Credentials are stored in `@edairyApp:user_preferences`
3. Credentials include `username` and `password`

If credentials are not available or login fails, sync will be skipped until the user logs in manually.

## API Integration

### Endpoint

**URL**: `offline_collection`  
**Method**: `POST`

### Payload Structure

```json
{
  "member_number": "12345",
  "member_name": "John Doe",
  "shift_id": 1,
  "transporter_id": 5,
  "route_id": 3,
  "center_id": 2,
  "measuring_can_id": 7,
  "total_cans": 5,
  "total_quantity": 125.50,
  "cans": [
    {
      "can_label": "Can 1",
      "scale_weight": 30.00,
      "tare_weight": 5.00,
      "net": 25.00,
      "timestamp": "2025-01-08T10:30:00.000Z"
    },
    {
      "can_label": "Can 2",
      "scale_weight": 28.50,
      "tare_weight": 5.00,
      "net": 23.50,
      "timestamp": "2025-01-08T10:31:00.000Z"
    }
  ],
  "collected_at": "2025-01-08T10:30:00.000Z",
  "is_offline": true
}
```

### Expected Response

**Success (200/201)**:
```json
{
  "success": true,
  "message": "Collection recorded successfully",
  "data": {
    "id": 12345,
    "member_number": "12345",
    "total_quantity": 125.50
  }
}
```

**Error (4xx/5xx)**:
```json
{
  "success": false,
  "message": "Error message here"
}
```

## User Access

The Offline Milk Collection screen is accessible to:

- ✅ Members (member-only users)
- ✅ Transporters
- ✅ Employees
- ✅ Administrators

The screen is added to the dashboard quick links with a cloud-off icon.

## Storage Management

### Automatic Cleanup

- Successfully synced collections are automatically deleted from local storage
- This prevents the database from growing indefinitely

### Manual Cleanup

Use the database helper function:

```typescript
import { clearSyncedCollections } from './src/services/offlineDatabase';

// Clear all synced collections
const deletedCount = await clearSyncedCollections();
console.log(`Deleted ${deletedCount} synced collections`);
```

## Error Handling

### Sync Failures

- Failed sync attempts are tracked in the database
- Error messages are stored for debugging
- Collections remain in the database for retry
- Max retry attempts can be configured if needed

### Database Errors

- Database initialization errors are logged
- User is notified if database cannot be accessed
- App continues to function (online mode only)

## Configuration

### Auto-Sync Interval

Edit `App.tsx` to change the sync interval:

```typescript
// Default: 5 minutes
startAutoSync(5);

// Change to 10 minutes
startAutoSync(10);

// Change to 1 minute (for testing)
startAutoSync(1);
```

### Database Location

SQLite database is stored at:
- **Database Name**: `edairy_offline.db`
- **Location**: App's document directory (iOS) / internal storage (Android)

## Troubleshooting

### Collections Not Syncing

1. **Check Internet Connection**: Ensure device is connected to internet
2. **Check Credentials**: Verify stored credentials in Settings
3. **Check Server**: Ensure backend server is running and accessible
4. **View Error Messages**: Check collection history for error messages
5. **Manual Login**: Log out and log back in to refresh token

### Database Errors

1. **Reinstall App**: This will clear the database and start fresh
2. **Check Permissions**: Ensure app has storage permissions (Android)
3. **Check Storage Space**: Ensure device has sufficient storage

### Bluetooth Scale Issues

1. **Enable Bluetooth**: Ensure Bluetooth is enabled on the device
2. **Location Permission**: Grant location permission (required for BLE on Android)
3. **Reconnect Scale**: Disconnect and reconnect the scale
4. **Manual Entry**: Use manual weight entry if scale is unavailable

## Testing

### Test Offline Mode

1. Enable airplane mode on the device
2. Open the Offline Collection screen
3. Record a collection
4. Verify it's saved (check history)
5. Disable airplane mode
6. Wait for auto-sync or tap "Sync Now"
7. Verify collection is uploaded and removed from local storage

### Test Auto-Sync

1. Record a collection while offline
2. Connect to internet
3. Wait for auto-sync (up to 5 minutes)
4. Check collection history to verify sync status

### Test Manual Sync

1. Record multiple collections while offline
2. Connect to internet
3. Tap "Sync Now" button
4. Verify sync results in the alert dialog

## Development Notes

### Dependencies

- `react-native-sqlite-storage`: SQLite database
- `@react-native-community/netinfo`: Network connectivity monitoring

### Type Safety

The offline collection system is fully typed with TypeScript for better development experience and runtime safety.

### Logging

All operations are logged with prefixes:
- `[DB]`: Database operations
- `[SYNC]`: Sync operations
- `[OFFLINE]`: Screen-level operations
- `[APP]`: App-level initialization

View logs using:
```bash
# Android
npx react-native log-android

# iOS
npx react-native log-ios
```

## Future Enhancements

Potential improvements:
- [ ] Conflict resolution for duplicate collections
- [ ] Batch sync with progress indicator
- [ ] Export offline data to CSV
- [ ] Sync scheduling (e.g., only on WiFi)
- [ ] Collection editing before sync
- [ ] Photo attachments for collections
- [ ] Offline member registration
- [ ] Data compression for large datasets

## Support

For issues or questions, contact the development team or file an issue in the project repository.

