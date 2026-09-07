import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserX, AlertTriangle, Clock, DollarSign,
  TrendingDown, X, Ban,
} from "lucide-react";
import type { FlexTable } from "../../lib/sessions";
import { compact, intFmt, pct, dec } from "../../lib/format";
import { cn } from "../../utils/cn";
import { Panel, SectionHeader, Btn, ShareBar } from "../ui";
import { DataTable, type Col } from "../DataTable";
import { TrendChart, Donut, RankBars } from "../Charts";

interface LapsedMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  hostId: string;
  status: string;
  membershipName: string;
  sessionsLimit: number;
  purchaseDate: string;
  startDate: string;
  endDate: string;
  churnedDate: string;
  amountPaid: number;
  discountCode: string;
  discountValue: number;
  originalAmount: number;
  soldBy: string;
  mostRecentVisit: string;
  firstVisitDate: string;
  totalSessionsCompleted: number;
  sessionsUsed: number;
  percentRemaining: number;
  totalCancellations: number;
  lateCancellations: number;
  noShows: number;
  cancellationRate: number;
  preferredBookingMethod: string;
  primaryLocation: string;
  locationsAttended: number;
  freezeCount: number;
  daysFrozen: number;
  membershipDuration: number;
  daysActive: number;
  daysSinceLastVisit: number;
  avgSessionsPerMonth: number;
  revenuePerSession: number;
  attendanceRate: number;
  churnedDateObj: Date | null;
}

const money = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;

const pick = (row: Record<string, string>, ...keys: string[]) => {
  const norm = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), v]));
  for (const k of keys) {
    const v = norm.get(k.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (v !== undefined) return v;
  }
  return "";
};

