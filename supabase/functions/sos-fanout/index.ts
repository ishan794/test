import {
  adminClient,
  corsHeaders,
  json,
  requireWebhookSecret,
  WebhookUnauthorizedError,
} from '../_shared/auth.ts';

// Called by the pg_net trigger on INSERT into sos_events (server-to-server).
// Verifies the shared webhook secret, then fans the alert out to the user's
// trusted contacts AND system contacts (campus security) via Expo push.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    requireWebhookSecret(req);
  } catch (err) {
    if (err instanceof WebhookUnauthorizedError) return json({ error: 'Unauthorized' }, 401);
    return json({ error: (err as Error).message }, 500);
  }

  // Fail closed: adminClient() throws if the service-role key is missing.
  const supabase = adminClient();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const sos = (payload as {
    record?: {
      id?: string;
      user_id?: string;
      lat?: number | null;
      lng?: number | null;
      incident_type?: string;
      triggered_at?: string;
    } | null;
  } | null)?.record;
  if (!sos?.id || !sos.user_id) {
    return json({ error: 'no record' }, 400);
  }

  // Idempotency guard: pg_net may retry. If we already notified for this event,
  // do not blast contacts again.
  const { data: existing } = await supabase
    .from('sos_events')
    .select('notified_contact_ids')
    .eq('id', sos.id)
    .single();
  const alreadyNotified = Array.isArray(existing?.notified_contact_ids) && existing.notified_contact_ids.length > 0;
  if (alreadyNotified) {
    return json({ notified: 0, skipped: 'already-notified' });
  }

  const { data: user } = await supabase
    .from('users')
    .select('full_name, phone, student_id, university')
    .eq('id', sos.user_id)
    .single();

  const { data: contacts } = await supabase
    .from('trusted_contacts')
    .select('id, linked_uid, phone')
    .eq('user_id', sos.user_id);

  const contactIds = (contacts ?? []).map((c) => c.id);
  const linkedUids = (contacts ?? []).map((c) => c.linked_uid).filter((id): id is string => !!id);
  const phones = (contacts ?? []).map((c) => c.phone).filter((p): p is string => !!p);

  const tokens: string[] = [];

  if (linkedUids.length) {
    const { data: linkedUsers } = await supabase.from('users').select('push_token').in('id', linkedUids);
    for (const u of linkedUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }
  if (phones.length) {
    const { data: phoneUsers } = await supabase.from('users').select('push_token').in('phone', phones);
    for (const u of phoneUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }

  // Fan out to campus security staff (users with the campus_security role) so
  // the "campus security has been notified" promise is actually honoured.
  const { data: securityUsers } = await supabase
    .from('users')
    .select('push_token')
    .eq('role', 'campus_security');
  for (const u of securityUsers ?? []) if (u.push_token) tokens.push(u.push_token);

  const deduped = [...new Set(tokens.filter(Boolean))];
  const incidentType = sos.incident_type ?? 'emergency';
  const triggeredAt = sos.triggered_at ? new Date(sos.triggered_at).toLocaleString() : 'now';

  if (deduped.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        deduped.map((to) => ({
          to,
          title: `🚨 SOS ALERT from ${user?.full_name ?? 'a student'}`,
          body: `${incidentType} at ${triggeredAt}. Tap to see their live location.`,
          data: {
            type: 'sos',
            eventId: sos.id,
            userId: sos.user_id,
            incidentType,
            triggeredAt: sos.triggered_at ?? '',
            fullName: user?.full_name ?? '',
            phone: user?.phone ?? '',
            studentId: user?.student_id ?? '',
            lat: String(sos.lat ?? ''),
            lng: String(sos.lng ?? ''),
          },
          sound: 'default',
          priority: 'high',
        })),
      ),
    });
    if (!res.ok) console.error('Expo push send failed', res.status, await res.text());
  }

  await supabase.from('sos_events').update({ notified_contact_ids: contactIds }).eq('id', sos.id);

  return json({ notified: deduped.length });
});
