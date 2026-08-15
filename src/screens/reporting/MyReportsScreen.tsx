import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import { Incident, IncidentStatus } from '../../types/incident';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EmptyState from '../../components/ui/EmptyState';
import { colors, radius, spacing, typography } from '../../theme';

function toIncident(row: Record<string, unknown>): Incident {
  return {
    id: String(row.id),
    reporterId: row.reporter_id ? String(row.reporter_id) : null,
    isAnonymous: Boolean(row.is_anonymous),
    type: row.type as Incident['type'],
    description: String(row.description ?? ''),
    location: { lat: Number(row.lat ?? 0), lng: Number(row.lng ?? 0) },
    mediaUrls: Array.isArray(row.media_urls) ? (row.media_urls as string[]) : [],
    status: (row.status as Incident['status']) ?? 'submitted',
    createdAt: row.created_at,
  };
}

const STATUS_META: Record<IncidentStatus, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  submitted: { color: colors.warning, bg: colors.warningLight, icon: 'time-outline' },
  'under-review': { color: colors.primaryDark, bg: colors.primaryLight, icon: 'eye-outline' },
  resolved: { color: colors.success, bg: colors.successLight, icon: 'checkmark-circle-outline' },
};

export default function MyReportsScreen({ navigation }: any) {
  const [reports, setReports] = useState<Incident[]>([]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid || !active) return;
      channel = supabase
        .channel(`my-reports-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `reporter_id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const removedId = String((payload.old as Record<string, unknown>).id);
            setReports((prev) => prev.filter((r) => r.id !== removedId));
            return;
          }
          const row = toIncident(payload.new as Record<string, unknown>);
          setReports((prev) => {
            const rest = prev.filter((r) => r.id !== row.id);
            return [row, ...rest].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
        })
        .subscribe();

      const { data } = await supabase
        .from('incidents')
        .select('*')
        .eq('reporter_id', uid)
        .order('created_at', { ascending: false });
      if (active && data) setReports(data.map(toIncident));
    };
    load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <FlatList
      style={styles.container}
      data={reports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}
      ListHeaderComponent={<ScreenHeader title="My Reports" subtitle="Track the status of what you've submitted" onBack={() => navigation.goBack()} />}
      renderItem={({ item }) => {
        const meta = STATUS_META[item.status];
        return (
          <View style={styles.card}>
            <View style={[styles.statusIcon, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={18} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.type}>{item.type.replace('-', ' ')}</Text>
              <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            </View>
            <Text style={[styles.status, { color: meta.color }]}>{item.status.replace('-', ' ')}</Text>
          </View>
        );
      }}
      ListEmptyComponent={<EmptyState icon="document-text-outline" title="No reports yet" body="Anything you report will show up here so you can follow its status." />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  type: { ...typography.bodyStrong, textTransform: 'capitalize' },
  desc: { ...typography.caption, marginTop: 2 },
  status: { fontSize: 11.5, fontWeight: '700', textTransform: 'capitalize', marginLeft: spacing.sm },
});
