-- Owner settings: support phone used as WhatsApp {{4}} when outlet has no phone.

alter table public.orgs
  add column support_phone text
  check (support_phone is null or support_phone ~ '^[6-9][0-9]{9}$');

revoke update on public.orgs from authenticated;
grant update (reminder_offsets, reminders_enabled, wa_template, wa_language, name, support_phone)
  on public.orgs to authenticated;
