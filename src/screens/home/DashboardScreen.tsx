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

const screenWidth = Dimensions.get('window').width;
const iconSize = screenWidth / 4 - 20;

const quickLinks = [
    { name: 'Farmer Registration', icon: 'person-add', navigateTo: 'Members', screenName: 'MemberRegistration' },
    { name: 'Member Kilos', icon: 'assignment', navigateTo: 'Members', screenName: 'MemberKilos' },
    { name: 'Cashout', icon: 'assignment', navigateTo: 'Members', screenName: 'MemberCashout' },
    { name: 'Transporter Kilos', icon: 'local-shipping', navigateTo: 'Members', screenName: 'TransporterKilos' },
    { name: 'Store Sales', icon: 'store', navigateTo: 'Members', screenName: 'StoreSales' },
    { name: 'Store Sales Summary', icon: 'store', navigateTo: 'Members', screenName: 'StoreSalesSummary' },
    { name: 'Store Orders', icon: 'shopping-cart', navigateTo: 'Members', screenName: 'StoreOrders' },
    { name: 'Milk Sales', icon: 'local-drink', navigateTo: 'Members', screenName: 'MilkSales' },
    { name: 'Deductions', icon: 'money-off' },
    { name: 'Can Management', icon: 'delete', navigateTo: 'Members', screenName: 'CanManagement' },
    { name: 'Shift Summary', icon: 'bar-chart', navigateTo: 'Members', screenName: 'ShiftSummaryReport' },
    { name: 'Transporter Summary', icon: 'directions-bus', navigateTo: 'Members', screenName: 'TransporterSummaryReport' },
    { name: 'Member Statement', icon: 'receipt', navigateTo: 'Members', screenName: 'MemberStatementSummaryReport' },
    { name: 'Reprint', icon: 'print' },
];

// Bar chart data with different colors
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
    const navigation = useNavigation(); // 👈 hook to get navigation

    return (
        <ScrollView style={styles.container}>
            {/* Stats Card */}
            <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Milk Delivery Stats 2025</Text>

                {/* Bar Chart */}
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
                    height={180}
                    animateOnDataChange
                />

                {/* Key section */}
                <View style={styles.keySection}>
                    <Text style={styles.keyTitle}>Key</Text>
                    <Text style={styles.keyInfo}>
                        Daily milk delivery trends across the first week.
                    </Text>
                </View>
            </View>

            {/* Quick Links */}
            <View style={styles.quickLinksHeader}>
                <Text style={styles.quickLinksTitle}>Quick Links</Text>
                <TouchableOpacity>
                    <Text style={styles.seeAllText}>See All →</Text>
                </TouchableOpacity>
            </View>

            {/* Icon Grid */}
            <View style={styles.grid}>
                {quickLinks.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.iconButton}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (item.navigateTo) {
                                navigation.navigate(
                                    item.navigateTo as never,
                                    { screen: item.screenName } as never
                                );
                            }
                        }}
                    >
                        <Icon name={item.icon} size={30} color="#1b7f74" />
                        <Text style={styles.iconLabel}>{item.name}</Text>
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
    statsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
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
    quickLinksHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    quickLinksTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#222',
    },
    seeAllText: {
        color: '#1b7f74',
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    iconButton: {
        width: iconSize,
        alignItems: 'center',
        marginBottom: 20,
    },
    iconLabel: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 6,
        color: '#444',
    },
});
