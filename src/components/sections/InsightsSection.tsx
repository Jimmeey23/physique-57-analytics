import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Target, TrendingUp } from "lucide-react";
import type { SaleRow } from "../../lib/types";
import { aggregate, buildInsights, groupBy, isGood, monthlySeries, type Insight } from "../../lib/analytics";
import { compact, intFmt, pct } from "../../lib/format";
import { Panel } from "../ui";
import { DataTable, type Col } from "../DataTable";
import { Narrative } from "../tableKit";
import { cn } from "../../utils/cn";

const KIND: Record<Insight["kind"], { icon: any; cls: string; label: string }> = {
  win: { icon: CheckCircle2, cls: "pos", label: "What worked" },
  risk: { icon: AlertTriangle, cls: "neg", label: "Red flag" },
  trend: { icon: TrendingUp, cls: "loc", label: "Pattern" },
  action: { icon: Target, cls: "warn", label: "Action" },
};

/** Left rule + icon tint per insight kind. */
const KIND_TONE: Record<string, string> = {
  pos: "border-l-[3px] border-l-[rgb(var(--pos))]",
  neg: "border-l-[3px] border-l-[rgb(var(--neg))]",
  warn: "border-l-[3px] border-l-[rgb(var(--warn))]",
  loc: "border-l-[3px] border-l-[rgb(var(--loc))]",
};
const KIND_TEXT: Record<string, string> = {
  pos: "text-pos", neg: "text-neg", warn: "text-warn", loc: "text-loc",
};

export function InsightCards({ rows, limit }: { rows: SaleRow[]; limit?: number }) {
  const series = useMemo(() => monthlySeries(rows), [rows]);
  const insights = useMemo(() => buildInsights(rows, series), [rows, series]);
  const list = limit ? insights.slice(0, limit) : insights;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((ins, i) => {
        const k = KIND[ins.kind];
        const Icon = k.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.35) }}
            whileHover={{ y: -3 }}
            className={cn("card panel-lift p-4", KIND_TONE[k.cls])}
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md">
                <Icon className={cn("h-3.5 w-3.5", KIND_TEXT[k.cls])} />
              </span>
              <span className={cn("font-mono text-[9px] font-semibold uppercase tracking-[0.14em]", KIND_TEXT[k.cls])}>{k.label}</span>
            </div>
            <h4 className="mb-2 font-display text-[14px] font-bold leading-snug text-hi">{ins.title}</h4>
            <p className="text-[12px] leading-relaxed text-lo">{ins.body}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

interface Rec {
  priority: "P1" | "P2" | "P3";
  action: string;
  rationale: string;
  metric: string;
  impact: number;
  effort: string;
}

