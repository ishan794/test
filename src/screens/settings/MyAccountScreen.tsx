import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import { logout } from '../../services/authService';
import { stopLocationHeartbeat } from '../../services/locationService';
import { AppUser } from '../../types/user';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '../../theme';

function toAppUser(row: Record<string, unknown>): AppUser {
  return {
    uid: String(row.id),
    fullName: String(row.full_name ?? ''),
    studentId: String(row.student_id ?? ''),
    university: String(row.university ?? ''),
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    verified: Boolean(row.verified),
    currentStatus: (row.current_status as AppUser['currentStatus']) ?? 'safe',
    lastActiveAt: row.last_active_at,
    lastKnownLocation:
      row.last_known_lat != null && row.last_known_lng != null
        ? { lat: Number(row.last_known_lat), lng: Number(row.last_known_lng), accuracy: Number(row.last_known_accuracy ?? 0) }
        : undefined,
    silentAlertMode: Boolean(row.silent_alert_mode),
    autoSosOnFall: Boolean(row.auto_sos_on_fall),
    hasOnboarded: Boolean(row.has_onboarded),
    pushToken: row.push_token ? String(row.push_token) : undefined,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

export default function MyAccountScreen({ navigation }: any) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid || !active) return;
      channel = supabase
        .channel(`account-users-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'DELETE') return;
          const data = toAppUser(payload.new as Record<string, unknown>);
          setProfile(data);
          setFullName(data.fullName);
        })
        .subscribe();

      const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
      if (active && data) {
        const p = toAppUser(data);
        setProfile(p);
        setFullName(p.fullName);
      }
    };
    load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const saveName = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid || !fullName.trim()) return;
    await supabase.from('users').update({ full_name: fullName }).eq('id', uid);
  };

  const handleLogout = async () => {
    await stopLocationHeartbeat();
    await logout();
    // RootNavigator's onAuthStateChanged listener automatically routes
    // back to AuthNavigator (Login screen) the instant this resolves.
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing info', 'Enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter the same new password.');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (err: any) {
      Alert.alert('Could not change password', err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <ScreenHeader title="My Account" onBack={() => navigation.goBack()} />

      {profile && (
        <>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(profile.fullName)}</Text>
            </View>
            <Text style={styles.name}>{profile.fullName}</Text>
            {profile.verified ? (
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={styles.verifiedText}>Verified student</Text>
              </View>
            ) : null}
          </View>

          <Card style={{ marginBottom: spacing.lg }}>
            <InfoRow icon="card-outline" label="Student ID" value={profile.studentId} />
            <InfoRow icon="school-outline" label="University" value={profile.university} />
            <InfoRow icon="mail-outline" label="Email" value={profile.email} last />
          </Card>

          <Text style={styles.sectionTitle}>Full Name</Text>
          <Input value={fullName} onChangeText={setFullName} onBlur={saveName} icon="person-outline" />

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Change Password</Text>
          <Input value={newPassword} onChangeText={setNewPassword} placeholder="New password (min 8)" secureTextEntry icon="lock-closed-outline" />
          <Input value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" secureTextEntry icon="lock-closed-outline" />
          <Button label={changingPassword ? 'Updating…' : 'Update Password'} onPress={handleChangePassword} loading={changingPassword} variant="dark" style={{ marginTop: spacing.md }} />

          <View style={{ marginTop: spacing.xl }}>
            <Button
              label="Log Out"
              variant="outline"
              onPress={() =>
                Alert.alert('Log out?', 'You will need to log in again.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log Out', style: 'destructive', onPress: handleLogout },
                ])
              }
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Ionicons name={icon} size={18} color={colors.ink400} style={{ marginRight: spacing.md }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: '800' },
  name: { ...typography.h2 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.successLight, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.sm,
  },
  verifiedText: { color: colors.success, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  infoLabel: { ...typography.caption, flex: 1 },
  infoValue: { ...typography.bodyStrong, fontSize: 14 },
  sectionTitle: { ...typography.overline, marginBottom: spacing.md },
});
