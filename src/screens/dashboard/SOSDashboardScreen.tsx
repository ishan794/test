import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import SOSButton from '../../components/SOSButton';
import StatusBadge from '../../components/StatusBadge';
import QuickActionGrid from '../../components/QuickActionGrid';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import { AppUser } from '../../types/user';
import { colors, spacing, typography } from '../../theme';

const SOS_TYPES = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'medical', label: 'Medical' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'stalking', label: 'Stalking' },
  { value: 'unsafe-area', label: 'Unsafe area' },
  { value: 'other', label: 'Other' },
];

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

function timeAgo(iso: unknown): string {
  if (!iso) return 'never';
  const then = new Date(String(iso)).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

export default function SOSDashboardScreen({ navigation }: any) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [sosType, setSosType] = useState('emergency');

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid || !active) return;
      // Live subscription — reflects real-time status/location changes from the
      // 60s heartbeat and any Edge Function updates (e.g. offline-suspected).
      channel = supabase
        .channel(`user-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'DELETE') return;
          setProfile(toAppUser(payload.new as Record<string, unknown>));
        })
        .subscribe();

      const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
      if (active && data) setProfile(toAppUser(data));
    };
    load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const firstName = profile?.fullName?.split(' ')[0] || 'there';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
          <Text style={typography.caption}>Last check-in {timeAgo(profile?.lastActiveAt)}</Text>
        </View>
        {profile && <StatusBadge status={profile.currentStatus} />}
      </View>

      <Card style={styles.sosCard} elevated={false}>
        <Text style={styles.sosCardTitle}>In danger right now?</Text>
        <Text style={styles.sosCardBody}>Hold the button below. Your live location and an alert go straight to your trusted contacts and campus security.</Text>
        <View style={styles.sosWrap}>
          <SOSButton incidentType={sosType} />
        </View>
        <View style={styles.sosTypeRow}>
          {SOS_TYPES.map((t) => (
            <Chip key={t.value} label={t.label} active={sosType === t.value} onPress={() => setSosType(t.value)} inverted />
          ))}
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Quick Emergency Contacts</Text>
      <QuickActionGrid
        actions={[
          { label: 'Campus Security', icon: 'shield-checkmark', tint: colors.primaryDark, onPress: () => Linking.openURL('tel:+94112000000') },
          { label: 'Local Police', icon: 'call', tint: colors.danger, onPress: () => Linking.openURL('tel:119') },
          { label: 'Trusted Contacts', icon: 'people', tint: colors.warning, onPress: () => navigation.navigate('Settings', { screen: 'TrustedContacts' }) },
          { label: 'Hospital', icon: 'medkit', tint: colors.success, onPress: () => Linking.openURL('tel:1990') },
        ]}
      />

      <Text style={styles.sectionTitle}>Safety Tools</Text>
      <View style={{ gap: spacing.sm }}>
        <Pressable onPress={() => navigation.navigate('Tracking')}>
          <Card style={styles.toolRow} elevated={false}>
            <Ionicons name="navigate-circle-outline" size={22} color={colors.primaryDark} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={typography.bodyStrong}>Walk With Me</Text>
              <Text style={typography.caption}>Share a live journey with a safety timer</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Card>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Reporting')}>
          <Card style={styles.toolRow} elevated={false}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={typography.bodyStrong}>Report an Incident</Text>
              <Text style={typography.caption}>Anonymous or identified reporting</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Card>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Map')}>
          <Card style={styles.toolRow} elevated={false}>
            <Ionicons name="map-outline" size={22} color={colors.success} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={typography.bodyStrong}>Campus Heatmap</Text>
              <Text style={typography.caption}>See recently reported risk zones</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Card>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  greeting: { ...typography.h1, marginBottom: 2 },
  sosCard: { backgroundColor: colors.ink, alignItems: 'center', paddingVertical: spacing.xxl, marginBottom: spacing.xxl },
  sosCardTitle: { color: colors.white, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sosCardBody: { color: colors.ink300, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: spacing.xl, paddingHorizontal: spacing.md },
  sosWrap: { alignItems: 'center' },
  sosTypeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.md },
  sectionTitle: { ...typography.overline, marginBottom: spacing.md, marginTop: spacing.xl },
  toolRow: { flexDirection: 'row', alignItems: 'center' },
});
