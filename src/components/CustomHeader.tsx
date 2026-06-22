import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { AuthContext } from '../AuthContext';
import { useSync } from '../context/SyncContext';
import { syncWithConfirmation } from '../services/offlineSync';
import { getUnsyncedCollections } from '../services/offlineDatabase';
import { getDairyName, DEFAULT_DAIRY_NAME } from '../utils/userPreferences';
import { subscribeHeaderRefresh } from '../utils/headerRefresh';

const CustomHeader = ({ scene, previous, navigation }) => {
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [dairyName, setDairyName] = useState(DEFAULT_DAIRY_NAME);
    const { logout } = useContext(AuthContext);
    const { isSyncing, lastSyncResult, lastSyncTime, syncError, triggerSync } = useSync();
    const [hasPendingSync, setHasPendingSync] = useState(false);
    const bellIconRef = useRef(null);

    const loadHeaderInfo = useCallback(async () => {
        try {
            const storedUser = await AsyncStorage.getItem('user');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                const name =
                    userData?.first_name ||
                    userData?.member_details?.first_name ||
                    (userData?.member_details?.full_name || '').split(' ')[0] ||
                    userData?.username ||
                    '';
                setFirstName(String(name).trim());
            } else {
                setFirstName('');
            }

            const savedDairyName = await getDairyName();
            setDairyName(savedDairyName);
        } catch (error) {
            console.error('[Header] Failed to load header info:', error);
        }
    }, []);

    useEffect(() => {
        loadHeaderInfo();
        return subscribeHeaderRefresh(loadHeaderInfo);
    }, [loadHeaderInfo]);

    useFocusEffect(
        useCallback(() => {
            loadHeaderInfo();
        }, [loadHeaderInfo])
    );

    useEffect(() => {
        if (!navigation?.addListener) {
            return;
        }
        const unsubscribe = navigation.addListener('focus', loadHeaderInfo);
        return unsubscribe;
    }, [navigation, loadHeaderInfo]);

    const handleLogout = async () => {
        console.log('Logout button pressed, closing dropdown...');
        setDropdownVisible(false);
        console.log('Calling logout function...');
        await logout();
        console.log('Logout function completed');
    };

    const toggleDropdown = () => {
        setDropdownVisible(!dropdownVisible);
    };

    // Check for pending syncs on component mount
    useEffect(() => {
        const checkPendingSyncs = async () => {
            try {
                const pendingCollections = await getUnsyncedCollections();
                setHasPendingSync(pendingCollections.length > 0);
            } catch (error) {
                console.error('Error checking pending syncs:', error);
            }
        };

        checkPendingSyncs();

        // Re-check when sync completes
        if (!isSyncing && hasPendingSync) {
            checkPendingSyncs();
        }
    }, [isSyncing, hasPendingSync]);

    const handleSyncPress = async () => {
        try {
            console.log('[SYNC] Sync button pressed, checking for pending collections...');
            const pendingCollections = await getUnsyncedCollections();
            console.log('[SYNC] Found pending collections:', pendingCollections.length);
            if (pendingCollections.length > 0) {
                console.log('[SYNC] Starting sync process...');
                const result = await triggerSync();

                if (result.success > 0 && result.failed === 0) {
                    Alert.alert('Sync Complete', `Successfully synced ${result.success} collection(s).`);
                } else if (result.failed > 0) {
                    Alert.alert('Sync Partially Failed', `Successfully synced ${result.success} collection(s), but ${result.failed} failed.`);
                }
            } else {
                Alert.alert('All Synced', 'All your offline collections are already synced.');
            }
        } catch (error) {
            console.error('Error during sync:', error);
            Alert.alert('Sync Error', 'An error occurred during sync. Please try again.');
        }
    };


    return (
        <View style={styles.header}>
            <Image
                source={require('../assets/images/profile.png')}
                style={styles.profileImage}
            />

            <View style={styles.headerTextBlock}>
                <Text style={styles.greetingLine} numberOfLines={1}>
                    {firstName || 'Hello'}
                </Text>
                <Text style={styles.headerText} numberOfLines={1}>
                    {dairyName}
                </Text>
                <Text style={styles.brandLine}>eDairy</Text>
            </View>

            <TouchableOpacity
                style={[styles.iconContainer, isSyncing && styles.iconContainerDisabled]}
                onPress={handleSyncPress}
                disabled={isSyncing}
            >
                {isSyncing ? (
                    <ActivityIndicator size={20} color="#FFFFFF" />
                ) : (
                    <Icon name="refresh" size={20} color="#FFFFFF" />
                )}
                {hasPendingSync && !isSyncing && (
                    <View style={styles.pendingSyncBadge}>
                        <Text style={styles.pendingSyncBadgeText}>!</Text>
                    </View>
                )}
                {lastSyncResult && (lastSyncResult.success > 0 || lastSyncResult.failed > 0) && !isSyncing && !hasPendingSync && (
                    <View style={[
                        styles.syncBadge,
                        lastSyncResult.failed > 0 && styles.syncBadgeError
                    ]}>
                        <Text style={styles.syncBadgeText}>
                            {lastSyncResult.success > 0 && lastSyncResult.failed === 0 ? '✓' :
                             lastSyncResult.failed > 0 ? '!' : ''}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                ref={bellIconRef}
                style={styles.iconContainer}
                onPress={toggleDropdown}
            >
                <Icon name="bell" size={20} color="#FFFFFF" />
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>1</Text>
                </View>
            </TouchableOpacity>

            <Modal
                visible={dropdownVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setDropdownVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setDropdownVisible(false)}
                >
                    <View style={styles.dropdownContainer}>
                        <View style={styles.dropdownHeader}>
                            <Text style={styles.dropdownTitle}>Notifications</Text>
                            <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                                <Icon name="times" size={20} color="#333" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.notificationsList}>
                            <View style={styles.notificationItem}>
                                <Icon name="info-circle" size={16} color="#26A69A" style={styles.notificationIcon} />
                                <View style={styles.notificationContent}>
                                    <Text style={styles.notificationText}>You have a new update</Text>
                                    <Text style={styles.notificationTime}>2 hours ago</Text>
                                </View>
                            </View>
                            
                            <View style={styles.emptyNotifications}>
                                <Text style={styles.emptyText}>No more notifications</Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity 
                            style={styles.logoutButton}
                            onPress={handleLogout}
                        >
                            <Icon name="sign-out" size={18} color="#F44336" />
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View >
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#26A69A',
        paddingHorizontal: 10,
        paddingVertical: 20,
    },
    profileImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    headerTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    greetingLine: {
        color: '#FFFFFF',
        fontSize: 13,
        opacity: 0.85,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 2,
    },
    brandLine: {
        color: '#FFFFFF',
        fontSize: 12,
        opacity: 0.75,
        marginTop: 2,
        fontWeight: '600',
    },
    iconContainer: {
        position: 'relative',
        padding: 8,
    },
    iconContainerDisabled: {
        opacity: 0.6,
    },
    badge: {
        position: 'absolute',
        right: 2,
        top: 5,
        backgroundColor: '#F44336',
        borderRadius: 6,
        width: 12,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: 'bold',
    },
    syncBadge: {
        position: 'absolute',
        right: 2,
        top: 5,
        backgroundColor: '#4CAF50',
        borderRadius: 6,
        width: 12,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    syncBadgeError: {
        backgroundColor: '#F44336',
    },
    syncBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: 'bold',
    },
    pendingSyncBadge: {
        position: 'absolute',
        right: 2,
        top: 5,
        backgroundColor: '#EF4444',
        borderRadius: 6,
        width: 12,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingSyncBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 70,
        paddingRight: 10,
    },
    dropdownContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        width: 320,
        maxHeight: 500,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    dropdownTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    notificationsList: {
        maxHeight: 350,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
        alignItems: 'flex-start',
    },
    notificationIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    notificationContent: {
        flex: 1,
    },
    notificationText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
    },
    notificationTime: {
        fontSize: 12,
        color: '#999',
    },
    emptyNotifications: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FAFAFA',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F44336',
        marginLeft: 8,
    },
});

export default CustomHeader;
