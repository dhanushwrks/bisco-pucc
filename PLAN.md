# PUCC Console — Product Plan & Implementation Design

_Owner dashboard for Pollution Under Control Certificate (PUCC) testing centres._
_Status: MVP built (this repo). Last updated: 22 Sep 2026._

---

## 1. Problem

A PUCC owner runs several emission-testing outlets. Each outlet's software exports a
daily sheet of certificates (see `samples/Certificate-sample.xlsx`). Today that data sits
in Excel files on separate machines, so the owner cannot answer:

- How many vehicles did each outlet test this week? Did every outlet send its file?
- Which customers' certificates expire soon — and have we reminded them?

Every expiring certificate is a **repeat customer who will go to whichever centre reminds
them first.** Reminders on WhatsApp are the revenue lever; the dashboard is the control room.

## 2. Users & permissions

| Role | Sees | Can do |
|---|---|---|
| **Owner** | All outlets, all vehicles, reminders, settings | Create outlets, add operator logins, upload for any outlet, run/send reminders, edit reminder rules, opt customers out |
| **Outlet operator** | Only their outlet: its uploads and vehicles last tested there | Upload their outlet's file |

Enforced in the database with Row Level Security, not just in the UI.

## 3. Core flows

1. **Onboard** — owner signs up → names the business → adds outlets (name, licence no.,
   ETC ID, phone) → optionally creates an operator login per outlet.
2. **Daily upload** — operator (or owner) opens *Upload*, drops the `.xlsx`/`.csv`.
   The period (from → to) auto-fills from the file's test dates; it can be one day or a range.
   → **Preview** shows: new vehicles, renewals, already-imported, rejected rows with reasons.
   → **Import** commits atomically.
3. **Monitor** — Overview shows KPIs (active / expiring ≤7d / ≤30d / expired), a 14-day
   upload-coverage strip per outlet (spot the outlet that forgot to upload), and the
   reminder pipeline.
4. **Remind** — a daily job (10:30 IST) sends WhatsApp template messages to customers at
   configured stages (default 15, 3 and 0 days before expiry). Owner can also *Run now*
   or send to a single vehicle. Delivery / read / failed statuses flow back via webhook.
   A customer replying **STOP** is opted out automatically.

## 4. Data rules (the important part)

### Vehicle number is the primary key
- Normalised before anything else: uppercase, strip spaces/hyphens/dots → `KA19HL6177`.
- Validated against Indian plate formats (`KA19HL6177`, `DL3CAB1234`, `22BH1234AA`);
  rows that fail are rejected with a reason — they never enter the vehicles table.
- `vehicles` has `PRIMARY KEY (org_id, vehicle_no)` — **one row per vehicle per business,
  across all outlets.** A vehicle tested at Outlet A and later at Outlet B is still one
  customer; its `last_outlet` moves to B.

### Certificates keep history, vehicles keep "current state"
- `certificates` stores every test (`UNIQUE (org_id, pucc_no)`), so re-uploading the
  same file is harmless: those rows show up as *already imported*.
- On import, a vehicle's current state (validity, mobile, model, outlet) is updated
  **only if the new certificate is newer** (later `valid_until`, then later `test_date`).
  Uploading an old backlog file never rolls a vehicle back.
- Same vehicle appearing twice in one file → the latest test wins for current state;
  both certificates are kept.

### Upload validation
| Check | Result |
|---|---|
| Missing `VEHICLE_NO` / `PUCC_NO` / `TESTDATE` / `VALIDDATE` | Row rejected |
| Invalid plate format | Row rejected |
| `LICENCE_NO` doesn't match the selected outlet | Row rejected (stops cross-outlet mistakes) |
| Test date outside chosen period | Row rejected |
| `RESULT` not *Pass* | Row skipped (no valid certificate) |
| Mobile not a valid Indian mobile | Imported, flagged "no WhatsApp" |
| Duplicate `PUCC_NO` inside the file | Second copy dropped |

Dates accepted as `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY` or native Excel dates.
Headers are matched case-insensitively, so minor export differences don't break imports.

## 5. Reminder engine

- Settings per business: `reminder_offsets` (default `{15,3,0}` days; negatives allowed for
  "expired N days ago" nudges), template name, language, on/off.
