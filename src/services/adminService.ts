// adminService.ts — campus-security console data layer. All of these call the
// security-definer functions in 0004_admin_functions.sql, which reject any
// caller who is not role = 'campus_security'.

import supabase from '../config/supabase';

export type AlertRow = {
  id: string;
  kind: 'sos' | 'offline';
  user_id: string;
  full_name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  occurred_at: string | null;
  status: string;
};

export type IncidentRow = {
  id: string;
  type: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  is_anonymous: boolean;
  created_at: string;
};

export async function getActiveAlerts(): Promise<AlertRow[]> {
  const { data, error } = await supabase.rpc('get_active_alerts');
  if (error) throw error;
  return (data ?? []) as AlertRow[];
}

export async function resolveSos(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_sos', { p_event_id: eventId });
  if (error) throw error;
}

export async function setIncidentStatus(incidentId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_incident_status', {
    p_incident_id: incidentId,
    p_status: status,
  });
  if (error) throw error;
}

export async function listIncidents(limit = 100): Promise<IncidentRow[]> {
  const { data, error } = await supabase.rpc('list_incidents', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

export async function isCampusSecurity(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return false;
  const { data } = await supabase.from('users').select('role').eq('id', uid).maybeSingle();
  return data?.role === 'campus_security';
}
