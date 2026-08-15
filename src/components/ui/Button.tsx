import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, PressableStateCallbackType } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

type Variant = 'primary' | 'danger' | 'dark' | 'outline' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  icon,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const bgFor = (pressed: boolean) => {
    switch (variant) {
      case 'primary':
        return pressed ? colors.primaryDark : colors.primary;
      case 'danger':
        return pressed ? colors.dangerDark : colors.danger;
      case 'dark':
        return pressed ? colors.ink700 : colors.ink;
      case 'outline':
        return 'transparent';
      case 'ghost':
        return 'transparent';
    }
  };

  const textColor = variant === 'outline' ? colors.ink : variant === 'ghost' ? colors.primaryDark : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.base,
        fullWidth && { alignSelf: 'stretch' },
        { backgroundColor: bgFor(pressed) },
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[typography.button, { color: textColor }, icon ? { marginLeft: spacing.sm } : null]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.ink200,
  },
  disabled: {
    opacity: 0.5,
  },
});