- **Stage logic**: for each vehicle, `days_left = valid_until − today(IST)`. Its stage is the
  smallest offset ≥ `days_left`. A reminder row is created per
  `(vehicle, valid_until, stage)` under a unique index → **never double-sends**, and if the
  job misses a day it catches up with the right stage instead of spamming every stage.
- Renewal automatically stops reminders: the vehicle's `valid_until` moves forward, so old
  stages no longer match.
- Skips opted-out customers and vehicles without a valid mobile.
- Manual "Send now" per vehicle (limited to once per 24 h per vehicle).
- Without WhatsApp credentials the sender runs in **simulation mode** (status `simulated`)
  so the whole flow can be tested safely.

### WhatsApp (Meta Cloud API)
- `POST https://graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages`, template message.
- Suggested template — category **Utility**, name `pucc_expiry_reminder`, language `en`:

  > Hi, the PUC certificate for your vehicle **{{1}}** expires on **{{2}}**. Renew it at
  > **{{3}}** to stay road-legal. For help call {{4}}. Reply STOP to stop these reminders.

- Webhook `/api/whatsapp/webhook`: verifies `X-Hub-Signature-256`, updates
  sent → delivered → read / failed (never downgrades on out-of-order events), and opts out
  on STOP / UNSUBSCRIBE.
- Setup: Meta Business verification → WhatsApp Business number → approve template →
  paste token, phone-number ID, app secret into env.

## 6. Architecture

```
Next.js 15 (App Router, server components, server actions) — Vercel
 ├─ /api/upload                 parse xlsx (SheetJS) → validate → rpc ingest_certificates
 ├─ /api/cron/reminders         daily (Vercel Cron, CRON_SECRET) → engine → WhatsApp
 ├─ /api/whatsapp/webhook       status + STOP handling
 └─ Supabase
     ├─ Auth (email + password; owner creates operator logins)
     ├─ Postgres + RLS (org-scoped; operator = own outlet only)
     └─ RPCs: create_org, ingest_certificates (atomic, dedup), plan_reminders, dashboard_summary
```

### Tables
`orgs` · `profiles (role, outlet_id)` · `outlets` · `vehicles (PK org_id+vehicle_no)` ·
`certificates (UNIQUE org_id+pucc_no)` · `uploads (period, counts, errors)` ·
`reminders (UNIQUE org_id+vehicle_no+valid_until+stage for auto)`

Full DDL: `supabase/migrations/0001_init.sql`.

## 7. UI

Minimal, calm, data-first: white canvas, zinc greys, one emerald accent (clean air), status
colours only where they carry meaning (amber = expiring, red = expired).

| Screen | Content |
|---|---|
| Overview | 4 KPI tiles · 14-day upload coverage per outlet · expiring-soon list · reminder stats |
| Outlets | List with last upload + vehicle count · add outlet · outlet detail with operators and upload history |
| Upload | Outlet picker (fixed for operators) · drag-drop · period · preview → import |
| Vehicles | Search by plate/mobile · filters (status, outlet) · status pill · "Send reminder" · opt-out |
| Reminders | Run now · settings (stages, template) · log with delivery status |

## 8. Roadmap

**MVP (built)** — everything above.

**Next**
1. Hosted onboarding for WhatsApp (embedded signup) so owners don't touch Meta console.
2. Reply-to-book: customer replies "BOOK" → slot request shows on outlet's dashboard.
3. Upload-reminder to operators on WhatsApp when a day's file is missing by 9 PM.
4. Revenue view: renewals attributed to reminders (reminder sent → renewed within 30 days).
5. Direct pull from the PUCC software/Vahan export if available, removing manual uploads.
6. Multilingual templates (Kannada / Hindi) per outlet.

**Metrics** — % outlets uploading daily · reminder delivery rate · renewal rate within 30 days of
expiry (reminded vs not) · opt-out rate (<2% target).

## 9. Risks

| Risk | Mitigation |
|---|---|
| Template rejected / marked marketing | Keep wording transactional; Utility category |
| Customer data privacy (DPDP Act) | Opt-out honoured instantly; data scoped per org with RLS; no sharing across owners |
| Wrong outlet's file uploaded | Licence-number check per row |
| Format changes in export | Case-insensitive header mapping, clear rejected-row reasons |
| Messaging cost | Stage de-dup, opt-out, per-vehicle manual throttle |
