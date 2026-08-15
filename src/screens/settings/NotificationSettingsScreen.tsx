import React, { useEffect, useState } from 'react';
import { View, Switch, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../config/supabase';
import Card from '../../components/ui/Card';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, spacing, typography } from '../../theme';

type Prefs = { sos: boolean; offline: boolean; journey: boolean; incident_updates: boolean };
const DEFAULT_PREFS: Prefs = { sos: true, offline: true, journey: true, incident_updates: true };

export default function NotificationSettingsScreen({ navigation }: any) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) return;
      setUid(id);
      const { data } = await supabase.from('users').select('notification_prefs').eq('id', id).maybeSingle();
      if (data?.notification_prefs) setPrefs({ ...DEFAULT_PREFS, ...data.notification_prefs });
    })();
  }, []);

  const update = async (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (uid) await supabase.from('users').update({ notification_prefs: next }).eq('id', uid);
  };

  const rows: { key: keyof Prefs; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
    { key: 'sos', icon: 'alert-circle-outline', title: 'SOS alerts', body: 'When a trusted contact triggers an SOS' },
    { key: 'offline', icon: 'wifi-outline', title: 'Offline alerts', body: 'When a trusted contact goes unexpectedly offline' },
    { key: 'journey', icon: 'walk-outline', title: 'Walk With Me updates', body: 'When someone shares a journey with you' },
    { key: 'incident_updates', icon: 'document-text-outline', title: 'Incident report updates', body: 'Status changes on reports you submitted' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <ScreenHeader title="Notification Settings" onBack={() => navigation.goBack()} />
      <Card style={{ padding: 0 }}>
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
            <Ionicons name={r.icon} size={20} color={colors.ink500} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={typography.bodyStrong}>{r.title}</Text>
              <Text style={typography.caption}>{r.body}</Text>
            </View>
            <Switch
              value={prefs[r.key]}
              onValueChange={(v) => update(r.key, v)}
              trackColor={{ false: colors.ink100, true: colors.primaryLight }}
              thumbColor={prefs[r.key] ? colors.primary : '#FFFFFF'}
            />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
});