import Link from "next/link";
import { getDb, requireOwner } from "@/lib/session";
import { whatsappConfigured } from "@/lib/whatsapp";
import { fmtDate, fmtDateTime, fmtMobile, fmtPlate } from "@/lib/format";
import { Card, Empty, Notice, PageHeader, Pill, type Tone } from "@/components/ui";
import { ActionButton } from "@/components/forms";
import { runRemindersNow } from "../actions";

const STATUS: Record<string, Tone> = {
  queued: "zinc", simulated: "blue", sent: "zinc", delivered: "green", read: "green", failed: "red",
};
const stageLabel = (n: number | null) =>
  n === null ? "Manual" : n === 0 ? "On expiry day" : n > 0 ? `${n}d before` : `${-n}d after`;

export default async function Reminders() {
  const me = await requireOwner();
  const db = await getDb();
  const [{ data: org }, { data: due }, { data: log }] = await Promise.all([
    db.from("orgs").select("reminder_offsets, reminders_enabled").eq("id", me.orgId).single(),
    db.rpc("preview_reminders"),
    db.from("reminders").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const live = whatsappConfigured();
  const dueRows = (due ?? []) as { vehicle_no: string; mobile: string; valid_until: string; stage: number; days_left: number; outlet_name: string | null }[];
  const offsets = org?.reminder_offsets ?? [];

  return (
    <>
      <PageHeader title="Reminders"
        subtitle="WhatsApp messages to customers before their PUC certificate expires."
        actions={<ActionButton action={runRemindersNow} className="btn-primary" confirm={`Send ${dueRows.length} reminder(s) now?`}>Run now</ActionButton>} />

      {!live && (
        <div className="mb-6"><Notice tone="amber">
          <b className="font-medium">Simulation mode.</b> WhatsApp credentials aren’t set, so runs are logged as “simulated” and nothing is sent. Configure reminders in{" "}
          <Link href="/settings" className="font-medium underline underline-offset-2">Settings</Link>.
        </Notice></div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
        <span>
          {org?.reminders_enabled === false
            ? "Automatic reminders are off."
            : offsets.length
              ? <>Stages: {offsets.map(stageLabel).join(" · ")}</>
              : "No stages configured."}
        </span>
        <span className="text-zinc-300">·</span>
        <span>Daily 10:30 AM IST</span>
        <span className="text-zinc-300">·</span>
        <Link href="/settings" className="font-medium text-zinc-900 underline underline-offset-2">Edit in Settings</Link>
      </div>

      <div className="space-y-6">
        <Card pad={false} title={`Due on next run · ${dueRows.length}`}
          action={<span className="text-xs text-zinc-400">Daily 10:30 AM IST</span>}>
          {!dueRows.length ? <Empty title="No reminders due" hint="Customers already reminded at their current stage are skipped automatically." /> : (
            <div className="max-h-80 overflow-auto overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th className="hidden sm:table-cell">Mobile</th>
                    <th>Expires</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {dueRows.map((r) => (
                    <tr key={r.vehicle_no}>
                      <td className="font-mono text-[13px] font-medium">
                        {fmtPlate(r.vehicle_no)}
                        <div className="mt-0.5 font-sans text-[11px] tabular font-normal text-zinc-500 sm:hidden">{fmtMobile(r.mobile)}</div>
                      </td>
                      <td className="hidden tabular text-zinc-600 sm:table-cell">{fmtMobile(r.mobile)}</td>
                      <td className="tabular text-zinc-600">
                        {fmtDate(r.valid_until)}
                        <span className="ml-1 text-xs text-zinc-400">({r.days_left < 0 ? `${-r.days_left}d ago` : `${r.days_left}d`})</span>
                      </td>
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
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Vehicle</th>
                    <th className="hidden sm:table-cell">Mobile</th>
                    <th className="hidden md:table-cell">Stage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-xs text-zinc-500">{fmtDateTime(r.created_at)}</td>
                      <td className="font-mono text-[13px]">{fmtPlate(r.vehicle_no)}</td>
                      <td className="hidden tabular text-zinc-600 sm:table-cell">{fmtMobile(r.mobile)}</td>
                      <td className="hidden text-zinc-600 md:table-cell">{stageLabel(r.stage)}</td>
                      <td title={r.error ?? ""}><Pill tone={STATUS[r.status] ?? "zinc"}>{r.status}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
