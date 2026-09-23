-- Enforce at most one certificate per vehicle per test date (org-scoped),
-- matching the ingest skip rule in 0003.

create unique index if not exists certificates_org_vehicle_test_uidx
  on public.certificates (org_id, vehicle_no, test_date);

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

  -- One row per PUCC number, then one per vehicle + test date (same-day retests in one file collapse).
  create temp table _raw on commit drop as
  select distinct on (r.pucc_no) r.*
  from jsonb_to_recordset(p_rows) as r(
    pucc_no text, vehicle_no text, mobile text, fuel text, model text, engine text,
    test_date date, valid_until date, result text,
    km numeric, hsu numeric, co numeric, hc numeric)
  where r.pucc_no is not null and r.vehicle_no is not null
    and r.test_date is not null and r.valid_until is not null
  order by r.pucc_no, r.valid_until desc, r.test_date desc;

  create temp table _in on commit drop as
  select distinct on (vehicle_no, test_date) *
  from _raw
  order by vehicle_no, test_date, valid_until desc, pucc_no;

  select count(*) into v_total from _in;

  -- Skip if this PUCC number was already imported, or this vehicle already has a cert on this test date.
  create temp table _fresh on commit drop as
  select i.* from _in i
  where not exists (
    select 1 from public.certificates c
    where c.org_id = v_org and c.pucc_no = i.pucc_no
  )
  and not exists (
    select 1 from public.certificates c
    where c.org_id = v_org and c.vehicle_no = i.vehicle_no and c.test_date = i.test_date
  );
  v_already := v_total - (select count(*) from _fresh);

  -- The latest fresh certificate per vehicle decides the vehicle's current state
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
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'upload_id', v_upload, 'dry_run', p_dry_run, 'valid_rows', v_total,
    'new_vehicles', v_new, 'renewed', v_renewed,
    'already_imported', v_already, 'history_only', v_history, 'rejected', p_rejected);
end $$;
