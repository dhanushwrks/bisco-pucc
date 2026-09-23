import { DEMO_CATEGORIES, formatCompact, type CategoryCount } from "@/lib/demo-analytics";

const TONES = [
  "bg-brand-500",
  "bg-brand-600",
  "bg-zinc-800",
  "bg-amber-500",
  "bg-sky-500",
] as const;

export function CategoryBreakdown({ data = DEMO_CATEGORIES }: { data?: CategoryCount[] }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular text-zinc-900">
            {total.toLocaleString("en-IN")}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">Demo · vehicles by category</div>
        </div>
        <div className="text-xs text-zinc-400">{data.length} categories</div>
      </div>

      <ul className="space-y-3.5">
        {data.map((d, i) => {
          const pct = total ? (d.count / total) * 100 : 0;
          const width = max ? (d.count / max) * 100 : 0;
          return (
            <li key={d.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-zinc-800">{d.label}</span>
                <span className="tabular text-zinc-600">
                  {d.count.toLocaleString("en-IN")}
                  <span className="ml-1.5 text-xs text-zinc-400">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${TONES[i % TONES.length]}`}
                  style={{ width: `${width}%` }}
                  title={`${d.label}: ${formatCompact(d.count)} · avg fee ₹${d.avgFee}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
