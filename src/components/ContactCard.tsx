import React from 'react';
import { View, Text, Switch, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrustedContact } from '../types/contact';
import { colors, radius, spacing, typography } from '../theme';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

export default function ContactCard({
  contact,
  onToggleAutoShare,
  onRemove,
  onEdit,
  onSetPrimary,
}: {
  contact: TrustedContact;
  onToggleAutoShare: (v: boolean) => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onSetPrimary?: () => void;
}) {
  const verified = contact.status === 'verified';
  const isPrimary = contact.priority === 'primary';
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(contact.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{contact.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{contact.relationship || 'Contact'}</Text>
          <View style={styles.dotSep} />
          <Ionicons
            name={verified ? 'checkmark-circle' : 'time-outline'}
            size={12}
            color={verified ? colors.success : colors.warning}
          />
          <Text style={[styles.meta, { color: verified ? colors.success : colors.warning, marginLeft: 3 }]}>
            {verified ? 'Verified' : 'Pending'}
          </Text>
        </View>
      </View>
      {onSetPrimary ? (
        <Pressable onPress={onSetPrimary} hitSlop={8} style={{ marginLeft: spacing.sm }}>
          <Ionicons name={isPrimary ? 'star' : 'star-outline'} size={18} color={isPrimary ? colors.warning : colors.ink300} />
        </Pressable>
      ) : null}
      <Switch
        value={contact.autoShare}
        onValueChange={onToggleAutoShare}
        trackColor={{ false: colors.ink100, true: colors.primaryLight }}
        thumbColor={contact.autoShare ? colors.primary : '#FFFFFF'}
      />
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8} style={{ marginLeft: spacing.sm }}>
          <Ionicons name="create-outline" size={17} color={colors.ink300} />
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: spacing.sm }}>
          <Ionicons name="trash-outline" size={18} color={colors.ink300} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  name: { ...typography.bodyStrong },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  meta: { fontSize: 12, color: colors.ink400, fontWeight: '500', textTransform: 'capitalize' },
  dotSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.ink200, marginHorizontal: 6 },
});
