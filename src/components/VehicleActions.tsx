"use client";

import { useState, useTransition } from "react";
import { BellOff, Bell, Send } from "lucide-react";
import { sendReminderAction, toggleOptOut } from "@/app/(dash)/actions";

export function VehicleActions({ vehicleNo, optedOut, canSend }: { vehicleNo: string; optedOut: boolean; canSend: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string } | null>(null);
  return (
    <div className="flex items-center justify-end gap-1">
      {msg && <span className={`mr-1 max-w-40 truncate text-xs ${msg.error ? "text-rose-600" : "text-brand-700"}`} title={msg.error ?? msg.message}>{msg.error ?? msg.message}</span>}
      <button className="btn-ghost btn-sm" disabled={pending || !canSend || optedOut} title="Send WhatsApp reminder now"
        onClick={() => start(async () => setMsg(await sendReminderAction(vehicleNo)))}>
        <Send size={13} /> <span className="hidden xl:inline">Remind</span>
      </button>
      <button className="btn-ghost btn-sm text-zinc-500" disabled={pending}
        title={optedOut ? "Resume reminders" : "Stop reminders (opt out)"}
        onClick={() => start(async () => { await toggleOptOut(vehicleNo, !optedOut); setMsg(null); })}>
        {optedOut ? <Bell size={13} /> : <BellOff size={13} />}
      </button>
    </div>
  );
}
