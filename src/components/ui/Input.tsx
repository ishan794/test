import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export default function Input({ label, icon, error, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error && styles.fieldError,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primaryDark : colors.ink400} style={{ marginRight: spacing.sm }} /> : null}
        <TextInput
          placeholderTextColor={colors.ink300}
          style={[styles.input, style]}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          {...rest}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { ...typography.caption, marginBottom: spacing.xs, color: colors.ink600 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
  },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
