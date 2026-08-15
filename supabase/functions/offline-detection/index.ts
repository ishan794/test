import {
  adminClient,
  corsHeaders,
  json,
  requireWebhookSecret,
  WebhookUnauthorizedError,
} from '../_shared/auth.ts';

const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes without a heartbeat

// Scheduled by pg_cron (every 2 minutes) via pg_net. Server-to-server: verifies
// the shared webhook secret before doing anything.

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  const recipients = [...new Set(tokens.filter(Boolean))];
  if (!recipients.length) return;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      recipients.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' })),
    ),
  });
  if (!res.ok) console.error('Expo push send failed', res.status, await res.text());
}

async function resolveContactTokens(
  supabase: ReturnType<typeof adminClient>,
  contacts: { linked_uid: string | null; phone: string | null }[],
): Promise<string[]> {
  const tokens: string[] = [];
  const linkedUids = contacts.map((c) => c.linked_uid).filter((id): id is string => !!id);
  const phones = contacts.map((c) => c.phone).filter((p): p is string => !!p);

  if (linkedUids.length) {
    const { data: linkedUsers } = await supabase.from('users').select('push_token').in('id', linkedUids);
    for (const u of linkedUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }
  if (phones.length) {
    const { data: phoneUsers } = await supabase.from('users').select('push_token').in('phone', phones);
    for (const u of phoneUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }
  return tokens;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    requireWebhookSecret(req);
  } catch (err) {
    if (err instanceof WebhookUnauthorizedError) return json({ error: 'Unauthorized' }, 401);
    return json({ error: (err as Error).message }, 500);
  }

  const supabase = adminClient();
  const now = Date.now();
  const cutoff = new Date(now - OFFLINE_THRESHOLD_MS).toISOString();

  // Recovery: a fresh heartbeat means the user is fine. Clear any stale
  // offline-suspected flag in one batched update (previously this never
  // happened, leaving users flagged forever).
  const { error: recoveryError } = await supabase
    .from('users')
    .update({ current_status: 'safe' })
    .eq('current_status', 'offline-suspected')
    .gt('last_active_at', cutoff);
  if (recoveryError) console.error('Recovery update failed', recoveryError);

  // Two batched queries instead of 1-query-per-journey: fetch active journeys,
  // then fetch all their owners in a single .in().
  const { data: journeys, error: journeyError } = await supabase
    .from('journeys')
    .select('id, user_id, auto_sos_at, status')
    .eq('status', 'active');
  if (journeyError) {
    console.error('Failed to fetch active journeys', journeyError);
    return json({ error: journeyError.message }, 500);
  }

  const userIds = [...new Set((journeys ?? []).map((j) => j.user_id))];
  const { data: userRows } = userIds.length
    ? await supabase
        .from('users')
        .select('id, full_name, current_status, last_active_at, last_known_lat, last_known_lng')
        .in('id', userIds)
    : { data: [] as {
        id: string;
        full_name: string;
        current_status: string;
        last_active_at: string | null;
        last_known_lat: number | null;
        last_known_lng: number | null;
      }[] };

  const usersById = new Map((userRows ?? []).map((u) => [u.id, u]));

  let processed = 0;
  let flagged = 0;

  for (const journey of journeys ?? []) {
    const user = usersById.get(journey.user_id);

    if (!user?.id) continue;

    if (user.last_active_at) {
      const lastActiveMs = new Date(user.last_active_at).getTime();

      if (now - lastActiveMs > OFFLINE_THRESHOLD_MS && user.current_status !== 'offline-suspected') {
        await supabase.from('users').update({ current_status: 'offline-suspected' }).eq('id', user.id);

        const { data: contacts } = await supabase
          .from('trusted_contacts')
          .select('linked_uid, phone')
          .eq('user_id', user.id)
          .eq('auto_share', true);

        const tokens = await resolveContactTokens(supabase, contacts ?? []);
        if (tokens.length) {
          await sendExpoPush(
            tokens,
            `${user.full_name || 'A contact'} may need help`,
            `Last seen ${Math.round((now - lastActiveMs) / 60000)} min ago near their journey route.`,
            {
              type: 'offline-alert',
              userId: user.id,
              lat: String(user.last_known_lat ?? ''),
              lng: String(user.last_known_lng ?? ''),
            },
          );
        }
        flagged += 1;
      }
    }

    // Auto-SOS if the safety timer expired. Deduplicated by the partial unique
    // index (one active sos_events row per user).
    if (journey.auto_sos_at && now > new Date(journey.auto_sos_at).getTime() && journey.status === 'active') {
      await supabase.from('journeys').update({ status: 'auto-sos-triggered' }).eq('id', journey.id);
      const { error: sosError } = await supabase.from('sos_events').insert(
        {
          user_id: user.id,
          triggered_at: new Date().toISOString(),
          lat: user.last_known_lat ?? null,
          lng: user.last_known_lng ?? null,
          status: 'active',
          notified_contact_ids: [],
          source: 'auto-safety-timer',
        },
        { ignoreDuplicates: true },
      );
      if (sosError) console.error('Auto-SOS insert failed', sosError);
    }

    processed += 1;
  }

  return json({ processed, flagged });
});
