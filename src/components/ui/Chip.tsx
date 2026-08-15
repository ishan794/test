import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export default function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.ink600, textTransform: 'capitalize' },
  textActive: { color: colors.white },
});
