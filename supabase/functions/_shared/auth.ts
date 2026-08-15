import { createClient } from 'npm:@supabase/supabase-js';

/**
 * Shared auth / CORS helpers for the SafeYou-Campus Edge Functions.
 *
 * Two distinct callers are supported and they authenticate differently:
 *   1. Server-to-server callers (pg_net database webhooks and the pg_cron
 *      scheduler) authenticate with a shared secret held in Vault on the
 *      Postgres side and as WEBHOOK_SECRET on the function side. They are
 *      verified with requireWebhookSecret() and NEVER with the anon key.
 *   2. End-user callers authenticate with their Supabase JWT and are verified
 *      with supabase.auth.getUser(token) — see account-deletion/index.ts.
 *
 * Every function must fail CLOSED: a missing secret/key is an error, never a
 * silent fallback to the public anon key.
 */

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

export class WebhookUnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'WebhookUnauthorizedError';
  }
}

export function getSupabaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL is not configured');
  return url;
}

/**
 * Fail closed: never fall back SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY.
 * The anon key is public and must not be used to perform privileged work.
 */
export function getServiceRoleKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return key;
}

/** Admin client for internal, service-role work (bypasses RLS). */
export function adminClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Verify a server-to-server webhook/cron call. Throws WebhookUnauthorizedError
 * when the secret is missing (fail closed) or does not match (constant time).
 */
export function requireWebhookSecret(req: Request): void {
  const expected = Deno.env.get('WEBHOOK_SECRET');
  if (!expected) {
    throw new Error('WEBHOOK_SECRET is not configured — refusing to run');
  }
  const provided = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!timingSafeEqual(provided, expected)) {
    throw new WebhookUnauthorizedError();
  }
}
