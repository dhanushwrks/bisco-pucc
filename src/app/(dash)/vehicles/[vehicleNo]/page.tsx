import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDb, getSession } from "@/lib/session";
import { fmtDate, fmtDateTime, fmtMobile, fmtPlate, todayIST, validity } from "@/lib/format";
import { normalizePlate } from "@/lib/parse";
import { whatsappConfigured } from "@/lib/whatsapp";
import { Card, Empty, Notice, PageHeader, Pill, ValidityPill } from "@/components/ui";
import { VehicleDetailActions } from "@/components/VehicleDetailActions";

const STATUS_TONE = {
  queued: "zinc", simulated: "blue", sent: "zinc", delivered: "green", read: "green", failed: "red",
} as const;

export default async function VehicleDetail({ params }: { params: Promise<{ vehicleNo: string }> }) {
  const me = await getSession();
  const { vehicleNo: raw } = await params;
  const plate = normalizePlate(decodeURIComponent(raw));
  if (!plate) notFound();

  const db = await getDb();
  const today = todayIST();

  const [{ data: v }, { data: certs }, { data: log }, { data: org }] = await Promise.all([
    db.from("vehicles")
      .select("vehicle_no, mobile, model, fuel, valid_until, last_test_date, last_pucc_no, first_seen_at, updated_at, opted_out, outlets(name, phone)")
      .eq("vehicle_no", plate)
      .maybeSingle(),
    db.from("certificates")
      .select("pucc_no, test_date, valid_until, result, fuel, model, outlet_id, created_at, outlets(name)")
      .eq("vehicle_no", plate)
      .order("test_date", { ascending: false })
      .limit(20),
    me.role === "owner"
      ? db.from("reminders")
          .select("id, kind, stage, status, error, created_at")
          .eq("vehicle_no", plate)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as { id: string; kind: string; stage: number | null; status: string; error: string | null; created_at: string }[] }),
    me.role === "owner"
      ? db.from("orgs").select("wa_template, wa_language").eq("id", me.orgId).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!v) notFound();

  const outlet = (Array.isArray(v.outlets) ? v.outlets[0] : v.outlets) as { name: string; phone: string | null } | null;
  const vstate = validity(v.valid_until, today);
  const live = whatsappConfigured();

  return (
    <>
      <Link href="/vehicles" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={14} /> Vehicles
      </Link>

      <PageHeader
        title={fmtPlate(v.vehicle_no)}
        subtitle={[v.fuel, v.model].filter(Boolean).join(" · ") || "Vehicle details"}
        actions={
          me.role === "owner" ? (
            <VehicleDetailActions
              vehicleNo={v.vehicle_no}
              optedOut={v.opted_out}
              canSend={!!v.mobile}
              defaultTemplate={org?.wa_template || "pucc_expiry_reminder"}
              defaultLanguage={org?.wa_language || "en"}
            />
          ) : undefined
        }
      />

      {me.role === "owner" && !live && (
        <div className="mb-6">
          <Notice tone="amber">
            <b className="font-medium">Simulation mode.</b> WhatsApp isn’t configured — alerts are logged as simulated.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Certificate history" pad={false}>
            {!certs?.length ? (
              <Empty title="No certificates on record" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>PUCC no.</th>
                      <th>Tested</th>
                      <th>Valid till</th>
                      <th className="hidden sm:table-cell">Outlet</th>
                      <th className="hidden md:table-cell">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certs.map((c) => {
                      const o = (Array.isArray(c.outlets) ? c.outlets[0] : c.outlets) as { name: string } | null;
                      return (
                        <tr key={c.pucc_no}>
                          <td className="font-mono text-[13px]">{c.pucc_no}</td>
                          <td className="tabular text-zinc-600">{fmtDate(c.test_date)}</td>
                          <td className="tabular text-zinc-600">{fmtDate(c.valid_until)}</td>
                          <td className="hidden text-zinc-600 sm:table-cell">{o?.name ?? "—"}</td>
                          <td className="hidden text-zinc-600 md:table-cell">{c.result ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {me.role === "owner" && (
            <Card title="Alert log" pad={false}>
              {!log?.length ? (
                <Empty title="No alerts sent yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Kind</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap text-xs text-zinc-500">{fmtDateTime(r.created_at)}</td>
                          <td className="text-zinc-600">
                            {r.kind === "manual" ? "Manual" : r.stage == null ? "Auto" : `${r.stage}d stage`}
                          </td>
                          <td title={r.error ?? ""}>
                            <Pill tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "zinc"}>{r.status}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        <Card title="Details">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-zinc-500">Status</dt>
              <dd className="flex items-center gap-1.5">
                <ValidityPill {...vstate} />
                {v.opted_out && <Pill>Muted</Pill>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Mobile</dt>
              <dd className="mt-0.5 tabular">{v.mobile ? fmtMobile(v.mobile) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Valid till</dt>
              <dd className="mt-0.5 tabular">{fmtDate(v.valid_until)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Last tested</dt>
              <dd className="mt-0.5 tabular">{fmtDate(v.last_test_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Last PUCC no.</dt>
              <dd className="mt-0.5 font-mono text-[13px]">{v.last_pucc_no ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Outlet</dt>
              <dd className="mt-0.5">{outlet?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Added</dt>
              <dd className="mt-0.5 tabular">{fmtDateTime(v.first_seen_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Updated</dt>
              <dd className="mt-0.5 tabular">{fmtDateTime(v.updated_at)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
