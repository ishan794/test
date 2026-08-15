# SafeYou-Campus — Setup Instructions

This is a real, working project — **no mock data anywhere**. Every screen reads/writes a real
Supabase Postgres database, real Supabase Auth sessions, and real Supabase Storage buckets.

**Stack:** Expo (React Native) frontend + Supabase (Postgres, Auth, Storage, Realtime, Edge
Functions) backend. There is no separate Node/Firebase backend to run — Supabase *is* the backend.

> For the complete, screen-by-screen architecture, data model, RLS, and Edge Function reference,
> see **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)**.

---

## Full File Structure

```
safeyou-campus/                     ← open this whole folder in VS Code
├── App.tsx                         # frontend entry point
├── app.json                        # Expo config (permissions, icons, splash)
├── eas.json                        # EAS Build profiles (needed for background location)
├── babel.config.js                 # loads .env via react-native-dotenv as `@env`
├── tsconfig.json
├── package.json                    # frontend dependencies
├── .env                            # your real Supabase URL + anon key (never commit this)
├── .env.example                    # template — copy to .env
├── .gitignore
│
├── assets/                         # icon.png, adaptive-icon.png, logo.png
│
├── src/
│   ├── config/
│   │   └── supabase.ts             # Supabase client init (reads .env)
│   │
│   ├── theme/                      # design system
│   │   ├── colors.ts               # palette + status colors (safe/sos/offline)
│   │   ├── spacing.ts              # spacing/radius/shadow scales
│   │   ├── typography.ts           # type scale
│   │   └── index.ts                # barrel export
│   │
│   ├── types/                      # user.ts, contact.ts, journey.ts, incident.ts, env.d.ts
│   │
│   ├── services/                   # ALL real Supabase calls, no mocks
│   │   ├── authService.ts          # signUp / login / logout
│   │   ├── contactService.ts       # add / remove / toggle trusted contacts
│   │   ├── journeyService.ts       # start / end Walk-With-Me journeys
│   │   ├── geocodingService.ts     # destination → coordinates + walking ETA
│   │   ├── locationService.ts      # 60s background location heartbeat
│   │   ├── incidentService.ts      # submit incident + upload photo evidence
│   │   ├── sosService.ts           # trigger / resolve SOS
│   │   ├── adminService.ts         # campus-security console data layer
│   │   └── notificationService.ts  # register Expo push token
│   │
│   ├── store/                      # useAuthStore.ts, useAppStore.ts (Zustand)
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx       # splash → auth → onboarding → main tabs
│   │   ├── AuthNavigator.tsx       # Login, Register
│   │   ├── MainTabNavigator.tsx    # 5 tabs: Dashboard, Walk, Report, Map, Settings
│   │   └── SettingsNavigator.tsx   # nested stack: account, contacts, privacy, reports
│   │
│   ├── screens/
│   │   ├── splash/SplashScreen.tsx
│   │   ├── auth/                   # LoginScreen, RegisterScreen, OnboardingScreen
│   │   ├── dashboard/SOSDashboardScreen.tsx
│   │   ├── tracking/WalkWithMeScreen.tsx
│   │   ├── reporting/              # ReportIncidentScreen, MyReportsScreen
│   │   ├── admin/CampusSecurityScreen.tsx   # security console (role-gated)
│   │   ├── map/CampusHeatmapScreen.tsx
│   │   └── settings/               # SettingsHomeScreen, MyAccountScreen,
│   │                                #   TrustedContactsScreen, PrivacySecurityScreen
│   │
│   ├── components/
│   │   ├── ui/                     # Button, Input, Card, ScreenHeader, EmptyState, Chip
│   │   ├── SOSButton.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ContactCard.tsx
│   │   └── QuickActionGrid.tsx
│   │
│   └── utils/                      # distance.ts, validators.ts
│
└── supabase/                       # BACKEND — this is the real backend
    ├── migrations/
    │   ├── 0001_init.sql           # tables + trusted-graph RLS + webhook triggers
    │   ├── 0002_cron.sql           # schedules offline-detection every 2 minutes
    │   ├── 0003_security_functions.sql  # trigger_sos/resolve_sos RPCs, moderation, rate limits
    │   ├── 0004_admin_functions.sql     # campus-security console RPCs (alerts, review)
    │   └── 0005_auth_trigger.sql        # auto-provision users row on signup
    │
    └── functions/                  # Deno Edge Functions
        ├── _shared/auth.ts         # shared auth guards (webhook secret, fail-closed keys)
        ├── sos-fanout/             # fires on new sos_events row → notifies contacts + security
        ├── offline-detection/      # cron: flags users who've gone silent (with recovery)
        ├── incident-moderation/    # moderate + roll incidents into risk_zones for the heatmap
        └── account-deletion/       # cascade-deletes a user's real data on request
```

