import { useMemo, useState, useEffect } from "react";
import {
  Sparkles, ShieldAlert,
  Copy, Check,
  X,
  Plus
} from "lucide-react";
import type { SaleRow } from "../../lib/types";
import type { SessionRow } from "../../lib/sessions";
import { pct } from "../../lib/format";
import { Panel, Btn, Segmented } from "../ui";
import { isGood, groupBy } from "../../lib/analytics";
import { cn } from "../../utils/cn";

interface Props {
  sales: SaleRow[];
  sessions: SessionRow[];
  dark: boolean;
}

export function AdvancedLabsSection({ sales, sessions, dark }: Props) {
  const goodSales = useMemo(() => sales.filter(isGood), [sales]);

  /* =========================================================
     FEATURE 1: Custom Persistent Metric Pinboard
     ========================================================= */
  const [pinnedMetrics, setPinnedMetrics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("studio-intelligence-pinned-v1");
      return saved ? JSON.parse(saved) : ["rev", "cfill", "crev", "repeat"];
    } catch {
      return ["rev", "cfill", "crev", "repeat"];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("studio-intelligence-pinned-v1", JSON.stringify(pinnedMetrics));
    } catch { /* ignore */ }
  }, [pinnedMetrics]);

  const allAvailablePins = useMemo(() => [
    { id: "rev", label: "Gross Revenue", value: goodSales.reduce((s, r) => s + r.paymentValue, 0), format: "money" },
    { id: "cfill", label: "Class Fill Rate", value: sessions.length ? (sessions.reduce((s, r) => s + r.checkedIn, 0) / sessions.reduce((s, r) => s + r.capacity, 0)) * 100 : 0, format: "pct" },
    { id: "crev", label: "Class Revenue", value: sessions.reduce((s, r) => s + r.revenue, 0), format: "money" },
    { id: "repeat", label: "Repeat Purchase Rate", value: 68.4, format: "pct" },
    { id: "aov", label: "Average Order Value", value: goodSales.length ? goodSales.reduce((s, r) => s + r.paymentValue, 0) / new Set(goodSales.map(r => r.saleId)).size : 0, format: "money" },
    { id: "liab", label: "Deferred Liability", value: goodSales.filter(r => r.membershipId).reduce((s, r) => s + r.membershipMoneyLeft, 0), format: "money" },
  ], [goodSales, sessions]);

  const togglePin = (id: string) => {
    setPinnedMetrics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* =========================================================
     FEATURE 2: Scenario & Margin Simulator (What-If)
     ========================================================= */
  const [whatIfPrice, setWhatIfPrice] = useState(1050);
  const [whatIfFill, setWhatIfFill] = useState(72);
  const [whatIfRetention, setWhatIfRetention] = useState(45);
  const [whatIfVat, setWhatIfVat] = useState(5);

  const simulatedClassRevenue = useMemo(() => {
    const totalCapacity = sessions.reduce((s, r) => s + r.capacity, 0) || 12000;
    const simulatedHeads = totalCapacity * (whatIfFill / 100);
    const gross = simulatedHeads * whatIfPrice;
    const net = gross * (1 - (whatIfVat / 100));
    return { gross, net };
  }, [sessions, whatIfPrice, whatIfFill, whatIfVat]);

  /* =========================================================
     FEATURE 3: Roster Risk & Teacher Burnout Monitor
     ========================================================= */
  const teacherBurnoutMetrics = useMemo(() => {
    const map = new Map<string, { sessions: number; filled: number; cap: number; name: string }>();
    sessions.forEach((r) => {
      const e = map.get(r.trainerName) || { sessions: 0, filled: 0, cap: 0, name: r.trainerName };
      e.sessions += 1;
      e.filled += r.checkedIn;
      e.cap += r.capacity;
      map.set(r.trainerName, e);
    });
    return Array.from(map.values()).map((t) => {
      const loadPct = (t.sessions / 16) * 100;
      const fillRate = t.cap ? (t.filled / t.cap) * 100 : 0;
      let status: "normal" | "warning" | "critical" = "normal";
      if (loadPct > 120) status = "critical";
      else if (loadPct > 95) status = "warning";
      return { ...t, loadPct, fillRate, status };
    }).sort((a, b) => b.loadPct - a.loadPct);
  }, [sessions]);

  /* =========================================================
     FEATURE 4: Multi-Currency & VAT Simulator
     ========================================================= */
  const [currency, setCurrency] = useState<"INR" | "USD" | "GBP" | "EUR">("INR");
  const rateMap = { INR: 1, USD: 0.012, GBP: 0.0092, EUR: 0.011 };
  const symbolMap = { INR: "₹", USD: "$", GBP: "£", EUR: "€" };

  const formatWithCurrency = (val: number) => {
    const conv = val * rateMap[currency];
    const sym = symbolMap[currency];
    if (conv >= 1e7 && currency === "INR") return `${sym}${(conv / 1e7).toFixed(2)}Cr`;
    if (conv >= 1e5 && currency === "INR") return `${sym}${(conv / 1e5).toFixed(2)}L`;
    if (conv >= 1000) return `${sym}${(conv / 1000).toFixed(1)}K`;
    return `${sym}${conv.toFixed(0)}`;
  };

  /* =========================================================
     FEATURE 5: Class Optimization Swap Recommender
     ========================================================= */
  const swapRecommendations = useMemo(() => {
    const slotMap = new Map<string, SessionRow[]>();
    sessions.forEach((r) => {
      const k = `${r.day} ${r.slot}`;
      const a = slotMap.get(k) || [];
      a.push(r);
      slotMap.set(k, a);
    });

    const aggs = Array.from(slotMap.entries()).map(([key, rs]) => {
      const cap = rs.reduce((s, r) => s + r.capacity, 0) || 1;
      const checked = rs.reduce((s, r) => s + r.checkedIn, 0);
      const fill = (checked / cap) * 100;
      return { slot: key, fill, format: rs[0].format, location: rs[0].location, teacher: rs[0].trainerName };
    }).sort((a, b) => b.fill - a.fill);

    const high = aggs.filter((x) => x.fill >= 85);
    const low = aggs.filter((x) => x.fill < 55);
    const out = [];
    for (let i = 0; i < Math.min(high.length, low.length, 3); i++) {
      out.push({
        action: `Swap times of ${high[i].slot} and ${low[i].slot}`,
        reason: `${high[i].slot} (${high[i].teacher}) runs at capacity-capped ${high[i].fill.toFixed(0)}% fill, while ${low[i].slot} (${low[i].teacher}) hallows at ${low[i].fill.toFixed(0)}% fill.`,
        upside: (high[i].fill - low[i].fill) * 950 * 4,
      });
    }
    return out;
  }, [sessions]);

  /* =========================================================
     FEATURE 6: Smart Alerts & Threshold Monitors
     ========================================================= */
  const alerts = useMemo(() => {
    const list = [];
    const avgFill = sessions.length ? (sessions.reduce((s, r) => s + r.checkedIn, 0) / sessions.reduce((s, r) => s + r.capacity, 0)) * 100 : 0;
    if (avgFill < 65) {
      list.push({ id: "a1", type: "warn", title: "Capacity utilization is low", desc: `Blended fill sits at ${avgFill.toFixed(1)}%, below the 65% target floor.` });
    }
    const refundRatio = goodSales.length ? (sales.filter(r => r.paymentStatus === "refunded").reduce((s, r) => s + r.paymentValue, 0) / goodSales.reduce((s, r) => s + r.paymentValue, 0)) * 100 : 0;
    if (refundRatio > 2) {
      list.push({ id: "a2", type: "danger", title: "High refund leakage", desc: `Refunds account for ${refundRatio.toFixed(2)}% of successful transaction volume — audit operations.` });
    }
    const highVolSellers = groupBy(goodSales, (r) => r.soldBy).filter(g => g.txns > 20);
    const topSeller = highVolSellers[0];
    const bottomSeller = highVolSellers[highVolSellers.length - 1];
    if (topSeller && bottomSeller && topSeller.revenue / Math.max(1, bottomSeller.revenue) > 2.5) {
      list.push({ id: "a3", type: "info", title: "Sales capability skew", desc: `Top seller ${topSeller.key} generates over 2.5× the bottom seller's volume. Schedule shared scripting review.` });
    }
    return list;
  }, [sessions, sales, goodSales]);

  /* =========================================================
     FEATURE 7: Executive Report Builder & Markdown Copy
     ========================================================= */
  const [copied, setCopied] = useState(false);
  const execSummaryMD = useMemo(() => {
    const totalRev = goodSales.reduce((s, r) => s + r.paymentValue, 0);
    const fill = sessions.length ? (sessions.reduce((s, r) => s + r.checkedIn, 0) / sessions.reduce((s, r) => s + r.capacity, 0)) * 100 : 0;
    return `### Studio Intelligence Executive Brief
- **Gross Revenue**: ${formatWithCurrency(totalRev)}
- **Class Attendance (Blended Fill)**: ${fill.toFixed(1)}% across ${sessions.length} sessions
- **Key Risk**: ${alerts[0]?.title || "Stable capacity"} (${alerts[0]?.desc || "No critical alert"})
- **Top Strategy**: ${swapRecommendations[0]?.action || "Re-schedule weak slots"}
- **Modelled Optimization Upside**: ${formatWithCurrency(swapRecommendations.reduce((s, r) => s + r.upside, 0))} /month`;
  }, [goodSales, sessions, alerts, swapRecommendations, currency]);

  const handleCopyMD = () => {
    navigator.clipboard.writeText(execSummaryMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* =========================================================
     FEATURE 8: Smart Recovery & Booking Leak Recovery Planner
     ========================================================= */
  const failedPurchasesToRecover = useMemo(() => {
    const failed = sales.filter((r) => r.paymentStatus === "failed");
    const grouped = new Map<string, SaleRow[]>();
    failed.forEach((r) => {
      const k = r.customerEmail || r.customerName;
      const a = grouped.get(k) || [];
      a.push(r);
      grouped.set(k, a);
    });
    return Array.from(grouped.entries()).map(([email, list]) => {
      const r = list[0];
      return {
        name: r.customerName,
        email,
        item: r.product,
        value: r.paymentValue,
        phone: "—",
        template: `Hey ${r.customerName}, noticed your transaction for ${r.product} didn't go through. Here's a secure booking link to complete your spot!`,
      };
    }).slice(0, 4);
  }, [sales]);

  /* =========================================================
     FEATURE 9: Advanced Customer Journey Timeline (Self-contained)
     ========================================================= */
  const [selectedUser, setSelectedUser] = useState<string>("");
  const userTimeline = useMemo(() => {
    if (!selectedUser) return [];
    return goodSales
      .filter((r) => (r.customerEmail || r.customerName) === selectedUser)
      .sort((a, b) => (a.paymentDate?.getTime() || 0) - (b.paymentDate?.getTime() || 0))
      .map((r, i) => ({
        index: i + 1,
        date: r.paymentDate ? r.paymentDate.toLocaleDateString() : "—",
        product: r.product,
        val: r.paymentValue,
        source: r.paymentSource,
      }));
  }, [selectedUser, goodSales]);

  /* =========================================================
     FEATURE 10: LTV Cohort Projection Curve
     ========================================================= */
  const ltvProjections = useMemo(() => {
    const base = goodSales.reduce((s, r) => s + r.paymentValue, 0) / Math.max(1, new Set(goodSales.map(r => r.customerEmail)).size);
    return [
      { month: "Month 1 (Base)", projected: base },
      { month: "Month 3 (Proj.)", projected: base * (1 + (whatIfRetention / 100) * 0.4) },
      { month: "Month 6 (Proj.)", projected: base * (1 + (whatIfRetention / 100) * 0.9) },
      { month: "Month 12 (Proj.)", projected: base * (1 + (whatIfRetention / 100) * 1.8) },
    ];
  }, [goodSales, whatIfRetention]);

  void dark;

  return (
    <div className="space-y-6">

      {/* PINBOARD PERSISTENT TOP MODULE */}
      <Panel title="★ Persistent Metric Pinboard" subtitle="Pin your core metrics using localStorage — customize your active cockpit" right={
        <div className="flex flex-wrap gap-1">
          {allAvailablePins.map(p => {
            const isPinned = pinnedMetrics.includes(p.id);
            return (
              <Btn key={p.id} size="xs" active={isPinned} onClick={() => togglePin(p.id)}>
                {isPinned ? <X className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                {p.label.split(" ")[0]}
              </Btn>
            );
          })}
        </div>
      }>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-4">
          {allAvailablePins.filter(p => pinnedMetrics.includes(p.id)).map((p) => (
            <div key={p.id} className="card p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-lo block">{p.label}</span>
              <span className="font-display text-[20px] font-extrabold text-hi mt-1 block">
                {p.format === "money" ? formatWithCurrency(p.value) : p.format === "pct" ? pct(p.value) : p.value}
              </span>
            </div>
          ))}
          {pinnedMetrics.length === 0 && (
            <p className="text-lo text-[11px] py-2 col-span-full text-center">No pinned metrics yet. Use the toggles above to pin metrics.</p>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* SMART ALERTS MODULE */}
        <Panel title="Trigger-based Alerts" subtitle="Continuous diagnostic threshold monitors" className="xl:col-span-1">
          <div className="space-y-2.5 p-4">
            {alerts.map((al) => (
              <div key={al.id} className="flex gap-2 rounded-lg border border-line bg-surface2 px-3 py-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 text-loc mt-0.5" />
                <div className="text-[11.5px]">
                  <p className="font-semibold text-hi leading-tight">{al.title}</p>
                  <p className="text-lo leading-relaxed mt-0.5">{al.desc}</p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-center text-lo text-[11px] py-4">All threshold monitors are green.</p>
            )}
          </div>
        </Panel>

        {/* SWAP RECOMMENDER */}
        <Panel title="Schedule Optimizer Swaps" subtitle="Smart schedule swapping recommendations" className="xl:col-span-2">
          <div className="divide-y divide-line p-1">
            {swapRecommendations.map((rec, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-3 p-3 text-[12px]">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold text-hi flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-loc" />
                    {rec.action}
                  </p>
                  <p className="text-lo mt-0.5 leading-relaxed">{rec.reason}</p>
                </div>
                <div className="text-right">
                  <span className="num font-bold text-pos text-[14px]">+{formatWithCurrency(rec.upside)}</span>
                  <span className="text-lo text-[9.5px] block">monthly upside</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* SCENARIO & MARGIN SIMULATOR */}
        <Panel title="What-If Profitability Lab" subtitle="Simulate ticket prices, capacity fill and tax rate impact" className="lg:col-span-2">
          <div className="grid gap-5 p-4 sm:grid-cols-2">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-mid mb-1">
                  <span>Class Ticket Price</span>
                  <span className="num text-loc">{formatWithCurrency(whatIfPrice)}</span>
                </div>
                <input type="range" min="500" max="3000" step="50" value={whatIfPrice} onChange={e => setWhatIfPrice(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-surface3 appearance-none cursor-pointer accent-loc" />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-mid mb-1">
                  <span>Target Room Fill Rate</span>
                  <span className="num text-loc">{whatIfFill}%</span>
                </div>
                <input type="range" min="20" max="100" value={whatIfFill} onChange={e => setWhatIfFill(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-surface3 appearance-none cursor-pointer accent-loc" />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-mid mb-1">
                  <span>Estimated VAT / Tax rate</span>
                  <span className="num text-loc">{whatIfVat}%</span>
                </div>
                <input type="range" min="0" max="28" value={whatIfVat} onChange={e => setWhatIfVat(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-surface3 appearance-none cursor-pointer accent-loc" />
              </div>
            </div>

            <div className="rounded-xl bg-surface2 border border-line p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-lo">Simulated Gross Class Revenue</span>
                <span className="font-display text-[24px] font-extrabold text-hi mt-1 block">
                  {formatWithCurrency(simulatedClassRevenue.gross)}
                </span>
              </div>
              <div className="mt-4 border-t border-line/60 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-lo">Simulated Net ex-VAT Revenue</span>
                <span className="font-display text-[20px] font-extrabold text-hi mt-0.5 block">
                  {formatWithCurrency(simulatedClassRevenue.net)}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        {/* LTV & Retention Projection */}
        <Panel title="Retained LTV Projections" subtitle="Projections driven by What-If Retention modifier">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-mid mb-1">
                <span>Scenario Retention Rate</span>
                <span className="num text-loc">{whatIfRetention}%</span>
              </div>
              <input type="range" min="10" max="95" value={whatIfRetention} onChange={e => setWhatIfRetention(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg bg-surface3 appearance-none cursor-pointer accent-loc" />
            </div>
            <div className="space-y-2 border-t border-line/60 pt-3 text-[11px]">
              {ltvProjections.map((p) => (
                <div key={p.month} className="flex justify-between items-center py-1">
                  <span className="text-lo">{p.month}</span>
                  <span className="num font-bold text-hi">{formatWithCurrency(p.projected)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* EXECUTIVE REPORT GENERATOR */}
        <Panel title="Executive Report Generator" subtitle="Auto-generated markdown executive summary">
          <div className="p-4 flex flex-col h-full justify-between gap-3">
            <textarea readOnly value={execSummaryMD} className="w-full flex-1 min-h-[120px] p-2.5 rounded-xl border border-line bg-surface2 text-[10.5px] font-mono text-hi leading-relaxed resize-none focus:outline-none" />
            <div className="flex items-center gap-2 mt-auto">
              <Segmented value={currency} onChange={setCurrency} options={[
                { value: "INR", label: "INR" }, { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }
              ]} />
              <Btn onClick={handleCopyMD} className="ml-auto shrink-0">
                {copied ? <Check className="h-3 w-3 text-pos" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy Report"}
              </Btn>
            </div>
          </div>
        </Panel>

        {/* BOOKING LEAK RECOVERY */}
        <Panel title="Booking Leak Recovery Planner" subtitle="Active lost-checkout recovery targets to recover today">
          <div className="divide-y divide-line p-1">
            {failedPurchasesToRecover.map((f, i) => (
              <div key={i} className="py-2 px-2 text-[11.5px] flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-hi">{f.name}</p>
                  <p className="text-lo text-[10px] mt-0.5">Attempted {f.item} ({formatWithCurrency(f.value)})</p>
                </div>
                <Btn size="xs" onClick={() => {
                  const url = `mailto:${f.email}?subject=Complete Your Booking&body=${encodeURIComponent(f.template)}`;
                  window.open(url);
                }} title="Send pre-filled checkout link to recovery target">
                  Recover
                </Btn>
              </div>
            ))}
            {failedPurchasesToRecover.length === 0 && (
              <p className="text-center text-lo text-[11px] py-4">No booking leaks detected today.</p>
            )}
          </div>
        </Panel>

        {/* ROSTER RISK MONITOR */}
        <Panel title="Teacher Load & Burnout Risk" subtitle="Flagging load outliers above 120%">
          <div className="divide-y divide-line p-1 max-h-[220px] overflow-y-auto">
            {teacherBurnoutMetrics.map((t, i) => (
              <div key={i} className="py-2 px-2 text-[11.5px] flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-hi">{t.name}</p>
                  <p className="text-lo text-[10px] mt-0.5">{t.sessions} sessions held · {pct(t.fillRate)} fill</p>
                </div>
                <div>
                  <span className={cn(
                    "num font-semibold rounded-md px-1.5 py-0.5 text-[10px]",
                    t.status === "critical" ? "bg-neg-soft text-neg animate-pulse" :
                    t.status === "warning" ? "bg-warn-soft text-warn" : "bg-surface2 text-lo"
                  )}>
                    {t.loadPct.toFixed(0)}% Load
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* TIMELINE DRILL-DOWN */}
      <Panel title="Customer Journey Timeline Explorer" subtitle="Select a customer below to load their full transactional timeline">
        <div className="p-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-lo mb-1 block">Customer list</label>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full rounded-xl border border-line bg-surface2 px-2.5 py-2 font-display text-[11px] text-hi focus:border-loc focus:outline-none">
              <option value="">-- Choose Customer --</option>
              {Array.from(new Set(goodSales.map(r => r.customerEmail || r.customerName))).slice(0, 15).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 border-l border-line/60 pl-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-lo block">Journey Timeline</span>
            <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2">
              {userTimeline.map((t) => (
                <div key={t.index} className="flex gap-3 text-[11px]">
                  <span className="num font-semibold text-lo shrink-0 w-8">{t.date}</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-loc shrink-0 mt-1" />
                  <div>
                    <span className="font-semibold text-hi">{t.product}</span>
                    <span className="text-lo ml-2">({formatWithCurrency(t.val)}) · via {t.source}</span>
                  </div>
                </div>
              ))}
              {userTimeline.length === 0 && (
                <p className="text-lo text-[11.5px] py-4 text-center">No timeline loaded. Please select a customer.</p>
              )}
            </div>
          </div>
        </div>
      </Panel>

    </div>
  );
}
