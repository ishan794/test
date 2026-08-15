import React from 'react';
import { View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';

export default function Card({
  children,
  style,
  padded = true,
  elevated = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  elevated?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        elevated && shadow.card,
        padded && { padding: spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}