---

## Prerequisites

Install these once, in order:

1. **Node.js ≥ 20.19.4** — [nodejs.org](https://nodejs.org)
2. **VS Code** with the extensions: `ES7+ React/Redux/React-Native snippets`, `Prettier`
3. **Expo Go** app on your phone (App Store / Play Store) — for scanning the QR code
4. **Supabase CLI**:
   ```bash
   npm install -g supabase
   ```
5. A free **Supabase account** at [supabase.com](https://supabase.com) → **New Project**
   (pick a region close to your users, e.g. Southeast Asia for Sri Lanka)

---

## Step 1 — Create your Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project** → name it
   `safeyou-campus`, set a database password (save it), pick a region → **Create**.
2. Wait ~2 minutes for provisioning.
3. **Project Settings → API** → copy:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon / public key**
4. **Authentication → Providers** → confirm **Email** is enabled (it is by default).
5. **Authentication → Email Templates** → optional: disable "Confirm email" while testing
   (**Authentication → Settings → Email Auth → toggle off "Confirm email"**) so you don't need
   a working mail server to test signup immediately. Turn it back on before going live.

## Step 2 — Push the database schema

```bash
cd safeyou-campus
supabase login
supabase link --project-ref <your-project-ref>   # the xxxxxxxx from your Project URL
supabase db push                                  # runs 0001–0004 migrations
```

This creates every table (`users`, `trusted_contacts`, `journeys`, `journey_pings`,
`sos_events`, `incidents`, `risk_zones`) with Row Level Security enabled and a trusted-graph
model: a user can read only their own profile and the minimal (`safe_users`) projection of
people in their mutual trusted-contact graph. `push_token`, `phone`, `email` and live location
are never exposed across users, and only the service role can read `push_token`.

To start over from a clean slate (destroys data):

```bash
supabase db reset
```

> `0002_cron.sql` schedules the offline-detection function via `pg_cron`/`pg_net`. If your
> project doesn't have the `pg_cron` extension available on your plan, you can skip that file
> and instead trigger `offline-detection` manually or via an external scheduler (e.g. GitHub
> Actions cron hitting the function URL every 2 minutes).

## Step 3 — Create the storage bucket for incident evidence

**Dashboard → Storage → New bucket** → name it exactly `incident-evidence` → set to **Public**
(so `getPublicUrl()` in `incidentService.ts` works) → Create.

## Step 4 — Deploy the Edge Functions and set the webhook secret

```bash
supabase functions deploy sos-fanout
supabase functions deploy offline-detection
supabase functions deploy incident-moderation
supabase functions deploy account-deletion
```

The `sos-fanout`, `offline-detection` and `incident-moderation` functions are **server-to-server
only**. They are invoked by the database triggers / cron scheduler defined in the migrations
(no dashboard webhook to wire) and authenticate with a shared secret — never the public anon
key. Configure that secret on both sides so they match:

1. In the Supabase dashboard, open **Database → Vault → Secrets** and create two secrets:
   - `safeyou-functions-url` → your function host, e.g. `https://<project-ref>.supabase.co`
   - `safeyou-webhook-secret` → a long random string (e.g. `openssl rand -hex 32`)
2. Set the same random string as a function secret:
   ```bash
   supabase secrets set WEBHOOK_SECRET=<the same random string>
   ```

The functions **fail closed**: if `WEBHOOK_SECRET` (or `SUPABASE_SERVICE_ROLE_KEY`) is missing,
they refuse to run rather than falling back to the anon key. `account-deletion` is called by the
logged-in app and instead verifies the caller's JWT via `auth.getUser()`.

> **Campus security.** Promote staff accounts to the security console by setting
> `role = 'campus_security'` on their `users` row (Table Editor → users). SOS fan-out notifies
> these users' push tokens, and their role can read `incidents`, `sos_events`, `journeys` and
> `safe_users` for review. On the app, a "Campus Security" entry appears under **Settings** for
> these accounts, opening a console with a live alert feed (active SOS + offline-suspected users)
> and incident review. The console's actions (`admin_resolve_sos`, `admin_set_incident_status`,
> etc. in `0004_admin_functions.sql`) reject any caller who is not campus security.

## Step 5 — Configure the frontend

```bash
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
# optional — override the destination geocoder (defaults to OpenStreetMap Nominatim)
# EXPO_PUBLIC_GEOCODING_ENDPOINT=https://your-geocoder.example/search
```

> **Important:** `SUPABASE_URL` must be the bare project URL — no `/rest/v1` or any path
> appended. The Supabase client appends the right path internally for auth, rest, realtime,
> and storage.

## Step 6 — Install and run

```bash
npm install
npx expo install --fix     # aligns every expo-* package to your installed Expo SDK
npx expo start
```

Scan the QR code with **Expo Go** on a real phone — not a simulator, since background
location and push notifications need real hardware.

This project targets **Expo SDK 54** (React Native 0.81, React 19.1, New Architecture on).
If you ever bump the `expo` version in `package.json`, run `npx expo install --fix` afterward
instead of hand-editing individual `expo-*` versions.

---

## Verify the full flow end-to-end

1. **Register** a real account → Onboarding appears once → finish it → land on Dashboard.
2. Force-close and reopen the app → should skip straight to Dashboard (session persists via
   AsyncStorage).
3. **Supabase Dashboard → Table Editor → users** → confirm your row exists and
   `last_active_at` updates roughly every 60 seconds while the app is open (background
   location heartbeat).
4. **Settings → Trusted Contacts** → add a contact → confirm the row appears instantly in
   **Table Editor → trusted_contacts** (Realtime subscription working both ways).
5. Hold the SOS button for 3 seconds → confirm a row appears in **sos_events**, `users.current_status`
   flips to `sos`, and (with the Step 4 secret configured) the `sos-fanout` function logs a run
   under **Edge Functions → sos-fanout → Logs**.
6. **Report an incident** → confirm the row appears in **incidents** and, if you added a photo,
   the file appears in **Storage → incident-evidence**.

---

## Notes on what changed in this update

- **Walk With Me uses real destinations:** the destination is geocoded (OpenStreetMap
  Nominatim by default, override with `EXPO_PUBLIC_GEOCODING_ENDPOINT`) and the ETA is computed
  from walking distance instead of the previous fabricated `loc + 0.01°` offset and hardcoded
  12/15-minute values.
- **Campus security console:** a role-gated "Campus Security" screen (live SOS/offline alerts +
  incident review) backed by `0004_admin_functions.sql`, shown only to `campus_security` users.
- **Security hardening:** replaced the blanket `using (true)` RLS policies with a
  trusted-graph model (owner-only `users`, a `safe_users` projection for cross-user reads,
  owner-scoped writes, and a server-side incident rate limit). Edge Functions now verify a
  shared webhook secret (server-to-server) or the caller JWT (`account-deletion`), fail closed
  when keys/secrets are missing, and never fall back to the anon key. SOS is created/resolved
  atomically through `trigger_sos`/`resolve_sos` RPCs with a 30s cooldown. `pg_net` is no
  longer usable by anon/authenticated.
- Added a full design system (`src/theme/`) and reusable UI primitives
  (`src/components/ui/`) — every screen was restyled on top of it. No backend logic changed.
- Added `SettingsNavigator.tsx` + `SettingsHomeScreen.tsx`: the Trusted Contacts, My Account,
  Privacy & Security, and My Reports screens existed in the codebase but weren't reachable
  from any navigator before. They're now a proper "Settings" tab.
- Fixed `.env`: `SUPABASE_URL` previously had `/rest/v1/` appended, which would have broken
  Supabase Auth and Realtime (they use different base paths than REST).
- Removed `backend/` (the old Firebase Cloud Functions implementation). It was fully
  superseded by `supabase/functions/` and left in the repo would only cause confusion — it
  required separate Firebase credentials this project no longer uses.
- The whole `src/` tree passes `npx tsc --noEmit` with zero errors.
