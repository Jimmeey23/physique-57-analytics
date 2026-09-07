import { useMemo, useState } from "react";
import type { SaleRow } from "../../lib/types";
import { aggregate, groupBy, isGood, monthlySeries, ymLabel, type MonthPoint } from "../../lib/analytics";
import { compact, dec, DOW, intFmt, pct } from "../../lib/format";
import { DataTable, type Col } from "../DataTable";
import { Panel, Segmented, Delta, Tip } from "../ui";
import { Narrative, aggCols } from "../tableKit";
import { TrendChart } from "../Charts";
import { cn } from "../../utils/cn";

const FULL_RANGE_BADGE = (
  <span className="num rounded-md border border-line bg-surface2 px-2 py-1 text-[9.5px] font-semibold text-lo">
    Full history · ignores date filter
  </span>
);

/** All time intelligence ignores the date range and always shows the full span. */
export function TimeSection({ rows, timeRows }: { rows: SaleRow[]; timeRows?: SaleRow[] }) {
  const trows = timeRows ?? rows;
  const series = useMemo(() => monthlySeries(trows), [trows]);
  const [metric, setMetric] = useState<"revenue" | "txns" | "customers" | "aov" | "discount" | "units">("revenue");
  const [overlay, setOverlay] = useState<"none" | "aov" | "cumulative" | "newCustomers">("aov");

  const chartData = series.map((s) => ({
    label: s.label,
    revenue: s.revenue,
    txns: s.txns,
    customers: s.customers,
    aov: s.aov,
    discount: s.discount,
    units: s.units,
    cumulative: s.cumulative,
    newCustomers: s.newCustomers,
  }));

  const cols: Col<MonthPoint>[] = [
    { key: "label", label: "Month", align: "left", value: (r) => r.label, totalMode: "none", width: "90px" },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true, tip: "Gross revenue for the month." },
    { key: "momRev", label: "MoM", value: (r) => r.momRev ?? 0, totalMode: "none", tip: "Month-on-month revenue growth versus the prior calendar month.", render: (r) => <Delta value={r.momRev} /> },
    { key: "yoyRev", label: "YoY", value: (r) => r.yoyRev ?? 0, totalMode: "none", tip: "Year-on-year growth versus the same month last year — removes seasonality.", render: (r) => <Delta value={r.yoyRev} /> },
    { key: "txns", label: "Txns", value: (r) => r.txns, fmt: intFmt },
    { key: "units", label: "Units", value: (r) => r.units, fmt: intFmt },
    { key: "customers", label: "Customers", value: (r) => r.customers, fmt: intFmt },
    { key: "newCustomers", label: "New", value: (r) => r.newCustomers, fmt: intFmt, tip: "First-time buyers acquired in the month." },
    { key: "aov", label: "AOV", value: (r) => r.aov, fmt: compact, totalMode: "custom", totalValue: (rs) => compact(rs.reduce((s, r) => s + r.revenue, 0) / Math.max(1, rs.reduce((s, r) => s + r.txns, 0))) },
    { key: "arpc", label: "Rev/Cust", value: (r) => r.arpc, fmt: compact, totalMode: "custom", totalValue: (rs) => compact(rs.reduce((s, r) => s + r.revenue, 0) / Math.max(1, rs.reduce((s, r) => s + r.customers, 0))) },
    { key: "discount", label: "Discount", value: (r) => r.discount, fmt: compact },
    { key: "discountRate", label: "Disc %", value: (r) => r.discountRate, fmt: (n) => pct(n), totalMode: "custom", totalValue: (rs) => pct((rs.reduce((s, r) => s + r.discount, 0) / Math.max(1, rs.reduce((s, r) => s + r.listValue, 0))) * 100) },
    { key: "exVat", label: "Net ex-VAT", value: (r) => r.exVat, fmt: compact },
    { key: "cumulative", label: "Cumulative", value: (r) => r.cumulative, fmt: compact, totalMode: "none", tip: "Running total of revenue across the filtered window." },
  ];

  /* ---------- YoY pivot ---------- */
  const years = useMemo(() => Array.from(new Set(trows.filter(isGood).map((r) => r.year))).filter(Boolean).sort(), [trows]);
  const pivot = useMemo(() => {
    const m: Record<number, Record<number, number>> = {};
    trows.filter(isGood).forEach((r) => {
      if (!r.year) return;
      m[r.month] = m[r.month] || {};
      m[r.month][r.year] = (m[r.month][r.year] || 0) + r.paymentValue;
    });
    return Array.from({ length: 12 }, (_, i) => {
      const mo = i + 1;
      const row: any = { month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i] };
      years.forEach((y) => (row[`y${y}`] = m[mo]?.[y] || 0));
      const a = years.length > 1 ? row[`y${years[years.length - 2]}`] : 0;
      const b = years.length ? row[`y${years[years.length - 1]}`] : 0;
      row.growth = a ? ((b - a) / a) * 100 : null;
      return row;
    });
  }, [trows, years]);

  const pivotCols: Col<any>[] = [
    { key: "month", label: "Month", align: "left", value: (r) => r.month, totalMode: "none" },
    ...years.map((y) => ({
      key: `y${y}`,
      label: String(y),
      value: (r: any) => r[`y${y}`] as number,
      fmt: compact,
      heat: true,
      tip: `Total revenue recorded in ${y}.`,
    })),
    { key: "growth", label: "Latest YoY", value: (r: any) => r.growth ?? 0, totalMode: "none", render: (r: any) => <Delta value={r.growth} /> },
  ];

  /* ---------- Heatmap ---------- */
  const heat = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    trows.filter(isGood).forEach((r) => {
      if (!r.paymentDate) return;
      grid[r.dow][r.hour] += r.paymentValue;
      max = Math.max(max, grid[r.dow][r.hour]);
    });
    return { grid, max };
  }, [trows]);

  const dowAgg = useMemo(() => groupBy(trows.filter(isGood), (r) => DOW[r.dow]), [trows]);
  const best = series.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const worst = series.slice().sort((a, b) => a.revenue - b.revenue)[0];
  const last = series[series.length - 1];
  const avg = series.length ? series.reduce((s, x) => s + x.revenue, 0) / series.length : 0;
  const growing = series.filter((s) => (s.momRev ?? 0) > 0).length;
  const topDow = dowAgg[0];
  const peakHour = useMemo(() => {
    const hours = groupBy(trows.filter(isGood), (r) => String(r.hour).padStart(2, "0") + ":00");
    return hours[0];
  }, [trows]);

  return (
    <div className="space-y-6">
      <Panel
        title="Monthly Performance Matrix"
        subtitle="Every month with MoM, YoY, mix and efficiency metrics — click any row to drill down"
        tip="The primary time table. Always spans the full data history; only the date filter is bypassed, location and other filters still apply."
        right={FULL_RANGE_BADGE}
      >
        <DataTable
          cols={cols}
          rows={series}
          rowKey={(r) => r.ym}
          defaultSort="label"
          csvName="monthly-performance"
          initialLimit={14}
          maxHeight="560px"
          expand={(m) => <MonthDrill month={m} rows={trows} />}
        />
        {series.length > 0 && (
          <Narrative
            lines={[
              <>Across <b>{series.length} months</b> the filtered book produced <b>{compact(series.reduce((s, x) => s + x.revenue, 0))}</b>, averaging <b>{compact(avg)}</b> per month. <b>{best?.label}</b> was the strongest month at {compact(best?.revenue || 0)} and <b>{worst?.label}</b> the weakest at {compact(worst?.revenue || 0)} — a {(best && worst && worst.revenue ? best.revenue / worst.revenue : 0).toFixed(1)}× spread that shows how much seasonality and campaign timing matter.</>,
              <><b>{growing} of {series.length}</b> months grew on the prior month ({pct((growing / Math.max(1, series.length)) * 100)} of periods). The latest month, <b>{last?.label}</b>, posted {compact(last?.revenue || 0)} with an AOV of {compact(last?.aov || 0)} and {intFmt(last?.newCustomers || 0)} new customers.</>,
              <>Watch the relationship between the <b>Txns</b> and <b>AOV</b> columns: months where revenue fell while AOV held steady are traffic problems (fix marketing and rebooking), whereas months where transactions held but AOV dropped are pricing or discount-mix problems.</>,
              <>Cumulative revenue reached <b>{compact(last?.cumulative || 0)}</b>. Discounting absorbed <b>{compact(series.reduce((s, x) => s + x.discount, 0))}</b> over the same window — roughly {pct((series.reduce((s, x) => s + x.discount, 0) / Math.max(1, series.reduce((s, x) => s + x.listValue, 0))) * 100)} of gross list value.</>,
            ]}
          />
        )}
      </Panel>

      <Panel
        title="Revenue Trajectory"
        subtitle="Switch the primary metric and overlay a second series to test relationships"
        right={
          <>
            {FULL_RANGE_BADGE}
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: "revenue", label: "Revenue" },
                { value: "txns", label: "Txns" },
                { value: "customers", label: "Customers" },
                { value: "units", label: "Units" },
                { value: "discount", label: "Discount" },
              ]}
            />
            <Segmented
              value={overlay}
              onChange={setOverlay}
              options={[
                { value: "none", label: "No overlay" },
                { value: "aov", label: "AOV" },
                { value: "cumulative", label: "Cumulative" },
                { value: "newCustomers", label: "New cust." },
              ]}
            />
          </>
        }
      >
        <div className="p-3">
          <TrendChart
            data={chartData}
            bars={[{ key: metric, name: metric.toUpperCase() }]}
            lines={overlay === "none" ? [] : [{ key: overlay, name: overlay }]}
            height={300}
          />
        </div>
        <div className="px-3 pb-2">
          <p className="text-[11px] leading-relaxed text-lo">
            Primary metric set to <b className="text-hi">{metric.toUpperCase()}</b> with <b className="text-hi">{overlay === "none" ? "no overlay" : overlay}</b> overlaid as a line.
            Switch the primary to compare volume patterns — or overlay <b className="text-hi">cumulative</b> to see the C-shaped growth curve.
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Year-on-Year Pivot"
          subtitle="Same month, different years — the cleanest read on real growth"
          right={FULL_RANGE_BADGE}
          tip="Compares each calendar month across every year present in the data, with heat shading for magnitude."
        >
          <DataTable cols={pivotCols} rows={pivot} rowKey={(r) => r.month} defaultSort="month" csvName="yoy-pivot" initialLimit={12} />
          <Narrative
            tone="emerald"
            lines={[
              <>Reading down a column shows seasonality; reading across a row shows genuine growth. Any row where the newest year is below the prior year is a month you have <b>lost ground</b> in and should plan a campaign against next cycle.</>,
              <>Years in view: <b>{years.join(", ") || "—"}</b>. Use this pivot rather than MoM when setting targets, because MoM confuses seasonal swing with performance.</>,
            ]}
          />
        </Panel>

        <Panel
          title="Trading Rhythm — Day × Hour"
          subtitle="Where revenue lands across the week — full history"
          right={FULL_RANGE_BADGE}
          tip="Each cell is total revenue for that weekday and hour. Darker = richer. Use it for staffing and campaign send-times."
        >
          <div className="overflow-x-auto p-3">
            <div className="min-w-[560px]">
              <div className="mb-1 flex gap-[2px] pl-9">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[7px] text-lo">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
              </div>
              {heat.grid.map((row, di) => (
                <div key={di} className="mb-[2px] flex items-center gap-[2px]">
                  <div className="w-9 shrink-0 text-[9px] text-lo">{DOW[di].slice(0, 3)}</div>
                  {row.map((v, hi) => {
                    const r = heat.max ? v / heat.max : 0;
                    return (
                      <Tip key={hi} text={`${DOW[di]} ${hi}:00 — ${compact(v)}`} className="flex-1">
                        <div
                          className="h-5 w-full cursor-pointer rounded-[3px] bg-surface-2 transition-all duration-150 hover:bg-line-strong hover:scale-[1.08]"
                          style={{ minWidth: 14, opacity: v ? 0.25 + r * 0.75 : 0.2 }}
                        />
                      </Tip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <Narrative
            tone="amber"
            lines={[
              <>The strongest weekday is <b>{topDow?.key}</b> with {compact(topDow?.revenue || 0)} ({pct(topDow?.share || 0)} of revenue) and the busiest hour overall is <b>{peakHour?.key}</b>. Staff the front desk and schedule outbound calls into those blocks.</>,
              <>Cold cells are not automatically bad — they are the cheapest slots to test flash offers, off-peak pricing and automated online-only bundles without cannibalising full-price demand.</>,
            ]}
          />
        </Panel>
      </div>

      <Panel title="Weekday Economics" subtitle="Full metric set per day of week — full history" right={FULL_RANGE_BADGE}>
        <DataTable
          cols={aggCols("Weekday")}
          rows={dowAgg}
          rowKey={(r) => r.key}
          csvName="weekday"
          initialLimit={7}
          expand={(a) => (
            <DataTable
              cols={aggCols("Category")}
              rows={groupBy(a.rows, (r) => r.category)}
              rowKey={(r) => r.key}
              csvName="weekday-cat"
              initialLimit={8}
              dense
              level={1}
            />
          )}
        />
        <Narrative
          lines={[
            <>Weekend versus weekday economics differ more than most teams assume — compare the <b>AOV</b> and <b>UPT</b> columns, not just revenue. A day with lower revenue but higher AOV is a capacity problem, not a demand problem.</>,
            <>Expand any weekday to see which categories drive it. If one day is disproportionately reliant on a single category, a schedule change to that category will move the whole week.</>,
          ]}
        />
      </Panel>
    </div>
  );
}

function MonthDrill({ month, rows }: { month: MonthPoint; rows: SaleRow[] }) {
  const [view, setView] = useState<"category" | "product" | "seller" | "day" | "location">("category");
  const mr = rows.filter((r) => r.ym === month.ym);
  const keyFn: Record<string, (r: SaleRow) => string> = {
    category: (r) => r.category,
    product: (r) => r.product,
    seller: (r) => r.soldBy,
    location: (r) => r.location,
    day: (r) => `${String(r.day).padStart(2, "0")} ${ymLabel(r.ym)}`,
  };
  const data = groupBy(mr, keyFn[view]);
  const a = aggregate(mr, month.label);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[10px] text-lo">
          <Stat label="Revenue" v={compact(a.revenue)} />
          <Stat label="Txns" v={intFmt(a.txns)} />
          <Stat label="AOV" v={compact(a.aov)} />
          <Stat label="Customers" v={intFmt(a.customers)} />
          <Stat label="New" v={intFmt(a.newCustomers)} />
          <Stat label="Disc %" v={pct(a.discountRate)} />
          <Stat label="UPT" v={dec(a.upt, 2)} />
        </div>
        <Segmented
          value={view}
          onChange={(v) => setView(v)}
          options={[
            { value: "category", label: "Category" },
            { value: "product", label: "Product" },
            { value: "seller", label: "Seller" },
            { value: "location", label: "Location" },
            { value: "day", label: "Day" },
          ]}
        />
      </div>
      <div className="tbl-drill-inner">
        <DataTable
          cols={aggCols(view[0].toUpperCase() + view.slice(1))}
          rows={data}
          rowKey={(r) => r.key}
          csvName={`${month.ym}-${view}`}
          initialLimit={8}
          dense
          level={1}
          expand={(row) => (
            <DataTable
              cols={aggCols("Product")}
              rows={groupBy(row.rows, (r) => r.product)}
              rowKey={(r) => r.key}
              csvName="nested"
              initialLimit={6}
              dense
              level={1}
            />
          )}
        />
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-lo">
        In <b className="text-hi">{month.label}</b>, {data[0]?.key} led with {compact(data[0]?.revenue || 0)} ({pct(data[0]?.share || 0)} of the month) across {intFmt(data[0]?.txns || 0)} transactions.
        {data[1] ? ` ${data[1].key} followed at ${compact(data[1].revenue)}.` : ""} The month converted {intFmt(a.customers)} customers at {compact(a.arpc)} each, and gave away {compact(a.discount)} in discounts.
      </p>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <span className={cn("rounded-lg border border-line bg-surface px-2 py-1")}>
      <span className="text-lo">{label} </span>
      <b className="num text-hi">{v}</b>
    </span>
  );
}
