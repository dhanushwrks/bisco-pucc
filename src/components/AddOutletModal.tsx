"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createOutlet } from "@/app/(dash)/actions";
import { ActionForm, Submit } from "./forms";
import { OutletFields } from "./OutletFields";
import { Modal } from "./Modal";

export function AddOutletModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} /> Add outlet
      </button>
      {open && (
        <Modal title="Add outlet" onClose={() => setOpen(false)}>
          <ActionForm action={createOutlet} resetOnSuccess onSuccess={() => setOpen(false)} className="space-y-3">
            <OutletFields />
            <Submit>Add outlet</Submit>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
