import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import MapView from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { startJourney, endJourney, recordJourneyPing, getMyTrustedContacts } from '../../services/journeyService';
import { useAppStore } from '../../store/useAppStore';
import { ensureLocationPermission } from '../../utils/permissions';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import { colors, radius, shadow, spacing, typography } from '../../theme';

type Contact = { id: string; name: string; relationship: string; linked_uid: string | null };

const PING_INTERVAL_MS = 20000; // 20s — frequent enough to feel "live", light on battery/DB writes

export default function WalkWithMeScreen({ navigation }: any) {
  const [destination, setDestination] = useState('');
  const [starting, setStarting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { activeJourneyId, setActiveJourneyId } = useAppStore();
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    getMyTrustedContacts().then(setContacts).catch(() => {});
  }, []);

  // Live-tracking loop: only runs while a journey is active. Writes a
  // breadcrumb + updates last-known position every PING_INTERVAL_MS so
  // anyone viewing this journey (JourneyViewerScreen) sees it move.
  useEffect(() => {
    if (!activeJourneyId) return;

    let cancelled = false;
    (async () => {
      const granted = await ensureLocationPermission();
      if (!granted || cancelled) return;
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: PING_INTERVAL_MS, distanceInterval: 15 },
        (loc) => {
          recordJourneyPing(activeJourneyId, loc.coords.latitude, loc.coords.longitude, loc.coords.speed ?? null).catch(
            (err) => console.warn('Journey ping failed', err),
          );
        },
      );
    })();

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [activeJourneyId]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleStart = async () => {
    if (!destination.trim()) {
      Alert.alert('Add a destination', 'Tell us where you\u2019re headed first.');
      return;
    }
    setStarting(true);
    try {
      const granted = await ensureLocationPermission();
      if (!granted) return;
      const loc = await Location.getCurrentPositionAsync({});
      // In production, resolve `destination` text to real coordinates via a
      // Places Autocomplete API before calling startJourney.
      const id = await startJourney(
        destination,
        { lat: loc.coords.latitude + 0.01, lng: loc.coords.longitude + 0.01 },
        { lat: loc.coords.latitude, lng: loc.coords.longitude },
        12,
        15,
        selectedIds,
      );
      setActiveJourneyId(id);
    } catch (err: any) {
      Alert.alert('Could not start journey', err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    if (activeJourneyId) {
      await endJourney(activeJourneyId);
      setActiveJourneyId(null);
      setDestination('');
      setSelectedIds([]);
    }
  };

  return (
    <View style={styles.container}>
      <MapView style={StyleSheet.absoluteFillObject} showsUserLocation />

      <Pressable style={styles.sharedButton} onPress={() => navigation.navigate('SharedWithMe')}>
        <Ionicons name="eye-outline" size={16} color={colors.ink} />
        <Text style={styles.sharedButtonText}>Shared with me</Text>
      </Pressable>

      {activeJourneyId ? (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Sharing your live location — trusted contacts can see you now</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        {!activeJourneyId ? (
          <>
            <Text style={typography.h3}>Walk With Me</Text>
            <Text style={[typography.caption, { marginBottom: spacing.md }]}>
              We'll check in on you and notify contacts automatically if the timer runs out.
            </Text>
            <Input
              icon="location-outline"
              placeholder="Where are you headed?"
              value={destination}
              onChangeText={setDestination}
            />

            {contacts.length > 0 ? (
              <>
                <Text style={styles.pickerLabel}>Share with</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {contacts.map((c) => (
                      <Chip key={c.id} label={c.name} active={selectedIds.includes(c.id)} onPress={() => toggleContact(c.id)} />
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : (
              <Text style={[typography.caption, { marginBottom: spacing.md }]}>
                Add a trusted contact in Settings to share this journey live.
              </Text>
            )}

            <Button label={starting ? 'Starting…' : 'Start Walk With Me'} onPress={handleStart} loading={starting} variant="dark" />
          </>
        ) : (
          <>
            <View style={styles.activeRow}>
              <Ionicons name="navigate-circle" size={24} color={colors.primaryDark} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={typography.bodyStrong}>Heading to {destination || 'destination'}</Text>
                <Text style={typography.caption}>Safety timer active · ETA 12 min</Text>
              </View>
            </View>
            <Button label="End Journey" onPress={handleEnd} variant="danger" />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sharedButton: {
    position: 'absolute', top: 60, right: 20,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingVertical: 8, paddingHorizontal: spacing.md,
    ...shadow.floating,
  },
  sharedButtonText: { fontSize: 12, fontWeight: '700', color: colors.ink, marginLeft: 6 },
  liveBanner: {
    position: 'absolute', top: 108, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.ink, borderRadius: radius.full,
    paddingVertical: 10, paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: spacing.sm },
  liveText: { color: colors.white, fontSize: 12.5, fontWeight: '600', flex: 1 },
  panel: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md,
    ...shadow.floating,
  },
  pickerLabel: { ...typography.overline, marginBottom: spacing.sm },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
});