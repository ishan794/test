import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  const payload = await req.json();
  const sos = payload?.record as {
    id: string;
    user_id: string;
    lat: number | null;
    lng: number | null;
  } | null;
  if (!sos?.user_id) {
    return new Response(JSON.stringify({ error: 'no record' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const { data: user } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', sos.user_id)
    .single();

  const { data: contacts } = await supabase
    .from('trusted_contacts')
    .select('id, linked_uid, phone')
    .eq('user_id', sos.user_id);

  const contactIds = (contacts ?? []).map((c) => c.id);

  const tokens: string[] = [];
  const linkedUids = (contacts ?? []).map((c) => c.linked_uid).filter((id): id is string => !!id);
  const phones = (contacts ?? []).map((c) => c.phone).filter((p): p is string => !!p);

  if (linkedUids.length) {
    const { data: linkedUsers } = await supabase.from('users').select('push_token').in('id', linkedUids);
    for (const u of linkedUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }
  if (phones.length) {
    const { data: phoneUsers } = await supabase.from('users').select('push_token').in('phone', phones);
    for (const u of phoneUsers ?? []) if (u.push_token) tokens.push(u.push_token);
  }

  if (tokens.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        [...new Set(tokens)].map((to) => ({
          to,
          title: `🚨 SOS ALERT from ${user?.full_name ?? 'a student'}`,
          body: 'Tap to see their live location immediately.',
          data: {
            type: 'sos',
            eventId: sos.id,
            userId: sos.user_id,
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

  await supabase
    .from('sos_events')
    .update({ notified_contact_ids: contactIds })
    .eq('id', sos.id);

  return new Response(JSON.stringify({ notified: contactIds.length }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
});