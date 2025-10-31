import React, { useRef, useContext, useEffect } from "react";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/FontAwesome";

import Store from "./src/context/store";
import { GlobalProvider } from "./src/context/GlobalContext";
import { AuthProvider, AuthContext } from "./src/AuthContext";
import { ConnectivityProvider } from "./src/context/ConnectivityContext";
import ConnectivityDebugger from "./src/components/ConnectivityDebugger";

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
  ScaleTestScreen
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
      </RootStack.Navigator>
    </AuthLayout>
  );
}

function MembersStackNavigator() {
  return (
    <MembersStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MembersList">
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
            Cash: "money",
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
      <Tab.Screen name="Cash" component={DashboardScreen} />
      <Tab.Screen name="Members" component={MembersStackNavigator} />
      <Tab.Screen name="Settings" component={DashboardScreen} />
      <Tab.Screen name="Profile" component={DashboardScreen} />
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

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const { setNavigationRef } = useContext(AuthContext);

  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef);
    }
  }, []);

  return (
    <AuthProvider>
      <Store>
        <GlobalProvider>
          <ConnectivityProvider>
            <ConnectivityDebugger />
            <NavigationContainer ref={navigationRef}>
              <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Auth">
                <RootStack.Screen name="Auth" component={AuthStack} />
                <RootStack.Screen name="Home" component={HomeStack} />
              </RootStack.Navigator>
            </NavigationContainer>
          </ConnectivityProvider>
        </GlobalProvider>
      </Store>
    </AuthProvider>
  );
}