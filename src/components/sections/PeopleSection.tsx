import { useMemo, useState } from "react";
import type { SaleRow } from "../../lib/types";
import { groupBy, isGood, ymLabel, type Agg } from "../../lib/analytics";
import { compact, dateStr, dec, intFmt, pct } from "../../lib/format";
import { DataTable, type Col } from "../DataTable";
import { Panel, Segmented, Tip } from "../ui";
import { Narrative, aggCols } from "../tableKit";
import { RankBars } from "../Charts";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  revenue: number;
  txns: number;
  units: number;
  discount: number;
  first: Date | null;
  last: Date | null;
  aov: number;
  span: number;
  recency: number;
  cats: number;
  locs: number;
  segment: string;
  rows: SaleRow[];
}

export function PeopleSection({ rows }: { rows: SaleRow[] }) {
  const good = useMemo(() => rows.filter(isGood), [rows]);
  const sellers = useMemo(() => groupBy(good, (r) => r.soldBy), [good]);

  const customers = useMemo<CustomerRow[]>(() => {
    const m = new Map<string, SaleRow[]>();
    good.forEach((r) => {
      const k = r.customerEmail || r.memberId || r.customerName;
      const a = m.get(k);
      if (a) a.push(r);
      else m.set(k, [r]);
    });
    const now = Math.max(...good.map((r) => r.paymentDate?.getTime() || 0), Date.now() - 1);
    return Array.from(m.entries())
      .map(([id, rs]) => {
        const revenue = rs.reduce((s, r) => s + r.paymentValue, 0);
        const dates = rs.map((r) => r.paymentDate?.getTime() || 0).filter(Boolean);
        const first = dates.length ? new Date(Math.min(...dates)) : null;
        const last = dates.length ? new Date(Math.max(...dates)) : null;
        const txns = new Set(rs.map((r) => r.saleId || r.saleItemId)).size;
        const recency = last ? Math.round((now - last.getTime()) / 864e5) : 9999;
        const segment =
          revenue > 50000 && txns > 3 ? "Champion" :
          revenue > 50000 ? "High value" :
          txns > 3 && recency < 90 ? "Loyal" :
          recency > 180 ? "Lapsed" :
          txns === 1 ? "One-and-done" : "Developing";
        return {
          id,
          name: rs[0].customerName,
          email: rs[0].customerEmail,
          revenue,
          txns,
          units: rs.reduce((s, r) => s + r.quantity, 0),
          discount: rs.reduce((s, r) => s + r.discountValue, 0),
          first,
          last,
          aov: txns ? revenue / txns : 0,
          span: first && last ? Math.round((last.getTime() - first.getTime()) / 864e5) : 0,
          recency,
          cats: new Set(rs.map((r) => r.category)).size,
          locs: new Set(rs.map((r) => r.location)).size,
          segment,
          rows: rs,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [good]);

  const custCols: Col<CustomerRow>[] = [
    { key: "name", label: "Customer", align: "left", value: (r) => r.name, totalMode: "none", width: "170px",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-hi">{r.name}</p>
          <p className="truncate text-[9.5px] text-lo">{r.email || r.id}</p>
        </div>
      ) },
    { key: "segment", label: "Segment", align: "left", value: (r) => r.segment, totalMode: "none",
      render: (r) => {
        const tone: Record<string, string> = {
          Champion: "bg-loc-soft text-loc",
          "High value": "bg-loc-soft text-loc",
          Loyal: "bg-pos-soft text-pos",
          Lapsed: "bg-neg-soft text-neg",
          "One-and-done": "bg-warn-soft text-warn",
          Developing: "bg-surface2 text-lo",
        };
        return <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-semibold ${tone[r.segment]}`}>{r.segment}</span>;
      } },
    { key: "revenue", label: "Lifetime Value", value: (r) => r.revenue, fmt: compact, heat: true, tip: "Total spend within the filtered window." },
    { key: "txns", label: "Txns", value: (r) => r.txns, fmt: intFmt },
    { key: "units", label: "Units", value: (r) => r.units, fmt: intFmt },
    { key: "aov", label: "AOV", value: (r) => r.aov, fmt: compact, totalMode: "avg" },
    { key: "discount", label: "Discount", value: (r) => r.discount, fmt: compact, tip: "Total discount this customer has consumed." },
    { key: "cats", label: "Categories", value: (r) => r.cats, fmt: intFmt, tip: "Breadth of purchase — multi-category customers churn far less.", totalMode: "avg" },
    { key: "locs", label: "Sites", value: (r) => r.locs, fmt: intFmt, totalMode: "avg" },
    { key: "span", label: "Tenure (d)", value: (r) => r.span, fmt: intFmt, tip: "Days between first and last purchase.", totalMode: "avg" },
    { key: "recency", label: "Recency (d)", value: (r) => r.recency, fmt: intFmt, tip: "Days since last purchase. Above 180 is effectively lapsed.", totalMode: "avg",
      render: (r) => <span className={r.recency > 180 ? "text-neg" : r.recency > 90 ? "text-warn" : "text-pos"}>{intFmt(r.recency)}</span> },
    { key: "first", label: "First Seen", value: (r) => r.first?.getTime() || 0, totalMode: "none", render: (r) => <span className="text-[10.5px]">{dateStr(r.first)}</span> },
    { key: "last", label: "Last Seen", value: (r) => r.last?.getTime() || 0, totalMode: "none", render: (r) => <span className="text-[10.5px]">{dateStr(r.last)}</span> },
  ];

  /* -------- cohorts -------- */
  const [cohortMode, setCohortMode] = useState<"revenue" | "customers">("revenue");
  const cohort = useMemo(() => {
    const firstBy = new Map<string, string>();
    good.forEach((r) => {
      const k = r.customerEmail || r.memberId || r.customerName;
      if (!r.ym) return;
      const cur = firstBy.get(k);
      if (!cur || r.ym < cur) firstBy.set(k, r.ym);
    });
    const monthIdx = (a: string, b: string) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return (by - ay) * 12 + (bm - am);
    };
    const grid = new Map<string, { rev: number[]; cust: Set<string>[]; size: number }>();
    good.forEach((r) => {
      const k = r.customerEmail || r.memberId || r.customerName;
      const c = firstBy.get(k);
      if (!c || !r.ym) return;
      const i = monthIdx(c, r.ym);
      if (i < 0 || i > 11) return;
      const g = grid.get(c) || { rev: Array(12).fill(0), cust: Array.from({ length: 12 }, () => new Set<string>()), size: 0 };
      g.rev[i] += r.paymentValue;
      g.cust[i].add(k);
      grid.set(c, g);
    });
    const sizes = new Map<string, number>();
    firstBy.forEach((c) => sizes.set(c, (sizes.get(c) || 0) + 1));
    return Array.from(grid.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([c, g]) => ({
        cohort: c,
        label: ymLabel(c),
        size: sizes.get(c) || 0,
        rev: g.rev,
        cust: g.cust.map((s) => s.size),
      }));
  }, [good]);

  const maxCell = Math.max(
    1,
    ...cohort.flatMap((c) => (cohortMode === "revenue" ? c.rev : c.cust))
  );

  const segAgg = useMemo(() => {
    const m = new Map<string, CustomerRow[]>();
    customers.forEach((c) => {
      const a = m.get(c.segment);
      if (a) a.push(c);
      else m.set(c.segment, [c]);
    });
    const total = customers.reduce((s, c) => s + c.revenue, 0);
    return Array.from(m.entries())
      .map(([k, cs]) => ({
        key: k,
        count: cs.length,
        revenue: cs.reduce((s, c) => s + c.revenue, 0),
        txns: cs.reduce((s, c) => s + c.txns, 0),
        share: total ? (cs.reduce((s, c) => s + c.revenue, 0) / total) * 100 : 0,
        avgLtv: cs.reduce((s, c) => s + c.revenue, 0) / cs.length,
        avgRecency: cs.reduce((s, c) => s + c.recency, 0) / cs.length,
        customers: cs,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [customers]);

  const champions = segAgg.find((s) => s.key === "Champion");
  const lapsed = segAgg.find((s) => s.key === "Lapsed");
  const oneShot = segAgg.find((s) => s.key === "One-and-done");
  const topSeller = sellers[0];
  const medianSeller = sellers[Math.floor(sellers.length / 2)];
  const repeatRate = customers.length ? (customers.filter((c) => c.txns > 1).length / customers.length) * 100 : 0;
  const top10 = customers.slice(0, Math.max(1, Math.floor(customers.length * 0.1)));
  const top10Share = customers.length
    ? (top10.reduce((s, c) => s + c.revenue, 0) / customers.reduce((s, c) => s + c.revenue, 0)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <Panel
        title="Sales Team Leaderboard"
        subtitle="Who is selling what, where, and at what quality of ticket"
        tip="Expand a seller to see their category and product mix and their month-by-month consistency."
      >
        <DataTable
          cols={aggCols("Sold By")}
          rows={sellers}
          rowKey={(r) => r.key}
          csvName="sellers"
          initialLimit={12}
          expand={(s: Agg) => (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="tbl-drill-inner">
                <DataTable cols={aggCols("Category")} rows={groupBy(s.rows, (r) => r.category)} rowKey={(r) => r.key} csvName="s-cat" initialLimit={6} dense level={1}
                  expand={(c) => <DataTable cols={aggCols("Product")} rows={groupBy(c.rows, (r) => r.product)} rowKey={(r) => r.key} csvName="s-prod" initialLimit={6} dense level={1} />} />
              </div>
              <div className="tbl-drill-inner">
                <DataTable cols={aggCols("Month")} rows={groupBy(s.rows, (r) => r.ym).sort((a, b) => a.key.localeCompare(b.key))} rowKey={(r) => r.key} csvName="s-month" initialLimit={8} dense level={1} />
              </div>
            </div>
          )}
        />
        <Narrative
          lines={[
            <><b>{topSeller?.key}</b> leads with {compact(topSeller?.revenue || 0)} ({pct(topSeller?.share || 0)} of all revenue) at {compact(topSeller?.aov || 0)} AOV. The team median sits at {compact(medianSeller?.revenue || 0)}.</>,
            <>The most useful column here is <b>AOV</b>, not revenue — high revenue on a low AOV usually means the seller is working volume and discounting to close. Sellers with a high <b>UPT</b> are the ones who genuinely cross-sell; have them run the next team session.</>,
            <>If one person carries more than 35% of revenue, you have key-person risk. Document their approach into a script and route a share of high-intent leads to the next two sellers to build depth.</>,
          ]}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Customer Segments" subtitle="RFM-style segmentation with revenue contribution">
          <DataTable
            cols={[
              { key: "key", label: "Segment", align: "left", value: (r: any) => r.key, totalMode: "none" },
              { key: "count", label: "Customers", value: (r: any) => r.count, fmt: intFmt, heat: true },
              { key: "revenue", label: "Revenue", value: (r: any) => r.revenue, fmt: compact, heat: true },
              { key: "share", label: "Rev Share", value: (r: any) => r.share, fmt: (n) => pct(n) },
              { key: "avgLtv", label: "Avg LTV", value: (r: any) => r.avgLtv, fmt: compact, totalMode: "avg" },
              { key: "txns", label: "Txns", value: (r: any) => r.txns, fmt: intFmt },
              { key: "avgRecency", label: "Avg Recency", value: (r: any) => r.avgRecency, fmt: (n) => `${Math.round(n)}d`, totalMode: "avg" },
            ]}
            rows={segAgg}
            rowKey={(r: any) => r.key}
            csvName="segments"
            initialLimit={8}
            expand={(s: any) => (
              <div className="tbl-drill-inner">
                <DataTable cols={custCols.slice(0, 8)} rows={s.customers} rowKey={(c: CustomerRow) => c.id} csvName={`${s.key}-customers`} initialLimit={8} dense />
              </div>
            )}
          />
          <Narrative
            tone="emerald"
            lines={[
              <><b>{champions?.count || 0} champions</b> drive {pct(champions?.share || 0)} of revenue at {compact(champions?.avgLtv || 0)} average lifetime value. Losing ten of them costs more than losing a hundred one-time buyers — give them a named contact and early access.</>,
              <><b>{oneShot?.count || 0} customers bought exactly once</b> ({pct(oneShot?.share || 0)} of revenue). Converting even 15% of them to a second purchase is usually the single largest available revenue lift, and it costs a fraction of new acquisition.</>,
              <><b>{lapsed?.count || 0} customers are lapsed</b> (no purchase in 180+ days) with {compact(lapsed?.revenue || 0)} of historic value. A structured win-back with a time-boxed offer typically recovers 8–12% of them.</>,
            ]}
          />
        </Panel>

        <Panel title="Top Customers" subtitle="Revenue concentration">
          <div className="p-3">
            <RankBars data={customers.slice(0, 10).map((c) => ({ name: c.name.length > 16 ? c.name.slice(0, 15) + "…" : c.name, value: c.revenue }))} height={340} />
          </div>
          <p className="px-4 pb-3 text-[11px] leading-relaxed text-lo">
            The top decile of customers ({top10.length} people) contributes <b className="text-hi">{pct(top10Share)}</b> of all revenue.
            Repeat purchase rate across the base is <b className="text-hi">{pct(repeatRate)}</b>.
          </p>
        </Panel>
      </div>

      <Panel
        title="Customer Ledger"
        subtitle="Every customer with lifetime value, breadth, recency and a full transaction drill-down"
        tip="Search by name or email in the row filter. Expand a customer to see their complete purchase history."
      >
        <DataTable
          cols={custCols}
          rows={customers}
          rowKey={(r) => r.id}
          csvName="customers"
          initialLimit={12}
          maxHeight="620px"
          expand={(c) => (
            <div className="space-y-2">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="tbl-drill-inner">
                  <DataTable cols={aggCols("Category")} rows={groupBy(c.rows, (r) => r.category)} rowKey={(r) => r.key} csvName="c-cat" initialLimit={5} dense level={1} />
                </div>
                <div className="tbl-drill-inner">
                  <DataTable cols={aggCols("Product")} rows={groupBy(c.rows, (r) => r.product)} rowKey={(r) => r.key} csvName="c-prod" initialLimit={5} dense level={1} />
                </div>
              </div>
              <p className="px-1 text-[11px] leading-relaxed text-lo">
                <b className="text-hi">{c.name}</b> has spent {compact(c.revenue)} over {intFmt(c.txns)} transactions across {c.cats} categories
                since {dateStr(c.first)}. Last seen {intFmt(c.recency)} days ago. Average gap between purchases:{" "}
                {c.txns > 1 ? Math.round(c.span / (c.txns - 1)) : "—"} days.
                {c.recency > 90 ? " This customer is drifting — a personal message beats a discount here." : " Currently active and engaged."}
              </p>
            </div>
          )}
        />
        <Narrative
          lines={[
            <>{intFmt(customers.length)} unique customers are in scope, generating {compact(customers.reduce((s, c) => s + c.revenue, 0))} — an average of {compact(customers.reduce((s, c) => s + c.revenue, 0) / Math.max(1, customers.length))} each across {dec(customers.reduce((s, c) => s + c.txns, 0) / Math.max(1, customers.length), 2)} transactions.</>,
            <>The <b>Categories</b> column is the most predictive retention signal in this table: customers who buy across two or more categories have materially longer tenure. Every single-category customer is a cross-sell opportunity with a known next-best product.</>,
            <>Sort by <b>Recency</b> descending to build today's outreach list, then sort by <b>Lifetime Value</b> to prioritise who gets a call rather than an email.</>,
          ]}
        />
      </Panel>

      <Panel
        title="Acquisition Cohorts"
        subtitle="How much each joining month keeps spending in the months that follow"
        right={<Segmented value={cohortMode} onChange={setCohortMode} options={[{ value: "revenue", label: "Revenue" }, { value: "customers", label: "Active customers" }]} />}
        tip="Rows are the month a customer first purchased. Columns are months since that first purchase. Strong colour to the right means genuine retention."
      >
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[720px] border-collapse text-[10.5px]">
            <thead>
              <tr className="tbl-head">
                <th className="border-b border-line px-2 py-2 text-left font-display text-[10px] uppercase tracking-wider text-lo">Cohort</th>
                <th className="border-b border-line px-2 py-2 text-right font-display text-[10px] uppercase tracking-wider text-lo">Size</th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} className="border-b border-line px-1 py-2 text-center font-display text-[10px] uppercase tracking-wider text-lo">M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohort.map((c) => (
                <tr key={c.cohort} className="row-hover border-b border-line/50">
                  <td className="px-2 py-1.5 font-medium text-hi">{c.label}</td>
                  <td className="num px-2 py-1.5 text-right text-lo">{intFmt(c.size)}</td>
                  {(cohortMode === "revenue" ? c.rev : c.cust).map((v, i) => {
                    const r = v / maxCell;
                    return (
                      <td key={i} className="p-[2px]">
                        <Tip text={`${c.label} cohort · month ${i} → ${cohortMode === "revenue" ? compact(v) : `${v} active`}`} className="w-full">
                          <div
                            className="heat-cell num flex h-6 w-full min-w-[38px] cursor-pointer items-center justify-center rounded-[4px] text-[9px] font-medium text-hi"
                            style={{
                              background: v
                                ? `color-mix(in srgb, rgb(100 116 139) ${(8 + r * 42).toFixed(1)}%, rgb(var(--surface-2)))`
                                : "rgb(var(--surface-2))",
                            }}
                          >
                            {v ? (cohortMode === "revenue" ? compact(v).replace("₹", "") : v) : ""}
                          </div>
                        </Tip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Narrative
          tone="amber"
          lines={[
            <>Column <b>M0</b> is acquisition value; everything to the right is retention value. If colour fades sharply after M0, the business is renting customers rather than keeping them — and every marketing rupee has to be re-spent next month.</>,
            <>Compare cohorts vertically at the same month index. A newer cohort that is darker than an older one at M1 and M2 means recent onboarding changes are working. If newer cohorts are lighter, something in the recent customer experience or offer mix has regressed.</>,
            <>The most profitable single intervention is usually moving M1 up: a scheduled follow-up at day 7 and day 21 after first purchase reliably lifts the second-purchase rate.</>,
          ]}
        />
      </Panel>
    </div>
  );
}
