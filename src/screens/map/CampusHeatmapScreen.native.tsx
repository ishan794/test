import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import { colors, radius, shadow, spacing, typography } from '../../theme';

type Zone = {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  riskScore: number;
  incidentCount: number;
  incidentTypes: Record<string, number>;
};

function toZone(row: Record<string, unknown>): Zone {
  const types = (row.incident_types ?? {}) as Record<string, number>;
  return {
    id: String(row.id),
    centerLat: Number(row.center_lat ?? 0),
    centerLng: Number(row.center_lng ?? 0),
    radiusMeters: Number(row.radius_meters ?? 0),
    riskScore: Number(row.risk_score ?? 0),
    incidentCount: Number(row.incident_count ?? 0),
    incidentTypes: types,
  };
}

function riskLabel(score: number): string {
  if (score > 66) return 'High risk';
  if (score > 33) return 'Moderate risk';
  return 'Low risk';
}

export default function CampusHeatmapScreen() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selected, setSelected] = useState<Zone | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      channel = supabase
        .channel('risk-zones')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_zones' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const removedId = String((payload.old as Record<string, unknown>).id);
            setZones((prev) => prev.filter((z) => z.id !== removedId));
            setSelected((prev) => (prev?.id === removedId ? null : prev));
          } else {
            const row = toZone(payload.new as Record<string, unknown>);
            setZones((prev) => {
              const rest = prev.filter((z) => z.id !== row.id);
              return [...rest, row];
            });
            setSelected((prev) => (prev?.id === row.id ? row : prev));
          }
        })
        .subscribe();

      const { data } = await supabase.from('risk_zones').select('*');
      if (active && data) setZones(data.map(toZone));
    };
    load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const colorFor = (score: number) =>
    score > 66 ? 'rgba(220,38,38,0.35)' : score > 33 ? 'rgba(217,119,6,0.28)' : 'rgba(22,163,74,0.22)';

  const markerColorFor = (score: number) => (score > 66 ? colors.danger : score > 33 ? colors.warning : colors.success);

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={{ latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.02, longitudeDelta: 0.02 }}>
        {zones.map((z) => (
          <Circle
            key={z.id}
            center={{ latitude: z.centerLat, longitude: z.centerLng }}
            radius={z.radiusMeters}
            fillColor={colorFor(z.riskScore)}
            strokeColor="transparent"
          />
        ))}
        {zones.map((z) => (
          <Marker
            key={`marker-${z.id}`}
            coordinate={{ latitude: z.centerLat, longitude: z.centerLng }}
            pinColor={markerColorFor(z.riskScore)}
            onPress={() => setSelected(z)}
            tracksViewChanges={false}
          />
        ))}
      </MapView>

      <View style={styles.titleBar}>
        <Text style={typography.h3}>Campus Heatmap</Text>
        <Text style={typography.caption}>{zones.length} reported {zones.length === 1 ? 'zone' : 'zones'}</Text>
      </View>

      {selected ? (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={[styles.detailDot, { backgroundColor: markerColorFor(selected.riskScore) }]} />
            <Text style={typography.bodyStrong}>{riskLabel(selected.riskScore)}</Text>
            <Pressable onPress={() => setSelected(null)} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.detailBody}>
            {selected.incidentCount} incident{selected.incidentCount === 1 ? '' : 's'} reported here
          </Text>
          {Object.keys(selected.incidentTypes).length > 0 && (
            <View style={styles.typeList}>
              {Object.entries(selected.incidentTypes).map(([type, count]) => (
                <View key={type} style={styles.typePill}>
                  <Text style={styles.typeText}>
                    {type.replace('-', ' ')} · {count}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.tapHint}>Tap another pin to inspect a different area.</Text>
        </View>
      ) : (
        <View style={styles.legend}>
          <LegendRow color="rgba(22,163,74,0.9)" label="Low risk" />
          <LegendRow color="rgba(217,119,6,0.9)" label="Moderate" />
          <LegendRow color="rgba(220,38,38,0.9)" label="High risk" />
          <Text style={styles.tapHint}>Tap a pin to see incident counts and types.</Text>
        </View>
      )}
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBar: {
    position: 'absolute', top: 56, left: 20, right: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  legend: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, gap: 6,
    ...shadow.floating,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: spacing.sm },
  legendText: { fontSize: 12, fontWeight: '600', color: colors.ink600 },
  detailCard: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm,
    ...shadow.floating,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailDot: { width: 11, height: 11, borderRadius: 6 },
  detailBody: { ...typography.caption, color: colors.ink600 },
  closeText: { color: colors.ink400, fontSize: 16, fontWeight: '700' },
  typeList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.ink600, textTransform: 'capitalize' },
  tapHint: { fontSize: 11, color: colors.ink300, marginTop: spacing.xs },
});
