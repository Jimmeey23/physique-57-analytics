import { useMemo, useState } from "react";
import type { SaleRow } from "../../lib/types";
import { groupBy, isGood, monthlySeries, type Agg } from "../../lib/analytics";
import { compact, intFmt, pct } from "../../lib/format";
import { DataTable, type Col } from "../DataTable";
import { Panel, Segmented, Sparkline } from "../ui";
import { Narrative, aggCols, growthCol } from "../tableKit";
import { Donut, RankBars, BubbleChart, TrendChart } from "../Charts";

function growthMap(cur: SaleRow[], prev: SaleRow[], keyFn: (r: SaleRow) => string) {
  const c = new Map<string, number>();
  const p = new Map<string, number>();
  cur.filter(isGood).forEach((r) => c.set(keyFn(r), (c.get(keyFn(r)) || 0) + r.paymentValue));
  prev.filter(isGood).forEach((r) => p.set(keyFn(r), (p.get(keyFn(r)) || 0) + r.paymentValue));
  const out = new Map<string, number>();
  c.forEach((v, k) => {
    const pv = p.get(k);
    if (pv) out.set(k, ((v - pv) / pv) * 100);
  });
  return out;
}

export function MixSection({ rows, prevRows }: { rows: SaleRow[]; prevRows: SaleRow[] }) {
  const good = useMemo(() => rows.filter(isGood), [rows]);
  const locs = useMemo(() => groupBy(good, (r) => r.location), [good]);
  const cats = useMemo(() => groupBy(good, (r) => r.category), [good]);
  const prods = useMemo(() => groupBy(good, (r) => r.product), [good]);

  const locGrowth = useMemo(() => growthMap(rows, prevRows, (r) => r.location), [rows, prevRows]);
  const catGrowth = useMemo(() => growthMap(rows, prevRows, (r) => r.category), [rows, prevRows]);
  const prodGrowth = useMemo(() => growthMap(rows, prevRows, (r) => r.product), [rows, prevRows]);

  const [chartView, setChartView] = useState<"donut" | "rank" | "bubble">("donut");
  const [dim, setDim] = useState<"category" | "product" | "location">("category");

  const dimData = dim === "category" ? cats : dim === "product" ? prods : locs;

  const sparkCol = (_source: Agg[]): Col<Agg> => ({
    key: "trend",
    label: "12-mo trend",
    totalMode: "none",
    value: (r) => r.revenue,
    tip: "Monthly revenue shape for this row over the filtered window.",
    render: (r) => {
      const s = monthlySeries(r.rows).slice(-12).map((m) => m.revenue);
      return (
        <div className="ml-auto h-6 w-24">
          <Sparkline data={s.length ? s : [0, 0]} height={24} />
        </div>
      );
    },
  });

  // Product x Location pivot
  const locNames = locs.map((l) => l.key);
  const pivot = useMemo(() => {
    const m = new Map<string, any>();
    good.forEach((r) => {
      const row = m.get(r.product) || { product: r.product, total: 0 };
      row[r.location] = (row[r.location] || 0) + r.paymentValue;
      row.total += r.paymentValue;
      m.set(r.product, row);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [good]);

  const pivotCols: Col<any>[] = [
    { key: "product", label: "Product", align: "left", value: (r) => r.product, totalMode: "none", width: "190px" },
    ...locNames.map((l) => ({
      key: l,
      label: l.length > 16 ? l.slice(0, 15) + "…" : l,
      value: (r: any) => (r[l] as number) || 0,
      fmt: compact,
      heat: true,
      tip: `Revenue for this product at ${l}.`,
    })),
    { key: "total", label: "Total", value: (r: any) => r.total as number, fmt: compact },
  ];

  const topCat = cats[0];
  const topProd = prods[0];
  const conc = cats.slice(0, 3).reduce((s, c) => s + c.share, 0);
  const longTail = prods.filter((p) => p.share < 1).length;
  const decliners = prods.filter((p) => (prodGrowth.get(p.key) ?? 0) < -15 && p.revenue > 0).slice(0, 3);
  const risers = prods.filter((p) => (prodGrowth.get(p.key) ?? 0) > 15).slice(0, 3);

  return (
    <div className="space-y-6">
      <Panel
        title="Location Scorecard"
        subtitle="Full P&L-style comparison across studios — expand for category, then product level detail"
        tip="Every location with revenue, mix, efficiency and growth. Two levels of nested drill-down are attached to each row."
      >
        <DataTable
          cols={[...aggCols("Location"), growthCol(locGrowth), sparkCol(locs)]}
          rows={locs}
          rowKey={(r) => r.key}
          csvName="locations"
          initialLimit={10}
          expand={(l) => (
            <div className="space-y-2">
              <DataTable
                cols={aggCols("Category")}
                rows={groupBy(l.rows, (r) => r.category)}
                rowKey={(r) => r.key}
                csvName={`${l.key}-categories`}
                initialLimit={8}
                dense
                level={1}
                expand={(c) => (
                  <DataTable
                    cols={aggCols("Product")}
                    rows={groupBy(c.rows, (r) => r.product)}
                    rowKey={(r) => r.key}
                    csvName={`${l.key}-${c.key}`}
                    initialLimit={8}
                    dense
                    level={1}
                    expand={(p) => (
                      <DataTable
                        cols={aggCols("Sold By")}
                        rows={groupBy(p.rows, (r) => r.soldBy)}
                        rowKey={(r) => r.key}
                        csvName="sellers"
                        initialLimit={6}
                        dense
                        level={1}
                      />
                    )}
                  />
                )}
              />
              <p className="px-1 text-[11px] leading-relaxed text-lo">
                <b className="text-hi">{l.key}</b> generated {compact(l.revenue)} from {intFmt(l.customers)} customers
                ({compact(l.arpc)} each) across {intFmt(l.txns)} transactions. Discounting ran at {pct(l.discountRate)} and
                basket depth at {l.upt.toFixed(2)} units per sale.
              </p>
            </div>
          )}
        />
        <Narrative
          lines={[
            <>The network is led by <b>{locs[0]?.key}</b> at {compact(locs[0]?.revenue || 0)} ({pct(locs[0]?.share || 0)} of total). {locs[1] ? <>Second is <b>{locs[1].key}</b> at {compact(locs[1].revenue)}.</> : null} {locs.length > 1 ? <>The gap between best and worst ARPC is {compact(Math.abs((locs[0]?.arpc || 0) - (locs[locs.length - 1]?.arpc || 0)))} per customer — that difference is almost always product mix and desk conversion, not catchment.</> : null}</>,
            <>Compare <b>Disc %</b> across locations: a studio discounting materially harder for a similar AOV is buying its revenue. Compare <b>New</b> against <b>Customers</b> to see which sites are acquisition machines versus retention machines — they need different playbooks.</>,
            <>Drill into any location to see category → product → seller. That path answers "why is this site behind?" in three clicks.</>,
          ]}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Mix Explorer"
          subtitle="Visualise revenue concentration across any dimension"
          right={
            <>
              <Segmented value={dim} onChange={setDim} options={[
                { value: "category", label: "Category" },
                { value: "product", label: "Product" },
                { value: "location", label: "Location" },
              ]} />
              <Segmented value={chartView} onChange={setChartView} options={[
                { value: "donut", label: "Donut" },
                { value: "rank", label: "Ranked" },
                { value: "bubble", label: "Bubble" },
              ]} />
            </>
          }
        >
          <div className="p-3">
            {chartView === "donut" && (
              <Donut data={dimData.slice(0, 9).map((d) => ({ name: d.key, value: d.revenue }))} height={320} inner={72} />
            )}
            {chartView === "rank" && (
              <RankBars data={dimData.slice(0, 12).map((d) => ({ name: d.key.length > 20 ? d.key.slice(0, 19) + "…" : d.key, value: d.revenue }))} height={340} />
            )}
            {chartView === "bubble" && (
              <BubbleChart data={dimData.slice(0, 20).map((d) => ({ x: d.txns, y: d.aov, z: d.revenue, name: d.key }))} height={340} />
            )}
          </div>
          <p className="px-4 pb-3 text-[11px] leading-relaxed text-lo">
            {chartView === "bubble"
              ? "Bubble view plots transaction volume against average order value, sized by revenue. Top-right is your premium volume engine; bottom-right is high-traffic low-value (bundle it); top-left is high-value low-volume (scale it)."
              : `Top three ${dim} lines hold ${pct(dimData.slice(0, 3).reduce((s, d) => s + d.share, 0))} of revenue. Concentration above 70% means a single schedule or supply change can swing the whole month.`}
          </p>
        </Panel>

        <Panel title="Category Split" subtitle="Revenue vs transactions per category">
          <div className="p-3">
            <TrendChart
              data={cats.slice(0, 8).map((c) => ({ label: c.key.length > 10 ? c.key.slice(0, 9) + "…" : c.key, revenue: c.revenue, aov: c.aov }))}
              bars={[{ key: "revenue", name: "Revenue" }]}
              lines={[{ key: "aov", name: "AOV" }]}
              height={320}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="Category Performance"
        subtitle="Revenue engines ranked with growth, discounting and basket metrics"
        tip="Expand a category to see its products, then each product's monthly history."
      >
        <DataTable
          cols={[...aggCols("Category"), growthCol(catGrowth), sparkCol(cats)]}
          rows={cats}
          rowKey={(r) => r.key}
          csvName="categories"
          initialLimit={12}
          expand={(c) => (
            <DataTable
              cols={aggCols("Product")}
              rows={groupBy(c.rows, (r) => r.product)}
              rowKey={(r) => r.key}
              csvName={`${c.key}-products`}
              initialLimit={10}
              dense
              level={1}
              expand={(p) => (
                <DataTable
                  cols={aggCols("Month")}
                  rows={groupBy(p.rows, (r) => r.ym).sort((a, b) => a.key.localeCompare(b.key))}
                  rowKey={(r) => r.key}
                  csvName="months"
                  initialLimit={12}
                  dense
                  level={1}
                />
              )}
            />
          )}
        />
        <Narrative
          tone="emerald"
          lines={[
            <><b>{topCat?.key}</b> is the engine at {compact(topCat?.revenue || 0)} ({pct(topCat?.share || 0)}), serving {intFmt(topCat?.customers || 0)} customers at {compact(topCat?.aov || 0)} AOV. The top three categories together hold <b>{pct(conc)}</b> of revenue.</>,
            <>Categories with high transaction counts but low AOV are acquisition products — judge them on the upgrade rate they produce, not on their own revenue. Categories with high AOV and low volume are margin products — they deserve proactive outbound selling rather than passive shelf space.</>,
            <>Any category running a <b>Disc %</b> above 12% while growth is flat is being subsidised. Pull the discount and watch whether volume actually moves; usually it barely does.</>,
          ]}
        />
      </Panel>

      <Panel
        title="Product Deep Dive"
        subtitle="Every SKU with growth, trend shape and full drill-down"
      >
        <DataTable
          cols={[...aggCols("Product"), growthCol(prodGrowth), sparkCol(prods)]}
          rows={prods}
          rowKey={(r) => r.key}
          csvName="products"
          initialLimit={15}
          maxHeight="620px"
          expand={(p) => (
            <div className="space-y-2">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="tbl-drill-inner">
                  <DataTable cols={aggCols("Location")} rows={groupBy(p.rows, (r) => r.location)} rowKey={(r) => r.key} csvName="p-loc" initialLimit={5} dense level={1} />
                </div>
                <div className="tbl-drill-inner">
                  <DataTable cols={aggCols("Sold By")} rows={groupBy(p.rows, (r) => r.soldBy)} rowKey={(r) => r.key} csvName="p-seller" initialLimit={5} dense level={1} />
                </div>
              </div>
              <div className="tbl-drill-inner">
                <DataTable
                  cols={aggCols("Month")}
                  rows={groupBy(p.rows, (r) => r.ym).sort((a, b) => a.key.localeCompare(b.key))}
                  rowKey={(r) => r.key}
                  csvName="p-month"
                  initialLimit={12}
                  dense
                  level={1}
                />
              </div>
            </div>
          )}
        />
        <Narrative
          tone="amber"
          lines={[
            <><b>{topProd?.key}</b> is the single biggest SKU at {compact(topProd?.revenue || 0)} ({pct(topProd?.share || 0)} of revenue) from {intFmt(topProd?.units || 0)} units.</>,
            <><b>{longTail}</b> SKUs each contribute under 1% of revenue. That long tail adds operational complexity for very little return — consolidate or retire the weakest half and reinvest the shelf space.</>,
            risers.length ? <>Rising fastest: {risers.map((r) => `${r.key} (+${(prodGrowth.get(r.key) || 0).toFixed(0)}%)`).join(", ")}. Push these into bundles and front-of-house scripts while momentum lasts.</> : <>No SKU is growing more than 15% versus the comparison window — the assortment is flat and needs a new hero product.</>,
            decliners.length ? <>Declining fastest: {decliners.map((r) => `${r.key} (${(prodGrowth.get(r.key) || 0).toFixed(0)}%)`).join(", ")}. Check price changes, schedule changes and staff mix before assuming demand has gone.</> : <>No material decliners — the base is stable.</>,
          ]}
        />
      </Panel>

      <Panel
        title="Product × Location Matrix"
        subtitle="Where each SKU actually sells — heat shaded by revenue"
        tip="A cross-tab of product against location. Blank cells are distribution gaps: products proven elsewhere that this site does not sell."
      >
        <DataTable cols={pivotCols} rows={pivot} rowKey={(r) => r.product} defaultSort="total" csvName="product-location-matrix" initialLimit={15} maxHeight="560px" />
        <Narrative
          lines={[
            <>Empty or near-empty cells beside a strong row total are the fastest wins available: a product already proven at one site that another site simply is not selling. Copy the script, not the discount.</>,
            <>Rows that are strong at exactly one location are either local demand quirks or the result of one specific staff member selling well — check the seller drill-down before concluding it is the market.</>,
          ]}
        />
      </Panel>
    </div>
  );
}
