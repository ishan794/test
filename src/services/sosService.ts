// sosService.ts
import supabase from '../config/supabase';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';

// SOS is created and resolved through the trigger_sos / resolve_sos RPCs, which
// run the insert + status update in a single DB transaction and enforce a
// per-user cooldown server-side (so a client can't spam SOS or leave stale state).

export async function triggerSOS(incidentType = 'emergency') {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const granted = await ensureLocationPermission();
  if (!granted) throw new Error('Location permission is required to send SOS.');

  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

  const { data, error } = await supabase.rpc('trigger_sos', {
    p_lat: loc.coords.latitude,
    p_lng: loc.coords.longitude,
    p_source: 'manual',
    p_incident_type: incidentType,
  });
  if (error) throw error;

  return data as string;
}

export async function resolveSOS(eventId: string) {
  const { error } = await supabase.rpc('resolve_sos', { p_event_id: eventId });
  if (error) throw error;
}
