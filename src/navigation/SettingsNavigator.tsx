import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsHomeScreen from '../screens/settings/SettingsHomeScreen';
import MyAccountScreen from '../screens/settings/MyAccountScreen';
import TrustedContactsScreen from '../screens/settings/TrustedContactsScreen';
import PrivacySecurityScreen from '../screens/settings/PrivacySecurityScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import LocationSettingsScreen from '../screens/settings/LocationSettingsScreen';
import DeleteAccountScreen from '../screens/settings/DeleteAccountScreen';
import MyReportsScreen from '../screens/reporting/MyReportsScreen';
import CampusSecurityScreen from '../screens/admin/CampusSecurityScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="SettingsHome">
      <Stack.Screen name="SettingsHome" component={SettingsHomeScreen} />
      <Stack.Screen name="MyAccount" component={MyAccountScreen} />
      <Stack.Screen name="TrustedContacts" component={TrustedContactsScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="LocationSettings" component={LocationSettingsScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="MyReports" component={MyReportsScreen} />
      <Stack.Screen name="CampusSecurity" component={CampusSecurityScreen} />
    </Stack.Navigator>
  );
}