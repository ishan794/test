import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import { colors, radius, shadow, spacing, typography } from '../../theme';

type Zone = { id: string; centerLat: number; centerLng: number; radiusMeters: number; riskScore: number };

function toZone(row: Record<string, unknown>): Zone {
  return {
    id: String(row.id),
    centerLat: Number(row.center_lat ?? 0),
    centerLng: Number(row.center_lng ?? 0),
    radiusMeters: Number(row.radius_meters ?? 0),
    riskScore: Number(row.risk_score ?? 0),
  };
}

export default function CampusHeatmapScreen() {
  const [zones, setZones] = useState<Zone[]>([]);

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
          } else {
            const row = toZone(payload.new as Record<string, unknown>);
            setZones((prev) => {
              const rest = prev.filter((z) => z.id !== row.id);
              return [...rest, row];
            });
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
      </MapView>

      <View style={styles.titleBar}>
        <Text style={typography.h3}>Campus Heatmap</Text>
        <Text style={typography.caption}>{zones.length} reported {zones.length === 1 ? 'zone' : 'zones'}</Text>
      </View>

      <View style={styles.legend}>
        <LegendRow color="rgba(22,163,74,0.9)" label="Low risk" />
        <LegendRow color="rgba(217,119,6,0.9)" label="Moderate" />
        <LegendRow color="rgba(220,38,38,0.9)" label="High risk" />
      </View>
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
    position: 'absolute', bottom: 30, left: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, gap: 6,
    ...shadow.floating,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: spacing.sm },
  legendText: { fontSize: 12, fontWeight: '600', color: colors.ink600 },
});
