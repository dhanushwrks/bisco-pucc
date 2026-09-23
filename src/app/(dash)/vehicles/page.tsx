import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { getDb, getSession } from "@/lib/session";
import { addDays, fmtDate, fmtMobile, fmtPlate, todayIST, validity } from "@/lib/format";
import { normalizePlate } from "@/lib/parse";
import { Card, Empty, PageHeader, Pill, ValidityPill } from "@/components/ui";
import { VehiclesToolbar } from "@/components/VehiclesToolbar";
import { ClickableRow } from "@/components/ClickableRow";

const PAGE = 15;

type SP = { q?: string; status?: string; outlet?: string; fuel?: string; sort?: string; page?: string };
type SortKey = "newest" | "oldest" | "expiring" | "valid_longest" | "tested" | "plate";

function applySort<T extends { order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => T }>(
  q: T,
  sort: SortKey,
) {
  switch (sort) {
    case "oldest":
      return q.order("first_seen_at", { ascending: true });
    case "expiring":
      return q.order("valid_until", { ascending: true, nullsFirst: false });
    case "valid_longest":
      return q.order("valid_until", { ascending: false, nullsFirst: false });
    case "tested":
      return q.order("last_test_date", { ascending: false, nullsFirst: false });
    case "plate":
      return q.order("vehicle_no", { ascending: true });
    case "newest":
    default:
      return q.order("first_seen_at", { ascending: false });
  }
}

export default async function Vehicles({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await getSession();
  const db = await getDb();
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const sort = (sp.sort ?? "newest") as SortKey;
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayIST();
  const term = (sp.q ?? "").trim();
  const fuel = (sp.fuel ?? "").trim().toUpperCase();

  let q = db.from("vehicles").select(
    "vehicle_no, mobile, model, fuel, valid_until, last_test_date, first_seen_at, opted_out, outlets(name)",
    { count: "exact" },
  );

  if (term) {
    const digits = term.replace(/\D/g, "");
    q = digits.length >= 5 && digits.length === term.replace(/\s/g, "").length
      ? q.like("mobile", `%${digits}%`)
      : q.like("vehicle_no", `%${normalizePlate(term)}%`);
  }
  if (sp.outlet) q = q.eq("last_outlet_id", sp.outlet);
  if (fuel) q = q.ilike("fuel", fuel);
  if (status === "expiring") q = q.gte("valid_until", today).lte("valid_until", addDays(today, 30));
  if (status === "expired") q = q.lt("valid_until", today);
  if (status === "valid") q = q.gt("valid_until", addDays(today, 30));
  if (status === "nomobile") q = q.is("mobile", null);
  if (status === "optedout") q = q.eq("opted_out", true);

  q = applySort(q, sort);

  const [{ data: rows, count }, { data: outlets }] = await Promise.all([
    q.range((page - 1) * PAGE, page * PAGE - 1),
    db.from("outlets").select("id, name").order("name"),
  ]);

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: Partial<SP>) => {
    const u = new URLSearchParams();
    const m = { ...sp, ...p };
    Object.entries(m).forEach(([k, v]) => {
      if (!v || v === "all" || (k === "page" && v === "1") || (k === "sort" && v === "newest")) return;
      u.set(k, String(v));
    });
    return `/vehicles${u.size ? `?${u}` : ""}`;
  };

  const filtered = Boolean(term || status !== "all" || sp.outlet || fuel);

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle="One record per vehicle number · latest certificate wins"
      />

      <Suspense fallback={<div className="mb-4 h-24 animate-pulse rounded-xl bg-zinc-100" />}>
        <VehiclesToolbar
          outlets={outlets ?? []}
          showOutlets={me.role === "owner"}
          total={count ?? 0}
        />
      </Suspense>

      <Card className="mt-4" pad={false}>
        {!rows?.length ? (
          <Empty
            title={filtered ? "No vehicles match" : "No vehicles yet"}
            hint={filtered ? "Try clearing filters or a different search." : "Upload an outlet’s certificate export to get started."}
            action={!filtered && <Link href="/upload" className="btn-primary">Upload file</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th className="hidden sm:table-cell">Mobile</th>
                  <th className="hidden lg:table-cell">Model</th>
                  <th className="hidden md:table-cell">Outlet</th>
                  <th>Valid till</th>
                  <th className="hidden lg:table-cell">Added</th>
                  <th className="hidden md:table-cell">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const o = (Array.isArray(v.outlets) ? v.outlets[0] : v.outlets) as { name: string } | null;
                  return (
                    <ClickableRow
                      key={v.vehicle_no}
                      href={`/vehicles/${encodeURIComponent(v.vehicle_no)}`}
                      className={v.opted_out ? "opacity-60" : ""}
                    >
                      <td className="whitespace-nowrap">
                        <div className="font-mono text-[13px] font-medium">{fmtPlate(v.vehicle_no)}</div>
                        <div className="text-[11px] text-zinc-400">{v.fuel ?? ""}{v.opted_out ? " · muted" : ""}</div>
                        <div className="mt-0.5 text-[11px] tabular text-zinc-500 sm:hidden">
                          {v.mobile ? fmtMobile(v.mobile) : "No mobile"}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap tabular text-zinc-600 sm:table-cell">
                        {v.mobile ? fmtMobile(v.mobile) : <Pill>No mobile</Pill>}
                      </td>
                      <td className="hidden max-w-52 truncate text-zinc-600 lg:table-cell">{v.model ?? "—"}</td>
                      <td className="hidden max-w-44 truncate text-zinc-600 md:table-cell" title={o?.name ?? undefined}>
                        {o?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap tabular text-zinc-600">
                        <div>{fmtDate(v.valid_until)}</div>
                        <div className="mt-1 md:hidden"><ValidityPill {...validity(v.valid_until, today)} /></div>
                      </td>
                      <td className="hidden whitespace-nowrap tabular text-zinc-500 lg:table-cell">
                        {fmtDate(v.first_seen_at.slice(0, 10))}
                      </td>
                      <td className="hidden whitespace-nowrap md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <ValidityPill {...validity(v.valid_until, today)} />
                          {v.opted_out && <Pill>Muted</Pill>}
                        </div>
                      </td>
                      <td className="text-zinc-300">
                        <ChevronRight size={16} aria-hidden />
                      </td>
                    </ClickableRow>
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
