import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/FontAwesome";

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
  ConnectScaleScreen,
  WebViewScreen,
} from "./src/screens";

import CustomHeader from "./src/components/CustomHeader";

// 👉 Import GlobalContext provider
import { GlobalProvider } from "./src/context/GlobalContext"; // adjust path

type MembersStackParamList = {
  MembersList: undefined;
  MemberRegistration: undefined;
  MemberKilos: undefined;
  TransporterKilos: undefined;
  StoreSales: undefined;
  StoreOrders: undefined;
  MilkSales: undefined;
  CanManagement: undefined;
  ShiftSummaryReport: undefined;
  TransporterSummaryReport: undefined;
  StoreSalesSummary: undefined;
  MemberStatementSummaryReport: undefined;
  MemberCashout: undefined;
  ConnectScale: undefined;
  LivenessCheck: { url: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const MembersStack = createNativeStackNavigator<MembersStackParamList>();

function AuthStack() {
  return (
    <AuthLayout>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
        initialRouteName="Login"
      >
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Register" component={RegisterScreen} />
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
      <MembersStack.Screen
        name="MemberRegistration"
        component={RegistrationWizard}
      />
      <MembersStack.Screen name="MemberKilos" component={MemberKilosScreen} />
      <MembersStack.Screen
        name="TransporterKilos"
        component={TransporterKilosScreen}
      />
      <MembersStack.Screen name="StoreSales" component={StoreSalesScreen} />
      <MembersStack.Screen name="StoreOrders" component={StoreOrdersScreen} />
      <MembersStack.Screen name="MilkSales" component={MilkSalesScreen} />
      <MembersStack.Screen
        name="CanManagement"
        component={CanManagementScreen}
      />
      <MembersStack.Screen
        name="ShiftSummaryReport"
        component={ShiftSummaryReportScreen}
      />
      <MembersStack.Screen
        name="TransporterSummaryReport"
        component={TransporterSummaryReportScreen}
      />
      <MembersStack.Screen
        name="StoreSalesSummary"
        component={StoreSalesSummaryReportScreen}
      />
      <MembersStack.Screen
        name="MemberStatementSummaryReport"
        component={MemberStatementSummaryReportScreen}
      />
      <MembersStack.Screen
        name="MemberCashout"
        component={MemberCashoutListScreen}
      />
      <MembersStack.Screen name="LivenessCheck" component={WebViewScreen} />
    </MembersStack.Navigator>
  );
}

function HomeTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: (props) => <CustomHeader {...props} />,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = "home";
          if (route.name === "Home") iconName = "home";
          else if (route.name === "Cash") iconName = "money";
          else if (route.name === "Members") iconName = "users";
          else if (route.name === "Settings") iconName = "cog";
          else if (route.name === "Profile") iconName = "user";

          return <Icon name={iconName} size={size} color={color} />;
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
  return (
    <GlobalProvider>
      <NavigationContainer>
        <RootStack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="Auth"
        >
          <RootStack.Screen name="Auth" component={AuthStack} />
          <RootStack.Screen name="Home" component={HomeStack} />
        </RootStack.Navigator>
      </NavigationContainer>
    </GlobalProvider>
  );
}
