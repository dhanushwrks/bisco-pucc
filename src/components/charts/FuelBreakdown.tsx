import { DEMO_FUELS, formatCompact, type CategoryCount } from "@/lib/demo-analytics";

const TONES: Record<string, string> = {
  petrol: "bg-amber-500",
  diesel: "bg-zinc-700",
  cng: "bg-sky-500",
  ev: "bg-brand-500",
};

export function FuelBreakdown({ data = DEMO_FUELS }: { data?: CategoryCount[] }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const petrol = data.find((d) => d.key === "petrol");
  const diesel = data.find((d) => d.key === "diesel");

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-amber-50 px-3 py-3">
          <div className="text-[11px] font-medium text-amber-800/70">Petrol</div>
          <div className="mt-1 text-xl font-semibold tabular text-amber-950 sm:text-2xl">
            {(petrol?.count ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="mt-0.5 text-xs tabular text-amber-800/60">
            {total ? (((petrol?.count ?? 0) / total) * 100).toFixed(0) : 0}% of fleet
          </div>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-3">
          <div className="text-[11px] font-medium text-zinc-500">Diesel</div>
          <div className="mt-1 text-xl font-semibold tabular text-zinc-900 sm:text-2xl">
            {(diesel?.count ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="mt-0.5 text-xs tabular text-zinc-500">
            {total ? (((diesel?.count ?? 0) / total) * 100).toFixed(0) : 0}% of fleet
          </div>
        </div>
      </div>

      <div className="mb-1 flex h-3 overflow-hidden rounded-full bg-zinc-100">
        {data.map((d) => {
          const pct = total ? (d.count / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={d.key}
              className={TONES[d.key] ?? "bg-zinc-400"}
              style={{ width: `${pct}%` }}
              title={`${d.label}: ${formatCompact(d.count)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="mb-4 text-xs text-zinc-400">Demo · fuel mix across all vehicles</div>

      <ul className="space-y-2.5">
        {data.map((d) => {
          const pct = total ? (d.count / total) * 100 : 0;
          return (
            <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-zinc-700">
                <span className={`h-2 w-2 rounded-full ${TONES[d.key] ?? "bg-zinc-400"}`} />
                {d.label}
              </span>
              <span className="tabular text-zinc-600">
                {d.count.toLocaleString("en-IN")}
                <span className="ml-1.5 text-xs text-zinc-400">{pct.toFixed(0)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
