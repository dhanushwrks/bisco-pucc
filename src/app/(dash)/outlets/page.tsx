import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getDb, requireOwner } from "@/lib/session";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Card, Empty, Notice, PageHeader, Pill } from "@/components/ui";
import { AddOutletModal } from "@/components/AddOutletModal";

export default async function Outlets({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  await requireOwner();
  const db = await getDb();
  const { welcome } = await searchParams;
  const [{ data: outlets }, { data: uploads }, { data: vehicles }] = await Promise.all([
    db.from("outlets").select("*").order("created_at"),
    db.from("uploads").select("outlet_id, period_to, created_at").order("created_at", { ascending: false }).limit(500),
    db.from("vehicles").select("last_outlet_id"),
  ]);
  const last = new Map<string, { period_to: string; created_at: string }>();
  for (const u of uploads ?? []) if (!last.has(u.outlet_id)) last.set(u.outlet_id, u);
  const counts = new Map<string, number>();
  for (const v of vehicles ?? []) if (v.last_outlet_id) counts.set(v.last_outlet_id, (counts.get(v.last_outlet_id) ?? 0) + 1);

  return (
    <>
      <PageHeader title="Outlets" subtitle="Each outlet uploads its certificate export daily." actions={<AddOutletModal />} />
      {welcome && !outlets?.length && (
        <div className="mb-6"><Notice tone="green">Welcome! Add your first outlet — the licence number must match the LICENCE_NO column in its export.</Notice></div>
      )}
      <Card pad={false} title={`${outlets?.length ?? 0} outlets`}>
          {!outlets?.length ? (
            <Empty title="No outlets yet" hint="Use the “Add outlet” button to create one."
              action={<AddOutletModal />} />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {outlets.map((o) => {
                const l = last.get(o.id);
                return (
                  <li key={o.id}>
                    <Link href={`/outlets/${o.id}`} className="flex items-center gap-3 px-4 py-4 transition hover:bg-zinc-50 sm:gap-4 sm:px-5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600">
                        {o.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{o.name}</span>
                          {!o.is_active && <Pill>Inactive</Pill>}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          <span className="sm:hidden">{counts.get(o.id) ?? 0} vehicles · {l ? `till ${fmtDate(l.period_to)}` : "Never uploaded"}</span>
                          <span className="hidden sm:inline">Lic. {o.licence_no}{o.etc_id ? ` · ETC ${o.etc_id}` : ""} · {counts.get(o.id) ?? 0} vehicles</span>
                        </div>
                      </div>
                      <div className="hidden text-right sm:block">
                        <div className="text-xs text-zinc-500">Last upload</div>
                        <div className="text-sm tabular" title={l ? `Uploaded ${fmtDateTime(l.created_at)}` : ""}>
                          {l ? `till ${fmtDate(l.period_to)}` : <span className="text-amber-600">Never</span>}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
      </Card>
    </>
  );
}
