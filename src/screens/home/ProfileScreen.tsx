import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import fetchCommonData from '../../components/utils/fetchCommonData';
import { fetchUserProfile } from '../../components/utils/makeRequest';

const ProfileScreen: React.FC = () => {
    const navigation = useNavigation();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any | null>(null);

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            const stored = await AsyncStorage.getItem('user');
            let parsedUser = null;
            
            if (stored) {
                parsedUser = JSON.parse(stored);
            }

            // Fetch fresh profile data from API
            const profileData = await fetchUserProfile();
            
            if (profileData) {
                // Merge API profile data with stored user data
                const mergedUser = {
                    ...parsedUser,
                    ...profileData,
                    // Preserve important stored data that might not be in API response
                    access_token: parsedUser?.access_token,
                    refresh_token: parsedUser?.refresh_token,
                    // Merge nested objects if they exist
                    member_details: {
                        ...parsedUser?.member_details,
                        ...profileData?.member_details,
                    },
                };
                setUser(mergedUser);
                
                // Update AsyncStorage with merged data (optional, but keeps it in sync)
                try {
                    await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
                } catch (storageError) {
                    console.warn('Failed to update stored user data:', storageError);
                }
            } else if (parsedUser) {
                // If API call fails, use stored data
                setUser(parsedUser);
            } else {
                setUser(null);
            }

            // Attempt to load additional milk summary if member id is available
            const memberId = profileData?.member_id || parsedUser?.member_id;
            if (memberId) {
                try {
                    const data = await fetchCommonData({
                        name: 'member_profile_summary',
                        cachable: false,
                        params: { member_id: memberId },
                    });
                    setSummary(data || null);
                } catch (err) {
                    console.warn('Failed to load member summary:', err);
                    setSummary(null);
                }
            } else {
                setSummary(null);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            // Fallback to stored user data if available
            try {
                const stored = await AsyncStorage.getItem('user');
                if (stored) {
                    setUser(JSON.parse(stored));
                } else {
                    setUser(null);
                }
            } catch (fallbackError) {
                setUser(null);
            }
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [loadProfile])
    );

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const isMember = user?.member_id || user?.member_details;

    // Basic Information - names and user groups
    const basicDetails = [
        {
            label: 'First Name',
            value: user?.first_name || 'Not provided',
            icon: 'person',
        },
        {
            label: 'Last Name',
            value: user?.last_name || 'Not provided',
            icon: 'person-outline',
        },
        {
            label: 'User Groups',
            value: user?.user_groups?.join(', ') || 'Not assigned',
            icon: 'group',
        },
    ];

    const contactDetails = [
        {
            label: 'Phone Number',
            value: user?.phone_number || user?.member_details?.primary_phone || 'Not provided',
            icon: 'phone',
        },
        {
            label: 'Email Address',
            value: user?.email || 'Not provided',
            icon: 'email',
        },
    ];

    const locationDetails = [
        {
            label: 'Route',
            value: user?.member_details?.route?.route_name || user?.member_details?.route?.route_code || 'Not assigned',
            icon: 'route',
        },
        {
            label: 'Center',
            value: user?.member_details?.center?.centre || 'Not assigned',
            icon: 'place',
        },
    ];

    const membershipDetails = [
        {
            label: 'Membership Level',
            value: user?.member_details?.next_level || 'Standard',
            icon: 'military-tech',
        },
        {
            label: 'Loan Eligibility',
            value: user?.member_details?.eligible_for_loans ? 'Eligible for loans' : 'Not eligible for loans',
            icon: 'verified-user',
        },
    ];

    // Add number of cows for members
    if (isMember) {
        membershipDetails.unshift({
            label: 'Number of Cows',
            value: user?.member_details?.number_of_cows || user?.member_details?.cows_count || summary?.number_of_cows || 'Not provided',
            icon: 'pets',
        });
    }

    const statCards = [
        {
            title: 'Total Milk Collections',
            value:
                summary?.total_collections ??
                user?.member_details?.milk_collections ??
                summary?.total_quantity ??
                0,
            suffix: 'KG',
            icon: 'local-drink',
            color: '#0ea5e9',
        },
        {
            title: 'Wallet Balance',
            value: user?.member_details?.wallet_balance ?? summary?.wallet_balance ?? 0,
            suffix: 'KES',
            icon: 'account-balance-wallet',
            color: '#059669',
        },
        {
            title: 'Pending Cashouts',
            value: summary?.pending_cashouts ?? user?.member_details?.pending_cashouts ?? 0,
            suffix: '',
            icon: 'pending-actions',
            color: '#f97316',
        },
    ];

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    if (!user) {
        return (
            <View style={styles.emptyContainer}>
                <Icon name="person-off" size={64} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No profile information found</Text>
                <Text style={styles.emptySubtitle}>Please sign out and sign in again.</Text>
            </View>
        );
    }

    const displayName =
        `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
        user?.member_details?.full_name ||
        user?.username ||
        'User';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerCard}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{displayName.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.nameText}>{displayName}</Text>
                <Text style={styles.roleText}>
                    {user?.member_details?.member_type?.toUpperCase() || user?.role || 'Member'}
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Stats</Text>
                <View style={styles.statsGrid}>
                    {statCards.map((item, index) => (
                        <View key={index} style={[styles.statCard, { backgroundColor: item.color }]}> 
                            <Icon name={item.icon} size={24} color="#fff" />
                            <Text style={styles.statValue}>
                                {item.value}
                                {item.suffix ? ` ${item.suffix}` : ''}
                            </Text>
                            <Text style={styles.statLabel}>{item.title}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Basic Information */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic</Text>
                <View style={styles.detailCard}>
                    {basicDetails.map((detail, index) => (
                        <View 
                            key={index} 
                            style={[
                                styles.detailRow,
                                index === basicDetails.length - 1 && styles.detailRowLast
                            ]}
                        >
                            <Icon name={detail.icon} size={20} color="#16a34a" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>{detail.label}</Text>
                                <Text style={styles.detailValue}>{detail.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Contact Information */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.detailCard}>
                    {contactDetails.map((detail, index) => (
                        <View 
                            key={index} 
                            style={[
                                styles.detailRow,
                                index === contactDetails.length - 1 && styles.detailRowLast
                            ]}
                        >
                            <Icon name={detail.icon} size={20} color="#16a34a" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>{detail.label}</Text>
                                <Text style={styles.detailValue}>{detail.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Location Information */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location Information</Text>
                <View style={styles.detailCard}>
                    {locationDetails.map((detail, index) => (
                        <View 
                            key={index} 
                            style={[
                                styles.detailRow,
                                index === locationDetails.length - 1 && styles.detailRowLast
                            ]}
                        >
                            <Icon name={detail.icon} size={20} color="#16a34a" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>{detail.label}</Text>
                                <Text style={styles.detailValue}>{detail.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Membership Information */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Membership Information</Text>
                <View style={styles.detailCard}>
                    {membershipDetails.map((detail, index) => (
                        <View 
                            key={index} 
                            style={[
                                styles.detailRow,
                                index === membershipDetails.length - 1 && styles.detailRowLast
                            ]}
                        >
                            <Icon name={detail.icon} size={20} color="#16a34a" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailLabel}>{detail.label}</Text>
                                <Text style={styles.detailValue}>{detail.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Members' as never, { screen: 'MemberKilos' } as never)}
                    >
                        <Icon name="list" size={22} color="#16a34a" />
                        <Text style={styles.actionText}>Member Kilos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Members' as never, { screen: 'MemberCashout' } as never)}
                    >
                        <Icon name="attach-money" size={22} color="#16a34a" />
                        <Text style={styles.actionText}>Cashouts</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Members' as never, { screen: 'UserBalanceSummary' } as never)}
                    >
                        <Icon name="analytics" size={22} color="#16a34a" />
                        <Text style={styles.actionText}>Balance Summary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Members' as never, { screen: 'ShiftSummaryReport' } as never)}
                    >
                        <Icon name="bar-chart" size={22} color="#16a34a" />
                        <Text style={styles.actionText}>Shift Summary</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {summary?.recent_activity?.length ? (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <View style={styles.detailCard}>
                        {summary.recent_activity.map((item: any, index: number) => (
                            <View key={index} style={styles.activityRow}>
                                <Icon name="timeline" size={20} color="#0ea5e9" style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.activityTitle}>{item.title || 'Activity'}</Text>
                                    <Text style={styles.activitySubtitle}>
                                        {item.subtitle || item.description || ''}
                                    </Text>
                                </View>
                                <Text style={styles.activityTime}>
                                    {item.timestamp || ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}
        </ScrollView>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    contentContainer: { padding: 12, paddingBottom: 48 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        color: '#475569',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    emptySubtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#64748b',
    },
    headerCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 12,
        elevation: 2,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#16a34a',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 24,
    },
    nameText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    roleText: {
        marginTop: 4,
        fontSize: 14,
        color: '#64748b',
    },
    section: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '30%',
        borderRadius: 16,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 8,
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    statLabel: {
        color: '#f8fafc',
        fontSize: 12,
        opacity: 0.85,
    },
    detailCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 0,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e2e8f0',
    },
    detailRowLast: {
        borderBottomWidth: 0,
    },
    detailLabel: {
        color: '#94a3b8',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValue: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bae6fd',
        backgroundColor: '#eff6ff',
        paddingVertical: 14,
        alignItems: 'center',
        gap: 6,
    },
    actionText: {
        color: '#0369a1',
        fontWeight: '600',
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e2e8f0',
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    activitySubtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    activityTime: {
        fontSize: 12,
        color: '#94a3b8',
    },
});
