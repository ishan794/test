import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, statusColors, StatusKind } from '../theme';

export default function StatusBadge({ status }: { status: StatusKind }) {
  const { fg, bg, label } = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: spacing.xs },
  text: { fontWeight: '700', fontSize: 12.5 },
});
