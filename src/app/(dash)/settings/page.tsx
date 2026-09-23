import Link from "next/link";
import { getDb, getSession } from "@/lib/session";
import { whatsappConfigured } from "@/lib/whatsapp";
import { fmtMobile, fmtPlate } from "@/lib/format";
import { Card, Empty, Notice, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { changePassword, saveBusinessSettings, saveReminderSettings } from "../actions";

const stageLabel = (n: number) =>
  n === 0 ? "On expiry day" : n > 0 ? `${n}d before` : `${-n}d after`;

export default async function Settings() {
  const me = await getSession();
  const isOwner = me.role === "owner";

  const db = isOwner ? await getDb() : null;
  const [{ data: org }, { data: optedOut }] = isOwner && db
    ? await Promise.all([
        db.from("orgs").select("*").eq("id", me.orgId).single(),
        db.from("vehicles")
          .select("vehicle_no, mobile")
          .eq("opted_out", true)
          .order("vehicle_no")
          .limit(100),
      ])
    : [{ data: null }, { data: null }];

  const live = whatsappConfigured();
  const offsets = org?.reminder_offsets ?? [];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={isOwner
          ? "Business profile, reminder rules, and your account."
          : "Manage your account password."}
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <Card title="Account">
          <p className="mb-3 text-sm text-zinc-500">{me.email}</p>
          <ActionForm action={changePassword} className="space-y-3" resetOnSuccess>
            <div>
              <label className="label">Current password</label>
              <input name="current_password" type="password" required autoComplete="current-password" className="input" />
            </div>
            <div>
              <label className="label">New password</label>
              <input name="new_password" type="password" required minLength={8} autoComplete="new-password" className="input" />
              <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" className="input" />
            </div>
            <Submit>Update password</Submit>
          </ActionForm>
        </Card>

        {isOwner && (
          <>
            <Card title="Business">
              <ActionForm action={saveBusinessSettings} className="space-y-3">
                <div>
                  <label className="label">Business name</label>
                  <input name="name" className="input" required defaultValue={org?.name ?? ""} />
                  <p className="mt-1 text-xs text-zinc-500">Shown in the sidebar and used when an outlet name is missing in WhatsApp.</p>
                </div>
                <div>
                  <label className="label">Support phone</label>
                  <input
                    name="support_phone"
                    className="input"
                    inputMode="numeric"
                    placeholder="10-digit mobile"
                    defaultValue={org?.support_phone ?? ""}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Fallback for the reminder “call” number when an outlet has no phone set.
                  </p>
                </div>
                <Submit>Save business</Submit>
              </ActionForm>
            </Card>

            <Card title="Automatic reminders">
              <ActionForm action={saveReminderSettings} className="space-y-3">
                <label className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
                  <span className="text-sm">Send automatic reminders</span>
                  <input type="checkbox" name="enabled" defaultChecked={org?.reminders_enabled} className="h-4 w-4 accent-emerald-600" />
                </label>
                <div>
                  <label className="label">Remind on (days before expiry)</label>
                  <input name="offsets" className="input" defaultValue={offsets.join(", ")} />
                  <p className="mt-1 text-xs text-zinc-500">0 = expiry day · negative = after expiry, e.g. −7 · daily run at 10:30 AM IST</p>
                  {offsets.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-600">
                      Stages: {offsets.map(stageLabel).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="label">WhatsApp template name</label>
                    <input name="template" className="input" defaultValue={org?.wa_template} />
                  </div>
                  <div>
                    <label className="label">Language</label>
                    <input name="language" className="input" defaultValue={org?.wa_language} />
                  </div>
                </div>
                <Submit>Save reminder settings</Submit>
              </ActionForm>
            </Card>

            <Card title="Message template">
              <div className="rounded-lg rounded-tl-none bg-[#e7fdd8] px-3.5 py-3 text-sm leading-relaxed text-zinc-800 shadow-sm">
                Hi, the PUC certificate for your vehicle <b>{"{{1}}"}</b> expires on <b>{"{{2}}"}</b>. Renew it at <b>{"{{3}}"}</b> to stay road-legal. For help call {"{{4}}"}. Reply STOP to stop these reminders.
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                Create this as a <b>Utility</b> template in WhatsApp Manager with 4 body variables: vehicle number, expiry date, outlet name, support/outlet phone. The template name above must match exactly.
              </p>
            </Card>

            <Card title="WhatsApp connection">
              {live ? (
                <Notice tone="green">
                  <b className="font-medium">Live.</b> Credentials are configured — automatic and manual reminders send via WhatsApp.
                </Notice>
              ) : (
                <Notice tone="amber">
                  <b className="font-medium">Simulation mode.</b> WhatsApp credentials aren’t set on the server, so runs are logged as “simulated” and nothing is sent. Add{" "}
                  <code className="text-xs">WHATSAPP_TOKEN</code> and <code className="text-xs">WHATSAPP_PHONE_NUMBER_ID</code> to go live.
                </Notice>
              )}
            </Card>

            <Card pad={false} title={`Opted out · ${optedOut?.length ?? 0}`}>
              {!optedOut?.length ? (
                <Empty title="No opted-out customers" hint="Customers who reply STOP are listed here and skipped by the reminder engine." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Mobile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optedOut.map((v) => (
                        <tr key={v.vehicle_no}>
                          <td>
                            <Link href={`/vehicles?q=${encodeURIComponent(v.vehicle_no)}`} className="font-mono text-[13px] font-medium text-zinc-900 hover:underline">
                              {fmtPlate(v.vehicle_no)}
                            </Link>
                          </td>
                          <td className="tabular text-zinc-600">{v.mobile ? fmtMobile(v.mobile) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
