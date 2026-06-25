import React, { useRef, useContext, useEffect, useState } from "react";
import { View } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";

import Store from "./src/context/store";
import { GlobalProvider } from "./src/context/GlobalContext";
import { AuthProvider, AuthContext } from "./src/AuthContext";
import { ConnectivityProvider, useConnectivity } from "./src/context/ConnectivityContext";
import { SyncProvider } from "./src/context/SyncContext";
import ConnectivityDebugger from "./src/components/ConnectivityDebugger";
import OfflineModeRedirect from "./src/components/OfflineModeRedirect";
import CoreDataGate from "./src/components/CoreDataGate";
import { initDatabase } from "./src/services/offlineDatabase";
import { bindAppNavigationRef, getRootRouteName } from "./src/services/offlineNavigation";
import { isNetworkOnlineFromFlags } from "./src/utils/networkState";
import LaunchScreen from "./src/components/LaunchScreen";

import {
  LoginScreen,
  RegisterScreen,
  DashboardScreen,
  AuthLayout,
  DashboardLayout,
  RegistrationWizard,
  MembersListScreen,
  MemberKilosScreen,
  TransporterKilosScreen,
  StoreSalesScreen,
  StoreOrdersScreen,
  MilkSalesScreen,
  CanManagementScreen,
  ShiftSummaryReportScreen,
  TransporterSummaryReportScreen,
  StoreSalesSummaryReportScreen,
  MemberStatementSummaryReportScreen,
  MemberCashoutListScreen,
  WebViewScreen,
  UserBalanceSummaryScreen,
  ScaleTestScreen,
  ProfileScreen,
  SettingsScreen,
  OfflineMilkCollectionScreen,
  FailedSyncsScreen,
} from "./src/screens";
import CustomHeader from "./src/components/CustomHeader";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MembersStack = createNativeStackNavigator();

function AuthStack() {
  return (
    <AuthLayout>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'rgba(0,0,0,0)' },
          animation: 'fade',
          animationDuration: 200,
        }}
        initialRouteName="Login"
      >
        <RootStack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            contentStyle: { backgroundColor: 'rgba(0,0,0,0)' },
          }}
        />
        <RootStack.Screen
          name="Register"
          component={RegisterScreen}
          options={{
            contentStyle: { backgroundColor: 'rgba(0,0,0,0)' },
          }}
        />
        <RootStack.Screen
          name="OfflineCollection"
          component={OfflineMilkCollectionScreen}
          options={{
            headerShown: true,
            headerTitle: "Offline Collection",
            headerStyle: { backgroundColor: '#dc2626' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#fff' },
          }}
        />
      </RootStack.Navigator>
    </AuthLayout>
  );
}

function MembersStackNavigator() {
  return (
    <MembersStack.Navigator 
      screenOptions={{ headerShown: false }} 
      initialRouteName="MembersList"
    >
      <MembersStack.Screen name="MembersList" component={MembersListScreen} />
      <MembersStack.Screen name="MemberRegistration" component={RegistrationWizard} />
      <MembersStack.Screen name="MemberKilos" component={MemberKilosScreen} />
      <MembersStack.Screen name="TransporterKilos" component={TransporterKilosScreen} />
      <MembersStack.Screen name="StoreSales" component={StoreSalesScreen} />
      <MembersStack.Screen name="StoreOrders" component={StoreOrdersScreen} />
      <MembersStack.Screen name="MilkSales" component={MilkSalesScreen} />
      <MembersStack.Screen name="CanManagement" component={CanManagementScreen} />
      <MembersStack.Screen name="ShiftSummaryReport" component={ShiftSummaryReportScreen} />
      <MembersStack.Screen name="TransporterSummaryReport" component={TransporterSummaryReportScreen} />
      <MembersStack.Screen name="StoreSalesSummary" component={StoreSalesSummaryReportScreen} />
      <MembersStack.Screen name="MemberStatementSummaryReport" component={MemberStatementSummaryReportScreen} />
      <MembersStack.Screen name="MemberCashout" component={MemberCashoutListScreen} />
      <MembersStack.Screen name="LivenessCheck" component={WebViewScreen} />
      <MembersStack.Screen name="UserBalanceSummary" component={UserBalanceSummaryScreen} />
        <MembersStack.Screen name="ScaleTest" component={ScaleTestScreen} />
        <MembersStack.Screen
          name="FailedSyncs"
          component={FailedSyncsScreen}
          options={{
            headerShown: true,
            headerTitle: "Failed Syncs",
            headerStyle: { backgroundColor: "#dc2626" },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
        <MembersStack.Screen
          name="OfflineMilkCollection"
          component={OfflineMilkCollectionScreen}
          options={{
            headerShown: true,
            headerTitle: "Milk Collection",
            headerStyle: { backgroundColor: "#dc2626" },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "600" },
          }}
        />
    </MembersStack.Navigator>
  );
}

function HomeTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: (props) => <CustomHeader {...props} />,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Home: "home",
            Cashouts: "money",
            Members: "users",
            Settings: "cog",
            Profile: "user",
          };
          return <Icon name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#26A69A",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: { backgroundColor: "#FFFFFF", height: 60 },
        tabBarLabelStyle: { fontSize: 12 },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Cashouts" component={MemberCashoutListScreen} />
      <Tab.Screen 
        name="Members" 
        component={MembersStackNavigator}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            // Get the current route name in the Members stack
            const routeName = getFocusedRouteNameFromRoute(route) ?? 'MembersList';
            
            // If we're not on MembersList, navigate to it (this will pop all screens above it)
            if (routeName !== 'MembersList') {
              // Navigate to MembersList, which will pop all screens above it
              navigation.navigate('Members', {
                screen: 'MembersList',
              });
            }
          },
        })}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function HomeStack() {
  return (
    <DashboardLayout>
      <HomeTabNavigator />
    </DashboardLayout>
  );
}

