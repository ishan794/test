import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getActiveAlerts, resolveSos, listIncidents, setIncidentStatus, AlertRow, IncidentRow } from '../../services/adminService';
import { colors, radius, spacing, typography } from '../../theme';

function timeAgo(iso: string | null): string {
  if (!iso) return 'unknown';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const NEXT_STATUS: Record<string, string> = {
  submitted: 'under-review',
  'under-review': 'resolved',
  resolved: 'resolved',
  rejected: 'under-review',
};

export default function CampusSecurityScreen() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [a, i] = await Promise.all([getActiveAlerts(), listIncidents(50)]);
      setAlerts(a);
      setIncidents(i);
    } catch (err: any) {
      Alert.alert('Load failed', err?.message ?? 'Could not load the security feed.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onResolve = async (id: string) => {
    try {
      await resolveSos(id);
      await load();
    } catch (err: any) {
      Alert.alert('Could not resolve', err?.message ?? '');
    }
  };

  const onAdvance = async (id: string, current: string) => {
    const next = NEXT_STATUS[current] ?? 'under-review';
    try {
      await setIncidentStatus(id, next);
      await load();
    } catch (err: any) {
      Alert.alert('Could not update', err?.message ?? '');
    }
  };

  const sosAlerts = alerts.filter((a) => a.kind === 'sos');
  const offlineAlerts = alerts.filter((a) => a.kind === 'offline');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primaryDark} />}
    >
      <ScreenHeader title="Campus Security" subtitle="Live alerts and incident review" />

      <Text style={styles.sectionTitle}>Active Alerts ({alerts.length})</Text>

      {alerts.length === 0 && (
        <Card style={styles.emptyCard} elevated={false}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
          <Text style={styles.emptyText}>No active alerts right now.</Text>
        </Card>
      )}

      {sosAlerts.map((a) => (
        <Card key={`${a.kind}-${a.id}`} style={styles.alertCard} elevated={false}>
          <View style={[styles.kindIcon, { backgroundColor: colors.dangerLight }]}>
            <Ionicons name="alert" size={18} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>SOS — {a.full_name || 'Unknown'}</Text>
            <Text style={typography.caption}>
              {timeAgo(a.occurred_at)} · {a.phone ? `call ${a.phone}` : 'no phone on file'}
            </Text>
            {a.lat != null && a.lng != null && (
              <Text style={styles.coords}>{a.lat.toFixed(5)}, {a.lng.toFixed(5)}</Text>
            )}
          </View>
          <Button label="Resolve" variant="dark" fullWidth={false} style={styles.resolveBtn} onPress={() => onResolve(a.id)} />
        </Card>
      ))}

      {offlineAlerts.map((a) => (
        <Card key={`${a.kind}-${a.id}`} style={styles.alertCard} elevated={false}>
          <View style={[styles.kindIcon, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="wifi-outline" size={18} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>Offline — {a.full_name || 'Unknown'}</Text>
            <Text style={typography.caption}>
              Last seen {timeAgo(a.occurred_at)} · {a.phone ? `call ${a.phone}` : 'no phone on file'}
            </Text>
            {a.lat != null && a.lng != null && (
              <Text style={styles.coords}>{a.lat.toFixed(5)}, {a.lng.toFixed(5)}</Text>
            )}
          </View>
        </Card>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Recent Reports ({incidents.length})</Text>

      {incidents.length === 0 && (
        <Card style={styles.emptyCard} elevated={false}>
          <Ionicons name="document-text-outline" size={22} color={colors.ink300} />
          <Text style={styles.emptyText}>No reports yet.</Text>
        </Card>
      )}

      {incidents.map((i) => (
        <Card key={i.id} style={styles.incidentCard} elevated={false}>
          <View style={styles.incidentHead}>
            <Text style={[typography.caption, { textTransform: 'capitalize' }]}>
              {i.type?.replace('-', ' ') || 'incident'} · {timeAgo(i.created_at)}
              {i.is_anonymous ? ' · anonymous' : ''}
            </Text>
            <Text style={[styles.statusPill, { backgroundColor: colors.ink100 }]}>{i.status}</Text>
          </View>
          <Text style={typography.body} numberOfLines={3}>{i.description || '(no details)'}</Text>
          <Pressable style={styles.advanceLink} onPress={() => onAdvance(i.id, i.status)}>
            <Text style={styles.advanceText}>
              {i.status === 'resolved' ? 'Resolved ✓' : `Advance to ${NEXT_STATUS[i.status] ?? 'under-review'}`}
            </Text>
          </Pressable>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { ...typography.overline, marginBottom: spacing.md },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyText: { ...typography.caption, color: colors.ink500 },
  alertCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.md },
  kindIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  resolveBtn: { paddingVertical: 8, paddingHorizontal: spacing.lg },
  coords: { ...typography.caption, fontFamily: undefined, fontSize: 11, color: colors.ink400, marginTop: 2 },
  incidentCard: { marginBottom: spacing.sm },
  incidentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, fontSize: 11, fontWeight: '700', color: colors.ink600, overflow: 'hidden' },
  advanceLink: { marginTop: spacing.md },
  advanceText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
});
