"use client";

import { useState, useTransition } from "react";
import { BellOff, Bell, Send } from "lucide-react";
import { sendReminderAction, toggleOptOut } from "@/app/(dash)/actions";

export function VehicleActions({ vehicleNo, optedOut, canSend }: { vehicleNo: string; optedOut: boolean; canSend: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string } | null>(null);
  return (
    <div className="flex items-center justify-end gap-1">
      {msg && <span className={`mr-1 max-w-28 truncate text-xs sm:max-w-40 ${msg.error ? "text-rose-600" : "text-brand-700"}`} title={msg.error ?? msg.message}>{msg.error ?? msg.message}</span>}
      <button
        type="button"
        className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2.5 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        disabled={pending || !canSend || optedOut}
        title="Send WhatsApp reminder now"
        onClick={() => start(async () => setMsg(await sendReminderAction(vehicleNo)))}
      >
        <Send size={15} /> <span className="hidden xl:inline">Remind</span>
      </button>
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
        disabled={pending}
        title={optedOut ? "Resume reminders" : "Stop reminders (opt out)"}
        onClick={() => start(async () => { await toggleOptOut(vehicleNo, !optedOut); setMsg(null); })}
      >
        {optedOut ? <Bell size={15} /> : <BellOff size={15} />}
      </button>
    </div>
  );
}
