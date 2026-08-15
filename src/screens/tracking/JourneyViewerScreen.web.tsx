import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../../theme';

// Web fallback: react-native-maps is native-only, so a shared journey's live
// trail cannot render in a browser. View it in the Expo Go mobile app instead.
export default function JourneyViewerScreen({ route }: any) {
  const { ownerName } = (route?.params ?? {}) as { ownerName?: string };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={typography.h3}>{ownerName ?? 'Shared journey'}</Text>
        <Text style={styles.placeholderText}>
          Live journey tracking is only available in the mobile app. Open this journey in Expo Go on
          Android or iOS to follow the live location trail.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    marginTop: 56,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.floating,
  },
  placeholderText: { ...typography.body, color: colors.ink600, marginTop: spacing.md },
});
