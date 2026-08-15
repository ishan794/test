// sosService.ts
import supabase from '../config/supabase';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

export async function triggerSOS() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const granted = await ensureLocationPermission();
  if (!granted) throw new Error('Location permission is required to send SOS.');

  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

  const { data, error } = await supabase
    .from('sos_events')
    .insert({
      user_id: uid,
      triggered_at: new Date().toISOString(),
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      status: 'active',
      notified_contact_ids: [],
      source: 'manual',
    })
    .select('id')
    .single();
  if (error) throw error;

  const { error: userError } = await supabase.from('users').update({ current_status: 'sos' }).eq('id', uid);
  if (userError) throw userError;

  return data.id;
  // The sos-fanout Edge Function listens for INSERT on sos_events (via a
  // Postgres webhook) and notifies trusted contacts + campus security.
}

export async function resolveSOS(eventId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('sos_events')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('user_id', uid);
  if (error) throw error;

  const { error: userError } = await supabase.from('users').update({ current_status: 'safe' }).eq('id', uid);
  if (userError) throw userError;
}