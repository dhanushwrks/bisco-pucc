export function OutletFields({ o }: { o?: { name: string; licence_no: string; etc_id: string | null; phone: string | null; address: string | null } }) {
  return (
    <>
      <div><label className="label">Outlet name</label><input name="name" required className="input" defaultValue={o?.name ?? ""} placeholder="Kadri Emission Testing Centre" /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">Licence no.</label><input name="licence_no" required className="input" defaultValue={o?.licence_no ?? ""} placeholder="522/2002-2003" /></div>
        <div><label className="label">ETC ID</label><input name="etc_id" className="input" defaultValue={o?.etc_id ?? ""} placeholder="P150" /></div>
      </div>
      <div><label className="label">Phone (shown in reminders)</label><input name="phone" className="input" defaultValue={o?.phone ?? ""} placeholder="98xxxxxxxx" /></div>
      <div><label className="label">Address</label><input name="address" className="input" defaultValue={o?.address ?? ""} /></div>
    </>
  );
}
