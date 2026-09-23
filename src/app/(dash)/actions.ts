"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSsrClient } from "@/lib/supabase/server";
import { getDb, getSession, requireOwner } from "@/lib/session";
import { runReminders, sendManualReminder } from "@/lib/reminders";
import { normalizeMobile, normalizePlate } from "@/lib/parse";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createOutlet(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireOwner();
  const supabase = await getDb();
  const { error } = await supabase.from("outlets").insert({
    org_id: me.orgId,
    name: s(f, "name"),
    licence_no: s(f, "licence_no"),
    etc_id: s(f, "etc_id") || null,
    phone: s(f, "phone") || null,
    address: s(f, "address") || null,
  });
  if (error) return { error: error.code === "23505" ? "An outlet with this licence number already exists." : error.message };
  revalidatePath("/outlets");
  return { ok: true, message: "Outlet added" };
}

export async function updateOutlet(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  await requireOwner();
  const supabase = await getDb();
  const { error } = await supabase.from("outlets").update({
    name: s(f, "name"),
    licence_no: s(f, "licence_no"),
    etc_id: s(f, "etc_id") || null,
    phone: s(f, "phone") || null,
    address: s(f, "address") || null,
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/outlets/${id}`);
  return { ok: true, message: "Saved" };
}

/** Owner creates a login for an outlet operator (email + temporary password). */
export async function addOperator(outletId: string, _: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireOwner();
  const supabase = await getDb();
  const { data: outlet } = await supabase.from("outlets").select("id").eq("id", outletId).maybeSingle();
  if (!outlet) return { error: "Outlet not found" };

  const email = s(f, "email").toLowerCase();
  const password = s(f, "password");
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: error?.message ?? "Could not create user" };

  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id, org_id: me.orgId, role: "operator", outlet_id: outletId,
    full_name: s(f, "full_name") || null, email,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: pErr.message };
  }
  revalidatePath(`/outlets/${outletId}`);
  return { ok: true, message: `Login created for ${email}. Share the password securely.` };
}

export async function removeOperator(outletId: string, userId: string) {
  const me = await requireOwner();
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("org_id, role").eq("id", userId).maybeSingle();
  if (p?.org_id === me.orgId && p.role === "operator") await admin.auth.admin.deleteUser(userId);
  revalidatePath(`/outlets/${outletId}`);
}

export async function sendReminderAction(vehicleNo: string): Promise<ActionState> {
  const me = await requireOwner();
  const res = await sendManualReminder(me.orgId, normalizePlate(vehicleNo), me.userId);
  revalidatePath("/vehicles");
  revalidatePath("/reminders");
  return res.ok ? { ok: true, message: res.status === "simulated" ? "Simulated (WhatsApp not configured)" : "Reminder sent" } : { error: res.error };
}

export async function toggleOptOut(vehicleNo: string, optedOut: boolean) {
  await requireOwner();
  const supabase = await getDb();
  await supabase.from("vehicles").update({ opted_out: optedOut }).eq("vehicle_no", vehicleNo);
  revalidatePath("/vehicles");
}

export async function runRemindersNow(): Promise<ActionState> {
  const me = await requireOwner();
  try {
    const r = await runReminders(me.orgId, me.userId);
    revalidatePath("/reminders");
    revalidatePath("/");
    if (!r.planned) return { ok: true, message: "Nothing due — everyone at their current stage has been reminded." };
    return { ok: true, message: `${r.sent + r.simulated} sent${r.simulated ? " (simulated)" : ""}, ${r.failed} failed.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Run failed" };
  }
}

export async function saveReminderSettings(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireOwner();
  const offsets = [...new Set(
    s(f, "offsets").split(/[,\s]+/).filter(Boolean).map(Number),
  )].filter((n) => Number.isInteger(n) && n >= -60 && n <= 90).sort((a, b) => b - a);
  if (!offsets.length) return { error: "Add at least one reminder day, e.g. 15, 3, 0" };
  const supabase = await getDb();
  const { error } = await supabase.from("orgs").update({
    reminder_offsets: offsets,
    reminders_enabled: f.get("enabled") === "on",
    wa_template: s(f, "template") || "pucc_expiry_reminder",
    wa_language: s(f, "language") || "en",
  }).eq("id", me.orgId);
  if (error) return { error: error.message };
  revalidatePath("/reminders");
  revalidatePath("/settings");
  return { ok: true, message: "Reminder settings saved" };
}

export async function saveBusinessSettings(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireOwner();
  const name = s(f, "name");
  if (!name) return { error: "Business name is required" };
  const rawPhone = s(f, "support_phone");
  const support_phone = rawPhone ? normalizeMobile(rawPhone) : null;
  if (rawPhone && !support_phone) return { error: "Enter a valid 10-digit Indian mobile number" };
  const supabase = await getDb();
  const { error } = await supabase.from("orgs").update({ name, support_phone }).eq("id", me.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Business details saved" };
}

/** Any signed-in user (owner or operator) can change their own password. */
export async function changePassword(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await getSession();
  const current = String(f.get("current_password") ?? "");
  const next = String(f.get("new_password") ?? "");
  const confirm = String(f.get("confirm_password") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };
  if (current === next) return { error: "New password must be different from the current one." };

  const supabase = await createSsrClient();
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: me.email,
    password: current,
  });
  if (authErr) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { ok: true, message: "Password updated" };
}

export async function goToVehicle(f: FormData) {
  await getSession();
  redirect(`/vehicles?q=${encodeURIComponent(s(f, "q"))}`);
}
