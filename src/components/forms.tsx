"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/(dash)/actions";

export function Submit({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? "Saving…" : children}</button>;
}

export function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-rose-600">{state.error}</p>;
  if (state.message) return <p className="text-sm text-brand-700">{state.message}</p>;
  return null;
}

/** Generic form bound to a server action; resets on success when resetOnSuccess. */
export function ActionForm({ action, children, className = "", resetOnSuccess = false, onSuccess }: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.();
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-3"><Feedback state={state} /></div>
    </form>
  );
}

/** Button that runs a server action and shows the resulting message inline. */
export function ActionButton({ action, children, className = "btn-outline btn-sm", confirm: confirmText }: {
  action: () => Promise<ActionState | void>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {msg && <span className={`text-xs ${msg.error ? "text-rose-600" : "text-brand-700"}`}>{msg.error ?? msg.message}</span>}
      <button className={className} disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => setMsg((await action()) ?? null));
        }}>
        {pending ? "…" : children}
      </button>
    </span>
  );
}
