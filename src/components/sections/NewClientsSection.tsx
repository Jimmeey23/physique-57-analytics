import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, TrendingUp, Target, Clock, DollarSign,
  UserCheck, X, Calendar, MapPin,
  Repeat,
} from "lucide-react";
import type { FlexTable } from "../../lib/sessions";
import { compact, intFmt, pct, dec } from "../../lib/format";
import { cn } from "../../utils/cn";
import { Panel, SectionHeader, Btn, ShareBar } from "../ui";
import { DataTable, type Col } from "../DataTable";
import { TrendChart, Donut, RankBars } from "../Charts";

/* ── Types ── */
interface NewClient {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  firstVisitDate: string;
  firstVisitDateObj: Date | null;
  firstVisitLocation: string;
  firstVisitType: string;
  paymentMethod: string;
  membershipUsed: string;
  homeLocation: string;
  classNo: number;
  trainerName: string;
  isNew: boolean;
  visitsPostTrial: number;
  postTrialSameMonth: number;
  lateCancellations: number;
  postTrialMembershipsBought: number;
  postTrialPurchaseCount: number;
  firstPurchaseDate: string;
  firstPurchaseValue: number;
  ltv: number;
  retentionStatus: string;
  conversionStatus: string;
  noOfVisits: number;
  lastVisitDate: string;
  daysSinceLastVisit: number;
  conversionSpan: number;
  daysToSecondVisit: number;
  uniqueLocationsVisited: number;
  source: string;
  avgPurchaseValue: number;
  lastPurchaseDate: string;
  lastPurchaseValue: number;
  totalPurchases: number;
  daysActive: number;
  visitsPerMonth: number;
  lateCancelRate: number;
  firstVisitDay: string;
  firstVisitTimeSlot: string;
  conversionSpeedBucket: string;
  lifecycleStatus: string;
  firstPurchase: string;
}

const money = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
const bool = (v: string) => /^(true|yes|1)$/i.test(v);

const pick = (row: Record<string, string>, ...keys: string[]) => {
  const norm = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), v]));
  for (const k of keys) {
    const v = norm.get(k.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (v !== undefined) return v;
  }
  return "";
};

function parseNewClients(members: FlexTable): NewClient[] {
  return members.rows.map((row) => {
    const firstVisit = pick(row, "First Visit Date");
    let dateObj: Date | null = null;
    if (firstVisit) {
      const m = firstVisit.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) dateObj = new Date(+m[1], +m[2] - 1, +m[3]);
    }
    return {
      id: pick(row, "Member Id", "Member ID"),
      firstName: pick(row, "First Name"),
      lastName: pick(row, "Last Name"),
      name: `${pick(row, "First Name")} ${pick(row, "Last Name")}`.trim() || "Unknown",
      email: pick(row, "Email"),
      phone: pick(row, "Phone Number"),
      firstVisitDate: firstVisit,
      firstVisitDateObj: dateObj,
      firstVisitLocation: pick(row, "First Visit Location", "First Visit Entity Name"),
      firstVisitType: pick(row, "First Visit Type"),
      paymentMethod: pick(row, "Payment Method"),
      membershipUsed: pick(row, "Membership Used"),
      homeLocation: pick(row, "Home Location"),
      classNo: num(pick(row, "Class No")),
      trainerName: pick(row, "Trainer Name"),
      isNew: bool(pick(row, "Is New")),
      visitsPostTrial: num(pick(row, "Visits Post Trial")),
      postTrialSameMonth: num(pick(row, "Post Trial Same Month")),
      lateCancellations: num(pick(row, "Late Cancellations")),
      postTrialMembershipsBought: num(pick(row, "Post Trial Memberships Bought")),
      postTrialPurchaseCount: num(pick(row, "Post Trial Purchase Count")),
      firstPurchaseDate: pick(row, "First Purchase Date"),
      firstPurchaseValue: money(pick(row, "First Purchase", "First Purchase Value")),
      ltv: money(pick(row, "Ltv", "LTV")),
      retentionStatus: pick(row, "Retention Status"),
      conversionStatus: pick(row, "Conversion Status"),
      noOfVisits: num(pick(row, "No of Visits")),
      lastVisitDate: pick(row, "Last Visit Date"),
      daysSinceLastVisit: num(pick(row, "Days Since Last Visit")),
      conversionSpan: num(pick(row, "Conversion Span (Days)")),
      daysToSecondVisit: num(pick(row, "Days To Second Visit")),
      uniqueLocationsVisited: num(pick(row, "Unique Locations Visited")),
      source: pick(row, "Source"),
      avgPurchaseValue: money(pick(row, "Avg Purchase Value", "Post Trial Avg Purchase Value")),
      lastPurchaseDate: pick(row, "Last Purchase Date", "Post Trial Last Purchase Date"),
      lastPurchaseValue: money(pick(row, "Last Purchase Value")),
      totalPurchases: num(pick(row, "Total Purchases All Time")),
      daysActive: num(pick(row, "Days Active")),
      visitsPerMonth: num(pick(row, "Visits Per Month")),
      lateCancelRate: num(pick(row, "Late Cancel Rate")) || num(pick(row, "Late Cancel Rate Post Trial")),
      firstVisitDay: pick(row, "First Visit Day"),
      firstVisitTimeSlot: pick(row, "First Visit Time Slot"),
      conversionSpeedBucket: pick(row, "Conversion Speed Bucket"),
      lifecycleStatus: pick(row, "Lifecycle Status"),
      firstPurchase: pick(row, "First Purchase", "Post Trial First Purchase"),
    };
  });
}

