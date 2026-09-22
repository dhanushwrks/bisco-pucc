import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDb, requireOwner } from "@/lib/session";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Card, Empty, PageHeader, Pill } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { addOperator, removeOperator } from "../../actions";
import { EditOutletModal } from "@/components/EditOutletModal";

export default async function OutletDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const db = await getDb();
  const [{ data: o }, { data: ops }, { data: uploads }] = await Promise.all([
    db.from("outlets").select("*").eq("id", id).maybeSingle(),
    db.from("profiles").select("id, email, full_name, created_at").eq("outlet_id", id).eq("role", "operator"),
    db.from("uploads").select("*").eq("outlet_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!o) notFound();

  return (
    <>
      <Link href="/outlets" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft size={14} /> Outlets</Link>
      <PageHeader title={o.name} subtitle={`Licence ${o.licence_no}${o.etc_id ? ` · ETC ${o.etc_id}` : ""}`}
        actions={<>
          <EditOutletModal outlet={o} />
          <Link href={`/upload?outlet=${o.id}`} className="btn-primary">Upload for this outlet</Link>
        </>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card pad={false} title="Upload history">
            {!uploads?.length ? <Empty title="No uploads yet" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Period</th><th className="text-right">Rows</th><th className="text-right">New</th><th className="text-right">Renewed</th><th className="text-right">Dupes</th><th className="text-right">Rejected</th><th>Uploaded</th></tr></thead>
                  <tbody>
                    {uploads.map((u) => (
                      <tr key={u.id}>
                        <td className="tabular whitespace-nowrap">{u.period_from === u.period_to ? fmtDate(u.period_from) : `${fmtDate(u.period_from)} – ${fmtDate(u.period_to)}`}</td>
                        <td className="text-right tabular">{u.total_rows}</td>
                        <td className="text-right tabular text-brand-700">{u.new_vehicles}</td>
                        <td className="text-right tabular">{u.renewed}</td>
                        <td className="text-right tabular text-zinc-400">{u.already_imported}</td>
                        <td className="text-right tabular">{u.rejected ? <span className="text-rose-600">{u.rejected}</span> : 0}</td>
                        <td className="whitespace-nowrap text-xs text-zinc-500">{fmtDateTime(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Operator logins" action={<Pill>{ops?.length ?? 0}</Pill>}>
            {ops?.length ? (
              <ul className="mb-5 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
                {ops.map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-sm">{u.full_name || u.email}</div>
                      <div className="text-xs text-zinc-500">{u.email}</div>
                    </div>
                    <ActionButton className="btn-ghost btn-sm text-rose-600" confirm={`Remove ${u.email}? They will lose access.`}
                      action={removeOperator.bind(null, o.id, u.id)}>Remove</ActionButton>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-4 text-sm text-zinc-500">Operators can upload files for this outlet only.</p>}
            <ActionForm action={addOperator.bind(null, o.id)} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
              <input name="full_name" className="input" placeholder="Name" />
              <input name="email" type="email" required className="input" placeholder="Email" />
              <input name="password" type="text" required minLength={8} className="input" placeholder="Temporary password" />
              <div className="sm:col-span-3"><Submit className="btn-outline">Create operator login</Submit></div>
            </ActionForm>
          </Card>
        </div>

        <Card title="Details" action={<EditOutletModal outlet={o} className="btn-ghost btn-sm" />}>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-zinc-500">Outlet name</dt><dd className="mt-0.5">{o.name}</dd></div>
            <div><dt className="text-xs text-zinc-500">Licence no.</dt><dd className="mt-0.5">{o.licence_no}</dd></div>
            <div><dt className="text-xs text-zinc-500">ETC ID</dt><dd className="mt-0.5">{o.etc_id || "—"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Phone</dt><dd className="mt-0.5">{o.phone || "—"}</dd></div>
            <div><dt className="text-xs text-zinc-500">Address</dt><dd className="mt-0.5">{o.address || "—"}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}
