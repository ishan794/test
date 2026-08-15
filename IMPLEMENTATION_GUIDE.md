# SafeYou-Campus — Full Implementation Guide (Supabase)

**Expo (React Native) + TypeScript + Supabase (Postgres · Auth · Storage · Realtime · Edge Functions). Real data, no mocks.**

This guide takes you from an empty folder to a working app with every screen: Splash,
Registration, Persistent Login (Facebook-style — sign in once), Onboarding, SOS Dashboard,
Walk With Me (journey tracking), Campus Risk Heatmap, Report an Incident, Privacy & Security,
Trusted Contacts, My Account, My Reports, and a role-gated Campus Security console.

Everything reads/writes a **real Supabase project** — real Postgres rows, real Auth sessions,
real Storage objects, real Realtime subscriptions, real Edge Functions. There is no mock/test
data layer, and **there is no Firebase anywhere** in this project. Supabase *is* the backend;
the frontend talks only to Supabase.

---

## 1. Architecture Overview

```
┌─────────────────────────────┐
│   Expo App (TypeScript)     │
│  - Screens (Dashboard, etc) │
│  - Location background task │
│  - Zustand state            │
└──────────────┬──────────────┘
               │
      @supabase/supabase-js (REST + Realtime)
               │
┌──────────────▼──────────────────────────────┐
│               Supabase                       │
│  - Postgres + RLS (users, journeys, …)      │
│  - Auth (students login, persistent session)│
│  - Storage (incident evidence, profile)     │
│  - Realtime (live status / heatmap)         │
│  - Edge Functions (offline, SOS fanout, …)  │
│  - pg_cron + pg_net (scheduler + webhooks)  │
│  - Expo push (via Edge Functions)           │
└──────────────────────────────────────────────┘
```

**Key real-time flows**

- **Location heartbeat** — the app writes `users.last_known_lat/lng` + `last_active_at` every
  60s from a background task (`src/services/locationService.ts`).
- **Offline detection** — `pg_cron` calls the `offline-detection` Edge Function every 2 minutes;
  it flags users who went silent on an active journey and notifies their trusted contacts.
- **SOS** — the app calls the `trigger_sos` RPC (atomic insert + status update + cooldown);
  a Postgres trigger fires `sos-fanout`, which pushes to trusted contacts **and campus security**.
- **Incidents → heatmap** — an incident insert triggers `incident-moderation`, which moderates
  the report and rolls it into `risk_zones` (aggregated — raw pins are never exposed).

---

## 2. Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| Node.js ≥ 20.19.4 | JS runtime (Expo SDK 54 minimum) | https://nodejs.org |
| VS Code | Editor | https://code.visualstudio.com |
| Git | Version control | https://git-scm.com |
| Expo CLI | Run/build app | via `npx` (no global install) |
| Supabase CLI | Push schema + deploy functions | `npm install -g supabase` |
| Expo Go | Test on your phone | App Store / Play Store |
| A Supabase account | For the hosted backend | https://supabase.com |

You do **not** need Android Studio / Xcode to start — Expo Go on a real phone is enough for
development. You only need EAS Build later for background-location on iOS and store release.

---

## 3. Create the Supabase Project (Real, Live Project)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project** → name it
   `safeyou-campus`, set a DB password (save it), pick a region near your users → **Create**.
2. Wait ~2 minutes for provisioning.
3. **Project Settings → API** → copy **Project URL** and **anon / public key**.
4. **Authentication → Providers** → confirm **Email** is enabled.
5. **Authentication → Settings → Email Auth** → optionally toggle off **"Confirm email"** while
   testing so you don't need a working mail server; turn it back on before going live.
6. **Database → Extensions** → confirm/enable `pg_cron` (needed by the offline-detection
   schedule) and `pg_net` (webhooks). The migrations also enable `pgcrypto`, `cube`,
   and `earthdistance` themselves.

---

## 4. Expo Project (already scaffolded in this repo)

The app targets **Expo SDK 54** (React Native 0.81, React 19.1, New Architecture on). Confirm it
runs:

```bash
npm install
npx expo install --fix     # aligns every expo-* package to SDK 54
npx expo start
```