function AppContent({
  navigationRef,
  appReady,
}: {
  navigationRef: React.RefObject<any>;
  appReady: boolean;
}) {
  const {
    setNavigationRef,
    userToken,
    loading: authLoading,
    handleConnectivityTransition,
  } = React.useContext(AuthContext);
  const { isConnected, isInternetReachable } = useConnectivity();
  const isOnline = isNetworkOnlineFromFlags(isConnected, isInternetReachable);
  const wasOnlineRef = React.useRef(isOnline);
  const connectivityBaselineSetRef = React.useRef(false);

  React.useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef);
      bindAppNavigationRef(navigationRef.current);
    }
  }, [navigationRef, setNavigationRef]);

  React.useEffect(() => {
    if (!appReady || authLoading) {
      return;
    }

    const nav = navigationRef.current;
    if (!nav?.isReady()) {
      return;
    }

    const rootRoute = getRootRouteName(nav.getRootState());

    if (userToken && rootRoute === "Auth") {
      nav.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    }
  }, [appReady, authLoading, navigationRef, userToken]);

  React.useEffect(() => {
    if (!appReady || authLoading) {
      return;
    }

    if (!connectivityBaselineSetRef.current) {
      connectivityBaselineSetRef.current = true;
      wasOnlineRef.current = isOnline;
      return;
    }

    const previousOnline = wasOnlineRef.current;
    if (previousOnline === isOnline) {
      return;
    }

    wasOnlineRef.current = isOnline;

    console.log(
      `[APP] Connectivity transition: ${previousOnline ? "online" : "offline"} → ${isOnline ? "online" : "offline"}`
    );

    void handleConnectivityTransition(isOnline);
  }, [isOnline, appReady, authLoading, handleConnectivityTransition]);

  return (
    <>
      <ConnectivityDebugger />
      <NavigationContainer ref={navigationRef}>
        <OfflineModeRedirect navigationRef={navigationRef} appReady={appReady} />
        <CoreDataGate navigationRef={navigationRef} appReady={appReady} />
        <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Auth">
          <RootStack.Screen name="Auth" component={AuthStack} />
          <RootStack.Screen name="Home" component={HomeStack} />
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const { setNavigationRef } = useContext(AuthContext);
  const [isLaunching, setIsLaunching] = useState(true);

  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef);
    }
  }, []);

  // Initialize offline database and sync service (without network listener)
  useEffect(() => {
    const initOfflineServices = async () => {
      try {
        // Initialize database
        await initDatabase();
        console.log('[APP] Offline database initialized');

        // Removed auto-sync on launch - sync should be user-initiated only
        // startAutoSync(5);
        // console.log('[APP] Auto-sync service started');

        // Hide launch screen after initialization
        console.log('[APP] Initialization complete, hiding launch screen');
        setTimeout(() => {
          console.log('[APP] Setting isLaunching to false');
          setIsLaunching(false);
        }, 2000); // Show launch screen for at least 2 seconds

      } catch (error) {
        console.error('[APP] Error initializing offline services:', error);
        // Still hide launch screen even on error
        setTimeout(() => {
          setIsLaunching(false);
        }, 2000);
      }
    };

    initOfflineServices();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#26A69A' }}>
      <SyncProvider>
        <Store>
          <GlobalProvider>
            <ConnectivityProvider>
              <AuthProvider>
                <AppContent navigationRef={navigationRef} appReady={!isLaunching} />
              </AuthProvider>
            </ConnectivityProvider>
          </GlobalProvider>
        </Store>
      </SyncProvider>
      <LaunchScreen visible={isLaunching} />
    </View>
  );
}