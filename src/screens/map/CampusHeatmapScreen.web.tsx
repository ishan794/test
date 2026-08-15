import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../../theme';

export default function CampusHeatmapScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={styles.titleBar}>
        <Text style={typography.h3}>Campus Heatmap</Text>
        <Text style={typography.caption}>Map view is only available on the mobile app</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Heatmap unavailable on web</Text>
        <Text style={styles.placeholderText}>React Native Maps is a native-only module. Open this screen in the Expo Go app on Android or iOS to view risk zones.</Text>
      </View>

      <View style={styles.legend}>
        <LegendRow color="rgba(22,163,74,0.9)" label="Low risk" />
        <LegendRow color="rgba(217,119,6,0.9)" label="Moderate" />
        <LegendRow color="rgba(220,38,38,0.9)" label="High risk" />
      </View>
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBar: {
    position: 'absolute', top: 56, left: 20, right: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  placeholderTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  placeholderText: {
    ...typography.body,
    color: colors.ink600,
    textAlign: 'center',
  },
  legend: {
    position: 'absolute', bottom: 30, left: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, gap: 6,
    ...shadow.floating,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: spacing.sm },
  legendText: { fontSize: 12, fontWeight: '600', color: colors.ink600 },
});