Scan the QR with Expo Go. See `package.json` for the full dependency list — key packages:
`@supabase/supabase-js`, `@react-navigation/*` v7, `expo-location`, `expo-task-manager`,
`expo-background-task`, `expo-notifications`, `expo-image-picker`, `expo-audio`,
`react-native-maps`, `zustand`, `react-hook-form`, `@react-native-async-storage/async-storage`.

> `expo-av` is intentionally **not** used (unmaintained at SDK 54); media uses `expo-audio` /
> `expo-image-picker`. Background heartbeat uses `expo-background-task` / `expo-task-manager`,
> not the deprecated `expo-background-fetch`.

---

## 5. Project File Structure

```
safeyou-campus/                     ◄── open THIS in VS Code
├── app.json                        # Expo config (permissions, splash, icons)
├── eas.json                        # EAS Build profiles (background location)
├── babel.config.js
├── tsconfig.json                   # includes moduleSuffixes for .native/.web splits
├── package.json
├── .env                            # real Supabase URL + anon key (never commit)
├── .env.example
├── App.tsx                         # thin entry: NavigationContainer + RootNavigator
│
├── assets/                         # icon.png, splash.png, adaptive-icon.png, logo.png
│
├── src/
│   ├── config/supabase.ts          # Supabase client (Auth + AsyncStorage persistence)
│   ├── theme/                      # colors.ts, spacing.ts, typography.ts, index.ts
│   ├── types/                      # user.ts, contact.ts, journey.ts, incident.ts, env.d.ts
│   ├── services/
│   │   ├── authService.ts          # signUp / login / logout
│   │   ├── locationService.ts      # 60s background heartbeat task
│   │   ├── sosService.ts           # trigger / resolve SOS (via RPCs)
│   │   ├── journeyService.ts       # start/end journeys + pings + shared-with-me
│   │   ├── geocodingService.ts     # destination → coordinates + walking ETA
│   │   ├── incidentService.ts      # submit incident + photo upload
│   │   ├── contactService.ts       # add / remove / toggle trusted contacts
│   │   ├── notificationService.ts  # register Expo push token
│   │   └── adminService.ts         # campus-security console data layer
│   ├── store/                      # useAuthStore.ts, useAppStore.ts (Zustand)
│   ├── navigation/
│   │   ├── RootNavigator.tsx       # Splash → Auth | Onboarding | Main (persistent session)
│   │   ├── AuthNavigator.tsx       # Login, Register
│   │   ├── MainTabNavigator.tsx    # Dashboard, Tracking, Reporting, Map, Settings
│   │   ├── SettingsNavigator.tsx   # account, contacts, privacy, reports, security
│   │   └── TrackingNavigator.tsx   # WalkWithMe, SharedWithMe, JourneyViewer
│   ├── screens/
│   │   ├── splash/SplashScreen.tsx
│   │   ├── auth/                   # LoginScreen, RegisterScreen, OnboardingScreen
│   │   ├── dashboard/SOSDashboardScreen.tsx
│   │   ├── tracking/               # WalkWithMeScreen, SharedWithMeScreen, JourneyViewerScreen
│   │   ├── reporting/              # ReportIncidentScreen, MyReportsScreen
│   │   ├── map/                    # CampusHeatmapScreen.native.tsx / .web.tsx
│   │   ├── admin/CampusSecurityScreen.tsx
│   │   └── settings/               # SettingsHome, MyAccount, TrustedContacts,
│   │                               #   PrivacySecurity, NotificationSettings,
│   │                               #   LocationSettings, DeleteAccount
│   ├── components/
│   │   ├── ui/                     # Button, Input, Card, ScreenHeader, EmptyState, Chip
│   │   ├── SOSButton.tsx, StatusBadge.tsx, ContactCard.tsx, QuickActionGrid.tsx
│   └── utils/                      # distance.ts, permissions.ts, validators.ts
│
└── supabase/                       ◄── BACKEND (this IS the real backend)
    ├── migrations/
    │   ├── 0001_init.sql           # tables + trusted-graph RLS + webhook triggers
    │   ├── 0002_cron.sql           # pg_cron schedule for offline-detection
    │   ├── 0003_security_functions.sql  # trigger_sos/resolve_sos, moderation, rate limits
    │   ├── 0004_admin_functions.sql     # campus-security console RPCs
    │   └── 0005_auth_trigger.sql        # auto-provision users row on signup
    └── functions/                  # Deno Edge Functions
        ├── _shared/auth.ts         # webhook-secret guard + fail-closed key helpers
        ├── sos-fanout/             # onCreate(sos_events) → notify contacts + security
        ├── offline-detection/      # cron → flag silent users (with recovery)
        ├── incident-moderation/    # onCreate(incidents) → moderate + roll up risk_zones
        └── account-deletion/       # onCall → cascade-delete a user's data
```

