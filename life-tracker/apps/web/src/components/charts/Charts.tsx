import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useReducedMotion } from "motion/react";

/**
 * Themed chart wrappers. Colors come from CSS tokens (--chart-*), so charts
 * follow light/dark mode automatically. Every chart takes a `title` that is
 * exposed to screen readers along with a text summary.
 */

export type Datum = { label: string } & Record<string, number | string>;
export interface Series {
  key: string;
  name: string;
  color?: string;
}

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const axis = { stroke: "var(--text-muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const ANIM_MS = 700;
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const tick = (v: number) => compact.format(v);

function ChartTooltip({ active, payload, label, unit }: Partial<TooltipContentProps<number, string>> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] shadow-pop">
      {label !== undefined && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="tabular font-semibold">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            {unit ? ` ${unit}` : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

function Frame({ title, summary, height, children }: { title: string; summary: string; height: number; children: React.ReactElement }) {
  return (
    <figure role="img" aria-label={`${title}. ${summary}`} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </figure>
  );
}

function summarize(data: Datum[], series: Series[]) {
  return series
    .map((s) => {
      const vals = data.map((d) => Number(d[s.key])).filter((n) => !Number.isNaN(n));
      if (!vals.length) return `${s.name}: no data`;
      return `${s.name} from ${vals[0].toLocaleString()} to ${vals[vals.length - 1].toLocaleString()}, high ${Math.max(...vals).toLocaleString()}`;
    })
    .join("; ");
}

export function TrendChart({
  title,
  data,
  series,
  height = 220,
  unit,
  area = false,
  domain,
}: {
  title: string;
  data: Datum[];
  series: Series[];
  height?: number;
  unit?: string;
  area?: boolean;
  domain?: [number | "auto", number | "auto"];
}) {
  const reduce = useReducedMotion();
  const common = { isAnimationActive: !reduce, animationDuration: ANIM_MS };
  const Chart = area ? AreaChart : LineChart;
  return (
    <Frame title={title} summary={summarize(data, series)} height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? PALETTE[i % PALETTE.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color ?? PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} domain={domain ?? ["auto", "auto"]} width={48} tickFormatter={tick} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "var(--border)" }} />
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i % PALETTE.length];
          return area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} strokeWidth={2.5} fill={`url(#fill-${s.key})`} {...common} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: color }} activeDot={{ r: 5 }} {...common} />
          );
        })}
      </Chart>
    </Frame>
  );
}

export function BarSeries({
  title,
  data,
  series,
  height = 220,
  unit,
  highlightLast = false,
}: {
  title: string;
  data: Datum[];
  series: Series[];
  height?: number;
  unit?: string;
  /** Emphasize the final bar (e.g. "today"). */
  highlightLast?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <Frame title={title} summary={summarize(data, series)} height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={48} tickFormatter={tick} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--surface-2)" }} />
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i % PALETTE.length];
          return (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={color} radius={[6, 6, 2, 2]} maxBarSize={34} isAnimationActive={!reduce} animationDuration={ANIM_MS}>
              {highlightLast &&
                data.map((_, idx) => <Cell key={idx} fill={color} fillOpacity={idx === data.length - 1 ? 1 : 0.45} />)}
            </Bar>
          );
        })}
      </BarChart>
    </Frame>
  );
}

export function Donut({
  title,
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  title: string;
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const reduce = useReducedMotion();
  const total = data.reduce((a, d) => a + d.value, 0);
  const summary = data.map((d) => `${d.name} ${d.value}`).join(", ");
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative" style={{ width: height, height }}>
        <Frame title={title} summary={summary} height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={!reduce}
              animationDuration={ANIM_MS}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </Frame>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
            {centerValue && <span className="tabular text-[22px] font-bold">{centerValue}</span>}
            {centerLabel && <span className="text-[12px] text-muted">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="space-y-1.5 text-[13.5px]">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color ?? PALETTE[i % PALETTE.length] }} />
            <span>{d.name}</span>
            <span className="tabular ml-auto pl-4 text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
