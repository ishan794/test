import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes without a heartbeat

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  const recipients = tokens.filter(Boolean);
  if (!recipients.length) return;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      recipients.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' })),
    ),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Expo push send failed', res.status, errText);
  }
}

async function resolveContactTokens(contacts: { linked_uid: string | null; phone: string | null }[]): Promise<string[]> {
  const tokens: string[] = [];
  const linkedUids = contacts.map((c) => c.linked_uid).filter((id): id is string => !!id);
  const phones = contacts.map((c) => c.phone).filter((p): p is string => !!p);

  if (linkedUids.length) {
    const { data: linkedUsers } = await supabase
      .from('users')
      .select('push_token')
      .in('id', linkedUids);
    for (const u of linkedUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }

  if (phones.length) {
    const { data: phoneUsers } = await supabase
      .from('users')
      .select('push_token')
      .in('phone', phones);
    for (const u of phoneUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }

  return [...new Set(tokens)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  const now = Date.now();
  const cutoff = new Date(now - OFFLINE_THRESHOLD_MS).toISOString();
  let processed = 0;

  const { data: activeJourneys, error: journeyError } = await supabase
    .from('journeys')
    .select('id, user_id, auto_sos_at, status')
    .eq('status', 'active');
  if (journeyError) {
    console.error('Failed to fetch active journeys', journeyError);
    return new Response(JSON.stringify({ error: journeyError.message, processed }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  for (const journey of activeJourneys ?? []) {
    const { data: user } = await supabase
      .from('users')
      .select('id, full_name, current_status, last_active_at, last_known_lat, last_known_lng')
      .eq('id', journey.user_id)
      .single();

    if (user?.last_active_at) {
      const lastActiveMs = new Date(user.last_active_at).getTime();

      if (
        now - lastActiveMs > OFFLINE_THRESHOLD_MS &&
        user.current_status !== 'offline-suspected'
      ) {
        await supabase.from('users').update({ current_status: 'offline-suspected' }).eq('id', user.id);

        const { data: contacts } = await supabase
          .from('trusted_contacts')
          .select('linked_uid, phone')
          .eq('user_id', journey.user_id)
          .eq('auto_share', true);

        const tokens = await resolveContactTokens(contacts ?? []);
        if (tokens.length) {
          await sendExpoPush(
            tokens,
            `${user.full_name} may need help`,
            `Last seen ${Math.round((now - lastActiveMs) / 60000)} min ago near their journey route.`,
            {
              type: 'offline-alert',
              userId: user.id,
              lat: String(user.last_known_lat ?? ''),
              lng: String(user.last_known_lng ?? ''),
            },
          );
        }
      }
    }

    // Auto-SOS if the safety timer expired
    if (journey.auto_sos_at && now > new Date(journey.auto_sos_at).getTime() && journey.status === 'active') {
      await supabase.from('journeys').update({ status: 'auto-sos-triggered' }).eq('id', journey.id);
      await supabase.from('sos_events').insert({
        user_id: journey.user_id,
        triggered_at: new Date().toISOString(),
        lat: user?.last_known_lat ?? null,
        lng: user?.last_known_lng ?? null,
        status: 'active',
        notified_contact_ids: [],
        source: 'auto-safety-timer',
      });
    }

    processed += 1;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
});