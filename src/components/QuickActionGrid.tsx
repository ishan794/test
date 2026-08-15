import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

type Action = { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; tint?: string };

export default function QuickActionGrid({ actions }: { actions: Action[] }) {
  return (
    <View style={styles.grid}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          onPress={a.onPress}
        >
          <View style={[styles.iconWrap, { backgroundColor: (a.tint ?? colors.primary) + '1A' }]}>
            <Ionicons name={a.icon} size={20} color={a.tint ?? colors.primaryDark} />
          </View>
          <Text style={styles.label}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  item: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  label: { ...typography.bodyStrong, fontSize: 13.5 },
});
