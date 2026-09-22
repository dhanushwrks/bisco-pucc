import { getDb, requireOwner } from "@/lib/session";
import { whatsappConfigured } from "@/lib/whatsapp";
import { fmtDate, fmtDateTime, fmtMobile, fmtPlate } from "@/lib/format";
import { Card, Empty, Notice, PageHeader, Pill, type Tone } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { runRemindersNow, saveReminderSettings } from "../actions";

const STATUS: Record<string, Tone> = {
  queued: "zinc", simulated: "blue", sent: "zinc", delivered: "green", read: "green", failed: "red",
};
const stageLabel = (n: number | null) =>
  n === null ? "Manual" : n === 0 ? "On expiry day" : n > 0 ? `${n}d before` : `${-n}d after`;

export default async function Reminders() {
  const me = await requireOwner();
  const db = await getDb();
  const [{ data: org }, { data: due }, { data: log }] = await Promise.all([
    db.from("orgs").select("*").eq("id", me.orgId).single(),
    db.rpc("preview_reminders"),
    db.from("reminders").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const live = whatsappConfigured();
  const dueRows = (due ?? []) as { vehicle_no: string; mobile: string; valid_until: string; stage: number; days_left: number; outlet_name: string | null }[];

  return (
    <>
      <PageHeader title="Reminders"
        subtitle="WhatsApp messages to customers before their PUC certificate expires."
        actions={<ActionButton action={runRemindersNow} className="btn-primary" confirm={`Send ${dueRows.length} reminder(s) now?`}>Run now</ActionButton>} />

      {!live && (
        <div className="mb-6"><Notice tone="amber">
          <b className="font-medium">Simulation mode.</b> WhatsApp credentials aren’t set, so runs are logged as “simulated” and nothing is sent. Add <code className="text-xs">WHATSAPP_TOKEN</code> and <code className="text-xs">WHATSAPP_PHONE_NUMBER_ID</code> to go live.
        </Notice></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card pad={false} title={`Due on next run · ${dueRows.length}`}
            action={<span className="text-xs text-zinc-400">Daily 10:30 AM IST</span>}>
            {!dueRows.length ? <Empty title="No reminders due" hint="Customers already reminded at their current stage are skipped automatically." /> : (
              <div className="max-h-80 overflow-auto">
                <table className="table">
                  <thead><tr><th>Vehicle</th><th>Mobile</th><th>Expires</th><th>Stage</th></tr></thead>
                  <tbody>
                    {dueRows.map((r) => (
                      <tr key={r.vehicle_no}>
                        <td className="font-mono text-[13px] font-medium">{fmtPlate(r.vehicle_no)}</td>
                        <td className="tabular text-zinc-600">{fmtMobile(r.mobile)}</td>
                        <td className="tabular text-zinc-600">{fmtDate(r.valid_until)} <span className="text-xs text-zinc-400">({r.days_left < 0 ? `${-r.days_left}d ago` : `${r.days_left}d`})</span></td>
                        <td><Pill tone="amber">{stageLabel(r.stage)}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card pad={false} title="Log">
            {!log?.length ? <Empty title="No reminders sent yet" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>When</th><th>Vehicle</th><th>Mobile</th><th>Stage</th><th>Status</th></tr></thead>
                  <tbody>
                    {log.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-xs text-zinc-500">{fmtDateTime(r.created_at)}</td>
                        <td className="font-mono text-[13px]">{fmtPlate(r.vehicle_no)}</td>
                        <td className="tabular text-zinc-600">{fmtMobile(r.mobile)}</td>
                        <td className="text-zinc-600">{stageLabel(r.stage)}</td>
                        <td title={r.error ?? ""}><Pill tone={STATUS[r.status] ?? "zinc"}>{r.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Settings">
            <ActionForm action={saveReminderSettings} className="space-y-3">
              <label className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
                <span className="text-sm">Automatic reminders</span>
                <input type="checkbox" name="enabled" defaultChecked={org?.reminders_enabled} className="h-4 w-4 accent-emerald-600" />
              </label>
              <div>
                <label className="label">Remind on (days before expiry)</label>
                <input name="offsets" className="input" defaultValue={(org?.reminder_offsets ?? []).join(", ")} />
                <p className="mt-1 text-xs text-zinc-500">0 = expiry day · negative = after expiry, e.g. −7</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className="label">Template name</label><input name="template" className="input" defaultValue={org?.wa_template} /></div>
                <div><label className="label">Language</label><input name="language" className="input" defaultValue={org?.wa_language} /></div>
              </div>
              <Submit>Save settings</Submit>
            </ActionForm>
          </Card>

          <Card title="Message template">
            <div className="rounded-lg rounded-tl-none bg-[#e7fdd8] px-3.5 py-3 text-sm leading-relaxed text-zinc-800 shadow-sm">
              Hi, the PUC certificate for your vehicle <b>{"{{1}}"}</b> expires on <b>{"{{2}}"}</b>. Renew it at <b>{"{{3}}"}</b> to stay road-legal. For help call {"{{4}}"}. Reply STOP to stop these reminders.
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Create this as a <b>Utility</b> template in WhatsApp Manager with 4 body variables: vehicle number, expiry date, outlet name, outlet phone.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
