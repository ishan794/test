import supabase from '../config/supabase';

export async function startJourney(
  destinationName: string,
  destinationLocation: { lat: number; lng: number },
  startLocation: { lat: number; lng: number },
  etaMinutes: number,
  safetyTimerMinutes: number,
  sharedWithContactIds: string[],
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const autoSosAt = new Date(Date.now() + safetyTimerMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('journeys')
    .insert({
      user_id: uid,
      status: 'active',
      destination_name: destinationName,
      destination_lat: destinationLocation.lat,
      destination_lng: destinationLocation.lng,
      start_lat: startLocation.lat,
      start_lng: startLocation.lng,
      started_at: new Date().toISOString(),
      eta_minutes: etaMinutes,
      auto_sos_at: autoSosAt,
      shared_with_contact_ids: sharedWithContactIds,
      last_ping_lat: startLocation.lat,
      last_ping_lng: startLocation.lng,
      last_ping_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;

  return data.id;
}

export async function endJourney(journeyId: string) {
  const { error } = await supabase
    .from('journeys')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', journeyId);
  if (error) throw error;
}

// Called repeatedly (e.g. every 15-30s) while a journey is active. Writes a
// breadcrumb to journey_pings (the location history) AND updates the
// journeys row's last_ping_* fields (what viewers see live via realtime).
export async function recordJourneyPing(journeyId: string, lat: number, lng: number, speed: number | null) {
  const { error: pingError } = await supabase.from('journey_pings').insert({
    journey_id: journeyId,
    lat,
    lng,
    speed: speed ?? null,
  });
  if (pingError) throw pingError;

  const { error: journeyError } = await supabase
    .from('journeys')
    .update({ last_ping_lat: lat, last_ping_lng: lng, last_ping_at: new Date().toISOString() })
    .eq('id', journeyId);
  if (journeyError) throw journeyError;
}

// My own trusted contacts, for the picker shown when starting a journey.
export async function getMyTrustedContacts() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trusted_contacts')
    .select('id, name, relationship, linked_uid')
    .eq('user_id', uid)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Active journeys where I am the linked in-app trusted contact — i.e.
// someone else added me and is currently sharing a Walk With Me with me.
export async function getJourneysSharedWithMe() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const { data: myContactRows, error: contactError } = await supabase
    .from('trusted_contacts')
    .select('id, user_id')
    .eq('linked_uid', uid);
  if (contactError) throw contactError;
  if (!myContactRows || myContactRows.length === 0) return [];

  const myContactIds = myContactRows.map((r) => r.id);

  const { data: journeys, error: journeyError } = await supabase
    .from('journeys')
    .select('id, user_id, destination_name, status, started_at, last_ping_lat, last_ping_lng, last_ping_at, shared_with_contact_ids')
    .eq('status', 'active')
    .overlaps('shared_with_contact_ids', myContactIds);
  if (journeyError) throw journeyError;

  const ownerIds = [...new Set((journeys ?? []).map((j) => j.user_id))];
  const { data: owners } = ownerIds.length
    ? await supabase.from('users').select('id, full_name').in('id', ownerIds)
    : { data: [] as { id: string; full_name: string }[] };

  return (journeys ?? []).map((j) => ({
    ...j,
    ownerName: owners?.find((o) => o.id === j.user_id)?.full_name ?? 'Someone',
  }));
}