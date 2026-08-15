import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../config/supabase';
import Card from '../../components/ui/Card';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '../../theme';

type Mode = 'always' | 'journeys-only' | 'off';

const OPTIONS: { value: Mode; title: string; body: string }[] = [
  { value: 'always', title: 'Always', body: 'Background heartbeat every 60s — needed for SOS and offline detection to work' },
  { value: 'journeys-only', title: 'Only during Walk With Me', body: 'Location is only shared while a journey is active' },
  { value: 'off', title: 'Off', body: 'SOS, offline detection, and Walk With Me will not work correctly' },
];

export default function LocationSettingsScreen({ navigation }: any) {
  const [mode, setMode] = useState<Mode>('always');
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) return;
      setUid(id);
      const { data } = await supabase.from('users').select('location_sharing_mode').eq('id', id).maybeSingle();
      if (data?.location_sharing_mode) setMode(data.location_sharing_mode as Mode);
    })();
  }, []);

  const select = async (value: Mode) => {
    setMode(value);
    if (uid) await supabase.from('users').update({ location_sharing_mode: value }).eq('id', uid);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <ScreenHeader title="Location Settings" subtitle="Controls the 60s background heartbeat" onBack={() => navigation.goBack()} />
      <View style={{ gap: spacing.sm }}>
        {OPTIONS.map((o) => (
          <Pressable key={o.value} onPress={() => select(o.value)}>
            <Card style={styles.option} elevated={false}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyStrong}>{o.title}</Text>
                <Text style={typography.caption}>{o.body}</Text>
              </View>
              <View style={[styles.radio, mode === o.value && styles.radioActive]}>
                {mode === o.value && <Ionicons name="checkmark" size={13} color={colors.white} />}
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  option: { flexDirection: 'row', alignItems: 'center' },
  radio: {
    width: 24, height: 24, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.ink100,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md,
  },
  radioActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});