/* ── Main Section ── */
export function NewClientsSection({ members }: { members: FlexTable }) {
  const clients = useMemo(() => parseNewClients(members), [members]);
  const [filter, setFilter] = useState<"all" | "converted" | "notconverted" | "active" | "lapsed">("all");
  const [selected, setSelected] = useState<NewClient | null>(null);

  const stats = useMemo(() => {
    const total = clients.length;
    const converted = clients.filter((c) => /converted/i.test(c.conversionStatus) && !/not/i.test(c.conversionStatus)).length;
    const notConverted = clients.filter((c) => /not\s*converted/i.test(c.conversionStatus)).length;
    const active = clients.filter((c) => /active/i.test(c.lifecycleStatus) || /active/i.test(c.retentionStatus)).length;
    const lapsed = clients.filter((c) => /lapsed|churned/i.test(c.lifecycleStatus) || /churned/i.test(c.retentionStatus)).length;
    const totalLtv = clients.reduce((s, c) => s + c.ltv, 0);
    const totalVisits = clients.reduce((s, c) => s + c.noOfVisits, 0);
    const avgConversionSpan = clients.filter((c) => c.conversionSpan > 0);
    const avgSpan = avgConversionSpan.length ? avgConversionSpan.reduce((s, c) => s + c.conversionSpan, 0) / avgConversionSpan.length : 0;
    const conversionRate = total ? (converted / total) * 100 : 0;
    const avgLtv = total ? totalLtv / total : 0;
    const activeRate = total ? (active / total) * 100 : 0;
    return { total, converted, notConverted, active, lapsed, totalLtv, totalVisits, avgSpan, conversionRate, avgLtv, activeRate };
  }, [clients]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "converted": return clients.filter((c) => /converted/i.test(c.conversionStatus) && !/not/i.test(c.conversionStatus));
      case "notconverted": return clients.filter((c) => /not\s*converted/i.test(c.conversionStatus));
      case "active": return clients.filter((c) => /active/i.test(c.lifecycleStatus) || /active/i.test(c.retentionStatus));
      case "lapsed": return clients.filter((c) => /lapsed|churned/i.test(c.lifecycleStatus) || /churned/i.test(c.retentionStatus));
      default: return clients;
    }
  }, [clients, filter]);

  // Monthly new client trend
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { count: number; converted: number; ltv: number }>();
    clients.forEach((c) => {
      if (!c.firstVisitDateObj) return;
      const ym = `${c.firstVisitDateObj.getFullYear()}-${String(c.firstVisitDateObj.getMonth() + 1).padStart(2, "0")}`;
      const entry = map.get(ym) || { count: 0, converted: 0, ltv: 0 };
      entry.count++;
      if (/converted/i.test(c.conversionStatus) && !/not/i.test(c.conversionStatus)) entry.converted++;
      entry.ltv += c.ltv;
      map.set(ym, entry);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, d]) => ({
      label: label.replace(/^\d{4}-/, ""),
      newClients: d.count,
      converted: d.converted,
      ltv: d.ltv,
    }));
  }, [clients]);

  // Source breakdown
  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; converted: number; ltv: number }>();
    clients.forEach((c) => {
      const src = c.source || "Unknown";
      const entry = map.get(src) || { count: 0, converted: 0, ltv: 0 };
      entry.count++;
      if (/converted/i.test(c.conversionStatus) && !/not/i.test(c.conversionStatus)) entry.converted++;
      entry.ltv += c.ltv;
      map.set(src, entry);
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, d]) => ({
      name,
      count: d.count,
      converted: d.converted,
      ltv: d.ltv,
      conversionRate: d.count ? (d.converted / d.count) * 100 : 0,
    }));
  }, [clients]);

  // Lifecycle distribution
  const lifecycleDist = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const status = c.lifecycleStatus || c.retentionStatus || "Unknown";
      map.set(status, (map.get(status) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [clients]);

  // Conversion speed buckets
  const speedBuckets = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const bucket = c.conversionSpeedBucket || "Unknown";
      map.set(bucket, (map.get(bucket) || 0) + 1);
    });
    return [...map.entries()].sort().map(([name, value]) => ({ name, value }));
  }, [clients]);

  // Top clients by LTV
  const topLtv = useMemo(() =>
    [...clients].filter((c) => c.ltv > 0).sort((a, b) => b.ltv - a.ltv).slice(0, 10).map((c) => ({
      name: c.name,
      value: c.ltv,
    })),
    [clients]
  );

  // First visit day distribution
  const dayDist = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const day = c.firstVisitDay || "Unknown";
      map.set(day, (map.get(day) || 0) + 1);
    });
    return [...map.entries()].sort().map(([name, value]) => ({ name, value }));
  }, [clients]);

  const cols = clientColumns(setSelected);

  return (
    <div className="space-y-8">
      <SectionHeader
        index={1}
        title="New Client Intelligence"
        description="First-visit journeys through conversion, retention, purchase behaviour, and lifecycle outcomes for every newcomer."
        meta={<span className="source-badge"><span className="source-dot" />{intFmt(clients.length)} new clients tracked</span>}
      />

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard icon={<Users />} label="Total New Clients" value={intFmt(stats.total)} accent="blue" />
        <StatCard icon={<Target />} label="Conversion Rate" value={pct(stats.conversionRate)} accent="emerald" />
        <StatCard icon={<DollarSign />} label="Total LTV" value={compact(stats.totalLtv)} accent="violet" />
        <StatCard icon={<TrendingUp />} label="Avg LTV / Client" value={compact(stats.avgLtv)} accent="amber" />
        <StatCard icon={<UserCheck />} label="Active Clients" value={intFmt(stats.active)} sub={pct(stats.activeRate)} accent="teal" />
        <StatCard icon={<Clock />} label="Avg Days to Convert" value={dec(stats.avgSpan, 0)} accent="rose" />
      </div>

      {/* Conversion funnel */}
      <Panel title="Conversion Funnel" subtitle="New visitors → trial → converted → retained">
        <div className="grid gap-0 sm:grid-cols-4">
          <FunnelStep label="New Visitors" value={stats.total} total={stats.total} color="blue" />
          <FunnelStep label="With Visits" value={clients.filter((c) => c.noOfVisits > 0).length} total={stats.total} color="violet" />
          <FunnelStep label="Converted" value={stats.converted} total={stats.total} color="emerald" />
          <FunnelStep label="Active / Retained" value={stats.active} total={stats.total} color="teal" />
        </div>
      </Panel>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="New Client Acquisition Trend" subtitle="Monthly new visitors and conversion counts">
          <TrendChart
            data={monthlyTrend}
            bars={[{ key: "newClients", name: "New Clients" }]}
            lines={[{ key: "converted", name: "Converted" }]}
            height={280}
          />
        </Panel>
        <Panel title="Lifecycle Status Distribution" subtitle="Where clients are in their journey">
          <Donut data={lifecycleDist} height={280} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Acquisition Source Performance" subtitle="Lead source → conversion rate → LTV">
          <DataTable
            cols={sourceColumns()}
            rows={sourceBreakdown}
            rowKey={(r) => r.name}
            defaultSort="count"
            initialLimit={10}
          />
        </Panel>
        <Panel title="Top Clients by Lifetime Value" subtitle="Highest-value newcomers">
          <RankBars data={topLtv} height={300} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Conversion Speed" subtitle="How quickly visitors convert to paying members">
          <Donut data={speedBuckets} height={260} />
        </Panel>
        <Panel title="First Visit Day" subtitle="Which days attract the most newcomers">
          <Donut data={dayDist} height={260} />
        </Panel>
      </div>

      {/* Client table */}
      <Panel
        title="New Client Roster"
        subtitle={`${intFmt(filtered.length)} clients · click a row for full journey details`}
        right={
          <div className="flex items-center gap-1.5">
            {(["all", "converted", "notconverted", "active", "lapsed"] as const).map((f) => (
              <Btn key={f} size="xs" active={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "notconverted" ? "Not Converted" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Btn>
            ))}
          </div>
        }
      >
        <DataTable
          cols={cols}
          rows={filtered}
          rowKey={(r) => r.id || r.name}
          defaultSort="ltv"
          initialLimit={25}
          csvName="new-clients"
          onRowClick={setSelected}
        />
      </Panel>

      <AnimatePresence>
        {selected && <ClientDetailModal client={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Helpers ── */
const accentMap: Record<string, string> = {
  blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-600 dark:text-blue-400",
  emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  violet: "from-violet-500/10 to-violet-600/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
  amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-600 dark:text-amber-400",
  teal: "from-teal-500/10 to-teal-600/5 border-teal-500/20 text-teal-600 dark:text-teal-400",
  rose: "from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-600 dark:text-rose-400",
};

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn("card relative overflow-hidden border bg-gradient-to-br p-4", accentMap[accent] || accentMap.blue)}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <span className="opacity-40">{icon}</span>
      </div>
      <p className="mt-2 font-display text-[26px] font-bold leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-[11px] opacity-60">{sub}</p>}
    </motion.div>
  );
}

