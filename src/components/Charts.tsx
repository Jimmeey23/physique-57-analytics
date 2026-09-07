import { useState } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { Btn, Segmented } from "./ui";
import { GRAY_RAMP } from "../lib/theme";
import { compact, intFmt } from "../lib/format";

const ACCENT = "rgb(var(--loc))";
const GRAY = "rgb(var(--gray-500))";
const GRAY_SOFT = "rgb(var(--gray-300))";

const axis = {
  stroke: "rgb(var(--text-3))",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
};

function TT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 text-[11px] shadow-lg">
      <p className="mb-1.5 font-display font-semibold text-hi">{label}</p>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-lo">
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: p.color || p.fill }} />
              {p.name}
            </span>
            <span className="num font-medium text-hi">
              {/rev|value|aov|amount|discount|cumulative|checked|fill|avg/i.test(String(p.dataKey))
                ? /fill|rate|pct|share/i.test(String(p.dataKey))
                  ? `${Number(p.value).toFixed(1)}%`
                  : compact(p.value)
                : intFmt(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Composed trend chart with controls ─────────── */
export function TrendChart({
  data, bars, lines, areas, height = 280,
}: {
  data: any[];
  bars?: { key: string; name: string; color?: string }[];
  lines?: { key: string; name: string; color?: string }[];
  areas?: { key: string; name: string; color?: string }[];
  height?: number;
}) {
  const [grid, setGrid] = useState(true);
  const [legend, setLegend] = useState(true);
  const [tip, setTip] = useState(true);

  const grayFills = [GRAY, GRAY_SOFT, "rgb(var(--gray-400))", "rgb(var(--gray-600))"];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface2/50 px-3 py-2">
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">View</span>
        <Btn size="xs" active={grid} onClick={() => setGrid(!grid)}>Grid</Btn>
        <Btn size="xs" active={legend} onClick={() => setLegend(!legend)}>Legend</Btn>
        <Btn size="xs" active={tip} onClick={() => setTip(!tip)}>Tooltip</Btn>
        <span className="ml-auto num text-[9.5px] text-lo">{data.length} points</span>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="barAccent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--loc))" stopOpacity={0.92} />
                <stop offset="100%" stopColor="rgb(var(--loc))" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="barGray" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--gray-400))" stopOpacity={0.9} />
                <stop offset="100%" stopColor="rgb(var(--gray-400))" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            {grid && <CartesianGrid strokeDasharray="2 6" stroke="rgb(var(--line))" vertical={false} />}
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} tickFormatter={(v) => compact(v)} width={52} />
            {(lines?.length || 0) > 0 && (
              <YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={(v) => compact(v)} width={48} />
            )}
            {tip && <Tooltip content={<TT />} cursor={{ fill: "rgb(var(--gray-200) / 0.5)" }} />}
            {legend && <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="plainline" iconSize={9} />}
            {areas?.map((a, i) => (
              <Area key={a.key} type="monotone" dataKey={a.key} name={a.name}
                stroke={a.color || grayFills[i % grayFills.length]}
                fill={a.color || grayFills[i % grayFills.length]}
                fillOpacity={0.12} strokeWidth={2} animationDuration={850} />
            ))}
            {bars?.map((b, i) => (
              <Bar key={b.key} dataKey={b.key} name={b.name}
                fill={b.color || (i === 0 ? "url(#barAccent)" : "url(#barGray)")}
                radius={[4, 4, 0, 0]} maxBarSize={34} animationDuration={850} />
            ))}
            {lines?.map((l) => (
              <Line key={l.key} yAxisId="r" type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color || (bars?.length ? GRAY : ACCENT)} strokeWidth={2}
                dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={1000} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────── Donut — accent hero + gray ramp ─────────── */
export function Donut({
  data, height = 250, inner = 58, colors,
}: {
  data: { name: string; value: number }[];
  height?: number;
  inner?: number;
  colors?: string[];
}) {
  const [labels, setLabels] = useState(false);
  const [legend, setLegend] = useState(true);
  const total = data.reduce((s, d) => s + d.value, 0);
  const fills = colors || [ACCENT, ...GRAY_RAMP.map((g) => g)];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface2/50 px-3 py-2">
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">View</span>
        <Btn size="xs" active={labels} onClick={() => setLabels(!labels)}>Labels</Btn>
        <Btn size="xs" active={legend} onClick={() => setLegend(!legend)}>Legend</Btn>
        <span className="ml-auto num text-[9.5px] text-lo">{data.length} segments</span>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={inner} outerRadius={inner + 32}
              paddingAngle={2} cornerRadius={3} animationDuration={850}
              label={labels ? ({ percent }: any) => `${(percent * 100).toFixed(0)}%` : false}
              labelLine={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={fills[i % fills.length]} stroke="rgb(var(--surface))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={({ active, payload }: any) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[11px] shadow-lg">
                  <p className="font-semibold text-hi">{payload[0].name}</p>
                  <p className="num text-lo">{compact(payload[0].value)} · {((payload[0].value / (total || 1)) * 100).toFixed(1)}%</p>
                </div>
              ) : null
            } />
            {legend && <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────── Ranked bars — accent leader, gray tail ─────────── */
export function RankBars({
  data, height = 300, dataKey = "value",
}: { data: { name: string; value: number }[]; height?: number; dataKey?: string }) {
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [vals, setVals] = useState(true);
  const sorted = [...data].sort((a, b) => (dir === "desc" ? b.value - a.value : a.value - b.value));
  const fillFor = (i: number) =>
    i === 0 ? ACCENT : GRAY_RAMP[(i - 1) % GRAY_RAMP.length];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface2/50 px-3 py-2">
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">View</span>
        <Segmented size="xs" value={dir} onChange={(v) => setDir(v)}
          options={[{ value: "desc", label: "Top" }, { value: "asc", label: "Bottom" }]} />
        <Btn size="xs" active={vals} onClick={() => setVals(!vals)}>Values</Btn>
        <span className="ml-auto num text-[9.5px] text-lo">{data.length} items</span>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={sorted} layout="vertical" margin={{ top: 4, right: vals ? 40 : 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgb(var(--line))" horizontal={false} />
            <XAxis type="number" {...axis} tickFormatter={(v) => compact(v)} />
            <YAxis type="category" dataKey="name" {...axis} width={128} />
            <Tooltip content={<TT />} cursor={{ fill: "rgb(var(--gray-200) / 0.5)" }} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={850}
              label={vals ? ({ x, y, width, value }: any) => (
                <text x={x + width + 6} y={y + 8} fontSize={9} fill="rgb(var(--text-3))" className="num">
                  {compact(value)}
                </text>
              ) : false}>
              {sorted.map((_, i) => <Cell key={i} fill={fillFor(i)} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────── Radar ─────────── */
export function RadarMix({ data, height = 260 }: { data: { subject: string; A: number }[]; height?: number }) {
  const [grid, setGrid] = useState(true);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface2/50 px-3 py-2">
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">View</span>
        <Btn size="xs" active={grid} onClick={() => setGrid(!grid)}>Grid</Btn>
        <span className="ml-auto num text-[9.5px] text-lo">{data.length} axes</span>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={data} outerRadius="72%">
            {grid && <PolarGrid stroke="rgb(var(--line))" />}
            <PolarAngleAxis dataKey="subject" tick={{ fill: "rgb(var(--text-3))", fontSize: 9 }} />
            <Radar name="Index" dataKey="A" stroke={ACCENT} fill={ACCENT} fillOpacity={0.22} animationDuration={850} />
            <Tooltip content={<TT />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────── Bubble ─────────── */
export function BubbleChart({
  data, height = 300, colorBy,
}: {
  data: { x: number; y: number; z: number; name: string; c?: string }[];
  height?: number;
  colorBy?: (d: { x: number; y: number; z: number; name: string; c?: string }, i: number) => string;
}) {
  const [grid, setGrid] = useState(true);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface2/50 px-3 py-2">
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">View</span>
        <Btn size="xs" active={grid} onClick={() => setGrid(!grid)}>Grid</Btn>
        <span className="ml-auto text-[9.5px] text-lo">x txns · y aov · size revenue</span>
      </div>
      <div className="p-2">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 8, right: 14, left: -8, bottom: 8 }}>
            {grid && <CartesianGrid strokeDasharray="2 6" stroke="rgb(var(--line))" />}
            <XAxis type="number" dataKey="x" name="Txns" {...axis} tickFormatter={(v) => intFmt(v)} />
            <YAxis type="number" dataKey="y" name="AOV" {...axis} tickFormatter={(v) => compact(v)} width={52} />
            <ZAxis type="number" dataKey="z" range={[50, 620]} />
            <Tooltip cursor={{ strokeDasharray: "3 3", stroke: GRAY }}
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[11px] shadow-lg">
                    <p className="font-semibold text-hi">{payload[0].payload.name}</p>
                    <p className="num text-lo">Txns {intFmt(payload[0].payload.x)}</p>
                    <p className="num text-lo">AOV {compact(payload[0].payload.y)}</p>
                    <p className="num text-lo">Revenue {compact(payload[0].payload.z)}</p>
                  </div>
                ) : null
              } />
            <Scatter data={data} animationDuration={850} fill={ACCENT} fillOpacity={0.55}>
              {colorBy && data.map((d, i) => <Cell key={i} fill={colorBy(d, i)} fillOpacity={0.6} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
