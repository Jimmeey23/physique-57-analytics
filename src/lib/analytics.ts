import type { SaleRow } from "./types";

export interface Agg {
  key: string;
  revenue: number;
  exVat: number;
  vat: number;
  discount: number;
  listValue: number;
  units: number;
  txns: number;
  customers: number;
  newCustomers: number;
  refunded: number;
  failed: number;
  voided: number;
  membershipRev: number;
  retailRev: number;
  aov: number;
  atv: number;
  upt: number;
  arpc: number;
  discountRate: number;
  discountedShare: number;
  share: number;
  rows: SaleRow[];
}

export const isGood = (r: SaleRow) => r.paymentStatus.toLowerCase() === "succeeded" && !r.isVoided;

export function aggregate(rows: SaleRow[], key: string): Agg {
  const custs = new Set<string>();
  const newCusts = new Set<string>();
  const sales = new Set<string>();
  let revenue = 0, exVat = 0, vat = 0, discount = 0, units = 0, refunded = 0, failed = 0, voided = 0;
  let membershipRev = 0, retailRev = 0, discountedTxns = 0;
  for (const r of rows) {
    const ok = isGood(r);
    const st = r.paymentStatus.toLowerCase();
    if (st === "refunded") refunded += r.paymentValue;
    if (st === "failed") failed += r.paymentValue;
    if (r.isVoided) voided += r.paymentValue;
    if (!ok) continue;
    revenue += r.paymentValue;
    exVat += r.priceExVat;
    vat += r.paymentVAT;
    discount += r.discountValue;
    units += r.quantity;
    const cid = r.customerEmail || r.memberId || r.customerName;
    custs.add(cid);
    if (r.isNew) newCusts.add(cid);
    sales.add(r.saleId || r.saleItemId);
    if (r.purchaseType.toLowerCase().includes("member") || r.membershipId) membershipRev += r.paymentValue;
    if (/retail/i.test(r.category)) retailRev += r.paymentValue;
    if (r.discountValue > 0) discountedTxns++;
  }
  const txns = sales.size || rows.filter(isGood).length;
  const listValue = revenue + discount;
  return {
    key,
    revenue, exVat, vat, discount, listValue, units, txns,
    customers: custs.size,
    newCustomers: newCusts.size,
    refunded, failed, voided, membershipRev, retailRev,
    aov: txns ? revenue / txns : 0,
    atv: units ? revenue / units : 0,
    upt: txns ? units / txns : 0,
    arpc: custs.size ? revenue / custs.size : 0,
    discountRate: listValue ? (discount / listValue) * 100 : 0,
    discountedShare: txns ? (discountedTxns / txns) * 100 : 0,
    share: 0,
    rows,
  };
}

export function groupBy(rows: SaleRow[], keyFn: (r: SaleRow) => string): Agg[] {
  const map = new Map<string, SaleRow[]>();
  for (const r of rows) {
    const k = keyFn(r) || "—";
    const a = map.get(k);
    if (a) a.push(r);
    else map.set(k, [r]);
  }
  const out = Array.from(map.entries()).map(([k, rs]) => aggregate(rs, k));
  const total = out.reduce((s, a) => s + a.revenue, 0);
  out.forEach((a) => (a.share = total ? (a.revenue / total) * 100 : 0));
  return out.sort((a, b) => b.revenue - a.revenue);
}

