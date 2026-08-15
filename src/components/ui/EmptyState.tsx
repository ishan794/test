import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

export default function EmptyState({
  icon = 'document-text-outline',
  title,
  body,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.ink300} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.bodyStrong, color: colors.ink500, marginBottom: 4 },
  body: { ...typography.caption, textAlign: 'center' },
});
