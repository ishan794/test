import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import SOSDashboardScreen from '../screens/dashboard/SOSDashboardScreen';
import TrackingNavigator from './TrackingNavigator';
import ReportIncidentScreen from '../screens/reporting/ReportIncidentScreen';
import CampusHeatmapScreen from '../screens/map/CampusHeatmapScreen';
import SettingsNavigator from './SettingsNavigator';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.ink300,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={SOSDashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Tracking"
        component={TrackingNavigator}
        options={{ tabBarLabel: 'Walk', tabBarIcon: ({ color, size }) => <Ionicons name="navigate" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Reporting"
        component={ReportIncidentScreen}
        options={{ tabBarLabel: 'Report', tabBarIcon: ({ color, size }) => <Ionicons name="alert-circle" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Map"
        component={CampusHeatmapScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}