import * as React from 'react';
import { SafeAreaView, StatusBar, View, StyleSheet, useColorScheme } from 'react-native';
import ConnectivityStatus from '../../components/ConnectivityStatus';
import ConnectivityToast from '../../components/ConnectivityToast';

type Props = { children: React.ReactNode };

export default function DashboardLayout({ children }: Props) {
    const isDark = useColorScheme() === 'dark';

    return (
        <SafeAreaView
            style={[
                styles.safeArea,
                { backgroundColor: isDark ? '#0b1220' : '#f6f8fb' },
            ]}
        >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <ConnectivityStatus />
            <ConnectivityToast />
            <View
                style={[
                    styles.container,
                    { backgroundColor: isDark ? '#0f1628' : '#ffffff' },
                ]}
            >
                {children}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
});
