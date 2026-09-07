import { useMemo, useState } from "react";
import type { SaleRow } from "../../lib/types";
import { groupBy, isGood } from "../../lib/analytics";
import { compact, dateTimeStr, dec, inr, intFmt, pct } from "../../lib/format";
import { DataTable, type Col } from "../DataTable";
import { Panel, Segmented, ShareBar } from "../ui";
import { Narrative, aggCols } from "../tableKit";
import { Donut } from "../Charts";

interface MemRow {
  key: string;
  sold: number;
  revenue: number;
  creditsSold: number;
  creditsLeft: number;
  util: number;
  liability: number;
  active: number;
  expiring: number;
  frozen: number;
  revPerCredit: number;
  avgPrice: number;
  rows: SaleRow[];
}

export function OpsSection({ rows }: { rows: SaleRow[] }) {
  const good = useMemo(() => rows.filter(isGood), [rows]);
  const now = new Date();

  const memberships = useMemo<MemRow[]>(() => {
    const mem = good.filter((r) => r.membershipId || /member|package/i.test(r.purchaseType));
    const m = new Map<string, SaleRow[]>();
    mem.forEach((r) => {
      const k = r.membershipName || r.product;
      const a = m.get(k);
      if (a) a.push(r);
      else m.set(k, [r]);
    });
    return Array.from(m.entries())
      .map(([k, rs]) => {
        const creditsSold = rs.reduce((s, r) => s + r.membershipTotalClasses, 0);
        const creditsLeft = rs.reduce((s, r) => s + r.membershipClassesLeft, 0);
        const revenue = rs.reduce((s, r) => s + r.paymentValue, 0);
        return {
          key: k,
          sold: rs.length,
          revenue,
          creditsSold,
          creditsLeft,
          util: creditsSold ? ((creditsSold - creditsLeft) / creditsSold) * 100 : 0,
          liability: rs.reduce((s, r) => s + r.membershipMoneyLeft, 0),
          active: rs.filter((r) => r.membershipEnd && r.membershipEnd > now).length,
          expiring: rs.filter((r) => r.membershipEnd && r.membershipEnd > now && r.membershipEnd.getTime() - now.getTime() < 30 * 864e5).length,
          frozen: rs.filter((r) => r.membershipFreezed).length,
          revPerCredit: creditsSold ? revenue / creditsSold : 0,
          avgPrice: rs.length ? revenue / rs.length : 0,
          rows: rs,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [good]);

  const memCols: Col<MemRow>[] = [
    { key: "key", label: "Membership / Package", align: "left", value: (r) => r.key, totalMode: "none", width: "200px" },
    { key: "sold", label: "Sold", value: (r) => r.sold, fmt: intFmt, heat: true, tip: "Number of memberships sold." },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "avgPrice", label: "Avg Price", value: (r) => r.avgPrice, fmt: compact, totalMode: "custom", totalValue: (rs) => compact(rs.reduce((s, r) => s + r.revenue, 0) / Math.max(1, rs.reduce((s, r) => s + r.sold, 0))) },
    { key: "creditsSold", label: "Credits Sold", value: (r) => r.creditsSold, fmt: intFmt, tip: "Total class credits issued." },
    { key: "creditsLeft", label: "Credits Left", value: (r) => r.creditsLeft, fmt: intFmt, tip: "Unredeemed credits still outstanding." },
    { key: "util", label: "Utilisation", value: (r) => r.util, fmt: (n) => pct(n), tip: "Credits used ÷ credits sold. Below 55% strongly predicts non-renewal.",
      totalMode: "custom",
      totalValue: (rs) => { const s = rs.reduce((a, r) => a + r.creditsSold, 0); const l = rs.reduce((a, r) => a + r.creditsLeft, 0); return s ? pct(((s - l) / s) * 100) : "—"; },
      render: (r) => (
        <div className="min-w-[62px]">
          <span className={`num ${r.util < 55 ? "text-neg" : r.util < 75 ? "text-warn" : "text-pos"}`}>{pct(r.util)}</span>
          <ShareBar value={r.util} />
        </div>
      ) },
    { key: "liability", label: "Deferred Liability", value: (r) => r.liability, fmt: compact, tip: "Money value of unused credits — revenue you have taken but not yet earned." },
    { key: "revPerCredit", label: "Rev / Credit", value: (r) => r.revPerCredit, fmt: compact, totalMode: "avg", tip: "Effective price per class credit." },
    { key: "active", label: "Active", value: (r) => r.active, fmt: intFmt, tip: "End date still in the future." },
    { key: "expiring", label: "Expiring ≤30d", value: (r) => r.expiring, fmt: intFmt, tip: "Renewal window opportunities.",
      render: (r) => <span className={r.expiring > 0 ? "text-warn font-semibold" : ""}>{intFmt(r.expiring)}</span> },
    { key: "frozen", label: "Frozen", value: (r) => r.frozen, fmt: intFmt },
  ];

  /* ---------- discounts ---------- */
  const discounts = useMemo(() => {
    const withCode = good.filter((r) => r.discountCode);
    return groupBy(withCode, (r) => r.discountCode).map((a) => ({
      ...a,
      efficiency: a.discount ? a.revenue / a.discount : 0,
      avgDiscount: a.txns ? a.discount / a.txns : 0,
    }));
  }, [good]);

  const discCols: Col<any>[] = [
    { key: "key", label: "Discount Code", align: "left", value: (r) => r.key, totalMode: "none", width: "150px" },
    { key: "txns", label: "Redemptions", value: (r) => r.txns, fmt: intFmt, heat: true },
    { key: "revenue", label: "Revenue Driven", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "discount", label: "Cost of Discount", value: (r) => r.discount, fmt: compact },
    { key: "avgDiscount", label: "Avg Discount", value: (r) => r.avgDiscount, fmt: compact, totalMode: "avg" },
    { key: "discountRate", label: "Effective %", value: (r) => r.discountRate, fmt: (n) => pct(n), totalMode: "avg",
      render: (r: any) => <span className={r.discountRate > 20 ? "text-neg" : r.discountRate > 12 ? "text-warn" : "text-mid"}>{pct(r.discountRate)}</span> },
    { key: "efficiency", label: "₹ Rev per ₹ Disc", value: (r) => r.efficiency, fmt: (n) => `${dec(n, 1)}×`, totalMode: "custom",
      totalValue: (rs: any[]) => `${dec(rs.reduce((s, r) => s + r.revenue, 0) / Math.max(1, rs.reduce((s, r) => s + r.discount, 0)), 1)}×`,
      tip: "Revenue generated for every rupee of discount given. Under 5× is usually value-destructive." },
    { key: "customers", label: "Customers", value: (r) => r.customers, fmt: intFmt },
    { key: "newCustomers", label: "New Cust.", value: (r) => r.newCustomers, fmt: intFmt, tip: "Did the code actually acquire, or just discount existing demand?" },
    { key: "aov", label: "AOV", value: (r) => r.aov, fmt: compact, totalMode: "avg" },
  ];

  /* ---------- payments ---------- */
  const [payDim, setPayDim] = useState<"paymentMethod" | "paymentStatus" | "paymentSource" | "purchaseType">("paymentMethod");
  const payGroups = useMemo(() => {
    const f: Record<string, (r: SaleRow) => string> = {
      paymentMethod: (r) => r.paymentMethod,
      paymentStatus: (r) => r.paymentStatus,
      paymentSource: (r) => r.paymentSource,
      purchaseType: (r) => r.purchaseType,
    };
    return groupBy(payDim === "paymentStatus" ? rows : good, f[payDim]);
  }, [rows, good, payDim]);

  const statusAll = useMemo(() => groupBy(rows, (r) => r.paymentStatus), [rows]);
  const failedRows = useMemo(() => rows.filter((r) => /fail|refund/i.test(r.paymentStatus) || r.isVoided), [rows]);

  /* ---------- ledger ---------- */
  const txCols: Col<SaleRow>[] = [
    { key: "date", label: "Date", align: "left", value: (r) => r.paymentDate?.getTime() || 0, totalMode: "none", width: "130px",
      render: (r) => <span className="text-[10.5px]">{dateTimeStr(r.paymentDate)}</span> },
    { key: "cust", label: "Customer", align: "left", value: (r) => r.customerName, totalMode: "none",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-hi">{r.customerName}</p>
          <p className="truncate text-[9.5px] text-lo">{r.customerEmail}</p>
        </div>
      ) },
    { key: "product", label: "Product", align: "left", value: (r) => r.product, totalMode: "none" },
    { key: "category", label: "Category", align: "left", value: (r) => r.category, totalMode: "none" },
    { key: "location", label: "Location", align: "left", value: (r) => r.location, totalMode: "none" },
    { key: "value", label: "Value", value: (r) => r.paymentValue, fmt: compact, heat: true },
    { key: "qty", label: "Qty", value: (r) => r.quantity, fmt: intFmt },
    { key: "disc", label: "Discount", value: (r) => r.discountValue, fmt: compact },
    { key: "vat", label: "VAT", value: (r) => r.paymentVAT, fmt: compact },
    { key: "method", label: "Method", align: "left", value: (r) => r.paymentMethod, totalMode: "none" },
    { key: "status", label: "Status", align: "left", value: (r) => r.paymentStatus, totalMode: "none",
      render: (r) => {
        const ok = r.paymentStatus.toLowerCase() === "succeeded" && !r.isVoided;
        return (
          <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-semibold ${ok ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"}`}>
            {r.isVoided ? "voided" : r.paymentStatus}
          </span>
        );
      } },
    { key: "seller", label: "Sold By", align: "left", value: (r) => r.soldBy, totalMode: "none" },
  ];

  const totalLiab = memberships.reduce((s, m) => s + m.liability, 0);
  const totalUtil = (() => {
    const s = memberships.reduce((a, m) => a + m.creditsSold, 0);
    const l = memberships.reduce((a, m) => a + m.creditsLeft, 0);
    return s ? ((s - l) / s) * 100 : 0;
  })();
  const expiringAll = memberships.reduce((s, m) => s + m.expiring, 0);
  const worstCode = discounts.slice().sort((a, b) => a.efficiency - b.efficiency)[0];
  const bestCode = discounts.slice().sort((a, b) => b.efficiency - a.efficiency)[0];
  const failedVal = failedRows.reduce((s, r) => s + r.paymentValue, 0);
  const successRate = rows.length ? (good.length / rows.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <Panel
        title="Membership & Credit Book"
        subtitle="Utilisation, deferred liability and renewal exposure by package"
        tip="Memberships are sold today but delivered later. This table tracks how much of that promise is still outstanding."
      >
        <DataTable
          cols={memCols}
          rows={memberships}
          rowKey={(r) => r.key}
          csvName="memberships"
          initialLimit={12}
          expand={(m) => (
            <div className="tbl-drill-inner">
              <DataTable
                cols={[
                  { key: "cust", label: "Member", align: "left", value: (r: SaleRow) => r.customerName, totalMode: "none" },
                  { key: "start", label: "Start", align: "left", value: (r: SaleRow) => r.membershipStart?.getTime() || 0, totalMode: "none", render: (r: SaleRow) => <span className="text-[10.5px]">{dateTimeStr(r.membershipStart)}</span> },
                  { key: "end", label: "End", align: "left", value: (r: SaleRow) => r.membershipEnd?.getTime() || 0, totalMode: "none", render: (r: SaleRow) => <span className="text-[10.5px]">{dateTimeStr(r.membershipEnd)}</span> },
                  { key: "paid", label: "Paid", value: (r: SaleRow) => r.paymentValue, fmt: compact },
                  { key: "tc", label: "Credits", value: (r: SaleRow) => r.membershipTotalClasses, fmt: intFmt },
                  { key: "cl", label: "Left", value: (r: SaleRow) => r.membershipClassesLeft, fmt: intFmt },
                  { key: "ml", label: "Money Left", value: (r: SaleRow) => r.membershipMoneyLeft, fmt: compact },
                  { key: "type", label: "Type", align: "left", value: (r: SaleRow) => r.membershipType || "—", totalMode: "none" },
                  { key: "loc", label: "Location", align: "left", value: (r: SaleRow) => r.location, totalMode: "none" },
                ]}
                rows={m.rows}
                rowKey={(r) => r.saleItemId + r.membershipId}
                csvName={`${m.key}-members`}
                initialLimit={8}
                dense
                level={1}
              />
            </div>
          )}
        />
        <Narrative
          lines={[
            <>Blended credit utilisation is <b>{pct(totalUtil)}</b> with <b>{compact(totalLiab)}</b> of deferred liability sitting on the books. That money is collected but not earned — if members never show up, it converts into churn rather than profit.</>,
            <><b>{intFmt(expiringAll)}</b> memberships expire within 30 days. Every one of them is a renewal conversation that should be scheduled now, not after they lapse; renewal conversion drops sharply once a membership actually ends.</>,
            <>Packages with low utilisation and high price are the churn risk to attack first — the member has paid, is not attending, and will not renew. Utilisation, not revenue, is the leading indicator here.</>,
            <>Compare <b>Rev / Credit</b> across packages: if a large package prices a class materially below a small one, you are training customers to buy the discount rather than the commitment. Keep the gap deliberate and narrow.</>,
          ]}
        />
      </Panel>

      <Panel
        title="Discount & Promotion Effectiveness"
        subtitle="What each code actually bought you"
        tip="Revenue per rupee of discount is the key column — it tells you whether a code created demand or just gave away margin."
      >
        <DataTable
          cols={discCols}
          rows={discounts}
          rowKey={(r) => r.key}
          csvName="discount-codes"
          initialLimit={12}
          expand={(d: any) => (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="tbl-drill-inner">
                <DataTable cols={aggCols("Product")} rows={groupBy(d.rows, (r: SaleRow) => r.product)} rowKey={(r) => r.key} csvName="d-prod" initialLimit={6} dense level={1} />
              </div>
              <div className="tbl-drill-inner">
                <DataTable cols={aggCols("Month")} rows={groupBy(d.rows, (r: SaleRow) => r.ym).sort((a, b) => a.key.localeCompare(b.key))} rowKey={(r) => r.key} csvName="d-month" initialLimit={6} dense level={1} />
              </div>
            </div>
          )}
        />
        <Narrative
          tone="amber"
          lines={[
            discounts.length ? (
              <>Codes were redeemed {intFmt(discounts.reduce((s, d) => s + d.txns, 0))} times, costing {compact(discounts.reduce((s, d) => s + d.discount, 0))} and touching {compact(discounts.reduce((s, d) => s + d.revenue, 0))} of revenue.</>
            ) : (
              <>No discount codes are present in the filtered window — full-price selling, which is the healthiest position to be in.</>
            ),
            bestCode ? <><b>{bestCode.key}</b> is the most efficient at {dec(bestCode.efficiency, 1)}× revenue per rupee discounted, with {intFmt(bestCode.newCustomers)} new customers acquired. Scale this one.</> : null,
            worstCode && discounts.length > 1 ? <><b>{worstCode.key}</b> is the weakest at {dec(worstCode.efficiency, 1)}× and only {intFmt(worstCode.newCustomers)} new customers — it is mostly discounting people who would have bought anyway. Retire it or restrict it to lapsed customers only.</> : null,
            <>Rule of thumb: a code that brings new customers at 8×+ is marketing spend; a code redeemed largely by existing customers at under 5× is a price cut wearing a costume.</>,
          ].filter(Boolean) as React.ReactNode[]}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Payment Intelligence"
          subtitle="Method, status, source and purchase type economics"
          right={
            <Segmented
              value={payDim}
              onChange={setPayDim}
              options={[
                { value: "paymentMethod", label: "Method" },
                { value: "paymentStatus", label: "Status" },
                { value: "paymentSource", label: "Source" },
                { value: "purchaseType", label: "Type" },
              ]}
            />
          }
        >
          <DataTable
            cols={aggCols("Segment")}
            rows={payGroups}
            rowKey={(r) => r.key}
            csvName={`payments-${payDim}`}
            initialLimit={10}
            expand={(p) => (
              <DataTable cols={aggCols("Category")} rows={groupBy(p.rows, (r) => r.category)} rowKey={(r) => r.key} csvName="pay-cat" initialLimit={6} dense level={1} />
            )}
          />
          <Narrative
            lines={[
              <>Payment success rate is <b>{pct(successRate)}</b>. Failed, refunded and voided attempts total <b>{compact(failedVal)}</b> across {intFmt(failedRows.length)} records — most of that is recoverable with automatic retries and a second payment option at checkout.</>,
              <>Watch the AOV difference between methods. Online gateways usually carry higher tickets because customers buy packages there, while cash and desk payments skew to single classes. If your gateway AOV is falling, the online funnel is pushing the wrong product first.</>,
            ]}
          />
        </Panel>

        <Panel title="Status Split" subtitle="Successful vs leaked value">
          <div className="p-3">
            <Donut data={statusAll.map((s) => ({ name: s.key, value: Math.max(s.revenue, s.rows.reduce((a, r) => a + r.paymentValue, 0)) }))} height={260} inner={62} />
          </div>
          <div className="space-y-1.5 px-4 pb-4 text-[11px]">
            {statusAll.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <span className="capitalize text-lo">{s.key}</span>
                <span className="num text-hi">{intFmt(s.rows.length)} · {compact(s.rows.reduce((a, r) => a + r.paymentValue, 0))}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Transaction Ledger"
        subtitle="Line-item level source of truth — expand any row for the full record"
        tip="This is the raw sheet, filtered. Every aggregate above rolls up from exactly these rows."
      >
        <DataTable
          cols={txCols}
          rows={rows}
          rowKey={(r) => r.saleItemId + r.transactionId + r.saleId}
          defaultSort="date"
          csvName="transactions"
          initialLimit={15}
          maxHeight="640px"
          expand={(r) => (
            <div className="grid gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Member ID", r.memberId],
                ["Paying Member ID", r.payingMemberId],
                ["Sale ID", r.saleId],
                ["Sale Item ID", r.saleItemId],
                ["Transaction ID", r.transactionId],
                ["Sale Reference", r.saleReference],
                ["Payment Value", inr(r.paymentValue, 2)],
                ["Price ex-VAT", inr(r.priceExVat, 2)],
                ["VAT", inr(r.paymentVAT, 2)],
                ["Unit Price inc VAT", inr(r.unitPriceIncVat, 2)],
                ["Unit Price ex VAT", inr(r.unitPriceExVat, 2)],
                ["Unit Discount", inr(r.unitDiscount, 2)],
                ["Sale Total Discount", inr(r.saleTotalDiscount, 2)],
                ["Discount Code", r.discountCode || "—"],
                ["Purchase Type", r.purchaseType],
                ["Payment Source", r.paymentSource],
                ["Money Credits", inr(r.paidInMoneyCredits, 2)],
                ["Event Credits", dec(r.paidInEventCredits, 2)],
                ["Host ID", r.hostId || "—"],
                ["Created At", dateTimeStr(r.createdAt)],
                ["Membership ID", r.membershipId || "—"],
                ["Membership Name", r.membershipName || "—"],
                ["Membership Start", dateTimeStr(r.membershipStart)],
                ["Membership End", dateTimeStr(r.membershipEnd)],
                ["Total Classes", r.membershipTotalClasses || "—"],
                ["Classes Left", r.membershipClassesLeft || "—"],
                ["Money Left", r.membershipMoneyLeft ? inr(r.membershipMoneyLeft, 2) : "—"],
                ["Membership Type", r.membershipType || "—"],
                ["Frozen", r.membershipFreezed ? "Yes" : "No"],
                ["Used Session Credits", r.membershipUsedCredits || "—"],
                ["Rev / Event Credit", r.membershipRevPerCredit ? inr(r.membershipRevPerCredit, 2) : "—"],
                ["Voided", r.isVoided ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-2 border-b border-line/60 py-1">
                  <span className="text-lo">{k}</span>
                  <span className="num truncate text-hi">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        />
        <Narrative
          lines={[
            <>{intFmt(rows.length)} line items are in scope, of which {intFmt(good.length)} are successful and non-voided. Use the row filter to jump straight to a customer, transaction ID or reference when finance queries a number.</>,
            <>Every metric on this dashboard is derived from these rows using the same rules: successful status, voided excluded, quantity-weighted units and VAT-separated net revenue. If a number looks wrong, expand the record here and you will see exactly which fields produced it.</>,
          ]}
        />
      </Panel>
    </div>
  );
}
