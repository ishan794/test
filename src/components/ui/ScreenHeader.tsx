import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

export default function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>{title}</Text>
          {subtitle ? <Text style={[typography.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backBtn: {
    marginRight: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
});
