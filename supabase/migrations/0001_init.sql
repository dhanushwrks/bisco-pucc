-- PUCC Console — initial schema
-- Vehicle number is the primary key per business (org). Certificates keep full history.

create extension if not exists pgcrypto;

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.user_role as enum ('owner', 'operator');
create type public.reminder_status as enum
  ('queued', 'sent', 'delivered', 'read', 'failed', 'simulated');

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.orgs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) > 0),
  reminder_offsets  int[] not null default '{15,3,0}',
  reminders_enabled boolean not null default true,
  wa_template       text not null default 'pucc_expiry_reminder',
  wa_language       text not null default 'en',
  created_at        timestamptz not null default now()
);

create table public.outlets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  licence_no  text not null,
  etc_id      text,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, licence_no)
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  role        public.user_role not null,
  outlet_id   uuid references public.outlets(id) on delete set null,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now(),
  check (role = 'owner' or outlet_id is not null)
);

create table public.vehicles (
  org_id          uuid not null references public.orgs(id) on delete cascade,
  vehicle_no      text not null check (vehicle_no ~ '^[A-Z0-9]{6,12}$'),
  mobile          text check (mobile ~ '^[6-9][0-9]{9}$'),
  fuel            text,
  model           text,
  last_outlet_id  uuid references public.outlets(id) on delete set null,
  last_pucc_no    text,
  last_test_date  date,
  valid_until     date,
  opted_out       boolean not null default false,
  first_seen_at   timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (org_id, vehicle_no)
);
create index vehicles_valid_idx  on public.vehicles (org_id, valid_until);
create index vehicles_outlet_idx on public.vehicles (last_outlet_id);
create index vehicles_mobile_idx on public.vehicles (org_id, mobile);

create table public.uploads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.orgs(id) on delete cascade,
  outlet_id        uuid not null references public.outlets(id) on delete cascade,
  uploaded_by      uuid references auth.users(id) on delete set null,
  file_name        text,
  period_from      date not null,
  period_to        date not null check (period_to >= period_from),
  total_rows       int not null default 0,
  new_vehicles     int not null default 0,
  renewed          int not null default 0,
  already_imported int not null default 0,
  history_only     int not null default 0,
  rejected         int not null default 0,
  errors           jsonb not null default '[]',
  created_at       timestamptz not null default now()
);
create index uploads_outlet_idx on public.uploads (outlet_id, period_to desc);

create table public.certificates (
  id           bigint generated always as identity primary key,
  org_id       uuid not null,
  pucc_no      text not null,
  vehicle_no   text not null,
  outlet_id    uuid not null references public.outlets(id) on delete cascade,
  upload_id    uuid references public.uploads(id) on delete set null,
  test_date    date not null,
  valid_until  date not null,
  result       text,
  fuel         text,
  model        text,
  engine       text,
  mobile       text,
  km           numeric,
  hsu          numeric,
  co           numeric,
  hc           numeric,
  created_at   timestamptz not null default now(),
  unique (org_id, pucc_no),
  foreign key (org_id, vehicle_no) references public.vehicles(org_id, vehicle_no) on delete cascade
);
create index certificates_vehicle_idx on public.certificates (org_id, vehicle_no);
create index certificates_outlet_idx  on public.certificates (outlet_id, test_date);

create table public.reminders (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  vehicle_no     text not null,
  valid_until    date not null,
  kind           text not null check (kind in ('auto', 'manual')),
  stage          int,                -- days before expiry for auto reminders
  mobile         text not null,
  status         public.reminder_status not null default 'queued',
  wa_message_id  text unique,
  error          text,
  triggered_by   uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (org_id, vehicle_no) references public.vehicles(org_id, vehicle_no) on delete cascade,
  check (kind = 'manual' or stage is not null)
);
-- One automatic reminder per vehicle / certificate / stage — never double-send.
-- (Manual reminders have stage NULL, and NULLs never collide.)
alter table public.reminders add constraint reminders_auto_once
  unique (org_id, vehicle_no, valid_until, stage);
create index reminders_org_created_idx on public.reminders (org_id, created_at desc);

-- ─── Helpers (private schema: not exposed through the Data API) ─────────────
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.ist_today() returns date
language sql stable set search_path = '' as
$$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function private.my_org() returns uuid
language sql stable security definer set search_path = '' as
$$ select org_id from public.profiles where id = (select auth.uid()) $$;

create or replace function private.my_role() returns public.user_role
language sql stable security definer set search_path = '' as
$$ select role from public.profiles where id = (select auth.uid()) $$;

create or replace function private.my_outlet() returns uuid
language sql stable security definer set search_path = '' as
$$ select outlet_id from public.profiles where id = (select auth.uid()) $$;

revoke execute on all functions in schema private from public, anon;
grant  execute on all functions in schema private to authenticated, service_role;

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.orgs         enable row level security;
alter table public.outlets      enable row level security;
alter table public.profiles     enable row level security;
alter table public.vehicles     enable row level security;
alter table public.uploads      enable row level security;
alter table public.certificates enable row level security;
alter table public.reminders    enable row level security;

