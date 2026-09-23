"use client";

import { useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ActionForm, Submit } from "@/components/forms";
import { sendReminderAction, toggleOptOut } from "@/app/(dash)/actions";

const TEMPLATES = [
  { value: "pucc_expiry_reminder", label: "PUC expiry reminder" },
] as const;

export function VehicleDetailActions({
  vehicleNo,
  optedOut,
  canSend,
  defaultTemplate,
  defaultLanguage,
}: {
  vehicleNo: string;
  optedOut: boolean;
  canSend: boolean;
  defaultTemplate: string;
  defaultLanguage: string;
}) {
  const [open, setOpen] = useState(false);
  const [mutePending, setMutePending] = useState(false);
  const templates = Array.from(
    new Map(
      [...TEMPLATES.map((t) => [t.value, t.label] as const), [defaultTemplate, defaultTemplate === "pucc_expiry_reminder" ? "PUC expiry reminder (default)" : `${defaultTemplate} (default)`]],
    ).entries(),
  ).map(([value, label]) => ({ value, label }));

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-outline"
        disabled={mutePending}
        onClick={async () => {
          setMutePending(true);
          try {
            await toggleOptOut(vehicleNo, !optedOut);
          } finally {
            setMutePending(false);
          }
        }}
      >
        {optedOut ? <Bell size={15} /> : <BellOff size={15} />}
        {optedOut ? "Unmute reminders" : "Mute reminders"}
      </button>

      <button
        type="button"
        className="btn-primary"
        disabled={!canSend || optedOut}
        title={optedOut ? "Customer has opted out" : !canSend ? "No mobile number" : "Send WhatsApp alert"}
        onClick={() => setOpen(true)}
      >
        <Send size={15} /> Send alert
      </button>

      {open && (
        <Modal title="Send WhatsApp alert" onClose={() => setOpen(false)}>
          <ActionForm
            action={sendReminderAction.bind(null, vehicleNo)}
            className="space-y-3"
            onSuccess={() => setOpen(false)}
          >
            <div>
              <label className="label" htmlFor="template">Template</label>
              <select id="template" name="template" className="input" required defaultValue={defaultTemplate}>
                {templates.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">Must match an approved Utility template in WhatsApp Manager.</p>
            </div>
            <div>
              <label className="label" htmlFor="language">Language</label>
              <input id="language" name="language" className="input" defaultValue={defaultLanguage || "en"} required />
            </div>
            <div className="flex gap-2 pt-1">
              <Submit className="btn-primary flex-1">Send now</Submit>
              <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
