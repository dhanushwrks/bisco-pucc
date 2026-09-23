import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDb, getSession } from "@/lib/session";
import { addDays, fmtDate, fmtPlate, todayIST, validity } from "@/lib/format";
import { Card, Empty, PageHeader, Pill, Stat, ValidityPill } from "@/components/ui";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { CategoryBreakdown } from "@/components/charts/CategoryBreakdown";

type Summary = { total: number; active: number; expiring_7: number; expiring_30: number; expired: number; no_mobile: number; opted_out: number };

export default async function Overview() {
  const me = await getSession();
  const db = await getDb();
  const today = todayIST();
  const start = addDays(today, -13);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));

  const [{ data: summary }, { data: outlets }, { data: uploads }, { data: expiring }, reminders, { data: due }] =
    await Promise.all([
      db.rpc("dashboard_summary"),
      db.from("outlets").select("id, name").eq("is_active", true).order("name"),
      db.from("uploads").select("outlet_id, period_from, period_to, created_at").gte("period_to", start),
      db.from("vehicles").select("vehicle_no, model, valid_until, outlets(name)")
        .gte("valid_until", today).lte("valid_until", addDays(today, 7))
        .order("valid_until").limit(8),
      me.role === "owner"
        ? db.from("reminders").select("status").gte("created_at", addDays(today, -30))
        : Promise.resolve({ data: [] as { status: string }[] }),
      me.role === "owner" ? db.rpc("preview_reminders") : Promise.resolve({ data: [] }),
    ]);

  const s = (summary ?? {}) as Summary;
  const covered = new Map<string, Set<string>>();
  for (const u of uploads ?? []) {
    const set = covered.get(u.outlet_id) ?? new Set<string>();
    for (let d = u.period_from; d <= u.period_to; d = addDays(d, 1)) set.add(d);
    covered.set(u.outlet_id, set);
  }
  const rs = (reminders.data ?? []) as { status: string }[];
  const count = (...st: string[]) => rs.filter((r) => st.includes(r.status)).length;
  const hello = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <>
      <PageHeader
        title={me.role === "owner" ? "Overview" : me.outletName ?? "Overview"}
        subtitle={hello}
        actions={<Link href="/upload" className="btn-primary">Upload today’s file</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active certificates" value={s.active ?? 0} tone="green" hint={`${s.total ?? 0} vehicles on record`} />
        <Stat label="Expiring in 7 days" value={s.expiring_7 ?? 0} tone="amber" hint="Highest-intent renewals" />
        <Stat label="Expiring in 30 days" value={s.expiring_30 ?? 0} tone="amber" hint="In the reminder window" />
        <Stat label="Expired" value={s.expired ?? 0} tone="red" hint={`${s.no_mobile ?? 0} without a mobile`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title={
            <span className="flex items-center gap-2">
              Revenue
              <Pill tone="zinc">Demo</Pill>
            </span>
          }
          action={<span className="text-xs text-zinc-400">Sample figures for showcase</span>}
        >
          <RevenueChart />
        </Card>

        <Card
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              By category
              <Pill tone="zinc">Demo</Pill>
            </span>
          }
        >
          <CategoryBreakdown />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Upload coverage · last 14 days"
          action={<span className="text-xs text-zinc-400">{fmtDate(start)} – {fmtDate(today)}</span>}>
          {!outlets?.length ? (
            <Empty title="No outlets yet" hint="Add your first outlet to start uploading."
              action={me.role === "owner" && <Link href="/outlets" className="btn-outline">Add outlet</Link>} />
          ) : (
            <div className="space-y-3.5">
              {outlets.map((o) => {
                const set = covered.get(o.id) ?? new Set();
                const missing = days.filter((d) => !set.has(d)).length;
                return (
                  <div key={o.id} className="flex items-center gap-4">
                    <div className="w-24 shrink-0 truncate text-sm text-zinc-700 sm:w-36">{o.name}</div>
                    <div className="flex flex-1 gap-1">
                      {days.map((d) => (
                        <div key={d} title={`${fmtDate(d)} · ${set.has(d) ? "uploaded" : "missing"}`}
                          className={`h-6 flex-1 rounded ${set.has(d) ? "bg-brand-500" : d === today ? "border border-dashed border-zinc-300 bg-white" : "bg-zinc-100"}`} />
                      ))}
                    </div>
                    <div className={`w-16 shrink-0 text-right text-xs tabular ${missing > 1 ? "text-amber-600" : "text-zinc-400"}`}>
                      {missing ? `${missing} missing` : "complete"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2" title="WhatsApp reminders · 30 days"
          action={me.role === "owner" && <Link href="/reminders" className="text-xs text-zinc-500 hover:text-zinc-900">Open →</Link>}>
          {me.role === "owner" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["Sent", count("sent", "delivered", "read", "simulated")], ["Read", count("read")], ["Failed", count("failed")]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-zinc-50 py-3">
                    <div className="text-xl font-semibold tabular">{v}</div>
                    <div className="text-xs text-zinc-500">{l}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-zinc-200 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{(due ?? []).length} due on next run</div>
                  <div className="text-xs text-zinc-500">Runs daily at 10:30 AM IST</div>
                </div>
                <Link href="/reminders" className="btn-outline btn-sm">Review</Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Your owner manages reminders. Keep uploads daily so customers are reminded on time.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6" pad={false} title="Expiring this week"
        action={<Link href="/vehicles?status=expiring" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">All expiring <ArrowRight size={12} /></Link>}>
        {!expiring?.length ? (
          <Empty title="Nothing expiring in the next 7 days" />
        ) : (
          <table className="table">
            <thead><tr><th>Vehicle</th><th className="hidden sm:table-cell">Model</th><th className="hidden sm:table-cell">Outlet</th><th>Valid till</th><th /></tr></thead>
            <tbody>
              {expiring.map((v) => {
                const o = (Array.isArray(v.outlets) ? v.outlets[0] : v.outlets) as { name: string } | null;
                return (
                  <tr key={v.vehicle_no}>
                    <td className="whitespace-nowrap font-mono text-[13px] font-medium">{fmtPlate(v.vehicle_no)}</td>
                    <td className="hidden text-zinc-600 sm:table-cell">{v.model ?? "—"}</td>
                    <td className="hidden text-zinc-600 sm:table-cell">{o?.name ?? "—"}</td>
                    <td className="whitespace-nowrap tabular text-zinc-600">{fmtDate(v.valid_until)}</td>
                    <td className="text-right"><ValidityPill {...validity(v.valid_until, today)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
