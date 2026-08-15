import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Client-side deletes alone leave orphaned rows and storage files — this
// cascades a full, real account wipe, called from "Delete Account & Data"
// via supabase.functions.invoke('account-deletion').
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Must be signed in.' }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
  const uid = user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  await admin.from('trusted_contacts').delete().eq('user_id', uid);

  const { data: journeys } = await admin.from('journeys').select('id').eq('user_id', uid);
  for (const journey of journeys ?? []) {
    await admin.from('journey_pings').delete().eq('journey_id', journey.id);
  }
  await admin.from('journeys').delete().eq('user_id', uid);

  await admin.from('sos_events').delete().eq('user_id', uid);

  // Anonymous reports cannot be attributed to the user — leave them intact.
  await admin.from('incidents').delete().eq('reporter_id', uid);

  // profile-photos/{uid}/ (kept 1:1 with the original Cloud Function)
  const { data: photos } = await admin.storage.from('profile-photos').list(uid);
  const photoPaths = (photos ?? []).map((p) => `${uid}/${p.name}`);
  if (photoPaths.length) {
    await admin.storage.from('profile-photos').remove(photoPaths);
  }

  await admin.from('users').delete().eq('id', uid);
  await admin.auth.admin.deleteUser(uid);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
});