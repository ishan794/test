import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image source={require('../../../assets/splash.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.title}>SafeYou-Campus</Text>
      <Text style={styles.subtitle}>Your safety network, always on</Text>
      <ActivityIndicator size="small" color={colors.danger} style={{ marginTop: spacing.xxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center' },
  logoWrap: {
    width: 96, height: 96, borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logo: { width: 56, height: 56 },
  title: { color: colors.white, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: colors.ink300, fontSize: 13, marginTop: spacing.xs, fontWeight: '500' },
});