function FunnelStep({ label, value, total }: { label: string; value: number; total: number; color: string }) {
  const pctVal = total ? (value / total) * 100 : 0;
  return (
    <div className="border-b border-line p-4 sm:border-b-0 sm:border-r last:border-r-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-lo">{label}</p>
      <p className="mt-1 font-display text-[28px] font-bold text-hi">{intFmt(value)}</p>
      <ShareBar value={pctVal} />
      <p className="mt-1 text-[10.5px] text-lo">{pct(pctVal)} of total</p>
    </div>
  );
}

function sourceColumns(): Col<{ name: string; count: number; converted: number; ltv: number; conversionRate: number }>[] {
  return [
    { key: "name", label: "Source", align: "left", value: (r) => r.name },
    { key: "count", label: "Clients", value: (r) => r.count, fmt: intFmt, heat: true },
    { key: "converted", label: "Converted", value: (r) => r.converted, fmt: intFmt },
    { key: "conversionRate", label: "Conv. Rate", value: (r) => r.conversionRate, fmt: (n) => pct(n, 1) },
    { key: "ltv", label: "Total LTV", value: (r) => r.ltv, fmt: compact, heat: true },
  ];
}

function clientColumns(_onClick: (c: NewClient) => void): Col<NewClient>[] {
  return [
    { key: "name", label: "Client", align: "left", value: (r) => r.name, totalMode: "none", width: "180px",
      render: (r) => <div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-loc-soft text-[9px] font-bold text-loc">{r.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9px] text-lo">{r.email || "—"}</small></span></div>
    },
    { key: "firstVisitDate", label: "First Visit", value: (r) => r.firstVisitDateObj?.getTime() || 0, fmt: () => "—" },
    { key: "noOfVisits", label: "Visits", value: (r) => r.noOfVisits, fmt: intFmt, heat: true },
    { key: "conversionStatus", label: "Status", value: (r) => r.conversionStatus,
      render: (r) => {
        const converted = /converted/i.test(r.conversionStatus) && !/not/i.test(r.conversionStatus);
        return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold", converted ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg")}>{r.conversionStatus || "—"}</span>;
      }
    },
    { key: "ltv", label: "LTV", value: (r) => r.ltv, fmt: compact, heat: true },
    { key: "retentionStatus", label: "Retention", value: (r) => r.retentionStatus,
      render: (r) => {
        const active = /active/i.test(r.retentionStatus);
        return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold", active ? "bg-pos-soft text-pos" : /lapsed|churned/i.test(r.retentionStatus) ? "bg-neg-soft text-neg" : "bg-surface3 text-lo")}>{r.retentionStatus || "—"}</span>;
      }
    },
    { key: "source", label: "Source", value: (r) => r.source },
    { key: "conversionSpan", label: "Days to Convert", value: (r) => r.conversionSpan, fmt: intFmt },
    { key: "lifecycleStatus", label: "Lifecycle", value: (r) => r.lifecycleStatus,
      render: (r) => <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold",
        /active/i.test(r.lifecycleStatus) ? "bg-pos-soft text-pos" : /lapsed/i.test(r.lifecycleStatus) ? "bg-warn-soft text-warn" : /churned/i.test(r.lifecycleStatus) ? "bg-neg-soft text-neg" : "bg-surface3 text-lo"
      )}>{r.lifecycleStatus || "—"}</span>
    },
    { key: "daysSinceLastVisit", label: "Days Since Visit", value: (r) => r.daysSinceLastVisit, fmt: intFmt },
  ];
}

