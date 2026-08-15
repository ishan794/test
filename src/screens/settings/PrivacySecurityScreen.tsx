import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import Card from '../../components/ui/Card';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, spacing, typography } from '../../theme';

export default function PrivacySecurityScreen({ navigation }: any) {
  const [autoSosOnFall, setAutoSosOnFall] = useState(true);
  const [silentAlertMode, setSilentAlertMode] = useState(false);
  const [smartOfflineDetection, setSmartOfflineDetection] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid || !active) return;
      channel = supabase
        .channel(`privacy-users-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'DELETE') return;
          const data = payload.new as Record<string, unknown>;
          setAutoSosOnFall(Boolean(data.auto_sos_on_fall ?? true));
          setSilentAlertMode(Boolean(data.silent_alert_mode ?? false));
        })
        .subscribe();

      const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
      if (active && data) {
        setAutoSosOnFall(Boolean(data.auto_sos_on_fall ?? true));
        setSilentAlertMode(Boolean(data.silent_alert_mode ?? false));
      }
    };
    load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const update = async (field: string, value: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) return;
    // smartOfflineDetection has no dedicated column in the users table — the
    // toggle is kept client-side; autoSosOnFall/silentAlertMode persist below.
    const columns: Record<string, string> = { autoSosOnFall: 'auto_sos_on_fall', silentAlertMode: 'silent_alert_mode' };
    const column = columns[field];
    if (!column) return;
    await supabase.from('users').update({ [column]: value }).eq('id', uid);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <ScreenHeader title="Privacy & Security" onBack={() => navigation.goBack()} />

      <Text style={styles.sectionTitle}>Safety Preferences</Text>
      <Card style={{ padding: 0 }}>
        <SettingRow
          icon="body-outline"
          title="Auto-SOS on fall detection"
          body="Triggers SOS automatically if a fall is detected"
          value={autoSosOnFall}
          onChange={(v) => { setAutoSosOnFall(v); update('autoSosOnFall', v); }}
        />
        <SettingRow
          icon="wifi-outline"
          title="Smart device offline detection"
          body="Alerts contacts if your device goes silent unexpectedly"
          value={smartOfflineDetection}
          onChange={(v) => { setSmartOfflineDetection(v); update('smartOfflineDetection', v); }}
        />
        <SettingRow
          icon="volume-mute-outline"
          title="Silent alert mode"
          body="Sends SOS without sound or visible screen alerts"
          value={silentAlertMode}
          onChange={(v) => { setSilentAlertMode(v); update('silentAlertMode', v); }}
          last
        />
      </Card>
    </ScrollView>
  );
}

function SettingRow({
  icon,
  title,
  body,
  value,
  onChange,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Ionicons name={icon} size={20} color={colors.ink500} style={{ marginRight: spacing.md }} />
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={typography.bodyStrong}>{title}</Text>
        <Text style={typography.caption}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.ink100, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : '#FFFFFF'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { ...typography.overline, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
});
