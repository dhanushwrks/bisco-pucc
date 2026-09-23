import { DEMO_REVENUE, formatCompact, formatInr, type MonthPoint } from "@/lib/demo-analytics";

const W = 560;
const H = 200;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

export function RevenueChart({ data = DEMO_REVENUE }: { data?: MonthPoint[] }) {
  const max = Math.max(...data.map((d) => d.revenue)) * 1.08;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const gap = 12;
  const barW = (innerW - gap * (data.length - 1)) / data.length;
  const total = data.reduce((a, d) => a + d.revenue, 0);
  const latest = data[data.length - 1]!;
  const prev = data[data.length - 2];
  const delta = prev ? ((latest.revenue - prev.revenue) / prev.revenue) * 100 : 0;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular text-zinc-900">{formatInr(total)}</div>
          <div className="mt-0.5 text-xs text-zinc-500">Demo · last 6 months</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div className="font-medium tabular text-zinc-800">{formatInr(latest.revenue)} this month</div>
          <div className={delta >= 0 ? "text-brand-700" : "text-rose-600"}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs prior month
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly revenue chart">
        {ticks.map((v) => {
          const y = PAD.top + innerH - (v / max) * innerH;
          return (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#f4f4f5" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-zinc-400" fontSize={10}>
                {formatCompact(v)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.revenue / max) * innerH;
          const x = PAD.left + i * (barW + gap);
          const y = PAD.top + innerH - h;
          const isLast = i === data.length - 1;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                className={isLast ? "fill-brand-500" : "fill-zinc-200"}
              />
              <text
                x={x + barW / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-zinc-500"
                fontSize={11}
              >
                {d.month}
              </text>
              <title>{`${d.month}: ${formatInr(d.revenue)} · ${d.tests.toLocaleString("en-IN")} tests`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