function ClientDetailModal({ client, onClose }: { client: NewClient; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog" aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-app shadow-lg"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="font-display text-lg font-semibold text-hi">{client.name}</h2>
            <p className="mt-0.5 text-[11px] text-lo">{client.email} · {client.phone}</p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-lo hover:bg-surface2 hover:text-hi">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="LTV" value={compact(client.ltv)} />
            <MiniStat label="Total Visits" value={intFmt(client.noOfVisits)} />
            <MiniStat label="Conversion" value={client.conversionStatus || "—"} />
            <MiniStat label="Retention" value={client.retentionStatus || "—"} />
            <MiniStat label="First Visit" value={client.firstVisitDate || "—"} />
            <MiniStat label="Days to Convert" value={intFmt(client.conversionSpan)} />
            <MiniStat label="Visits/Month" value={dec(client.visitsPerMonth, 1)} />
            <MiniStat label="Lifecycle" value={client.lifecycleStatus || "—"} />
            <MiniStat label="Source" value={client.source || "—"} />
            <MiniStat label="Location" value={client.homeLocation || "—"} />
            <MiniStat label="First Purchase" value={compact(client.firstPurchaseValue)} />
            <MiniStat label="Days Since Visit" value={intFmt(client.daysSinceLastVisit)} />
          </div>
          <Panel title="Journey Timeline">
            <div className="space-y-3 p-4">
              <TimelineItem icon={<Calendar className="h-3.5 w-3.5" />} label="First Visit" value={client.firstVisitDate} detail={`${client.firstVisitLocation} · ${client.firstVisitType}`} />
              {client.firstPurchaseDate && <TimelineItem icon={<DollarSign className="h-3.5 w-3.5" />} label="First Purchase" value={client.firstPurchaseDate} detail={`${compact(client.firstPurchaseValue)} · ${client.firstPurchase}`} />}
              {client.lastPurchaseDate && <TimelineItem icon={<Repeat className="h-3.5 w-3.5" />} label="Last Purchase" value={client.lastPurchaseDate} detail={compact(client.lastPurchaseValue)} />}
              {client.lastVisitDate && <TimelineItem icon={<MapPin className="h-3.5 w-3.5" />} label="Last Visit" value={client.lastVisitDate} detail={`${intFmt(client.daysSinceLastVisit)} days ago`} />}
            </div>
          </Panel>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-lo">{label}</p>
      <p className="mt-1 font-display text-sm font-bold text-hi">{value}</p>
    </div>
  );
}

function TimelineItem({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-loc-soft text-loc">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold text-hi">{label}</p>
        <p className="text-[10.5px] text-mid">{value}</p>
        <p className="text-[10px] text-lo">{detail}</p>
      </div>
    </div>
  );
}