There is **one** backend. The old `backend/` Firebase Cloud Functions tree was removed in a
prior update — it duplicated the schema in a different dialect and caused drift.

---

## 6. Supabase Config in the App

`.env` (never commit — copy from `.env.example`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
# optional — override the destination geocoder (defaults to OpenStreetMap Nominatim)
# EXPO_PUBLIC_GEOCODING_ENDPOINT=https://your-geocoder.example/search
```

`src/config/supabase.ts` creates the client with the anon key and persists the session in
AsyncStorage so login survives app restarts:

```ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);
export default supabase;
```

> `EXPO_PUBLIC_SUPABASE_URL` must be the bare project URL — no `/rest/v1` path. The client
> appends the right path internally for auth, REST, Realtime, and Storage.

---

## 7. Data Model (Postgres + RLS)

Every table is in `public`, has Row Level Security enabled, and follows a **trusted-graph**
model: a user reads only their own profile, plus a minimal projection of people in their mutual
trusted-contact graph. `push_token`, `phone`, `email`, `student_id`, `university` and live
location are never exposed across users.

| Table | Purpose | RLS summary |
|---|---|---|
| `users` | core profile + live status/location + `push_token` | owner-only read; owner insert/update; `push_token` only reachable by service_role |
| `safe_users` (view) | cross-user projection (`id`, `full_name`, `current_status`) | self + trusted graph + campus security |
| `trusted_contacts` | `user_id` → contact (name, phone, `linked_uid`, `is_system_contact`) | owner writes; owner / linked user / security reads |
| `journeys` | Walk-With-Me trip (dest, ETA, `auto_sos_at`, `shared_with_contact_ids`) | owner / shared contacts / security read; owner insert/update |
| `journey_pings` | breadcrumb trail (`journey_id`, lat/lng, speed) | viewers read; **only the journey owner inserts** |
| `sos_events` | SOS record | owner/security read; **no client insert/update** — go through `trigger_sos`/`resolve_sos` |
| `incidents` | report (`reporter_id`, `is_anonymous`, type, desc, media) | reporter/security read; insert scoped to reporter (or null for anon) + rate limit |
| `risk_zones` | aggregated heatmap (`center_lat/lng`, `radius_meters`, `risk_score`, `incident_count`) | public read; service_role write |
| `webhook_events` | idempotency dedup for `pg_net` retries | no client access |

The full SQL (with every policy and helper function) is in
`supabase/migrations/0001_init.sql`. Helpers `are_trusted()`, `can_view_journey()`,
`owns_journey()`, and `is_campus_security()` are `security definer` so RLS policies can't
recurse infinitely.

---

## 8. Core Feature Implementation

### 8.0 Splash → Persistent Login → Registration → Onboarding

`RootNavigator.tsx` owns the flow. On cold start it subscribes to
`supabase.auth.onAuthStateChange`, which fires immediately with the restored session (if any):

- `initializing` → **SplashScreen** (shown on every launch while the session is checked).
- no session → **AuthNavigator** (Login / Register).
- session, not onboarded → **OnboardingScreen** (shown once, right after registration).
- session, onboarded → **MainTabNavigator** (straight to the Dashboard — no login prompt).

Persistent login works because the Supabase client persists the refresh token in AsyncStorage
(`persistSession: true` in Section 6). The user only sees Login again after an explicit Log Out
or a revoked session.

### 8.1 Authentication — `src/services/authService.ts`

- `signUp()` → `supabase.auth.signUp(...)` then upserts the `users` row (also auto-created by
  the `on_auth_user_created` trigger, `0005_auth_trigger.sql` — the two are idempotent).
- `login()` → `supabase.auth.signInWithPassword(...)`.
- `logout()` → `supabase.auth.signOut()`.

`has_onboarded` defaults to `false` in the schema, so new accounts land on Onboarding;
returning users (`true`) skip it.

### 8.2 The 60-second location heartbeat — `src/services/locationService.ts`

Defines the `safeyou-location-heartbeat` background task and writes
`last_known_lat/lng/accuracy` + `last_active_at` to `users` every 60s. Called from
`RootNavigator` after auth. `stopLocationHeartbeat()` is called on logout and account deletion.

### 8.3 SOS — `src/services/sosService.ts` + `src/components/SOSButton.tsx`

The SOS button requires a 3-second hold, then calls `supabase.rpc('trigger_sos', …)`. The RPC
(`0003_security_functions.sql`) inserts the `sos_events` row **and** flips `users.current_status`
to `sos` in one transaction, enforces a 30s per-user cooldown, and dedupes active SOS. A Postgres
trigger fires `sos-fanout`, which pushes to trusted contacts **and** campus security.
`resolveSOS` calls `resolve_sos`, which marks the event resolved and restores `current_status`.

### 8.4 Walk With Me — `src/services/journeyService.ts` + `src/services/geocodingService.ts`

`WalkWithMeScreen` geocodes the destination (Nominatim by default, override via
`EXPO_PUBLIC_GEOCODING_ENDPOINT`), computes a walking ETA from distance, and starts the journey
with a safety timer (ETA + 5 min buffer). While active, a `watchPositionAsync` loop writes
breadcrumbs to `journey_pings` and updates the journey's `last_ping_*` fields for live viewers.
`SharedWithMeScreen` + `JourneyViewerScreen` render journeys shared with you via Realtime.

### 8.5 Trusted Contacts — `src/services/contactService.ts`

`addTrustedContact` / `removeTrustedContact` / `toggleAutoShare` write to `trusted_contacts`
(scoped to the owner by RLS). `TrustedContactsScreen` subscribes to Realtime changes.

### 8.6 Report an Incident — `src/services/incidentService.ts`

Uploads photo evidence to the `incident-evidence` bucket (signed URLs) and inserts an
`incidents` row. RLS scopes authenticated reports to `reporter_id = auth.uid()`; anonymous
reports require `reporter_id IS NULL`. A `before insert` trigger rate-limits both. An insert
trigger fires `incident-moderation`, which moderates and rolls the report into `risk_zones`.

### 8.7 Campus Risk Heatmap — `src/screens/map/CampusHeatmapScreen.native.tsx` / `.web.tsx`

Reads the aggregated `risk_zones` table over Realtime and renders translucent `Circle`s —
never raw incident pins (protecting reporter anonymity).

### 8.8 Campus Security console — `src/screens/admin/CampusSecurityScreen.tsx`

Only visible to users with `role = 'campus_security'`. Backed by the role-gated RPCs in
`0004_admin_functions.sql` (`get_active_alerts`, `admin_resolve_sos`,
`admin_set_incident_status`, `list_incidents`). Shows live SOS + offline alerts and an incident
review queue.

---

## 9. Edge Functions (the "backend" logic)

| Function | Trigger | What it does |
|---|---|---|
| `sos-fanout` | Postgres trigger on `sos_events` INSERT | fans out push to trusted contacts + campus security; idempotent |
| `offline-detection` | `pg_cron` every 2 min | flags silent users, resets recovered users, auto-SOS on expiry |
| `incident-moderation` | Postgres trigger on `incidents` INSERT | delegates to `moderate_incident` RPC (moderation + `risk_zones` rollup) |
| `account-deletion` | app `functions.invoke` | cascade-deletes a user's data; verifies the caller JWT |

All webhook/cron functions are **server-to-server** and verify a shared secret held in Vault
(`safeyou-webhook-secret`) + `WEBHOOK_SECRET` on the function. `account-deletion` instead verifies
the caller's Supabase JWT via `auth.getUser()`. Every function **fails closed** — no
`SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY` fallback anywhere.

Shared helpers live in `supabase/functions/_shared/auth.ts`.

---

## 10. Row Level Security (the "rules")

RLS is defined in `0001_init.sql` (see Section 7 table). The key properties:

- `users` is owner-only; cross-user reads go through the `safe_users` view.
- `push_token`/`phone` are only readable by `service_role` (Edge Functions), never by clients.
- `journey_pings`/`incidents` inserts are owner/reporter-scoped, not `with check (true)`.
- `sos_events` has no client write policies — only the `trigger_sos`/`resolve_sos` RPCs.
- `pg_net` usage is revoked from `anon`/`authenticated` (only `service_role` + security-definer
  triggers may make outbound HTTP calls).

---

## 11. Push Notifications

`src/services/notificationService.ts` registers the device's Expo push token into
`users.push_token`. The Edge Functions read `push_token` (via the service role) and send to
Expo's push API for both SOS and offline alerts.

---

## 12. Wiring the Screens (Navigation)

- `RootNavigator.tsx` — Splash → Auth | Onboarding | Main.
- `AuthNavigator.tsx` — Login, Register.
- `MainTabNavigator.tsx` — five tabs: **Dashboard**, **Tracking**, **Reporting**, **Map**,
  **Settings**.
- `SettingsNavigator.tsx` — MyAccount, TrustedContacts, PrivacySecurity, NotificationSettings,
  LocationSettings, MyReports, DeleteAccount, CampusSecurity.
- `TrackingNavigator.tsx` — WalkWithMe, SharedWithMe, JourneyViewer.

---

## 13. Push the Database + Deploy the Functions

```bash
cd safeyou-campus
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                    # runs 0001–0005 migrations
supabase db reset                   # (optional) wipe + re-apply from scratch