create policy orgs_read on public.orgs for select to authenticated
  using (id = (select private.my_org()));
create policy orgs_update on public.orgs for update to authenticated
  using (id = (select private.my_org()) and (select private.my_role()) = 'owner')
  with check (id = (select private.my_org()));

create policy outlets_read on public.outlets for select to authenticated
  using (org_id = (select private.my_org())
         and ((select private.my_role()) = 'owner' or id = (select private.my_outlet())));
create policy outlets_insert on public.outlets for insert to authenticated
  with check (org_id = (select private.my_org()) and (select private.my_role()) = 'owner');
create policy outlets_update on public.outlets for update to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role()) = 'owner')
  with check (org_id = (select private.my_org()));

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or (org_id = (select private.my_org()) and (select private.my_role()) = 'owner'));

create policy vehicles_read on public.vehicles for select to authenticated
  using (org_id = (select private.my_org())
         and ((select private.my_role()) = 'owner' or last_outlet_id = (select private.my_outlet())));
create policy vehicles_owner_update on public.vehicles for update to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role()) = 'owner')
  with check (org_id = (select private.my_org()));

create policy uploads_read on public.uploads for select to authenticated
  using (org_id = (select private.my_org())
         and ((select private.my_role()) = 'owner' or outlet_id = (select private.my_outlet())));

create policy certificates_read on public.certificates for select to authenticated
  using (org_id = (select private.my_org())
         and ((select private.my_role()) = 'owner' or outlet_id = (select private.my_outlet())));

create policy reminders_read on public.reminders for select to authenticated
  using (org_id = (select private.my_org()) and (select private.my_role()) = 'owner');

