import {
  adminClient,
  corsHeaders,
  json,
  requireWebhookSecret,
  WebhookUnauthorizedError,
} from '../_shared/auth.ts';

// Called by the pg_net trigger on INSERT into incidents (server-to-server).
// Verifies the shared webhook secret, then delegates the actual work to the
// public.moderate_incident() RPC which runs in a single database transaction:
//   - idempotent (dedup table keyed on the incident id, so pg_net retries are
//     no-ops),
//   - actual content moderation (empty/spam/abuse detection),
//   - geospatial rollup into risk_zones using an earthdistance index.
// Clients only ever read risk_zones — never raw incident pins.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    requireWebhookSecret(req);
  } catch (err) {
    if (err instanceof WebhookUnauthorizedError) return json({ error: 'Unauthorized' }, 401);
    return json({ error: (err as Error).message }, 500);
  }

  const supabase = adminClient();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const incident = (payload as { record?: { id?: string } } | null)?.record;
  if (!incident?.id) {
    return json({ error: 'no record' }, 400);
  }

  const { data, error } = await supabase.rpc('moderate_incident', { p_incident_id: incident.id });
  if (error) {
    console.error('moderate_incident failed', error);
    return json({ error: error.message }, 500);
  }

  return json({ result: data });
});