export function InsightsSection({ rows, prevRows }: { rows: SaleRow[]; prevRows: SaleRow[] }) {
  const series = useMemo(() => monthlySeries(rows), [rows]);
  const good = useMemo(() => rows.filter(isGood), [rows]);
  const total = useMemo(() => aggregate(rows, "all"), [rows]);
  const prevTotal = useMemo(() => aggregate(prevRows, "prev"), [prevRows]);

  /* -------- anomalies -------- */
  const anomalies = useMemo(() => {
    const vals = series.map((s) => s.revenue);
    const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length)) || 1;
    return series
      .map((s) => ({ ...s, z: (s.revenue - mean) / sd }))
      .filter((s) => Math.abs(s.z) > 1.3)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  }, [series]);

  /* -------- what worked / didn't -------- */
  const movers = useMemo(() => {
    const cur = new Map<string, number>();
    const prv = new Map<string, number>();
    good.forEach((r) => cur.set(r.product, (cur.get(r.product) || 0) + r.paymentValue));
    prevRows.filter(isGood).forEach((r) => prv.set(r.product, (prv.get(r.product) || 0) + r.paymentValue));
    const keys = new Set([...cur.keys(), ...prv.keys()]);
    return Array.from(keys)
      .map((k) => {
        const c = cur.get(k) || 0;
        const p = prv.get(k) || 0;
        return { key: k, cur: c, prev: p, diff: c - p, growth: p ? ((c - p) / p) * 100 : c ? 100 : 0 };
      })
      .filter((m) => Math.abs(m.diff) > 0)
      .sort((a, b) => b.diff - a.diff);
  }, [good, prevRows]);

  const moverCols: Col<any>[] = [
    { key: "key", label: "Product", align: "left", value: (r) => r.key, totalMode: "none", width: "190px" },
    { key: "prev", label: "Prev Period", value: (r) => r.prev, fmt: compact },
    { key: "cur", label: "This Period", value: (r) => r.cur, fmt: compact },
    { key: "diff", label: "Δ Value", value: (r) => r.diff, fmt: compact, heat: true,
      render: (r: any) => <span className={r.diff >= 0 ? "text-pos" : "text-neg"}>{r.diff >= 0 ? "+" : ""}{compact(r.diff)}</span> },
    { key: "growth", label: "Δ %", value: (r) => r.growth, fmt: (n) => pct(n), totalMode: "none",
      render: (r: any) => <span className={r.growth >= 0 ? "text-pos" : "text-neg"}>{r.growth >= 0 ? "+" : ""}{pct(r.growth)}</span> },
  ];

  /* -------- recommendations -------- */
  const recs = useMemo<Rec[]>(() => {
    const out: Rec[] = [];
    const cats = groupBy(good, (r) => r.category);
    const custMap = new Map<string, number>();
    good.forEach((r) => custMap.set(r.customerEmail || r.memberId, (custMap.get(r.customerEmail || r.memberId) || 0) + 1));
    const oneTime = Array.from(custMap.values()).filter((v) => v === 1).length;
    const memRows = good.filter((r) => r.membershipId);
    const liability = memRows.reduce((s, r) => s + r.membershipMoneyLeft, 0);
    const creditsSold = memRows.reduce((s, r) => s + r.membershipTotalClasses, 0);
    const creditsLeft = memRows.reduce((s, r) => s + r.membershipClassesLeft, 0);
    const util = creditsSold ? ((creditsSold - creditsLeft) / creditsSold) * 100 : 100;
    const failVal = rows.filter((r) => /fail/i.test(r.paymentStatus)).reduce((s, r) => s + r.paymentValue, 0);
    const locs = groupBy(good, (r) => r.location);
    const sellers = groupBy(good, (r) => r.soldBy).filter((s) => s.txns >= 3);

    if (oneTime > 0)
      out.push({
        priority: "P1",
        action: `Launch a second-purchase programme for ${intFmt(oneTime)} one-time buyers`,
        rationale: `One-time customers are the largest untapped pool in the base. A 15% conversion at the current ${compact(total.aov)} AOV is the cheapest revenue available, because acquisition has already been paid for.`,
        metric: "Repeat rate",
        impact: oneTime * 0.15 * total.aov,
        effort: "Low — automated email/WhatsApp sequence at day 7 and day 21",
      });

    if (util < 70 && liability > 0)
      out.push({
        priority: "P1",
        action: `Drive redemption of ${compact(liability)} in unused credits`,
        rationale: `Credit utilisation is ${pct(util)}. Unused credits are the strongest predictor of non-renewal; every credit redeemed materially raises the chance of a repeat purchase.`,
        metric: "Credit utilisation",
        impact: liability * 0.3,
        effort: "Low — inactivity trigger at 14 days plus a booked check-in call",
      });

    if (total.discountRate > 8)
      out.push({
        priority: "P2",
        action: `Cap discounting — currently ${pct(total.discountRate)} of list value`,
        rationale: `${compact(total.discount)} was given away. Removing the least efficient codes and blocking stacking typically recovers 25–40% of that with negligible volume loss.`,
        metric: "Discount rate",
        impact: total.discount * 0.3,
        effort: "Low — pricing rule change, no new tooling",
      });

    if (failVal > 0)
      out.push({
        priority: "P2",
        action: `Recover ${compact(failVal)} of failed payments`,
        rationale: "Failed transactions are pure leakage — the customer already wanted to buy. Smart retries, card updater and an alternative UPI route typically recover 50–70%.",
        metric: "Payment success rate",
        impact: failVal * 0.6,
        effort: "Medium — payment gateway configuration",
      });

    if (locs.length > 1) {
      const best = locs[0];
      const worst = locs[locs.length - 1];
      const gap = (best.arpc - worst.arpc) * worst.customers;
      if (gap > 0)
        out.push({
          priority: "P2",
          action: `Close the ARPC gap at ${worst.key}`,
          rationale: `${worst.key} earns ${compact(worst.arpc)} per customer versus ${compact(best.arpc)} at ${best.key}. Matching the leading site's product mix and desk script on the existing customer base is worth roughly ${compact(gap)}.`,
          metric: "Revenue per customer",
          impact: gap * 0.4,
          effort: "Medium — mix change and staff coaching",
        });
    }

    if (sellers.length > 2) {
      const median = sellers[Math.floor(sellers.length / 2)];
      const laggards = sellers.filter((s) => s.aov < median.aov);
      const upside = laggards.reduce((s, l) => s + (median.aov - l.aov) * l.txns, 0);
      if (upside > 0)
        out.push({
          priority: "P2",
          action: `Lift ${laggards.length} below-median sellers to team median AOV`,
          rationale: `Same footfall, better basket. Moving the bottom half of the team to the median ticket of ${compact(median.aov)} is worth about ${compact(upside)} with no extra marketing spend.`,
          metric: "AOV",
          impact: upside,
          effort: "Medium — weekly coaching on the top seller's script",
        });
    }

    if (cats.length > 2 && cats[0].share > 45)
      out.push({
        priority: "P3",
        action: `Reduce dependence on ${cats[0].key} (${pct(cats[0].share)} of revenue)`,
        rationale: `Single-category concentration means one schedule, supplier or trainer change can swing the entire month. Grow ${cats[1].key} deliberately to build a genuine second pillar.`,
        metric: "Revenue concentration",
        impact: total.revenue * 0.05,
        effort: "High — assortment and schedule strategy",
      });

    const tail = groupBy(good, (r) => r.product).filter((p) => p.share < 1);
    if (tail.length > 3)
      out.push({
        priority: "P3",
        action: `Rationalise ${tail.length} long-tail SKUs`,
        rationale: `Each contributes under 1% of revenue but consumes the same admin, staff attention and shelf space as the winners. Retire the weakest half and redirect that attention to the top five.`,
        metric: "Assortment efficiency",
        impact: total.revenue * 0.02,
        effort: "Low — catalogue clean-up",
      });

    return out.sort((a, b) => b.impact - a.impact);
  }, [good, rows, total]);

  const recCols: Col<Rec>[] = [
    { key: "priority", label: "Pri", align: "left", value: (r) => r.priority, totalMode: "none", width: "48px",
      render: (r) => (
        <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px] font-bold",
          r.priority === "P1" ? "bg-neg-soft text-neg" : r.priority === "P2" ? "bg-warn-soft text-warn" : "bg-surface2 text-lo")}>
          {r.priority}
        </span>
      ) },
    { key: "action", label: "Recommended Action", align: "left", value: (r) => r.action, totalMode: "none", width: "300px",
      render: (r) => <span className="font-medium text-hi">{r.action}</span> },
    { key: "metric", label: "Moves", align: "left", value: (r) => r.metric, totalMode: "none" },
    { key: "impact", label: "Est. Impact", value: (r) => r.impact, fmt: compact, heat: true, tip: "Modelled annualised-equivalent value if the action lands at the stated conversion assumption." },
    { key: "effort", label: "Effort", align: "left", value: (r) => r.effort, totalMode: "none", width: "220px",
      render: (r) => <span className="text-[10.5px] text-lo">{r.effort}</span> },
  ];

  const revDelta = prevTotal.revenue ? ((total.revenue - prevTotal.revenue) / prevTotal.revenue) * 100 : null;

  return (
    <div className="space-y-6">
      <Panel
        title="Executive Summary"
        subtitle="Auto-generated narrative from the current filter selection"
      >
        <div className="space-y-3 p-4 text-[12.5px] leading-relaxed text-hi/90">
          <p>
            The filtered book generated <b className="grad-text">{compact(total.revenue)}</b> in gross revenue
            ({compact(total.exVat)} net of VAT) from <b>{intFmt(total.txns)}</b> transactions and{" "}
            <b>{intFmt(total.customers)}</b> unique customers, at an average order value of <b>{compact(total.aov)}</b> and{" "}
            <b>{compact(total.arpc)}</b> per customer.
            {revDelta !== null && (
              <> Against the comparison window that is <b className={revDelta >= 0 ? "text-pos" : "text-neg"}>{revDelta >= 0 ? "+" : ""}{revDelta.toFixed(1)}%</b>.</>
            )}
          </p>
          <p>
            <b>{intFmt(total.newCustomers)}</b> of those customers were buying for the first time
            ({pct((total.newCustomers / Math.max(1, total.customers)) * 100)} of the base), and discounting absorbed{" "}
            <b>{compact(total.discount)}</b>, or {pct(total.discountRate)} of gross list value. Basket depth averaged{" "}
            {total.upt.toFixed(2)} units per transaction.
          </p>
          <p className="text-lo">
            The panels below convert this into patterns, red flags and a prioritised action list. Every figure respects the
            global filters and the location tabs at the top of the page — change either and this summary rewrites itself.
          </p>
        </div>
      </Panel>

      <InsightCards rows={rows} />

      <Panel
        title="Prioritised Recommendations"
        subtitle="Ranked by modelled revenue impact — the shortlist for the next 90 days"
        tip="Impact is modelled from the actual filtered data using conservative conversion assumptions stated in each rationale."
      >
        <DataTable
          cols={recCols}
          rows={recs}
          rowKey={(r) => r.action}
          defaultSort="impact"
          csvName="recommendations"
          initialLimit={10}
          expand={(r) => (
            <p className="px-1 text-[11.5px] leading-relaxed text-mid">
              <b>Why:</b> {r.rationale}
            </p>
          )}
        />
        <Narrative
          tone="emerald"
          lines={[
            <>Total modelled upside across the shortlist is <b>{compact(recs.reduce((s, r) => s + r.impact, 0))}</b>, equal to {pct((recs.reduce((s, r) => s + r.impact, 0) / Math.max(1, total.revenue)) * 100)} of current filtered revenue.</>,
            <>The P1 items are retention and redemption plays — they need no new customers and no new spend, which is why they rank above acquisition. Sequence them first.</>,
            <>Re-check this table after each change: because it is generated from live data, a successful intervention will visibly drop its own recommendation down the list.</>,
          ]}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="What Worked" subtitle="Biggest positive movers versus the comparison window">
          <DataTable cols={moverCols} rows={movers.filter((m) => m.diff > 0)} rowKey={(r) => r.key} defaultSort="diff" csvName="gainers" initialLimit={8} dense level={1} />
          <Narrative
            tone="emerald"
            lines={[
              <>These SKUs added <b>{compact(movers.filter((m) => m.diff > 0).reduce((s, m) => s + m.diff, 0))}</b> versus the comparison window. Find the common thread — a campaign, a schedule change, a seller — and repeat it deliberately rather than accidentally.</>,
            ]}
          />
        </Panel>

        <Panel title="What Didn't" subtitle="Biggest negative movers — investigate before they compound">
          <DataTable cols={moverCols} rows={movers.filter((m) => m.diff < 0)} rowKey={(r) => r.key} defaultSort="diff" csvName="decliners" initialLimit={8} dense level={1} />
          <Narrative
            tone="amber"
            lines={[
              <>These lines gave back <b>{compact(Math.abs(movers.filter((m) => m.diff < 0).reduce((s, m) => s + m.diff, 0)))}</b>. Before assuming demand fell, check three things in order: did the price change, did the schedule or availability change, and did the person who used to sell it stop selling it.</>,
            ]}
          />
        </Panel>
      </div>

      <Panel
        title="Anomaly Detection"
        subtitle="Months more than 1.3 standard deviations from the mean"
        tip="Statistical outliers in monthly revenue. Positive outliers are playbooks to repeat; negative ones need a root cause."
      >
        <DataTable
          cols={[
            { key: "label", label: "Month", align: "left", value: (r: any) => r.label, totalMode: "none" },
            { key: "revenue", label: "Revenue", value: (r: any) => r.revenue, fmt: compact, heat: true },
            { key: "z", label: "Z-Score", value: (r: any) => r.z, fmt: (n) => n.toFixed(2), totalMode: "none",
              render: (r: any) => <span className={r.z > 0 ? "text-pos" : "text-neg"}>{r.z > 0 ? "+" : ""}{r.z.toFixed(2)}σ</span> },
            { key: "txns", label: "Txns", value: (r: any) => r.txns, fmt: intFmt },
            { key: "aov", label: "AOV", value: (r: any) => r.aov, fmt: compact, totalMode: "avg" },
            { key: "customers", label: "Customers", value: (r: any) => r.customers, fmt: intFmt },
            { key: "discountRate", label: "Disc %", value: (r: any) => r.discountRate, fmt: (n) => pct(n), totalMode: "avg" },
          ]}
          rows={anomalies}
          rowKey={(r: any) => r.ym}
          defaultSort="z"
          csvName="anomalies"
          initialLimit={8}
          expand={(a: any) => (
            <DataTable cols={[
              { key: "key", label: "Category", align: "left", value: (r: any) => r.key, totalMode: "none" },
              { key: "revenue", label: "Revenue", value: (r: any) => r.revenue, fmt: compact },
              { key: "txns", label: "Txns", value: (r: any) => r.txns, fmt: intFmt },
              { key: "aov", label: "AOV", value: (r: any) => r.aov, fmt: compact, totalMode: "avg" },
            ]} rows={groupBy(a.rows, (r: SaleRow) => r.category)} rowKey={(r: any) => r.key} csvName="anomaly-cat" initialLimit={6} dense level={1} />
          )}
        />
        <Narrative
          tone="amber"
          lines={[
            anomalies.length ? (
              <>{anomalies.length} outlier month{anomalies.length > 1 ? "s" : ""} detected. Positive outliers usually trace to a campaign, a launch or a seasonal peak — document exactly what was running so it can be repeated. Negative outliers almost always trace to closure days, a staffing gap or a pricing change.</>
            ) : (
              <>No statistical outliers — revenue is running within a stable band, which makes forecasting reliable and makes any future deviation genuinely meaningful.</>
            ),
            <>Expand any outlier to see which category caused the swing. If a single category explains it, the fix is operational; if every category moved together, the cause is demand-side or calendar-driven.</>,
          ]}
        />
      </Panel>
    </div>
  );
}
