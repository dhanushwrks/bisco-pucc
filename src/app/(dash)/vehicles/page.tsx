import Link from "next/link";
import { Search } from "lucide-react";
import { getDb, getSession } from "@/lib/session";
import { addDays, fmtDate, fmtMobile, fmtPlate, todayIST, validity } from "@/lib/format";
import { normalizePlate } from "@/lib/parse";
import { Card, Empty, PageHeader, Pill, ValidityPill } from "@/components/ui";
import { VehicleActions } from "@/components/VehicleActions";

const PAGE = 50;
const FILTERS = [
  ["all", "All"], ["expiring", "Expiring ≤30d"], ["expired", "Expired"], ["valid", "Valid"], ["nomobile", "No mobile"], ["optedout", "Opted out"],
] as const;

type SP = { q?: string; status?: string; outlet?: string; page?: string };

export default async function Vehicles({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await getSession();
  const db = await getDb();
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayIST();

  let q = db.from("vehicles")
    .select("vehicle_no, mobile, model, fuel, valid_until, last_test_date, opted_out, outlets(name)", { count: "exact" });
  const term = (sp.q ?? "").trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    q = digits.length >= 5 && digits.length === term.replace(/\s/g, "").length
      ? q.like("mobile", `%${digits}%`)
      : q.like("vehicle_no", `%${normalizePlate(term)}%`);
  }
  if (sp.outlet) q = q.eq("last_outlet_id", sp.outlet);
  if (status === "expiring") q = q.gte("valid_until", today).lte("valid_until", addDays(today, 30));
  if (status === "expired") q = q.lt("valid_until", today);
  if (status === "valid") q = q.gt("valid_until", addDays(today, 30));
  if (status === "nomobile") q = q.is("mobile", null);
  if (status === "optedout") q = q.eq("opted_out", true);
  q = status === "expired"
    ? q.order("valid_until", { ascending: false })
    : q.order("valid_until", { ascending: true, nullsFirst: false });

  const [{ data: rows, count }, { data: outlets }] = await Promise.all([
    q.range((page - 1) * PAGE, page * PAGE - 1),
    db.from("outlets").select("id, name").order("name"),
  ]);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: Partial<SP>) => {
    const u = new URLSearchParams();
    const m = { ...sp, ...p };
    Object.entries(m).forEach(([k, v]) => v && v !== "all" && !(k === "page" && v === "1") && u.set(k, String(v)));
    return `/vehicles${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Vehicles" subtitle={`${count ?? 0} vehicles · one record per vehicle number, latest certificate wins`} />

      <div className="mb-4 space-y-3">
        <form className="relative w-full sm:max-w-sm" action="/vehicles">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input name="q" defaultValue={term} className="input pl-9" placeholder="Search vehicle no. or mobile" />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {sp.outlet && <input type="hidden" name="outlet" value={sp.outlet} />}
        </form>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:rounded-lg sm:bg-zinc-100 sm:p-1">
          {FILTERS.map(([k, l]) => (
            <Link key={k} href={href({ status: k, page: "1" })}
              className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-medium transition sm:rounded-md sm:py-1.5 ${status === k ? "bg-zinc-900 text-white sm:bg-white sm:text-zinc-900 sm:shadow-sm" : "bg-zinc-100 text-zinc-600 sm:bg-transparent sm:text-zinc-500 hover:text-zinc-800"}`}>{l}</Link>
          ))}
        </div>
        {me.role === "owner" && (outlets?.length ?? 0) > 1 && (
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link href={href({ outlet: undefined, page: "1" })} className={`shrink-0 rounded-lg px-3 py-2.5 text-xs ${!sp.outlet ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>All outlets</Link>
            {outlets!.map((o) => (
              <Link key={o.id} href={href({ outlet: o.id, page: "1" })} className={`shrink-0 rounded-lg px-3 py-2.5 text-xs ${sp.outlet === o.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>{o.name}</Link>
            ))}
          </div>
        )}
      </div>

      <Card pad={false}>
        {!rows?.length ? (
          <Empty title={term || status !== "all" ? "No vehicles match" : "No vehicles yet"}
            hint={term || status !== "all" ? "Try a different search or filter." : "Upload an outlet’s certificate export to get started."}
            action={!term && status === "all" && <Link href="/upload" className="btn-primary">Upload file</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Vehicle</th><th className="hidden sm:table-cell">Mobile</th><th className="hidden lg:table-cell">Model</th><th className="hidden md:table-cell">Outlet</th><th>Valid till</th><th className="hidden md:table-cell">Status</th>{me.role === "owner" && <th />}</tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const o = (Array.isArray(v.outlets) ? v.outlets[0] : v.outlets) as { name: string } | null;
                  return (
                    <tr key={v.vehicle_no} className={v.opted_out ? "opacity-60" : ""}>
                      <td className="whitespace-nowrap">
                        <div className="font-mono text-[13px] font-medium">{fmtPlate(v.vehicle_no)}</div>
                        <div className="text-[11px] text-zinc-400">{v.fuel ?? ""}{v.opted_out ? " · opted out" : ""}</div>
                        <div className="mt-0.5 text-[11px] tabular text-zinc-500 sm:hidden">{v.mobile ? fmtMobile(v.mobile) : "No mobile"}</div>
                      </td>
                      <td className="hidden whitespace-nowrap tabular text-zinc-600 sm:table-cell">{v.mobile ? fmtMobile(v.mobile) : <Pill>No mobile</Pill>}</td>
                      <td className="hidden max-w-52 truncate text-zinc-600 lg:table-cell">{v.model ?? "—"}</td>
                      <td className="hidden max-w-44 truncate text-zinc-600 md:table-cell" title={o?.name}>{o?.name ?? "—"}</td>
                      <td className="whitespace-nowrap tabular text-zinc-600">
                        <div>{fmtDate(v.valid_until)}</div>
                        <div className="mt-1 md:hidden"><ValidityPill {...validity(v.valid_until, today)} /></div>
                      </td>
                      <td className="hidden whitespace-nowrap md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <ValidityPill {...validity(v.valid_until, today)} />
                          {v.opted_out && <Pill>Opted out</Pill>}
                        </div>
                      </td>
                      {me.role === "owner" && (
                        <td><VehicleActions vehicleNo={v.vehicle_no} optedOut={v.opted_out} canSend={!!v.mobile} /></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn-outline btn-sm" href={href({ page: String(page - 1) })}>Previous</Link>}
            {page < pages && <Link className="btn-outline btn-sm" href={href({ page: String(page + 1) })}>Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
