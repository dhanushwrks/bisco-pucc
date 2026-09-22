# PUCC Console

Owner dashboard for PUC (Pollution Under Control) testing centres: manage outlets, import
daily certificate exports, de-duplicate by vehicle number, and send WhatsApp reminders
before certificates expire.

Product plan & design: [PLAN.md](PLAN.md) · Schema: [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)

**Stack:** Next.js 15 (App Router) · Supabase (Auth + Postgres + RLS) via `@supabase/ssr` + `@supabase/server` · Tailwind v4 · SheetJS · Meta WhatsApp Cloud API

## Setup

```bash
npm install
cp .env.example .env.local        # fill in the SUPABASE_* values
```

### 1. Apply the database migration (once)

Pick one:

- **Supabase MCP** (configured in `.mcp.json`): run `claude /mcp`, authenticate the
  `supabase` server, then ask Claude to apply `supabase/migrations/0001_init.sql`.
- **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`.
- **Dashboard:** SQL Editor → paste the migration file → Run.

### 2. Auth settings (Supabase dashboard → Authentication)

- **URL Configuration:** Site URL = your app URL (e.g. `http://localhost:3000` in dev);
  add `<app-url>/auth/callback` to Redirect URLs.
- Email confirmation is on by default — new owners confirm their email once. Operator
  logins created from the dashboard are pre-confirmed.

### 3. Run

```bash
npm run dev          # http://localhost:3000
```

Sign up → name your business → add outlets (licence no. must match `LICENCE_NO` in the
export) → upload `samples/Certificate-sample.xlsx`.

## WhatsApp reminders

Without WhatsApp credentials everything works in **simulation mode** (logged as `simulated`).

To go live:
1. Meta Business Manager → WhatsApp → add a phone number.
2. Create a **Utility** template `pucc_expiry_reminder` (language `en`) with 4 body variables
   — the suggested text is shown on the Reminders page.
3. Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.
4. Webhook: callback `https://<app>/api/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`,
   subscribe to `messages`. Delivery/read statuses and STOP opt-outs then flow back automatically.

The daily job runs from `vercel.json` (05:00 UTC = 10:30 IST) and calls
`/api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`. Owners can also press
**Run now** or remind a single vehicle.

## Key rules

- `vehicles` primary key is `(org_id, vehicle_no)`; plates are normalised (`KA 19-hl 6177` → `KA19HL6177`).
- Every certificate is kept (`UNIQUE (org_id, pucc_no)`), so re-uploads are harmless.
- A vehicle's current state only moves forward (newer validity wins); old files never roll it back.
- Auto reminders are unique per `(vehicle, validity, stage)` → no double sends; renewals stop reminders.
- Operators can only see and upload for their own outlet — enforced by RLS, not just the UI.

## Project layout

```
src/app/(dash)/          Overview, Upload, Vehicles, Outlets, Reminders + server actions
src/app/api/upload       parse + validate + ingest (preview or commit)
src/app/api/cron         daily reminder job
src/app/api/whatsapp     webhook (statuses, STOP)
src/lib/parse.ts         xlsx/csv parsing & validation
src/lib/reminders.ts     reminder engine
src/lib/whatsapp.ts      Cloud API sender + signature check
src/lib/supabase/        ssr cookie client, verified RLS client, secret-key admin client
supabase/migrations/     schema, RLS, RPCs
```
