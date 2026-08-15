import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    primary: colors.primary,
    card: colors.white,
    border: colors.border,
    text: colors.ink,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}
