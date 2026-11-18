# MB NUTRITION — architecture

One web codebase in `www/`, used three ways:

1. **Artifact claude.ai** — `www/` published as-is (preview, coach space via `window.claude` db).
2. **iPhone / Android app** — Capacitor wraps `www/` (`webDir: "www"`), adds Apple Health / Health Connect,
   barcode scanner, local notifications.
3. **Backend** — Supabase (auth, sync, coach dashboard, chat, AI photo analysis via Edge Function).

No bundler. Plain `<script>` files loaded in order by `www/index.html`:

```
config.js   -> window.MB_CONFIG = {supabaseUrl:"", supabaseAnonKey:""}   (empty = local-only mode)
data.js     -> FOODS, MEALS, WEEK… (nutrition tables)
health.js   -> window.MBHealth
native.js   -> window.MBNative
sync.js     -> window.MBSync
app.js      -> the app (state S in localStorage key "mbn.app.v3")
features.css (new screens) after app.css
```

Every bridge must load and no-op safely in a plain browser / the artifact (no Capacitor, no network).

## Contracts (all methods async unless noted, never throw — return null / false on failure)

### `window.MBHealth` (www/health.js)
- `available()` -> boolean  (true only in the native app with HealthKit / Health Connect present)
- `request()` -> boolean  (asks read permissions: steps, heart rate, resting HR, HRV, sleep, active energy, weight)
- `day(isoDate)` -> `{steps, activeKcal, hrAvg, hrMin, hrMax, hrResting, hrv, sleepMin, hr:[[minuteOfDay,bpm],…]}` or null.
  `hr` downsampled to ≤ 96 points (15 min buckets). Missing metrics = null.
- `range(fromIso, toIso)` -> `{[isoDate]: {steps, activeKcal, hrResting, sleepMin}}`
- `latestWeight()` -> `{date, kg}` or null

### `window.MBNative` (www/native.js)
- `isNative()` (sync) -> boolean
- `scanBarcode()` -> EAN string or null. Native: ML Kit scanner plugin. Web: `BarcodeDetector` + camera in a full-screen overlay; null if unsupported.
- `notify.schedule(list)` where list = `[{id:int, title, body, hour, minute}]` daily repeats; replaces all previous. Native: LocalNotifications. Web: no-op returning false.
- `notify.permission()` -> boolean

### `window.MBSync` (www/sync.js)
- `enabled()` (sync) -> boolean (MB_CONFIG filled and supabase-js loaded)
- `session()` -> `{userId, email, role:"client"|"coach"}` or null
- `signIn(email)` -> sends OTP code by email; `verify(email, code)` -> session or null; `signOut()`
- `pushDay(iso, payload)` — upsert one day of client data (`{log, water, steps, health, fasting}`)
- `pushProfile(profile)`, `pushWeight({date,kg})`, `pushMeasure({date, waist, hips, chest, arm, thigh})`
- `uploadPhoto(blob, kind:"meal"|"progress")` -> storage path or null
- `pullPlan()` -> plan object `{kcal, swap, extra, note, at}` or null
- `messages.list(clientId?)`, `messages.send(text, clientId?)`, `messages.subscribe(cb)` -> unsubscribe fn
- `analyzeMeal(blob)` -> `{nom,kcal,p,g,l,aliments,confiance}` via Edge Function `analyze-meal` (Claude vision), or null
- Coach only: `coach.clients()`, `coach.client(id)` -> profile + last 28 days + weights + measures + checkins

## Design rules
- Keep the current identity: grey `--bg`, white cards, one colour per metric, numbers first, Inter.
  New metric colours: `--hr` (heart, red-pink), `--sleep` (indigo), `--fast` (teal). Dark mode via tokens only.
- French UI copy, "vous", short. Accessibility: buttons have labels, focus-visible, reduced motion respected.
- Not medical: health numbers are informative, the legal footer stays.

## Abonnement, calls, notifications (v2)

Decisions (owner): 87 €/month Stripe subscription; without an active subscription the client
app shows a paywall (journal stays readable; plan, chat and calls are locked); the coach can
grant free access per client. Calls are booked through Cal.com, unlimited for subscribers.
Notifications: local pre-session reminders (device) + push notifications sent by the coach.
All of this exists only when MBSync.enabled(); local/artifact mode never shows a paywall.

Secrets live in Supabase (Edge Function secrets), never in the app: STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, CAL_WEBHOOK_SECRET, FCM_SERVICE_ACCOUNT (JSON).
Non-secret app config in www/config.js: `calUrl` (e.g. "https://cal.com/melvin-begue/call").

### `MBSync` additions
- `billing.status()` -> `{active:boolean, status:"active"|"trialing"|"past_due"|"canceled"|"none"|"comp", periodEnd:iso|null}` or null.
  `active` is true for active/trialing/comp (and past_due within Stripe's retry window).
- `billing.checkout()` -> Stripe Checkout URL (string) or null. Edge Function `create-checkout`.
- `billing.portal()` -> Stripe customer-portal URL or null. Edge Function `billing-portal`.
- `calls.next()` -> `{start:iso, end:iso, url:string|null}` of the client's next booked call, or null.
- `calls.list(clientId?)` -> upcoming calls (coach: all clients when clientId omitted).
- `push.register(token, platform:"ios"|"android")` -> boolean (stores the device token).
- Coach only: `coach.grantAccess(clientId, on:boolean)`, `coach.push({to:clientId|"all", title, body})` -> number sent or null
  (Edge Function `send-push`, FCM HTTP v1 for Android + iOS).
- `coach.clients()` rows gain `billing: {status, periodEnd}` and `nextCall`.

### `MBNative` additions
- `openUrl(url)` — opens in the system browser / in-app browser (@capacitor/browser); web: window.open / location.
- `push.register()` -> `{token, platform}` or null (asks permission; native only).
- `push.onTap(cb)` — cb({title, body, data}) when a push notification is tapped.
- Pre-session reminders keep using `notify.schedule(list)`.
