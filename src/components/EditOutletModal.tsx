"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateOutlet } from "@/app/(dash)/actions";
import { ActionForm, Submit } from "./forms";
import { OutletFields } from "./OutletFields";
import { Modal } from "./Modal";

type Outlet = { id: string; name: string; licence_no: string; etc_id: string | null; phone: string | null; address: string | null };

export function EditOutletModal({ outlet, className = "btn-outline btn-sm" }: { outlet: Outlet; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Pencil size={13} /> Edit
      </button>
      {open && (
        <Modal title="Edit outlet" onClose={() => setOpen(false)}>
          <ActionForm action={updateOutlet.bind(null, outlet.id)} onSuccess={() => setOpen(false)} className="space-y-3">
            <OutletFields o={outlet} />
            <Submit>Save changes</Submit>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
