import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Header } from '@react-navigation/stack'; // For React Navigation integration
import Icon from 'react-native-vector-icons/FontAwesome'; // For the bell icon

const CustomHeader = ({ scene, previous, navigation }) => {
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

            {/* Bell Icon with Badge */}
            <View style={styles.iconContainer}>
                <Icon name="bell" size={20} color="#FFFFFF" />
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>1</Text>
                </View>
            </View>
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
    },
    badge: {
        position: 'absolute',
        right: -6,
        top: -3,
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
});

export default CustomHeader;