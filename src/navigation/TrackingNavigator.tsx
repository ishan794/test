import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalkWithMeScreen from '../screens/tracking/WalkWithMeScreen';
import SharedWithMeScreen from '../screens/tracking/SharedWithMeScreen';
import JourneyViewerScreen from '../screens/tracking/JourneyViewerScreen';

const Stack = createNativeStackNavigator();

export default function TrackingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="WalkWithMe">
      <Stack.Screen name="WalkWithMe" component={WalkWithMeScreen} />
      <Stack.Screen name="SharedWithMe" component={SharedWithMeScreen} />
      <Stack.Screen name="JourneyViewer" component={JourneyViewerScreen} />
    </Stack.Navigator>
  );
}