export const ymLabel = (ym: string) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[+m - 1]} ${y.slice(2)}`;
};

export const prevYm = (ym: string, back = 1) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export interface MonthPoint extends Agg {
  ym: string;
  label: string;
  momRev: number | null;
  yoyRev: number | null;
  cumulative: number;
}

export function monthlySeries(rows: SaleRow[]): MonthPoint[] {
  const groups = groupBy(rows.filter((r) => r.ym), (r) => r.ym);
  const byYm = new Map(groups.map((g) => [g.key, g]));
  const keys = Array.from(byYm.keys()).sort();
  let cum = 0;
  return keys.map((k) => {
    const g = byYm.get(k) as Agg;
    cum += g.revenue;
    const p = byYm.get(prevYm(k, 1));
    const y = byYm.get(prevYm(k, 12));
    return {
      ...g,
      ym: k,
      label: ymLabel(k),
      momRev: p && p.revenue ? ((g.revenue - p.revenue) / p.revenue) * 100 : null,
      yoyRev: y && y.revenue ? ((g.revenue - y.revenue) / y.revenue) * 100 : null,
      cumulative: cum,
    };
  });
}

export interface KPI {
  id: string;
  label: string;
  value: number;
  prev: number;
  format: "money" | "int" | "pct" | "dec";
  hint: string;
  group: string;
  invert?: boolean;
}

export function computeKPIs(rows: SaleRow[], prevRows: SaleRow[]): KPI[] {
  const build = (rs: SaleRow[]) => {
    const good = rs.filter(isGood);
    const a = aggregate(rs, "all");
    const custMap = new Map<string, { rev: number; n: number }>();
    for (const r of good) {
      const k = r.customerEmail || r.memberId || r.customerName;
      const c = custMap.get(k) || { rev: 0, n: 0 };
      c.rev += r.paymentValue;
      c.n += 1;
      custMap.set(k, c);
    }
    const custArr = Array.from(custMap.values()).sort((x, y) => y.rev - x.rev);
    const repeat = custArr.filter((c) => c.n > 1).length;
    const top10n = Math.max(1, Math.floor(custArr.length * 0.1));
    const top10rev = custArr.slice(0, top10n).reduce((s, c) => s + c.rev, 0);
    const values = good.map((r) => r.paymentValue).sort((x, y) => x - y);
    const median = values.length ? values[Math.floor(values.length / 2)] : 0;
    const days = new Set(good.map((r) => (r.paymentDate ? r.paymentDate.toDateString() : ""))).size;
    const dayRev = new Map<string, number>();
    good.forEach((r) => {
      const k = r.paymentDate ? r.paymentDate.toDateString() : "";
      dayRev.set(k, (dayRev.get(k) || 0) + r.paymentValue);
    });
    const peakDay = Math.max(0, ...Array.from(dayRev.values()));
    const memRows = good.filter((r) => r.membershipId);
    const creditsSold = memRows.reduce((s, r) => s + r.membershipTotalClasses, 0);
    const creditsLeft = memRows.reduce((s, r) => s + r.membershipClassesLeft, 0);
    const creditsUsed = Math.max(0, creditsSold - creditsLeft);
    const liability = memRows.reduce((s, r) => s + r.membershipMoneyLeft, 0);
    const now = new Date();
    const activeMem = memRows.filter((r) => r.membershipEnd && r.membershipEnd > now).length;
    const expiring = memRows.filter(
      (r) => r.membershipEnd && r.membershipEnd > now && r.membershipEnd.getTime() - now.getTime() < 30 * 864e5
    ).length;
    const frozen = memRows.filter((r) => r.membershipFreezed).length;
    const newRev = good.filter((r) => r.isNew).reduce((s, r) => s + r.paymentValue, 0);
    const online = good.filter((r) => /stripe|razorpay|online|web/i.test(r.paymentSource + r.paymentMethod))
      .reduce((s, r) => s + r.paymentValue, 0);
    const attempts = rs.length;
    const succ = good.length;
    const sellers = new Set(good.map((r) => r.soldBy)).size;
    const prodCount = new Set(good.map((r) => r.product)).size;
    const catCount = new Set(good.map((r) => r.category)).size;
    const locCount = new Set(good.map((r) => r.location)).size;
    const ptRev = good.filter((r) => /personal training/i.test(r.category)).reduce((s, r) => s + r.paymentValue, 0);
    const pkgRev = good.filter((r) => /package/i.test(r.category)).reduce((s, r) => s + r.paymentValue, 0);
    return {
      a, custArr, repeat, top10rev, median, days, peakDay, creditsSold, creditsUsed, creditsLeft,
      liability, activeMem, expiring, frozen, newRev, online, attempts, succ, sellers, prodCount,
      catCount, locCount, ptRev, pkgRev, memRows,
    };
  };
  const c = build(rows);
  const p = build(prevRows);

  const K = (
    id: string, label: string, format: KPI["format"], group: string, hint: string,
    f: (x: ReturnType<typeof build>) => number, invert = false
  ): KPI => ({ id, label, format, group, hint, value: f(c) || 0, prev: f(p) || 0, invert });

  return [
    K("rev","Gross Revenue","money","Revenue","Total value of successful, non-voided payments (incl. VAT).",(x)=>x.a.revenue),
    K("net","Net Revenue (ex-VAT)","money","Revenue","Revenue excluding VAT — the amount that reaches the P&L.",(x)=>x.a.exVat),
    K("vat","VAT Collected","money","Revenue","Total tax component collected across all sales.",(x)=>x.a.vat),
    K("txn","Transactions","int","Volume","Count of distinct successful sales (Sale IDs).",(x)=>x.a.txns),
    K("units","Units Sold","int","Volume","Sum of Sale Item Quantity across successful line items.",(x)=>x.a.units),
    K("aov","AOV","money","Value","Average Order Value = revenue ÷ transactions.",(x)=>x.a.aov),
    K("atv","ATV / Unit Value","money","Value","Average value of a single unit sold.",(x)=>x.a.atv),
    K("upt","Units / Transaction","dec","Value","Basket depth — units divided by transactions.",(x)=>x.a.upt),
    K("median","Median Ticket","money","Value","Middle transaction value — resistant to outliers.",(x)=>x.median),
    K("cust","Unique Customers","int","Customers","Distinct paying customers in the period.",(x)=>x.a.customers),
    K("newc","New Customers","int","Customers","Customers whose first-ever purchase falls in this period.",(x)=>x.a.newCustomers),
    K("ret","Returning Customers","int","Customers","Customers who had purchased before this period.",(x)=>Math.max(0,x.a.customers-x.a.newCustomers)),
    K("arpc","Revenue / Customer","money","Customers","ARPC — revenue divided by unique customers.",(x)=>x.a.arpc),
    K("repeat","Repeat Purchase Rate","pct","Customers","Share of customers with more than one transaction.",(x)=>x.custArr.length?(x.repeat/x.custArr.length)*100:0),
    K("freq","Purchase Frequency","dec","Customers","Average transactions per customer.",(x)=>x.custArr.length?x.a.txns/x.custArr.length:0),
    K("ltv","Avg Customer Value","money","Customers","Average lifetime spend per customer within the filtered window.",(x)=>x.custArr.length?x.custArr.reduce((s,v)=>s+v.rev,0)/x.custArr.length:0),
    K("conc","Top-10% Rev Share","pct","Customers","Revenue concentration — share held by the top decile of customers.",(x)=>x.a.revenue?(x.top10rev/x.a.revenue)*100:0,true),
    K("newrevshare","New-Customer Rev Share","pct","Customers","Portion of revenue generated by first-time buyers.",(x)=>x.a.revenue?(x.newRev/x.a.revenue)*100:0),
    K("disc","Discount Value","money","Discounting","Total currency value given away as discounts.",(x)=>x.a.discount,true),
    K("discrate","Discount Rate","pct","Discounting","Discount ÷ list value. Above 12% signals margin erosion.",(x)=>x.a.discountRate,true),
    K("discshare","Discounted Txn Share","pct","Discounting","Percent of transactions that used any discount.",(x)=>x.a.discountedShare,true),
    K("listval","Gross List Value","money","Discounting","Revenue before discounts were applied.",(x)=>x.a.listValue),
    K("refund","Refunded Value","money","Risk","Value of payments marked refunded.",(x)=>x.a.refunded,true),
    K("failed","Failed Payments","money","Risk","Value of payment attempts that failed.",(x)=>x.a.failed,true),
    K("void","Voided Value","money","Risk","Value of line items flagged as voided.",(x)=>x.a.voided,true),
    K("success","Payment Success Rate","pct","Risk","Successful payments ÷ all payment attempts.",(x)=>x.attempts?(x.succ/x.attempts)*100:0),
    K("liab","Unredeemed Liability","money","Memberships","Money value still sitting inside unused memberships.",(x)=>x.liability,true),
    K("memrev","Membership Revenue","money","Memberships","Revenue from membership / package purchase types.",(x)=>x.a.membershipRev),
    K("memshare","Membership Rev Share","pct","Memberships","Membership revenue as a share of total revenue.",(x)=>x.a.revenue?(x.a.membershipRev/x.a.revenue)*100:0),
    K("active","Active Memberships","int","Memberships","Memberships whose end date is still in the future.",(x)=>x.activeMem),
    K("expiring","Expiring ≤30 Days","int","Memberships","Active memberships lapsing within 30 days — renewal targets.",(x)=>x.expiring,true),
    K("frozen","Frozen Memberships","int","Memberships","Memberships currently on freeze.",(x)=>x.frozen,true),
    K("credsold","Credits Sold","int","Memberships","Total class credits sold through packages.",(x)=>x.creditsSold),
    K("credused","Credits Used","int","Memberships","Class credits already redeemed.",(x)=>x.creditsUsed),
    K("credutil","Credit Utilisation","pct","Memberships","Credits used ÷ credits sold — engagement proxy.",(x)=>x.creditsSold?(x.creditsUsed/x.creditsSold)*100:0),
    K("revcred","Revenue / Credit","money","Memberships","Average realised revenue per class credit sold.",(x)=>x.creditsSold?x.a.membershipRev/x.creditsSold:0),
    K("retail","Retail Revenue","money","Mix","Revenue from retail products.",(x)=>x.a.retailRev),
    K("pkg","Package Revenue","money","Mix","Revenue from class packages.",(x)=>x.pkgRev),
    K("pt","Personal Training Revenue","money","Mix","Revenue from 1:1 personal training.",(x)=>x.ptRev),
    K("online","Online Payment Share","pct","Mix","Share of revenue collected via online gateways.",(x)=>x.a.revenue?(x.online/x.a.revenue)*100:0),
    K("dailyrev","Avg Daily Revenue","money","Velocity","Revenue divided by number of trading days.",(x)=>x.days?x.a.revenue/x.days:0),
    K("peak","Peak Day Revenue","money","Velocity","Best single trading day in the period.",(x)=>x.peakDay),
    K("tradedays","Trading Days","int","Velocity","Days with at least one successful sale.",(x)=>x.days),
    K("txnday","Transactions / Day","dec","Velocity","Average number of sales per trading day.",(x)=>x.days?x.a.txns/x.days:0),
    K("sellers","Active Sellers","int","Team","Distinct staff members who closed a sale.",(x)=>x.sellers),
    K("revseller","Revenue / Seller","money","Team","Average revenue produced per active seller.",(x)=>x.sellers?x.a.revenue/x.sellers:0),
    K("prods","Products Sold","int","Team","Distinct SKUs with at least one sale.",(x)=>x.prodCount),
    K("cats","Active Categories","int","Team","Distinct product categories generating revenue.",(x)=>x.catCount),
    K("locs","Active Locations","int","Team","Distinct studio locations with sales.",(x)=>x.locCount),
  ];
}

export function delta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/* ------------------------- Insight engine ------------------------- */
export interface Insight {
  kind: "win" | "risk" | "trend" | "action";
  title: string;
  body: string;
  metric?: string;
}

export function buildInsights(rows: SaleRow[], series: MonthPoint[]): Insight[] {
  const out: Insight[] = [];
  const good = rows.filter(isGood);
  if (!good.length) return out;
  const total = aggregate(rows, "all");
  const last = series[series.length - 1];
  const prev = series[series.length - 2];

  if (last && prev) {
    const mom = delta(last.revenue, prev.revenue);
    if (mom !== null) {
      out.push({
        kind: mom >= 0 ? "win" : "risk",
        title: `${last.label} revenue ${mom >= 0 ? "grew" : "declined"} ${Math.abs(mom).toFixed(1)}% MoM`,
        body: `${last.label} closed at ${money(last.revenue)} versus ${money(prev.revenue)} in ${prev.label}. ${
          mom >= 0
            ? `Growth was driven by ${last.txns} transactions at an AOV of ${money(last.aov)}.`
            : `Transactions moved from ${prev.txns} to ${last.txns} while AOV moved from ${money(prev.aov)} to ${money(last.aov)} — ${
                last.txns < prev.txns ? "the drop is volume-led, so focus on lead flow and rebooking." : "the drop is price-led, so review discounting and mix."
              }`
        }`,
        metric: "MoM",
      });
    }
    if (last.yoyRev !== null) {
      out.push({
        kind: last.yoyRev >= 0 ? "win" : "risk",
        title: `Year-on-year ${last.yoyRev >= 0 ? "up" : "down"} ${Math.abs(last.yoyRev).toFixed(1)}%`,
        body: `Compared with the same month last year, revenue is ${last.yoyRev >= 0 ? "ahead" : "behind"} by ${Math.abs(
          last.yoyRev
        ).toFixed(1)}%. Use YoY rather than MoM to strip out seasonality when judging the trend.`,
        metric: "YoY",
      });
    }
  }

  const cats = groupBy(good, (r) => r.category);
  if (cats.length) {
    const top = cats[0];
    out.push({
      kind: "trend",
      title: `${top.key} is the revenue engine at ${top.share.toFixed(1)}% of sales`,
      body: `${top.key} produced ${money(top.revenue)} across ${top.txns} transactions (AOV ${money(top.aov)}). ${
        cats.length > 1 ? `Second place is ${cats[1].key} at ${cats[1].share.toFixed(1)}%.` : ""
      } Concentration above 45% in one category is a resilience risk — protect it and grow the number two.`,
    });
    const weak = cats.filter((x) => x.txns >= 5).sort((a, b) => a.aov - b.aov)[0];
    if (weak) {
      out.push({
        kind: "action",
        title: `${weak.key} has the weakest ticket at ${money(weak.aov)}`,
        body: `It absorbs ${weak.txns} transactions but only ${weak.share.toFixed(
          1
        )}% of revenue. Either bundle it into a higher-value package or use it purely as an acquisition hook and measure the 60-day upgrade rate.`,
      });
    }
  }

  const disc = total.discountRate;
  out.push({
    kind: disc > 12 ? "risk" : "win",
    title: `Discount rate at ${disc.toFixed(1)}% of list value`,
    body: `${money(total.discount)} was given away, with ${total.discountedShare.toFixed(
      1
    )}% of transactions carrying a code. ${
      disc > 12
        ? "That is above the 12% healthy ceiling — cap stacked codes and shift to value-adds instead of price cuts."
        : "This is within a healthy band; keep codes targeted at acquisition and win-back rather than blanket sitewide use."
    }`,
  });

  const locs = groupBy(good, (r) => r.location);
  if (locs.length > 1) {
    const best = locs[0];
    const worst = locs[locs.length - 1];
    out.push({
      kind: "trend",
      title: `${best.key} outperforms ${worst.key} by ${(best.revenue / Math.max(1, worst.revenue)).toFixed(1)}×`,
      body: `${best.key}: ${money(best.revenue)} from ${best.customers} customers (ARPC ${money(
        best.arpc
      )}). ${worst.key}: ${money(worst.revenue)} from ${worst.customers} customers (ARPC ${money(
        worst.arpc
      )}). Transplant the winning product mix and staff scripts from the leading studio.`,
    });
  }

  const sellers = groupBy(good, (r) => r.soldBy).filter((s) => s.txns >= 3);
  if (sellers.length > 2) {
    const top = sellers[0];
    const median = sellers[Math.floor(sellers.length / 2)];
    out.push({
      kind: "action",
      title: `Top seller ${top.key} converts at ${money(top.aov)} AOV`,
      body: `${top.key} closed ${money(top.revenue)} versus a team median of ${money(
        median.revenue
      )}. Lifting the bottom half to median performance would add roughly ${money(
        Math.max(0, (median.aov - sellers[sellers.length - 1].aov) * sellers[sellers.length - 1].txns)
      )} without any extra footfall.`,
    });
  }

  const failRate = total.txns ? (rows.filter((r) => r.paymentStatus.toLowerCase() === "failed").length / rows.length) * 100 : 0;
  if (failRate > 1) {
    out.push({
      kind: "risk",
      title: `${failRate.toFixed(1)}% of payment attempts fail`,
      body: `Failed and refunded attempts total ${money(
        total.failed + total.refunded
      )}. Add automatic retries, a card-updater flow and an alternative UPI path at checkout to recover most of this.`,
    });
  }

  const memRows = good.filter((r) => r.membershipId);
  if (memRows.length) {
    const sold = memRows.reduce((s, r) => s + r.membershipTotalClasses, 0);
    const left = memRows.reduce((s, r) => s + r.membershipClassesLeft, 0);
    const util = sold ? ((sold - left) / sold) * 100 : 0;
    out.push({
      kind: util < 55 ? "risk" : "win",
      title: `Credit utilisation at ${util.toFixed(1)}%`,
      body: `${money(memRows.reduce((s, r) => s + r.membershipMoneyLeft, 0))} of deferred value is unredeemed across ${
        memRows.length
      } memberships. ${
        util < 55
          ? "Low utilisation strongly predicts non-renewal — trigger nudges at day 14 and day 30 of inactivity."
          : "Healthy redemption; members who use credits renew at materially higher rates."
      }`,
    });
  }

  const hours = groupBy(good, (r) => String(r.hour).padStart(2, "0"));
  if (hours.length) {
    const topH = hours[0];
    out.push({
      kind: "trend",
      title: `Peak selling hour is ${topH.key}:00 (${topH.share.toFixed(1)}% of revenue)`,
      body: `Staff the desk and schedule outbound follow-up calls around this window. The quietest hours are prime candidates for automated online-only offers.`,
    });
  }

  const newShare = total.revenue ? (good.filter((r) => r.isNew).reduce((s, r) => s + r.paymentValue, 0) / total.revenue) * 100 : 0;
  out.push({
    kind: newShare > 55 ? "risk" : "win",
    title: `${newShare.toFixed(1)}% of revenue comes from first-time buyers`,
    body:
      newShare > 55
        ? "The business is acquisition-dependent. A retention programme is the cheapest available growth lever — every 5pt lift in repeat rate compounds."
        : "A healthy majority of revenue is repeat business, which means acquisition spend is compounding rather than leaking.",
  });

  return out;
}

export const money = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

// ─── New Client KPIs ───
export function computeNewClientKPIs(
  rows: { rows: Record<string, string>[] },
): KPI[] {
  const data = rows.rows;
  const total = data.length;
  const converted = data.filter((r) => {
    const status = String(r["Conversion Status"] || "").toLowerCase();
    return status.includes("converted") && !status.includes("not");
  }).length;
  const notConverted = data.filter((r) => {
    const status = String(r["Conversion Status"] || "").toLowerCase();
    return status.includes("not") && status.includes("converted");
  }).length;
  const active = data.filter((r) => {
    const lifecycle = String(r["Lifecycle Status"] || "").toLowerCase();
    const retention = String(r["Retention Status"] || "").toLowerCase();
    return lifecycle.includes("active") || retention.includes("active");
  }).length;
  const lapsed = data.filter((r) => {
    const lifecycle = String(r["Lifecycle Status"] || "").toLowerCase();
    const retention = String(r["Retention Status"] || "").toLowerCase();
    return lifecycle.includes("lapsed") || lifecycle.includes("churned") || retention.includes("churned");
  }).length;
  
  const totalLtv = data.reduce((sum, r) => {
    const ltv = parseFloat(String(r["Ltv"] || r["LTV"] || "0").replace(/[^\d.-]/g, "")) || 0;
    return sum + ltv;
  }, 0);
  
  const avgLtv = total > 0 ? totalLtv / total : 0;
  const conversionRate = total > 0 ? (converted / total) * 100 : 0;
  const activeRate = total > 0 ? (active / total) * 100 : 0;
  
  const conversionSpans = data
    .map((r) => parseFloat(String(r["Conversion Span (Days)"] || "0").replace(/[^\d.-]/g, "")) || 0)
    .filter((v) => v > 0);
  const avgDaysToConvert = conversionSpans.length > 0
    ? conversionSpans.reduce((a, b) => a + b, 0) / conversionSpans.length
    : 0;

  return [
    {
      id: "total_new_clients",
      label: "Total New Clients",
      format: "int",
      group: "New Clients",
      hint: "Total number of new client records in the selected period.",
      value: total,
      prev: 0,
    },
    {
      id: "conversion_rate",
      label: "Conversion Rate",
      format: "pct",
      group: "New Clients",
      hint: "Percentage of new clients who converted to paying members.",
      value: conversionRate,
      prev: 0,
    },
    {
      id: "total_ltv",
      label: "Total LTV",
      format: "money",
      group: "New Clients",
      hint: "Combined lifetime value of all new clients.",
      value: totalLtv,
      prev: 0,
    },
    {
      id: "avg_ltv",
      label: "Avg LTV per Client",
      format: "money",
      group: "New Clients",
      hint: "Average lifetime value per new client.",
      value: avgLtv,
      prev: 0,
    },
    {
      id: "active_clients",
      label: "Active Clients",
      format: "int",
      group: "New Clients",
      hint: "Number of new clients currently active.",
      value: active,
      prev: 0,
    },
    {
      id: "active_rate",
      label: "Active Rate",
      format: "pct",
      group: "New Clients",
      hint: "Percentage of new clients who remain active.",
      value: activeRate,
      prev: 0,
    },
    {
      id: "converted_clients",
      label: "Converted",
      format: "int",
      group: "New Clients",
      hint: "Number of new clients who converted to paying members.",
      value: converted,
      prev: 0,
    },
    {
      id: "not_converted",
      label: "Not Converted",
      format: "int",
      group: "New Clients",
      hint: "Number of new clients who have not converted.",
      value: notConverted,
      prev: 0,
      invert: true,
    },
    {
      id: "lapsed_clients",
      label: "Lapsed Clients",
      format: "int",
      group: "New Clients",
      hint: "Number of new clients who have lapsed or churned.",
      value: lapsed,
      prev: 0,
      invert: true,
    },
    {
      id: "avg_days_to_convert",
      label: "Avg Days to Convert",
      format: "dec",
      group: "New Clients",
      hint: "Average number of days from first visit to conversion.",
      value: avgDaysToConvert,
      prev: 0,
    },
  ];
}

// ─── Lapsed Member KPIs ───
export function computeLapsedKPIs(
  rows: { rows: Record<string, string>[] },
): KPI[] {
  const data = rows.rows;
  const total = data.length;
  
  const churned = data.filter((r) => {
    const status = String(r["Status"] || "").toLowerCase();
    return status.includes("churned") || status.includes("expired");
  }).length;
  
  const atRisk = data.filter((r) => {
    const daysSince = parseFloat(String(r["Days Since Last Visit"] || "0").replace(/[^\d.-]/g, "")) || 0;
    return daysSince >= 14 && daysSince < 60 && !r["Churned Date"];
  }).length;
  
  const newMembers = data.filter((r) => {
    const daysActive = parseFloat(String(r["Days Active"] || "0").replace(/[^\d.-]/g, "")) || 0;
    return daysActive <= 30;
  }).length;
  
  const totalRevenue = data.reduce((sum, r) => {
    const amount = parseFloat(String(r["Amount Paid"] || "0").replace(/[^\d.-]/g, "")) || 0;
    return sum + amount;
  }, 0);
  
  const daysSinceVisits = data
    .map((r) => parseFloat(String(r["Days Since Last Visit"] || "0").replace(/[^\d.-]/g, "")) || 0)
    .filter((v) => v > 0);
  const avgDaysSinceVisit = daysSinceVisits.length > 0
    ? daysSinceVisits.reduce((a, b) => a + b, 0) / daysSinceVisits.length
    : 0;
  
  const sessionsCompleted = data
    .map((r) => parseFloat(String(r["Total Sessions Completed"] || "0").replace(/[^\d.-]/g, "")) || 0);
  const avgSessions = sessionsCompleted.length > 0
    ? sessionsCompleted.reduce((a, b) => a + b, 0) / sessionsCompleted.length
    : 0;
  
  const avgCancelRate = data.reduce((sum, r) => {
    const rate = parseFloat(String(r["Cancellation Rate %"] || "0").replace(/[^\d.-]/g, "")) || 0;
    return sum + rate;
  }, 0) / (total || 1);
  
  const avgAttendRate = data.reduce((sum, r) => {
    const rate = parseFloat(String(r["Attendance Rate %"] || "0").replace(/[^\d.-]/g, "")) || 0;
    return sum + rate;
  }, 0) / (total || 1);

  return [
    {
      id: "total_members",
      label: "Total Members",
      format: "int",
      group: "Lapsed",
      hint: "Total number of members tracked in the lapsed dataset.",
      value: total,
      prev: 0,
    },
    {
      id: "churned_members",
      label: "Churned",
      format: "int",
      group: "Lapsed",
      hint: "Number of members who have churned or expired.",
      value: churned,
      prev: 0,
      invert: true,
    },
    {
      id: "at_risk_members",
      label: "At Risk",
      format: "int",
      group: "Lapsed",
      hint: "Members with 14-60 days since last visit (not yet churned).",
      value: atRisk,
      prev: 0,
      invert: true,
    },
    {
      id: "new_lapsed_members",
      label: "New Members",
      format: "int",
      group: "Lapsed",
      hint: "Members with 30 days or less active.",
      value: newMembers,
      prev: 0,
    },
    {
      id: "lapsed_revenue",
      label: "Total Revenue",
      format: "money",
      group: "Lapsed",
      hint: "Combined revenue from all tracked members.",
      value: totalRevenue,
      prev: 0,
    },
    {
      id: "avg_days_since_visit",
      label: "Avg Days Since Visit",
      format: "dec",
      group: "Lapsed",
      hint: "Average number of days since last visit across all members.",
      value: avgDaysSinceVisit,
      prev: 0,
    },
    {
      id: "avg_sessions_completed",
      label: "Avg Sessions",
      format: "dec",
      group: "Lapsed",
      hint: "Average number of sessions completed per member.",
      value: avgSessions,
      prev: 0,
    },
    {
      id: "avg_cancel_rate_lapsed",
      label: "Avg Cancel Rate",
      format: "pct",
      group: "Lapsed",
      hint: "Average cancellation rate across all members.",
      value: avgCancelRate,
      prev: 0,
      invert: true,
    },
    {
      id: "avg_attend_rate",
      label: "Avg Attendance Rate",
      format: "pct",
      group: "Lapsed",
      hint: "Average attendance rate across all members.",
      value: avgAttendRate,
      prev: 0,
    },
  ];
}

// ─── Late Cancellation KPIs ───
export function computeLateCancelKPIs(
  rows: { rows: Record<string, string>[] },
): KPI[] {
  const data = rows.rows;
  const total = data.length;
  
  const lateCancelled = data.filter((r) => {
    const val = String(r["Late Cancelled"] || "").toLowerCase();
    return val === "true" || val === "yes" || val === "1";
  }).length;
  
  const allCancelled = data.filter((r) => {
    const val = String(r["Cancelled"] || "").toLowerCase();
    return val === "true" || val === "yes" || val === "1";
  }).length;
  
  const noShows = data.filter((r) => {
    const val = String(r["No Show"] || "").toLowerCase();
    return val === "true" || val === "yes" || val === "1";
  }).length;
  
  const confirmed = total - allCancelled - noShows;
  const lateRate = total > 0 ? (lateCancelled / total) * 100 : 0;
  const cancelRate = total > 0 ? (allCancelled / total) * 100 : 0;
  const noShowRate = total > 0 ? (noShows / total) * 100 : 0;
  const showRate = total > 0 ? (confirmed / total) * 100 : 0;

  return [
    {
      id: "total_bookings_late",
      label: "Total Bookings",
      format: "int",
      group: "Late Cancellations",
      hint: "Total number of booking records analyzed.",
      value: total,
      prev: 0,
    },
    {
      id: "late_cancels",
      label: "Late Cancellations",
      format: "int",
      group: "Late Cancellations",
      hint: "Number of bookings that were cancelled late.",
      value: lateCancelled,
      prev: 0,
      invert: true,
    },
    {
      id: "late_cancel_rate",
      label: "Late Cancel Rate",
      format: "pct",
      group: "Late Cancellations",
      hint: "Percentage of bookings that were cancelled late.",
      value: lateRate,
      prev: 0,
      invert: true,
    },
    {
      id: "all_cancels",
      label: "All Cancellations",
      format: "int",
      group: "Late Cancellations",
      hint: "Total cancellations (including late cancels).",
      value: allCancelled,
      prev: 0,
      invert: true,
    },
    {
      id: "cancel_rate",
      label: "Cancel Rate",
      format: "pct",
      group: "Late Cancellations",
      hint: "Percentage of all bookings that were cancelled.",
      value: cancelRate,
      prev: 0,
      invert: true,
    },
    {
      id: "no_shows",
      label: "No Shows",
      format: "int",
      group: "Late Cancellations",
      hint: "Number of bookings where the member did not show up.",
      value: noShows,
      prev: 0,
      invert: true,
    },
    {
      id: "no_show_rate",
      label: "No Show Rate",
      format: "pct",
      group: "Late Cancellations",
      hint: "Percentage of bookings that resulted in no-shows.",
      value: noShowRate,
      prev: 0,
      invert: true,
    },
    {
      id: "confirmed_bookings",
      label: "Confirmed",
      format: "int",
      group: "Late Cancellations",
      hint: "Number of bookings that were confirmed (not cancelled or no-show).",
      value: confirmed,
      prev: 0,
    },
    {
      id: "show_rate",
      label: "Show Rate",
      format: "pct",
      group: "Late Cancellations",
      hint: "Percentage of bookings that were confirmed and attended.",
      value: showRate,
      prev: 0,
    },
  ];
}

// ─── Bookings KPIs ───
export function computeBookingsKPIs(
  rows: { rows: Record<string, string>[] },
): KPI[] {
  const data = rows.rows;
  const total = data.length;
  
  const confirmed = data.filter((r) => {
    const cancelled = String(r["Cancelled"] || "").toLowerCase();
    const noShow = String(r["No Show"] || "").toLowerCase();
    return cancelled !== "true" && cancelled !== "yes" && cancelled !== "1" &&
           noShow !== "true" && noShow !== "yes" && noShow !== "1";
  }).length;
  
  const cancelled = data.filter((r) => {
    const val = String(r["Cancelled"] || "").toLowerCase();
    return val === "true" || val === "yes" || val === "1";
  }).length;
  
  const newBookings = data.filter((r) => {
    const val = String(r["Is New"] || "").toLowerCase();
    return val === "true" || val === "yes" || val === "1" || val.includes("new");
  }).length;
  
  const uniqueMembers = new Set(data.map((r) => r["Member Id"] || r["Member ID"] || "")).size;
  const uniqueClasses = new Set(data.map((r) => r["Cleaned Class"] || r["Cleaned Class Attended"] || "")).size;
  
  const showRate = total > 0 ? (confirmed / total) * 100 : 0;
  const cancelRate = total > 0 ? (cancelled / total) * 100 : 0;

  return [
    {
      id: "total_bookings",
      label: "Total Bookings",
      format: "int",
      group: "Bookings",
      hint: "Total number of booking records.",
      value: total,
      prev: 0,
    },
    {
      id: "confirmed_bookings_main",
      label: "Confirmed",
      format: "int",
      group: "Bookings",
      hint: "Number of confirmed bookings (not cancelled or no-show).",
      value: confirmed,
      prev: 0,
    },
    {
      id: "show_rate_main",
      label: "Show Rate",
      format: "pct",
      group: "Bookings",
      hint: "Percentage of bookings that were confirmed.",
      value: showRate,
      prev: 0,
    },
    {
      id: "cancelled_bookings",
      label: "Cancelled",
      format: "int",
      group: "Bookings",
      hint: "Number of bookings that were cancelled.",
      value: cancelled,
      prev: 0,
      invert: true,
    },
    {
      id: "cancel_rate_main",
      label: "Cancel Rate",
      format: "pct",
      group: "Bookings",
      hint: "Percentage of bookings that were cancelled.",
      value: cancelRate,
      prev: 0,
      invert: true,
    },
    {
      id: "new_bookings",
      label: "New Bookings",
      format: "int",
      group: "Bookings",
      hint: "Number of bookings marked as new.",
      value: newBookings,
      prev: 0,
    },
    {
      id: "unique_members_bookings",
      label: "Unique Members",
      format: "int",
      group: "Bookings",
      hint: "Number of unique members with bookings.",
      value: uniqueMembers,
      prev: 0,
    },
    {
      id: "unique_classes_bookings",
      label: "Unique Classes",
      format: "int",
      group: "Bookings",
      hint: "Number of unique classes booked.",
      value: uniqueClasses,
      prev: 0,
    },
  ];
}

// ─── Funnel/Leads KPIs ───
export function computeFunnelKPIs(
  rows: { rows: Record<string, string>[] },
): KPI[] {
  const data = rows.rows;
  const total = data.length;
  
  const won = data.filter((r) => {
    const status = String(r["Status"] || "").toLowerCase();
    return status.includes("won");
  }).length;
  
  const lost = data.filter((r) => {
    const status = String(r["Status"] || "").toLowerCase();
    return status.includes("lost");
  }).length;
  
  const active = total - won - lost;
  const winRate = total > 0 ? (won / total) * 100 : 0;
  const lostRate = total > 0 ? (lost / total) * 100 : 0;
  
  const withFollowUp = data.filter((r) => {
    return r["Follow Up 1 Date"] || r["Follow Up 2 Date"] || 
           r["Follow Up 3 Date"] || r["Follow Up 4 Date"];
  }).length;
  
  const followUpCounts = data.map((r) => {
    let count = 0;
    if (r["Follow Up 1 Date"]) count++;
    if (r["Follow Up 2 Date"]) count++;
    if (r["Follow Up 3 Date"]) count++;
    if (r["Follow Up 4 Date"]) count++;
    return count;
  });
  const avgFollowUps = followUpCounts.length > 0
    ? followUpCounts.reduce((a, b) => a + b, 0) / followUpCounts.length
    : 0;

  return [
    {
      id: "total_leads",
      label: "Total Leads",
      format: "int",
      group: "Funnel",
      hint: "Total number of leads in the pipeline.",
      value: total,
      prev: 0,
    },
    {
      id: "won_leads",
      label: "Won",
      format: "int",
      group: "Funnel",
      hint: "Number of leads that were successfully converted.",
      value: won,
      prev: 0,
    },
    {
      id: "win_rate",
      label: "Win Rate",
      format: "pct",
      group: "Funnel",
      hint: "Percentage of leads that were won.",
      value: winRate,
      prev: 0,
    },
    {
      id: "lost_leads",
      label: "Lost",
      format: "int",
      group: "Funnel",
      hint: "Number of leads that were lost.",
      value: lost,
      prev: 0,
      invert: true,
    },
    {
      id: "lost_rate",
      label: "Lost Rate",
      format: "pct",
      group: "Funnel",
      hint: "Percentage of leads that were lost.",
      value: lostRate,
      prev: 0,
      invert: true,
    },
    {
      id: "active_leads",
      label: "Active",
      format: "int",
      group: "Funnel",
      hint: "Number of leads still in the pipeline (not won or lost).",
      value: active,
      prev: 0,
    },
    {
      id: "leads_with_followup",
      label: "With Follow-up",
      format: "int",
      group: "Funnel",
      hint: "Number of leads that have at least one follow-up recorded.",
      value: withFollowUp,
      prev: 0,
    },
    {
      id: "avg_followups",
      label: "Avg Follow-ups",
      format: "dec",
      group: "Funnel",
      hint: "Average number of follow-ups per lead.",
      value: avgFollowUps,
      prev: 0,
    },
  ];
}
