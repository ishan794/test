import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const ZONE_RADIUS_METERS = 150;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// On every real incident report, roll it into a nearby risk_zone (or create a
// new one). Clients only ever read risk_zones — never raw incident pins — so
// anonymous reporters stay anonymous on the heatmap.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  const payload = await req.json();
  const incident = payload?.record as {
    id: string;
    lat: number | null;
    lng: number | null;
  } | null;
  if (!incident || incident.lat == null || incident.lng == null) {
    return new Response(JSON.stringify({ error: 'no location' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const { data: zones } = await supabase.from('risk_zones').select('*');
  let matchedZoneId: string | null = null;

  for (const zone of zones ?? []) {
    if (distanceMeters({ lat: incident.lat, lng: incident.lng }, { lat: zone.center_lat, lng: zone.center_lng }) < ZONE_RADIUS_METERS) {
      matchedZoneId = zone.id;
      break;
    }
  }

  if (matchedZoneId) {
    const { data: zone } = await supabase.from('risk_zones').select('incident_count').eq('id', matchedZoneId).single();
    const newCount = (zone?.incident_count ?? 0) + 1;
    await supabase
      .from('risk_zones')
      .update({ incident_count: newCount, risk_score: Math.min(100, newCount * 12), updated_at: new Date().toISOString() })
      .eq('id', matchedZoneId);
  } else {
    await supabase.from('risk_zones').insert({
      center_lat: incident.lat,
      center_lng: incident.lng,
      radius_meters: ZONE_RADIUS_METERS,
      incident_count: 1,
      risk_score: 12,
      updated_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ matchedZoneId }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
});