function parseDate(v: string): Date | null {
  if (!v) return null;
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const m2 = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseLapsed(data: FlexTable): LapsedMember[] {
  return data.rows.map((row) => ({
    id: pick(row, "Member ID"),
    name: pick(row, "Member Name"),
    email: pick(row, "Member Email"),
    phone: pick(row, "Member Phone"),
    hostId: pick(row, "Host ID"),
    status: pick(row, "Status"),
    membershipName: pick(row, "Membership Name"),
    sessionsLimit: num(pick(row, "Sessions Limit")),
    purchaseDate: pick(row, "Purchase Date"),
    startDate: pick(row, "Start Date"),
    endDate: pick(row, "End Date"),
    churnedDate: pick(row, "Churned Date"),
    amountPaid: money(pick(row, "Amount Paid")),
    discountCode: pick(row, "Discount Code"),
    discountValue: money(pick(row, "Discount Value")),
    originalAmount: money(pick(row, "Original Amount (Before Discount)")),
    soldBy: pick(row, "Sold By"),
    mostRecentVisit: pick(row, "Most Recent Visit Date"),
    firstVisitDate: pick(row, "First Visit Date"),
    totalSessionsCompleted: num(pick(row, "Total Sessions Completed")),
    sessionsUsed: num(pick(row, "Sessions Used")),
    percentRemaining: num(pick(row, "% Remaining Sessions")),
    totalCancellations: num(pick(row, "Total Cancellations")),
    lateCancellations: num(pick(row, "Late Cancellations")),
    noShows: num(pick(row, "No Shows")),
    cancellationRate: num(pick(row, "Cancellation Rate %")),
    preferredBookingMethod: pick(row, "Preferred Booking Method"),
    primaryLocation: pick(row, "Primary Location"),
    locationsAttended: num(pick(row, "Locations Attended")),
    freezeCount: num(pick(row, "Membership Freeze Count")),
    daysFrozen: num(pick(row, "Days Frozen")),
    membershipDuration: num(pick(row, "Membership Duration (Days)")),
    daysActive: num(pick(row, "Days Active")),
    daysSinceLastVisit: num(pick(row, "Days Since Last Visit")),
    avgSessionsPerMonth: num(pick(row, "Average Sessions Per Month")),
    revenuePerSession: money(pick(row, "Revenue Per Session")),
    attendanceRate: num(pick(row, "Attendance Rate %")),
    churnedDateObj: parseDate(pick(row, "Churned Date")),
  }));
}

export function LapsedSection({ lapsed }: { lapsed: FlexTable }) {
  const members = useMemo(() => parseLapsed(lapsed), [lapsed]);
  const [tab, setTab] = useState<"all" | "churned" | "atrisk" | "new">("all");
  const [selected, setSelected] = useState<LapsedMember | null>(null);

  const stats = useMemo(() => {
    const total = members.length;
    const churned = members.filter((m) => m.churnedDateObj || /churned|expired/i.test(m.status)).length;
    const atRisk = members.filter((m) => m.daysSinceLastVisit >= 14 && m.daysSinceLastVisit < 60 && !m.churnedDateObj).length;
    const newMembers = members.filter((m) => m.daysActive <= 30).length;
    const totalRevenue = members.reduce((s, m) => s + m.amountPaid, 0);
    const avgRevPerSession = members.filter((m) => m.revenuePerSession > 0).reduce((s, m, _, arr) => s + m.revenuePerSession / arr.length, 0);
    const avgSessions = members.length ? members.reduce((s, m) => s + m.totalSessionsCompleted, 0) / members.length : 0;
    const avgDaysSinceVisit = members.filter((m) => m.daysSinceLastVisit > 0).reduce((s, m, _, arr) => s + m.daysSinceLastVisit / arr.length, 0);
    const avgCancelRate = members.length ? members.reduce((s, m) => s + m.cancellationRate, 0) / members.length : 0;
    const avgAttendRate = members.length ? members.reduce((s, m) => s + m.attendanceRate, 0) / members.length : 0;
    return { total, churned, atRisk, newMembers, totalRevenue, avgRevPerSession, avgSessions, avgDaysSinceVisit, avgCancelRate, avgAttendRate };
  }, [members]);

  const filtered = useMemo(() => {
    switch (tab) {
      case "churned": return members.filter((m) => m.churnedDateObj || /churned|expired/i.test(m.status));
      case "atrisk": return members.filter((m) => m.daysSinceLastVisit >= 14 && m.daysSinceLastVisit < 60 && !m.churnedDateObj);
      case "new": return members.filter((m) => m.daysActive <= 30);
      default: return members;
    }
  }, [members, tab]);

  // Churn timeline
  const churnTimeline = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      if (!m.churnedDateObj) return;
      const ym = `${m.churnedDateObj.getFullYear()}-${String(m.churnedDateObj.getMonth() + 1).padStart(2, "0")}`;
      map.set(ym, (map.get(ym) || 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({
      label: label.replace(/^\d{4}-/, ""),
      value,
    }));
  }, [members]);

  // Membership type distribution
  const membershipDist = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      const name = m.membershipName || "Unknown";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 22) + "…" : name, value }));
  }, [members]);

  // Location distribution
  const locDist = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      const loc = m.primaryLocation || "Unknown";
      map.set(loc, (map.get(loc) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [members]);

  // Booking method distribution
  const bookingDist = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      const method = m.preferredBookingMethod || "Unknown";
      map.set(method, (map.get(method) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [members]);

  // Days since last visit distribution
  const visitGapDist = useMemo(() => {
    const buckets = [
      { label: "0-7 days", min: 0, max: 7 },
      { label: "8-14 days", min: 8, max: 14 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "61-90 days", min: 61, max: 90 },
      { label: "90+ days", min: 91, max: 999999 },
    ];
    return buckets.map((b) => ({
      name: b.label,
      value: members.filter((m) => m.daysSinceLastVisit >= b.min && m.daysSinceLastVisit <= b.max).length,
    }));
  }, [members]);

  // Top lost revenue members
  const topLost = useMemo(() =>
    [...members]
      .filter((m) => m.amountPaid > 0)
      .sort((a, b) => b.amountPaid - a.amountPaid)
      .slice(0, 10)
      .map((m) => ({ name: m.name || "Unknown", value: m.amountPaid })),
    [members]
  );

  const cols = lapsedColumns(setSelected);

  return (
    <div className="space-y-8">
      <SectionHeader
        index={1}
        title="Lapsed Client Intelligence"
        description="Churned, at-risk, and recently dormant members — revenue exposure, engagement decay patterns, and win-back opportunities."
        meta={<span className="source-badge"><span className="source-dot" />{intFmt(members.length)} members tracked</span>}
      />

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <LStatCard icon={<UserX />} label="Total Members" value={intFmt(stats.total)} accent="blue" />
        <LStatCard icon={<Ban />} label="Churned" value={intFmt(stats.churned)} accent="rose" />
        <LStatCard icon={<AlertTriangle />} label="At Risk" value={intFmt(stats.atRisk)} accent="amber" />
        <LStatCard icon={<DollarSign />} label="Total Revenue" value={compact(stats.totalRevenue)} accent="violet" />
        <LStatCard icon={<TrendingDown />} label="Avg Days Since Visit" value={dec(stats.avgDaysSinceVisit, 0)} accent="teal" />
        <LStatCard icon={<Clock />} label="Avg Sessions" value={dec(stats.avgSessions, 1)} accent="emerald" />
      </div>

      {/* Risk overview */}
      <Panel title="Member Status Breakdown" subtitle="Churned vs at-risk vs active within cohort">
        <div className="grid gap-0 sm:grid-cols-3">
          <FunnelBlock label="Churned" value={stats.churned} total={stats.total} color="rose" />
          <FunnelBlock label="At Risk" value={stats.atRisk} total={stats.total} color="amber" />
          <FunnelBlock label="Engaged" value={stats.total - stats.churned - stats.atRisk} total={stats.total} color="emerald" />
        </div>
      </Panel>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Churn Timeline" subtitle="Monthly member churn counts">
          {churnTimeline.length > 0 ? (
            <TrendChart data={churnTimeline} bars={[{ key: "value", name: "Churned" }]} height={260} />
          ) : (
            <EmptyChart msg="No churn dates available" />
          )}
        </Panel>
        <Panel title="Membership Type Distribution" subtitle="Which products are members churning from">
          <Donut data={membershipDist} height={260} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Days Since Last Visit" subtitle="Engagement decay buckets">
          <Donut data={visitGapDist} height={260} />
        </Panel>
        <Panel title="Top Revenue at Risk" subtitle="Highest-value lapsed members">
          <RankBars data={topLost} height={260} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Location Distribution" subtitle="Where lapsed members primarily trained">
          <Donut data={locDist} height={260} />
        </Panel>
        <Panel title="Booking Channel" subtitle="How lapsed members preferred to book">
          <Donut data={bookingDist} height={260} />
        </Panel>
      </div>

      {/* Members table */}
      <Panel
        title="Lapsed Member Roster"
        subtitle={`${intFmt(filtered.length)} members · click a row for full details`}
        right={
          <div className="flex items-center gap-1.5">
            {(["all", "churned", "atrisk", "new"] as const).map((t) => (
              <Btn key={t} size="xs" active={tab === t} onClick={() => setTab(t)}>
                {t === "all" ? "All" : t === "atrisk" ? "At Risk" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Btn>
            ))}
          </div>
        }
      >
        <DataTable
          cols={cols}
          rows={filtered}
          rowKey={(r) => r.id || r.name}
          defaultSort="daysSinceLastVisit"
          initialLimit={25}
          csvName="lapsed-members"
          onRowClick={setSelected}
        />
      </Panel>

      <AnimatePresence>
        {selected && <LapsedDetailModal member={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Components ── */

const accentMap: Record<string, string> = {
  blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-600 dark:text-blue-400",
  emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  violet: "from-violet-500/10 to-violet-600/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
  amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-600 dark:text-amber-400",
  teal: "from-teal-500/10 to-teal-600/5 border-teal-500/20 text-teal-600 dark:text-teal-400",
  rose: "from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-600 dark:text-rose-400",
};

function LStatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
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

function FunnelBlock({ label, value, total }: { label: string; value: number; total: number; color: string }) {
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

function EmptyChart({ msg }: { msg: string }) {
  return <div className="flex h-[260px] items-center justify-center text-[12px] text-lo">{msg}</div>;
}

function lapsedColumns(_onClick: (m: LapsedMember) => void): Col<LapsedMember>[] {
  return [
    { key: "name", label: "Member", align: "left", value: (r) => r.name, totalMode: "none", width: "180px",
      render: (r) => <div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-loc-soft text-[9px] font-bold text-loc">{(r.name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2)}</span><span><b className="block text-hi">{r.name || "—"}</b><small className="text-[9px] text-lo">{r.email || "—"}</small></span></div>
    },
    { key: "status", label: "Status", value: (r) => r.status,
      render: (r) => {
        const active = /active/i.test(r.status);
        return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold",
          active ? "bg-pos-soft text-pos" : /expired|churned/i.test(r.status) ? "bg-neg-soft text-neg" : "bg-warn-soft text-warn"
        )}>{r.status || "—"}</span>;
      }
    },
    { key: "membershipName", label: "Membership", value: (r) => r.membershipName },
    { key: "amountPaid", label: "Amount Paid", value: (r) => r.amountPaid, fmt: compact, heat: true },
    { key: "totalSessionsCompleted", label: "Sessions", value: (r) => r.totalSessionsCompleted, fmt: intFmt },
    { key: "daysSinceLastVisit", label: "Days Since Visit", value: (r) => r.daysSinceLastVisit, fmt: intFmt, heat: true },
    { key: "cancellationRate", label: "Cancel Rate", value: (r) => r.cancellationRate, fmt: (n) => pct(n, 1) },
    { key: "attendanceRate", label: "Attend Rate", value: (r) => r.attendanceRate, fmt: (n) => pct(n, 1) },
    { key: "primaryLocation", label: "Location", value: (r) => r.primaryLocation },
    { key: "avgSessionsPerMonth", label: "Sessions/Mo", value: (r) => r.avgSessionsPerMonth, fmt: (n) => dec(n, 1) },
  ];
}

function LapsedDetailModal({ member, onClose }: { member: LapsedMember; onClose: () => void }) {
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
            <h2 className="font-display text-lg font-semibold text-hi">{member.name}</h2>
            <p className="mt-0.5 text-[11px] text-lo">{member.email} · {member.phone}</p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-lo hover:bg-surface2 hover:text-hi">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Status" value={member.status || "—"} />
            <MiniStat label="Amount Paid" value={compact(member.amountPaid)} />
            <MiniStat label="Sessions Completed" value={intFmt(member.totalSessionsCompleted)} />
            <MiniStat label="Days Since Visit" value={intFmt(member.daysSinceLastVisit)} />
            <MiniStat label="Membership" value={member.membershipName || "—"} />
            <MiniStat label="Avg Sessions/Mo" value={dec(member.avgSessionsPerMonth, 1)} />
            <MiniStat label="Cancel Rate" value={pct(member.cancellationRate)} />
            <MiniStat label="Attend Rate" value={pct(member.attendanceRate)} />
            <MiniStat label="Revenue/Session" value={compact(member.revenuePerSession)} />
            <MiniStat label="Location" value={member.primaryLocation || "—"} />
            <MiniStat label="Booking Method" value={member.preferredBookingMethod || "—"} />
            <MiniStat label="First Visit" value={member.firstVisitDate || "—"} />
          </div>
          <Panel title="Engagement Summary">
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface2 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-lo">Cancellations</p>
                <p className="mt-1 font-display text-xl font-bold text-hi">{member.totalCancellations} <span className="text-[11px] font-normal text-lo">({member.lateCancellations} late)</span></p>
              </div>
              <div className="rounded-xl border border-line bg-surface2 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-lo">No Shows</p>
                <p className="mt-1 font-display text-xl font-bold text-hi">{member.noShows}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface2 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-lo">Frozen Period</p>
                <p className="mt-1 font-display text-xl font-bold text-hi">{member.daysFrozen} <span className="text-[11px] font-normal text-lo">days ({member.freezeCount}x)</span></p>
              </div>
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
