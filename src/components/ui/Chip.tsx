import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export default function Chip({
  label,
  active,
  onPress,
  inverted = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Render for dark surfaces (e.g. the SOS card). */
  inverted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, inverted && styles.chipInverted, active && styles.chipActive, active && inverted && styles.chipActiveInverted]}
    >
      <Text style={[styles.text, inverted && styles.textInverted, active && styles.textActive, active && inverted && styles.textActiveInverted]}>
        {label}
      </Text>
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
  chipInverted: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipActiveInverted: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.ink600, textTransform: 'capitalize' },
  textInverted: { color: colors.ink200 },
  textActive: { color: colors.white },
  textActiveInverted: { color: colors.ink },
});
