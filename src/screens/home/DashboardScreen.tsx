import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BarChart } from 'react-native-gifted-charts';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { globalStyles } from '../../styles';

type QuickLink = {
    name: string;
    icon: string;
    navigateTo: string;
    screenName: string;
    iconColor: string;
    offlineOnly?: boolean;
};

const screenWidth = Dimensions.get('window').width;
const iconSize = screenWidth / 4 - 20;

const quickLinks = [
    { name: 'Farmer Registration', icon: 'person-add', navigateTo: 'Members', screenName: 'MemberRegistration', iconColor: '#1b7f74' },
    { name: 'Member Kilos', icon: 'assignment', navigateTo: 'Members', screenName: 'MemberKilos', iconColor: '#e76f51' },
    { name: 'Cashout', icon: 'account-balance-wallet', navigateTo: 'Members', screenName: 'MemberCashout', iconColor: '#1b7f74' },
    { name: 'Offline Collection', icon: 'cloud-off', navigateTo: 'Members', screenName: 'OfflineMilkCollection', iconColor: '#9333EA', offlineOnly: true },
    { name: 'Transporter Kilos', icon: 'local-shipping', navigateTo: 'Members', screenName: 'TransporterKilos', iconColor: '#e9c46a' },
    { name: 'Store Sales', icon: 'store', navigateTo: 'Members', screenName: 'StoreSales', iconColor: '#1b7f74' },
    { name: 'Milk Sales', icon: 'local-drink', navigateTo: 'Members', screenName: 'MilkSales', iconColor: '#264653' },
    { name: 'Delivery Summary', icon: 'money-off', navigateTo: 'Members', screenName: 'UserBalanceSummary', iconColor: '#f4a261' },
    { name: 'Transporter Summary', icon: 'bar-chart', navigateTo: 'Members', screenName: 'ShiftSummaryReport', iconColor: '#8ab17d' },
];

const chartData = [
    { value: 50, label: '1st', frontColor: '#1b7f74' },
    { value: 75, label: '2nd', frontColor: '#e76f51' },
    { value: 35, label: '3rd', frontColor: '#f4a261' },
    { value: 90, label: '4th', frontColor: '#2a9d8f' },
    { value: 65, label: '5th', frontColor: '#264653' },
    { value: 80, label: '6th', frontColor: '#8ab17d' },
    { value: 55, label: '7th', frontColor: '#e9c46a' },
];

const DashboardScreen = () => {
    const navigation = useNavigation();
    const [userIsMemberOnly, setUserIsMemberOnly] = useState<boolean>(false);
    const [filteredLinks, setFilteredLinks] = useState(quickLinks);
    const [isOnline, setIsOnline] = useState(true);

    // Network monitoring
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const online = state.isConnected === true && state.isInternetReachable !== false;
            setIsOnline(online);
        });

        // Check initial state
        NetInfo.fetch().then(state => {
            const online = state.isConnected === true && state.isInternetReachable !== false;
            setIsOnline(online);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const checkUserType = async () => {
            try {
                const userDataString = await AsyncStorage.getItem('user');
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    const userGroups = userData?.user_groups || [];

                    const isMemberOnly =
                        !userGroups.includes('transporter') &&
                        !userGroups.includes('employee');

                    setUserIsMemberOnly(isMemberOnly);

                    if (isMemberOnly) {
                        // show limited menu for member
                        const memberAllowedScreens = [
                            'MemberKilos',
                            'MemberCashout',
                            'StoreSales',
                            'UserBalanceSummary',
                            'ShiftSummaryReport',
                        ];
                        let filtered = quickLinks.filter(link =>
                            memberAllowedScreens.includes(link.screenName)
                        );

                        // Add offline collection when offline
                        if (!isOnline) {
                            const offlineCollection = quickLinks.find(link => link.screenName === 'OfflineMilkCollection');
                            if (offlineCollection) {
                                filtered = [...filtered, offlineCollection];
                            }
                        }

                        setFilteredLinks(filtered);
                    } else {
                        // full dashboard - add offline collection when offline
                        let filtered = [...quickLinks];
                        if (!isOnline) {
                            // Offline collection is already in quickLinks, no need to add
                            filtered = quickLinks;
                        } else {
                            // Remove offline collection when online
                            filtered = quickLinks.filter(link => !link.offlineOnly);
                        }
                        setFilteredLinks(filtered);
                    }
                }
            } catch (error) {
                console.error('Error checking user type:', error);
            }
        };

        checkUserType();
    }, [isOnline]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* --- Stats Card --- */}
            <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Milk Delivery Stats 2025</Text>

                <BarChart
                    data={chartData}
                    barWidth={24}
                    spacing={18}
                    roundedTop
                    barBorderRadius={6}
                    xAxisThickness={1}
                    yAxisThickness={1}
                    yAxisTextStyle={{ color: '#555' }}
                    xAxisLabelTextStyle={{ color: '#333' }}
                    height={140}
                    animateOnDataChange
                />

                <View style={styles.keySection}>
                    <Text style={styles.keyTitle}>Key</Text>
                    <Text style={styles.keyInfo}>
                        Daily milk delivery trends across the first week.
                    </Text>
                </View>
            </View>

            {/* --- Quick Links --- */}
            <View style={globalStyles.dashboardGrid}>
                {filteredLinks.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            globalStyles.dashboardLink,
                            !isOnline && item.screenName !== 'OfflineMilkCollection' && styles.offlineDisabled
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                            // Special handling for offline collection
                            if (item.screenName === 'OfflineMilkCollection') {
                                // Navigate to auth/login screen for offline collection
                                navigation.navigate('Auth' as never);
                                return;
                            }

                            // Check if offline and item requires internet
                            if (!isOnline) {
                                Alert.alert(
                                    'Internet Required',
                                    'This feature requires an internet connection. Please check your connection and try again.',
                                    [{ text: 'OK' }]
                                );
                                return;
                            }

                            if (item.navigateTo) {
                                navigation.navigate(
                                    item.navigateTo as never,
                                    { screen: item.screenName } as never
                                );
                            }
                        }}
                    >
                        <Icon
                            style={globalStyles.dashboardLinkIcon}
                            name={item.icon}
                            size={28}
                            color={item.iconColor}
                        />
                        <Text style={globalStyles.dashboardIconLabel}>{item.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
};

export default DashboardScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
        padding: 16,
    },
    contentContainer: {
        flexGrow: 1,
        paddingBottom: 120,
        justifyContent: 'flex-start',
    },
    statsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#222',
    },
    keySection: {
        marginTop: 12,
    },
    keyTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
    },
    keyInfo: {
        fontSize: 12,
        color: '#555',
    },
    offlineDisabled: {
        opacity: 0.5,
    },
});
