import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import { colors, radius, shadow, spacing, typography } from '../../theme';

type Ping = { lat: number; lng: number };

export default function JourneyViewerScreen({ route, navigation }: any) {
  const { journeyId, ownerName } = route.params as { journeyId: string; ownerName: string };
  const [current, setCurrent] = useState<Ping | null>(null);
  const [trail, setTrail] = useState<Ping[]>([]);
  const [status, setStatus] = useState<string>('active');
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);

  useEffect(() => {
    let journeyChannel: RealtimeChannel | null = null;
    let pingChannel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from('journeys')
        .select('last_ping_lat, last_ping_lng, last_ping_at, status')
        .eq('id', journeyId)
        .maybeSingle();
      if (active && data?.last_ping_lat != null && data?.last_ping_lng != null) {
        setCurrent({ lat: data.last_ping_lat, lng: data.last_ping_lng });
        setLastPingAt(data.last_ping_at);
        setStatus(data.status);
      }

      const { data: pings } = await supabase
        .from('journey_pings')
        .select('lat, lng')
        .eq('journey_id', journeyId)
        .order('created_at', { ascending: true });
      if (active && pings) setTrail(pings as Ping[]);

      journeyChannel = supabase
        .channel(`journey-${journeyId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'journeys', filter: `id=eq.${journeyId}` }, (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.last_ping_lat != null && row.last_ping_lng != null) {
            setCurrent({ lat: Number(row.last_ping_lat), lng: Number(row.last_ping_lng) });
          }
          setLastPingAt(row.last_ping_at ? String(row.last_ping_at) : null);
          setStatus(String(row.status));
        })
        .subscribe();

      pingChannel = supabase
        .channel(`journey-pings-${journeyId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journey_pings', filter: `journey_id=eq.${journeyId}` }, (payload) => {
          const row = payload.new as Record<string, unknown>;
          setTrail((prev) => [...prev, { lat: Number(row.lat), lng: Number(row.lng) }]);
        })
        .subscribe();
    };
    load();

    return () => {
      active = false;
      if (journeyChannel) supabase.removeChannel(journeyChannel);
      if (pingChannel) supabase.removeChannel(pingChannel);
    };
  }, [journeyId]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={
          current
            ? { latitude: current.lat, longitude: current.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : { latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        }
      >
        {trail.length > 1 && (
          <Polyline coordinates={trail.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.primaryDark} strokeWidth={3} />
        )}
        {current && (
          <Marker coordinate={{ latitude: current.lat, longitude: current.lng }} title={ownerName} pinColor={status === 'active' ? 'red' : 'gray'} />
        )}
      </MapView>

      <View style={styles.card}>
        <Text style={typography.h3}>{ownerName}</Text>
        <Text style={typography.caption}>
          {status === 'active' ? `Live · last update ${lastPingAt ? new Date(lastPingAt).toLocaleTimeString() : '—'}` : 'Journey ended'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.floating,
  },
});