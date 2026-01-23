import React, { useState, useContext, useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Header } from '@react-navigation/stack'; // For React Navigation integration
import Icon from 'react-native-vector-icons/FontAwesome'; // For the bell icon
import { AuthContext } from '../AuthContext';
import { useSync } from '../context/SyncContext';
import { syncWithConfirmation } from '../services/offlineSync';
import { getUnsyncedCollections } from '../services/offlineDatabase';

const CustomHeader = ({ scene, previous, navigation }) => {
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const { logout } = useContext(AuthContext);
    const { isSyncing, lastSyncResult, lastSyncTime, syncError, triggerSync } = useSync();
    const [hasPendingSync, setHasPendingSync] = useState(false);
    const bellIconRef = useRef(null);

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
            // Check if there are pending syncs
            const pendingCollections = await getUnsyncedCollections();
            if (pendingCollections.length > 0) {
                // If there are pending syncs, automatically start sync
                const result = await triggerSync();

                // Show result
                if (result.success > 0 && result.failed === 0) {
                    Alert.alert('Sync Complete', `Successfully synced ${result.success} collection(s).`);
                } else if (result.failed > 0) {
                    Alert.alert('Sync Partially Failed', `Successfully synced ${result.success} collection(s), but ${result.failed} failed.`);
                }
            } else {
                // No pending syncs - show success message
                Alert.alert('All Synced', 'All your offline collections are already synced.');
            }
        } catch (error) {
            console.error('Error during sync:', error);
            Alert.alert('Sync Error', 'An error occurred during sync. Please try again.');
        }
    };


    return (
        <View style={styles.header}>
            {/* Profile Image */}
            <Image
                source={require('../assets/images/profile.png')} // Replace with your image path
                style={styles.profileImage}
            />

            {/* Text */}
            <View style={{ flex: 1 }}>
                <Text style={{ opacity: 0.7, color: '#FFFFFF' }}>Goodmorning</Text>
                <Text style={styles.headerText}>Maziwai Dairy</Text>
            </View>

            {/* Sync Status Indicator */}
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

            {/* Bell Icon with Badge */}
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

            {/* Dropdown Modal */}
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
                            {/* Sample notification - replace with actual notifications */}
                            <View style={styles.notificationItem}>
                                <Icon name="info-circle" size={16} color="#26A69A" style={styles.notificationIcon} />
                                <View style={styles.notificationContent}>
                                    <Text style={styles.notificationText}>You have a new update</Text>
                                    <Text style={styles.notificationTime}>2 hours ago</Text>
                                </View>
                            </View>
                            
                            {/* Add more notifications here */}
                            <View style={styles.emptyNotifications}>
                                <Text style={styles.emptyText}>No more notifications</Text>
                            </View>
                        </ScrollView>

                        {/* Logout Button at Bottom */}
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
        backgroundColor: '#26A69A', // Teal/green shade from the image
        paddingHorizontal: 10,
        paddingVertical: 20,
        // height: 60, // Adjust height as needed
    },
    profileImage: {
        width: 40,
        height: 40,
        borderRadius: 20, // Circular image
        marginRight: 10,
    },
    headerText: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
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
        backgroundColor: '#F44336', // Red badge
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
        backgroundColor: '#4CAF50', // Green for success
        borderRadius: 6,
        width: 12,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    syncBadgeError: {
        backgroundColor: '#F44336', // Red for errors/failures
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
        backgroundColor: '#EF4444', // Red for pending sync
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