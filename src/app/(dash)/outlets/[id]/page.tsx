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
          <Link href={`/upload?outlet=${o.id}`} className="btn-primary w-full sm:w-auto">Upload for this outlet</Link>
        </>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card pad={false} title="Upload history">
            {!uploads?.length ? <Empty title="No uploads yet" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th className="text-right">Rows</th>
                      <th className="text-right">New</th>
                      <th className="hidden text-right sm:table-cell">Renewed</th>
                      <th className="hidden text-right md:table-cell">Dupes</th>
                      <th className="hidden text-right md:table-cell">Rejected</th>
                      <th className="hidden lg:table-cell">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((u) => (
                      <tr key={u.id}>
                        <td className="tabular whitespace-nowrap">
                          {u.period_from === u.period_to ? fmtDate(u.period_from) : `${fmtDate(u.period_from)} – ${fmtDate(u.period_to)}`}
                          <div className="mt-0.5 text-[11px] text-zinc-400 lg:hidden">{fmtDateTime(u.created_at)}</div>
                        </td>
                        <td className="text-right tabular">{u.total_rows}</td>
                        <td className="text-right tabular text-brand-700">{u.new_vehicles}</td>
                        <td className="hidden text-right tabular sm:table-cell">{u.renewed}</td>
                        <td className="hidden text-right tabular text-zinc-400 md:table-cell">{u.already_imported}</td>
                        <td className="hidden text-right tabular md:table-cell">{u.rejected ? <span className="text-rose-600">{u.rejected}</span> : 0}</td>
                        <td className="hidden whitespace-nowrap text-xs text-zinc-500 lg:table-cell">{fmtDateTime(u.created_at)}</td>
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
                  <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{u.full_name || u.email}</div>
                      <div className="truncate text-xs text-zinc-500">{u.email}</div>
                    </div>
                    <ActionButton className="btn-ghost btn-sm self-start text-rose-600 sm:self-auto" confirm={`Remove ${u.email}? They will lose access.`}
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