supabase functions deploy sos-fanout
supabase functions deploy offline-detection
supabase functions deploy incident-moderation
supabase functions deploy account-deletion

# Set the shared webhook secret so DB triggers can authenticate to the functions:
#   Vault → Secrets:  safeyou-functions-url  = https://<project-ref>.supabase.co
#                     safeyou-webhook-secret = <openssl rand -hex 32>
supabase secrets set WEBHOOK_SECRET=<the same random string>
```

The webhook triggers read the function URL and secret from Vault (`fn_base_url()` /
`fn_webhook_secret()`), so **no key is committed in the migrations**.

Create the storage bucket from the dashboard (**Storage → New bucket**, name `incident-evidence`,
set **Private** — the app uses signed URLs). `profile-photos` is created by the migration.

---

## 14. Running & Testing With Real Data

1. Register a real account → Onboarding → Dashboard.
2. Force-close and reopen → straight to Dashboard (persistent login working).
3. Supabase **Table Editor → users** → `last_active_at` updates ~every 60s.
4. Settings → Trusted Contacts → add a contact → row appears live (Realtime).
5. Hold SOS for 3s → row in `sos_events`, `users.current_status` flips to `sos`, `sos-fanout`
   logs a run.
6. Report an incident with a photo → row in `incidents` + file in `incident-evidence` + a
   `risk_zones` update after moderation.
7. Promote a staff account (`users.role = 'campus_security'`) → a "Campus Security" entry
   appears under Settings with the live console.

Use real phones — emulators don't give reliable GPS/background behavior.

---

## 15. Deployment Checklist

- [ ] `supabase db push` ran all migrations (0001–0005); RLS verified in the dashboard.
- [ ] `WEBHOOK_SECRET` set on functions + `safeyou-webhook-secret` in Vault (matching).
- [ ] Edge Functions deployed and logs checked (`supabase functions list`).
- [ ] `incident-evidence` storage bucket created.
- [ ] EAS Build configured for iOS background location (`UIBackgroundModes` is already in
      `app.json`).
- [ ] Real push tested on a physical Android device.
- [ ] Privacy policy linked from Privacy & Security (required — the app collects live location).
- [ ] Promote real campus-security staff as `campus_security`; audit the console's RPCs.

---

## 16. What's Next (optional hardening)

- **App Check / Turnstile** on Edge Functions to stop non-client callers.
- **Geocoder swap** — Nominatim is fine for dev; use a paid/self-hosted geocoder for production
  traffic (set `EXPO_PUBLIC_GEOCODING_ENDPOINT`).
- **Campus-security push dedup** — fan out to security staff via a dedicated topic rather than
  per-device tokens.
- **Email templates + "Confirm email"** re-enabled before going live.
- **Admin web dashboard** if the in-app console needs to grow beyond a single screen.

---

You now have a complete, real-data pipeline: **Expo client → Supabase Auth/Postgres/Storage →
Edge Functions → push notifications**, matching every screen in the original design — all on
Supabase, with no Firebase anywhere.
