# Offline Collection - Quick Setup Guide

## Installation Steps

### 1. Install Dependencies

The required dependency has been added to the project:

```bash
npm install react-native-sqlite-storage
```

**Note**: `@react-native-community/netinfo` is already installed.

### 2. Link Native Modules (if needed)

For React Native < 0.60, link the modules:

```bash
npx react-native link react-native-sqlite-storage
npx react-native link @react-native-community/netinfo
```

For React Native >= 0.60, auto-linking should handle this automatically.

### 3. iOS Setup (if applicable)

Install iOS pods:

```bash
cd ios
pod install
cd ..
```

### 4. Android Permissions

The app already has Bluetooth and network permissions. No additional permissions needed for SQLite (it uses internal storage).

### 5. Backend API Setup

Ensure your backend has an endpoint to receive offline collections:

**Endpoint**: `POST /offline_collection`

**Expected Payload**:
```typescript
{
  member_number: string;
  member_name?: string;
  shift_id?: number;
  transporter_id?: number;
  route_id?: number;
  center_id?: number;
  measuring_can_id?: number;
  total_cans: number;
  total_quantity: number;
  cans: Array<{
    can_label: string;
    scale_weight: number;
    tare_weight: number;
    net: number;
    timestamp: string;
  }>;
  collected_at: string;
  is_offline: boolean;
}
```

**Expected Response** (Success):
```json
{
  "success": true,
  "message": "Collection recorded successfully",
  "data": { /* collection data */ }
}
```

### 6. Rebuild the App

After installing dependencies, rebuild the app:

**Android**:
```bash
npx react-native run-android
```

**iOS**:
```bash
npx react-native run-ios
```

## Configuration

### Auto-Sync Interval

The default auto-sync interval is 5 minutes. To change it, edit `App.tsx`:

```typescript
// Change from 5 to desired minutes
startAutoSync(5);
```

### Stored Credentials

For auto-sync to work, users must save their credentials in the Settings screen. The sync service looks for:

- **Storage Key**: `@edairyApp:user_preferences`
- **Expected Fields**: `username`, `password`

Ensure your Settings screen saves these values correctly.

## Accessing the Screen

### From Dashboard

The "Offline Collection" button is available on the main dashboard with a cloud-off icon.

### Direct Navigation

Navigate programmatically:

```typescript
navigation.navigate('Members', {
  screen: 'OfflineMilkCollection'
});
```

## Testing Checklist

- [ ] Install dependencies and rebuild app
- [ ] Create backend endpoint for offline collections
- [ ] Test recording collections while offline
- [ ] Test manual sync
- [ ] Test auto-sync (connect to internet after recording offline)
- [ ] Test Bluetooth scale connection
- [ ] Test manual weight entry
- [ ] Verify collections appear in history
- [ ] Verify synced collections are removed from local storage
- [ ] Test with stored credentials for auto-login

## Troubleshooting Build Issues

### Android

**SQLite Build Error**:
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

**Database Permission Error**:
- SQLite uses internal storage, no additional permissions needed
- If issues persist, check `AndroidManifest.xml` for storage permissions

### iOS

**Pod Install Issues**:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx react-native run-ios
```

**SQLite Linking Issue**:
- Ensure `react-native-sqlite-storage` is in `Podfile`
- Run `pod install` again

## Production Considerations

### 1. Database Migrations

If you need to change the database schema in the future:

1. Update `createTables()` in `offlineDatabase.ts`
2. Increment `DATABASE_VERSION` constant
3. Implement migration logic if needed

### 2. Data Retention

Consider implementing:
- Maximum age for unsynced collections
- Maximum number of collections to retain
- Manual delete option for failed syncs

### 3. Security

- Ensure stored credentials are encrypted (consider using Keychain/Keystore)
- Sanitize data before syncing to prevent injection attacks
- Implement request signing for offline collections

### 4. Performance

For large volumes of offline data:
- Implement pagination in history view
- Batch sync in smaller chunks
- Add progress indicator for long-running syncs

### 5. Monitoring

Add analytics/logging for:
- Number of offline collections created
- Sync success/failure rates
- Average time to sync
- Database size growth

## Support Resources

- **Full Documentation**: See `OFFLINE_COLLECTION.md`
- **Database Schema**: See `src/services/offlineDatabase.ts`
- **Sync Logic**: See `src/services/offlineSync.ts`
- **UI Implementation**: See `src/screens/home/OfflineMilkCollectionScreen.tsx`

## Next Steps

1. ✅ Complete backend API implementation
2. ✅ Test thoroughly in offline scenarios
3. ✅ Configure auto-sync interval for production
4. ✅ Set up monitoring and analytics
5. ✅ Train users on offline collection feature
6. ✅ Document any backend-specific requirements