-- Table privileges: browser roles read; writes are narrow. Imports and reminders
-- go through the functions below or the secret key, never direct table writes.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.outlets to authenticated;
grant update (reminder_offsets, reminders_enabled, wa_template, wa_language, name) on public.orgs to authenticated;
grant update (opted_out) on public.vehicles to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ─── create_org: first-time owner onboarding ───────────────────────────────
create or replace function public.create_org(p_name text, p_full_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already onboarded';
  end if;
  insert into public.orgs (name) values (trim(p_name)) returning id into v_org;
  insert into public.profiles (id, org_id, role, full_name, email)
  values (v_uid, v_org, 'owner', nullif(trim(p_full_name), ''),
          (select email from auth.users where id = v_uid));
  return v_org;
end $$;

-- ─── ingest_certificates: atomic, de-duplicating import ────────────────────
-- p_rows: [{pucc_no, vehicle_no, mobile, fuel, model, engine, test_date,
--           valid_until, result, km, hsu, co, hc}, ...]  (validated by the app)
create or replace function public.ingest_certificates(
  p_outlet    uuid,
  p_file_name text,
  p_from      date,
  p_to        date,
  p_rows      jsonb,
  p_rejected  int   default 0,
  p_errors    jsonb default '[]',
  p_dry_run   boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_org  uuid := private.my_org();
  v_role public.user_role := private.my_role();
  v_upload uuid;
  v_total int; v_already int; v_new int; v_renewed int; v_history int;
begin
  if v_uid is null or v_org is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.outlets where id = p_outlet and org_id = v_org) then
    raise exception 'outlet not found';
  end if;
  if v_role <> 'owner' and private.my_outlet() is distinct from p_outlet then
    raise exception 'not allowed to upload for this outlet';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 20000 then
    raise exception 'rows must be an array of at most 20000 items';
  end if;

  -- one row per PUCC number
  create temp table _in on commit drop as
  select distinct on (r.pucc_no) r.*
  from jsonb_to_recordset(p_rows) as r(
    pucc_no text, vehicle_no text, mobile text, fuel text, model text, engine text,
    test_date date, valid_until date, result text,
    km numeric, hsu numeric, co numeric, hc numeric)
  where r.pucc_no is not null and r.vehicle_no is not null
    and r.test_date is not null and r.valid_until is not null
  order by r.pucc_no, r.test_date desc;
  select count(*) into v_total from _in;

  -- certificates never seen before (re-uploading a file is harmless)
  create temp table _fresh on commit drop as
  select i.* from _in i
  where not exists (select 1 from public.certificates c
                    where c.org_id = v_org and c.pucc_no = i.pucc_no);
  v_already := v_total - (select count(*) from _fresh);

  -- the latest fresh certificate per vehicle decides the vehicle's current state
  create temp table _latest on commit drop as
  select distinct on (vehicle_no) * from _fresh
  order by vehicle_no, valid_until desc, test_date desc;

  select
    count(*) filter (where v.vehicle_no is null),
    count(*) filter (where v.vehicle_no is not null and
       (v.valid_until is null or l.valid_until > v.valid_until or
        (l.valid_until = v.valid_until and l.test_date > v.last_test_date))),
    count(*) filter (where v.vehicle_no is not null and not
       (v.valid_until is null or l.valid_until > v.valid_until or
        (l.valid_until = v.valid_until and l.test_date > v.last_test_date)))
  into v_new, v_renewed, v_history
  from _latest l
  left join public.vehicles v on v.org_id = v_org and v.vehicle_no = l.vehicle_no;

  if not p_dry_run then
    insert into public.uploads (org_id, outlet_id, uploaded_by, file_name, period_from, period_to,
                                total_rows, new_vehicles, renewed, already_imported, history_only,
                                rejected, errors)
    values (v_org, p_outlet, v_uid, p_file_name, p_from, p_to,
            v_total + p_rejected, v_new, v_renewed, v_already, v_history, p_rejected, p_errors)
    returning id into v_upload;

    insert into public.vehicles as v (org_id, vehicle_no, mobile, fuel, model, last_outlet_id,
                                      last_pucc_no, last_test_date, valid_until)
    select v_org, l.vehicle_no, l.mobile, l.fuel, l.model, p_outlet,
           l.pucc_no, l.test_date, l.valid_until
    from _latest l
    on conflict (org_id, vehicle_no) do update set
      mobile         = coalesce(excluded.mobile, v.mobile),
      fuel           = excluded.fuel,
      model          = excluded.model,
      last_outlet_id = excluded.last_outlet_id,
      last_pucc_no   = excluded.last_pucc_no,
      last_test_date = excluded.last_test_date,
      valid_until    = excluded.valid_until,
      updated_at     = now()
    where v.valid_until is null
       or excluded.valid_until > v.valid_until
       or (excluded.valid_until = v.valid_until and excluded.last_test_date > v.last_test_date);

    insert into public.certificates (org_id, pucc_no, vehicle_no, outlet_id, upload_id, test_date,
                                     valid_until, result, fuel, model, engine, mobile, km, hsu, co, hc)
    select v_org, pucc_no, vehicle_no, p_outlet, v_upload, test_date, valid_until, result,
           fuel, model, engine, mobile, km, hsu, co, hc
    from _fresh
    on conflict (org_id, pucc_no) do nothing;
  end if;

  return jsonb_build_object(
    'upload_id', v_upload, 'dry_run', p_dry_run, 'valid_rows', v_total,
    'new_vehicles', v_new, 'renewed', v_renewed,
    'already_imported', v_already, 'history_only', v_history, 'rejected', p_rejected);
end $$;

-- ─── Reminder planning ──────────────────────────────────────────────────────
-- Stage = smallest configured offset >= days_left, and only if that stage
-- hasn't been sent for this certificate yet. Missed days catch up, never spam.
create or replace function public.plan_reminders(p_org uuid)
returns table (vehicle_no text, mobile text, valid_until date, stage int, days_left int,
               outlet_name text, outlet_phone text)
language sql stable security definer set search_path = '' as $$
  with o as (
    select reminder_offsets offs from public.orgs where id = p_org and reminders_enabled
  ), v as (
    select v.*, (v.valid_until - private.ist_today()) as dl
    from public.vehicles v
    where v.org_id = p_org and not v.opted_out
      and v.mobile is not null and v.valid_until is not null
  )
  select v.vehicle_no, v.mobile, v.valid_until, s.stage, v.dl, ot.name, ot.phone
  from v
  cross join o
  cross join lateral (select min(x) as stage from unnest(o.offs) x where x >= v.dl) s
  left join public.outlets ot on ot.id = v.last_outlet_id
  where s.stage is not null
    and v.dl >= (select min(x) from unnest(o.offs) x)
    and not exists (
      select 1 from public.reminders r
      where r.org_id = p_org and r.vehicle_no = v.vehicle_no and r.kind = 'auto'
        and r.valid_until = v.valid_until and r.stage = s.stage)
  order by v.dl;
$$;

-- Owner-facing preview of what the next run would send.
create or replace function public.preview_reminders()
returns table (vehicle_no text, mobile text, valid_until date, stage int, days_left int,
               outlet_name text, outlet_phone text)
language sql stable security definer set search_path = '' as $$
  select p.* from public.plan_reminders(private.my_org()) p
  where (select auth.uid()) is not null and private.my_role() = 'owner'
$$;

-- ─── Dashboard summary (security invoker: RLS scopes operators to their outlet)
create or replace function public.dashboard_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total',       count(*),
    'active',      count(*) filter (where valid_until >= private.ist_today()),
    'expiring_7',  count(*) filter (where valid_until between private.ist_today() and private.ist_today() + 7),
    'expiring_30', count(*) filter (where valid_until between private.ist_today() and private.ist_today() + 30),
    'expired',     count(*) filter (where valid_until < private.ist_today()),
    'no_mobile',   count(*) filter (where mobile is null),
    'opted_out',   count(*) filter (where opted_out)
  ) from public.vehicles
$$;

-- Function execute grants (Postgres grants EXECUTE to PUBLIC by default).
revoke execute on all functions in schema public from public, anon;
grant  execute on function public.create_org(text, text)              to authenticated;
grant  execute on function public.ingest_certificates(uuid, text, date, date, jsonb, int, jsonb, boolean) to authenticated;
grant  execute on function public.preview_reminders()                 to authenticated;
grant  execute on function public.dashboard_summary()                 to authenticated;
revoke execute on function public.plan_reminders(uuid)                from authenticated;
grant  execute on all functions in schema public                      to service_role;
