import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/FontAwesome';
import HomeScreen from './screens/HomeScreen';
import ProductsScreen from './screens/ProductsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ProfileScreen from './screens/ProfileScreen';
import CustomHeader from './CustomHeader'; // From your previous header request

const Tab = createBottomTabNavigator();

function AppNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName;

                        if (route.name === 'Home') {
                            iconName = focused ? 'home' : 'home';
                        } else if (route.name === 'Products') {
                            iconName = focused ? 'list' : 'list';
                        } else if (route.name === 'Notifications') {
                            iconName = focused ? 'bell' : 'bell';
                        } else if (route.name === 'Profile') {
                            iconName = focused ? 'user' : 'user';
                        }

                        return <Icon name={iconName} size={size} color={color} />;
                    },
                    tabBarActiveTintColor: '#26A69A', // Active tab color (teal from header)
                    tabBarInactiveTintColor: '#666',
                    tabBarStyle: { backgroundColor: '#FFFFFF', height: 60 },
                    header: (props) => <CustomHeader {...props} />, // Use your custom header
                })}
            >
                <Tab.Screen name="Home" component={HomeScreen} />
                <Tab.Screen name="Products" component={ProductsScreen} />
                <Tab.Screen name="Notifications" component={NotificationsScreen} />
                <Tab.Screen name="Profile" component={ProfileScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

export default AppNavigator;