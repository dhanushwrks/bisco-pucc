import type { ReactNode } from "react";
import type { Validity } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "", pad = true }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "amber" | "red" | "green";
}) {
  const dot = { default: "bg-zinc-300", amber: "bg-amber-400", red: "bg-rose-500", green: "bg-brand-500" }[tone];
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-zinc-900 tabular">{value}</div>
      {hint && <div className="mt-2 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

const TONES = {
  green: "bg-brand-50 text-brand-700 ring-brand-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-500/10",
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = "zinc", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ValidityPill({ state, days }: { state: Validity; days: number | null }) {
  if (state === "unknown" || days === null) return <Pill>Unknown</Pill>;
  if (state === "expired") return <Pill tone="red">Expired {Math.abs(days)}d ago</Pill>;
  if (state === "expiring") return <Pill tone="amber">{days === 0 ? "Expires today" : `${days}d left`}</Pill>;
  return <Pill tone="green">Valid</Pill>;
}

export function Empty({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-medium text-zinc-800">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "zinc", children }: { tone?: "zinc" | "amber" | "red" | "green"; children: ReactNode }) {
  const c = {
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    green: "border-brand-100 bg-brand-50 text-brand-700",
  }[tone];
  return <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${c}`}>{children}</div>;
}
