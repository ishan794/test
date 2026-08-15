// sosService.ts
import supabase from '../config/supabase';
import * as Location from 'expo-location';
import { ensureLocationPermission } from '../utils/permissions';
import { sendSosSms } from './smsService';

// SOS is created and resolved through the trigger_sos / resolve_sos / cancel_sos
// / acknowledge_sos RPCs, which run inside single DB transactions and enforce a
// per-user cooldown server-side (so a client can't spam SOS or leave stale state).

export interface TriggerSosResult {
  eventId: string | null;
  smsSent: boolean;
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch failed|failed to fetch|network request failed|network error|ECONNREFUSED|timeout|offline/i.test(msg);
}

export async function triggerSOS(
  incidentType = 'emergency',
  contactIds: string[] = [],
  contactPhone?: string,
): Promise<TriggerSosResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Not authenticated');

  const granted = await ensureLocationPermission();
  if (!granted) throw new Error('Location permission is required to send SOS.');

  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  const lat = loc.coords.latitude;
  const lng = loc.coords.longitude;

  try {
    const { data, error } = await supabase.rpc('trigger_sos', {
      p_lat: lat,
      p_lng: lng,
      p_source: 'manual',
      p_incident_type: incidentType,
      p_contact_ids: contactIds.length ? contactIds : null,
    });
    if (error) throw error;
    return { eventId: data as string, smsSent: false };
  } catch (err) {
    // SMS fallback: if the backend is unreachable and we have a selected
    // contact's phone number, still alert them via the device's SMS app.
    if (isNetworkError(err) && contactPhone) {
      const name = (user.user_metadata?.full_name as string) ?? 'A student';
      const sent = await sendSosSms(contactPhone, { name, incidentType, lat, lng });
      return { eventId: null, smsSent: sent };
    }
    throw err;
  }
}

export async function resolveSOS(eventId: string) {
  const { error } = await supabase.rpc('resolve_sos', { p_event_id: eventId });
  if (error) throw error;
}

export async function cancelSOS(eventId: string) {
  const { error } = await supabase.rpc('cancel_sos', { p_event_id: eventId });
  if (error) throw error;
}

export async function acknowledgeSOS(eventId: string) {
  const { error } = await supabase.rpc('acknowledge_sos', { p_event_id: eventId });
  if (error) throw error;
}
