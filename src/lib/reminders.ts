import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp";
import { fmtDate, fmtPlate } from "@/lib/format";

type Org = { id: string; name: string; wa_template: string; wa_language: string; support_phone: string | null };
type Planned = {
  vehicle_no: string; mobile: string; valid_until: string; stage: number;
  days_left: number; outlet_name: string | null; outlet_phone: string | null;
};

export type RunSummary = { orgs: number; planned: number; sent: number; simulated: number; failed: number };

const params = (org: Org, v: { vehicle_no: string; valid_until: string; outlet_name: string | null; outlet_phone: string | null }) => [
  fmtPlate(v.vehicle_no),
  fmtDate(v.valid_until),
  v.outlet_name ?? org.name,
  v.outlet_phone ?? org.support_phone ?? "-",
];

/** Runs the automatic reminder job for one org, or all orgs when orgId is omitted. */
export async function runReminders(orgId?: string, triggeredBy?: string): Promise<RunSummary> {
  const db = createAdminClient();
  let q = db.from("orgs").select("id, name, wa_template, wa_language, support_phone").eq("reminders_enabled", true);
  if (orgId) q = q.eq("id", orgId);
  const { data: orgs, error } = await q;
  if (error) throw error;

  const sum: RunSummary = { orgs: orgs?.length ?? 0, planned: 0, sent: 0, simulated: 0, failed: 0 };
  for (const org of (orgs ?? []) as Org[]) {
    const { data: plan, error: pErr } = await db.rpc("plan_reminders", { p_org: org.id });
    if (pErr) throw pErr;
    const rows = (plan ?? []) as Planned[];
    sum.planned += rows.length;

    // Claim rows first: the unique index makes concurrent runs safe (no double-send).
    const { data: claimed, error: cErr } = await db
      .from("reminders")
      .upsert(
        rows.map((r) => ({
          org_id: org.id, vehicle_no: r.vehicle_no, valid_until: r.valid_until, kind: "auto",
          stage: r.stage, mobile: r.mobile, status: "queued", triggered_by: triggeredBy ?? null,
        })),
        { onConflict: "org_id,vehicle_no,valid_until,stage", ignoreDuplicates: true },
      )
      .select("id, vehicle_no");
    if (cErr) throw cErr;

    const byVehicle = new Map(rows.map((r) => [r.vehicle_no, r]));
    for (let i = 0; i < (claimed ?? []).length; i += 10) {
      await Promise.all(
        claimed!.slice(i, i + 10).map(async (c) => {
          const r = byVehicle.get(c.vehicle_no)!;
          const out = await deliver(org, c.id, r);
          if (out === "failed") sum.failed++;
          else if (out === "simulated") sum.simulated++;
          else sum.sent++;
        }),
      );
    }
  }
  return sum;
}

/** Sends one manual reminder for a vehicle (throttled to once per 24h). */
export async function sendManualReminder(
  orgId: string,
  vehicleNo: string,
  userId: string,
  opts?: { template?: string; language?: string },
) {
  const db = createAdminClient();
  const [{ data: org }, { data: v }] = await Promise.all([
    db.from("orgs").select("id, name, wa_template, wa_language, support_phone").eq("id", orgId).single(),
    db.from("vehicles")
      .select("vehicle_no, mobile, valid_until, opted_out, outlets(name, phone)")
      .eq("org_id", orgId).eq("vehicle_no", vehicleNo).single(),
  ]);
  if (!org || !v) return { ok: false, error: "Vehicle not found" };
  if (v.opted_out) return { ok: false, error: "Customer has opted out" };
  if (!v.mobile) return { ok: false, error: "No valid mobile number" };
  if (!v.valid_until) return { ok: false, error: "No certificate on record" };

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("reminders").select("id", { count: "exact", head: true })
    .eq("org_id", orgId).eq("vehicle_no", vehicleNo).eq("kind", "manual").gte("created_at", since);
  if (count) return { ok: false, error: "Already reminded in the last 24 hours" };

  const { data: row, error } = await db.from("reminders").insert({
    org_id: orgId, vehicle_no: vehicleNo, valid_until: v.valid_until, kind: "manual",
    mobile: v.mobile, status: "queued", triggered_by: userId,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };

  const outlet = (Array.isArray(v.outlets) ? v.outlets[0] : v.outlets) as { name: string; phone: string | null } | null;
  const sendOrg: Org = {
    ...(org as Org),
    wa_template: opts?.template?.trim() || (org as Org).wa_template,
    wa_language: opts?.language?.trim() || (org as Org).wa_language,
  };
  const status = await deliver(sendOrg, row.id, {
    vehicle_no: v.vehicle_no, mobile: v.mobile, valid_until: v.valid_until,
    outlet_name: outlet?.name ?? null, outlet_phone: outlet?.phone ?? null,
  });
  return status === "failed" ? { ok: false, error: "WhatsApp send failed — see Reminders log" } : { ok: true, status };
}

async function deliver(
  org: Org,
  reminderId: string,
  v: { vehicle_no: string; mobile: string; valid_until: string; outlet_name: string | null; outlet_phone: string | null },
) {
  const db = createAdminClient();
  const res = await sendTemplate({ to: v.mobile, template: org.wa_template, language: org.wa_language, params: params(org, v) });
  const status = !res.ok ? "failed" : res.simulated ? "simulated" : "sent";
  await db.from("reminders").update({
    status,
    wa_message_id: res.ok ? res.messageId : null,
    error: res.ok ? null : res.error,
    updated_at: new Date().toISOString(),
  }).eq("id", reminderId);
  return status as "failed" | "simulated" | "sent";
}
