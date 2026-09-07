import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock, AlertTriangle, User,
  Ban, Activity,
} from "lucide-react";
import type { FlexTable } from "../../lib/sessions";
import { intFmt, pct } from "../../lib/format";
import { cn } from "../../utils/cn";
import { Panel, SectionHeader, Btn } from "../ui";
import { DataTable, type Col } from "../DataTable";
import { TrendChart, Donut, RankBars } from "../Charts";

interface BookingRecord {
  memberId: string;
  saleDate: string;
  customerName: string;
  customerEmail: string;
  saleValue: number;
  saleItem: string;
  saleId: string;
  sessionDate: string;
  paymentMethod: string;
  membershipUsed: string;
  location: string;
  soldBy: string;
  cancelled: boolean;
  lateCancelled: boolean;
  noShow: boolean;
  trainerId: string;
  teacherName: string;
  cleanedClass: string;
  classNo: string;
  isNew: string;
  dayOfWeek: string;
  timeSlot: string;
  hostId: string;
  sessionDateObj: Date | null;
  saleDateObj: Date | null;
}

const money = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
const bool = (v: string) => /^(true|yes|1)$/i.test(v.trim());

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
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const m2 = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return new Date(+m2[3], +m2[2] - 1, +m2[1]);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseBookings(data: FlexTable): BookingRecord[] {
  return data.rows.map((row) => ({
    memberId: pick(row, "Member Id", "Member ID"),
    saleDate: pick(row, "Sale Date"),
    customerName: pick(row, "Customer Name"),
    customerEmail: pick(row, "Customer Email"),
    saleValue: money(pick(row, "Sale Value")),
    saleItem: pick(row, "Sale Item"),
    saleId: pick(row, "Sale Id"),
    sessionDate: pick(row, "Session Date"),
    paymentMethod: pick(row, "Payment Method"),
    membershipUsed: pick(row, "Membership Used"),
    location: pick(row, "Location Name"),
    soldBy: pick(row, "Sold By"),
    cancelled: bool(pick(row, "Cancelled")),
    lateCancelled: bool(pick(row, "Late Cancelled")),
    noShow: bool(pick(row, "No Show")),
    trainerId: pick(row, "Trainer Id"),
    teacherName: pick(row, "Teacher Name"),
    cleanedClass: pick(row, "Cleaned Class", "Cleaned Class Attended"),
    classNo: pick(row, "Class No"),
    isNew: pick(row, "Is New"),
    dayOfWeek: pick(row, "Day Of Week"),
    timeSlot: pick(row, "Time Slot"),
    hostId: pick(row, "Host Id"),
    sessionDateObj: parseDate(pick(row, "Session Date")),
    saleDateObj: parseDate(pick(row, "Sale Date")),
  }));
}

export function LateCancellationSection({ bookings }: { bookings: FlexTable }) {
  const records = useMemo(() => parseBookings(bookings), [bookings]);
  const [tab, setTab] = useState<"late" | "all_cancelled" | "noshow">("late");

  const lateCancelled = useMemo(() => records.filter((r) => r.lateCancelled), [records]);
  const allCancelled = useMemo(() => records.filter((r) => r.cancelled), [records]);
  const noShows = useMemo(() => records.filter((r) => r.noShow), [records]);

  const stats = useMemo(() => {
    const total = records.length;
    const totalLate = lateCancelled.length;
    const totalCancelled = allCancelled.length;
    const totalNoShow = noShows.length;
    const lateRate = total ? (totalLate / total) * 100 : 0;
    const cancelRate = total ? (totalCancelled / total) * 100 : 0;
    const noShowRate = total ? (totalNoShow / total) * 100 : 0;
    return { total, totalLate, totalCancelled, totalNoShow, lateRate, cancelRate, noShowRate };
  }, [records, lateCancelled, allCancelled, noShows]);

  const displayed = useMemo(() => {
    switch (tab) {
      case "all_cancelled": return allCancelled;
      case "noshow": return noShows;
      default: return lateCancelled;
    }
  }, [tab, lateCancelled, allCancelled, noShows]);

  // Late cancel trend by month
  const lateTrend = useMemo(() => {
    const map = new Map<string, { late: number; total: number }>();
    records.forEach((r) => {
      if (!r.sessionDateObj) return;
      const ym = `${r.sessionDateObj.getFullYear()}-${String(r.sessionDateObj.getMonth() + 1).padStart(2, "0")}`;
      const e = map.get(ym) || { late: 0, total: 0 };
      e.total++;
      if (r.lateCancelled) e.late++;
      map.set(ym, e);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, d]) => ({
      label: label.replace(/^\d{4}-/, ""),
      lateCancels: d.late,
      totalBookings: d.total,
      rate: d.total ? (d.late / d.total) * 100 : 0,
    }));
  }, [records]);

  // By teacher
  const byTeacher = useMemo(() => {
    const map = new Map<string, { total: number; late: number; cancelled: number; noShow: number }>();
    records.forEach((r) => {
      const teacher = r.teacherName || "Unknown";
      const e = map.get(teacher) || { total: 0, late: 0, cancelled: 0, noShow: 0 };
      e.total++;
      if (r.lateCancelled) e.late++;
      if (r.cancelled) e.cancelled++;
      if (r.noShow) e.noShow++;
      map.set(teacher, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name,
      total: d.total,
      late: d.late,
      cancelled: d.cancelled,
      noShow: d.noShow,
      lateRate: d.total ? (d.late / d.total) * 100 : 0,
      cancelRate: d.total ? (d.cancelled / d.total) * 100 : 0,
    })).sort((a, b) => b.late - a.late);
  }, [records]);

  // By class
  const byClass = useMemo(() => {
    const map = new Map<string, { total: number; late: number }>();
    records.forEach((r) => {
      const cls = r.cleanedClass || "Unknown";
      const e = map.get(cls) || { total: 0, late: 0 };
      e.total++;
      if (r.lateCancelled) e.late++;
      map.set(cls, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name: name.length > 30 ? name.slice(0, 27) + "…" : name,
      value: d.late,
    })).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [records]);

  // By time slot
  const byTimeSlot = useMemo(() => {
    const map = new Map<string, number>();
    lateCancelled.forEach((r) => {
      const slot = r.timeSlot || "Unknown";
      map.set(slot, (map.get(slot) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [lateCancelled]);

  // By day of week
  const byDay = useMemo(() => {
    const map = new Map<string, { late: number; total: number }>();
    records.forEach((r) => {
      const day = r.dayOfWeek || "Unknown";
      const e = map.get(day) || { late: 0, total: 0 };
      e.total++;
      if (r.lateCancelled) e.late++;
      map.set(day, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name,
      late: d.late,
      total: d.total,
      rate: d.total ? (d.late / d.total) * 100 : 0,
    }));
  }, [records]);

  // By location
  const byLocation = useMemo(() => {
    const map = new Map<string, { late: number; total: number }>();
    records.forEach((r) => {
      const loc = r.location || "Unknown";
      const e = map.get(loc) || { late: 0, total: 0 };
      e.total++;
      if (r.lateCancelled) e.late++;
      map.set(loc, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name,
      late: d.late,
      total: d.total,
      rate: d.total ? (d.late / d.total) * 100 : 0,
    }));
  }, [records]);

  // Repeat offenders (members with multiple late cancels)
  const repeatOffenders = useMemo(() => {
    const map = new Map<string, { name: string; count: number; email: string }>();
    lateCancelled.forEach((r) => {
      const key = r.memberId || r.customerEmail;
      const e = map.get(key) || { name: r.customerName || "Unknown", count: 0, email: r.customerEmail };
      e.count++;
      map.set(key, e);
    });
    return [...map.values()].filter((v) => v.count >= 2).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [lateCancelled]);

  const cols = lateCancelColumns();

  return (
    <div className="space-y-8">
      <SectionHeader
        index={1}
        title="Late Cancellation Intelligence"
        description="Late cancellations, no-shows, and booking friction patterns that erode fill rates and block real demand."
        meta={<span className="source-badge"><span className="source-dot" />{intFmt(stats.totalLate)} late cancels identified</span>}
      />

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <LCStatCard icon={<CalendarClock />} label="Total Bookings" value={intFmt(stats.total)} accent="blue" />
        <LCStatCard icon={<AlertTriangle />} label="Late Cancels" value={intFmt(stats.totalLate)} sub={pct(stats.lateRate)} accent="rose" />
        <LCStatCard icon={<Ban />} label="All Cancels" value={intFmt(stats.totalCancelled)} sub={pct(stats.cancelRate)} accent="amber" />
        <LCStatCard icon={<User />} label="No Shows" value={intFmt(stats.totalNoShow)} sub={pct(stats.noShowRate)} accent="violet" />
        <LCStatCard icon={<Activity />} label="Show Rate" value={pct(100 - stats.cancelRate - stats.noShowRate)} accent="emerald" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Late Cancel Trend" subtitle="Monthly late cancellations vs total bookings">
          {lateTrend.length > 0 ? (
            <TrendChart
              data={lateTrend}
              bars={[{ key: "lateCancels", name: "Late Cancels" }]}
              lines={[{ key: "rate", name: "Late Rate %" }]}
              height={280}
            />
          ) : (
            <EmptyChart msg="No trend data available" />
          )}
        </Panel>
        <Panel title="Late Cancels by Class" subtitle="Which classes lose the most to late cancellations">
          {byClass.length > 0 ? <RankBars data={byClass} height={280} /> : <EmptyChart msg="No class data" />}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By Time Slot" subtitle="When late cancellations cluster">
          {byTimeSlot.length > 0 ? <Donut data={byTimeSlot} height={260} /> : <EmptyChart msg="No data" />}
        </Panel>
        <Panel title="By Day of Week" subtitle="Late cancel rates per day">
          <DataTable
            cols={dayColumns()}
            rows={byDay}
            rowKey={(r) => r.name}
            defaultSort="late"
            initialLimit={7}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Teacher Late Cancel Rates" subtitle="Instructor-level late cancellation performance">
          <DataTable
            cols={teacherColumns()}
            rows={byTeacher}
            rowKey={(r) => r.name}
            defaultSort="late"
            initialLimit={15}
          />
        </Panel>
        <Panel title="Repeat Offenders" subtitle="Members with 2+ late cancellations">
          {repeatOffenders.length > 0 ? (
            <DataTable
              cols={offenderColumns()}
              rows={repeatOffenders}
              rowKey={(r) => r.email}
              defaultSort="count"
              initialLimit={10}
            />
          ) : (
            <EmptyChart msg="No repeat offenders found" />
          )}
        </Panel>
      </div>

      {/* Location breakdown */}
      <Panel title="By Location" subtitle="Late cancel rates across studios">
        <DataTable
          cols={locationColumns()}
          rows={byLocation}
          rowKey={(r) => r.name}
          defaultSort="late"
          initialLimit={10}
        />
      </Panel>

      {/* Late cancel records table */}
      <Panel
        title="Late Cancel Records"
        subtitle={`${intFmt(displayed.length)} records`}
        right={
          <div className="flex items-center gap-1.5">
            <Btn size="xs" active={tab === "late"} onClick={() => setTab("late")}>Late Cancels</Btn>
            <Btn size="xs" active={tab === "all_cancelled"} onClick={() => setTab("all_cancelled")}>All Cancels</Btn>
            <Btn size="xs" active={tab === "noshow"} onClick={() => setTab("noshow")}>No Shows</Btn>
          </div>
        }
      >
        <DataTable
          cols={cols}
          rows={displayed}
          rowKey={(r) => `${r.memberId}-${r.sessionDate}-${r.saleId}`}
          defaultSort="sessionDate"
          initialLimit={25}
          csvName="late-cancellations"
        />
      </Panel>
    </div>
  );
}

/* ── Components ── */

const accentMap: Record<string, string> = {
  blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-600 dark:text-blue-400",
  emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  violet: "from-violet-500/10 to-violet-600/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
  amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-600 dark:text-amber-400",
  rose: "from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-600 dark:text-rose-400",
};

function LCStatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
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

function EmptyChart({ msg }: { msg: string }) {
  return <div className="flex h-[260px] items-center justify-center text-[12px] text-lo">{msg}</div>;
}

function lateCancelColumns(): Col<BookingRecord>[] {
  return [
    { key: "customerName", label: "Member", align: "left", value: (r) => r.customerName, totalMode: "none", width: "180px",
      render: (r) => <div><b className="block text-hi">{r.customerName || "—"}</b><small className="text-[9px] text-lo">{r.customerEmail || "—"}</small></div>
    },
    { key: "cleanedClass", label: "Class", value: (r) => r.cleanedClass },
    { key: "teacherName", label: "Teacher", value: (r) => r.teacherName },
    { key: "sessionDate", label: "Session Date", value: (r) => r.sessionDate },
    { key: "timeSlot", label: "Time Slot", value: (r) => r.timeSlot },
    { key: "location", label: "Location", value: (r) => r.location },
    { key: "cancelled", label: "Cancelled", value: (r) => r.cancelled ? 1 : 0,
      render: (r) => <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold", r.cancelled ? "bg-neg-soft text-neg" : "bg-surface3 text-lo")}>{r.cancelled ? "Yes" : "No"}</span>
    },
    { key: "lateCancelled", label: "Late Cancel", value: (r) => r.lateCancelled ? 1 : 0,
      render: (r) => <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold", r.lateCancelled ? "bg-warn-soft text-warn" : "bg-surface3 text-lo")}>{r.lateCancelled ? "Yes" : "No"}</span>
    },
    { key: "noShow", label: "No Show", value: (r) => r.noShow ? 1 : 0,
      render: (r) => <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold", r.noShow ? "bg-neg-soft text-neg" : "bg-surface3 text-lo")}>{r.noShow ? "Yes" : "No"}</span>
    },
    { key: "dayOfWeek", label: "Day", value: (r) => r.dayOfWeek },
  ];
}

function teacherColumns(): Col<{ name: string; total: number; late: number; cancelled: number; noShow: number; lateRate: number; cancelRate: number }>[] {
  return [
    { key: "name", label: "Teacher", align: "left", value: (r) => r.name },
    { key: "total", label: "Total Bookings", value: (r) => r.total, fmt: intFmt },
    { key: "late", label: "Late Cancels", value: (r) => r.late, fmt: intFmt, heat: true },
    { key: "lateRate", label: "Late Rate", value: (r) => r.lateRate, fmt: (n) => pct(n, 1) },
    { key: "cancelled", label: "All Cancels", value: (r) => r.cancelled, fmt: intFmt },
    { key: "cancelRate", label: "Cancel Rate", value: (r) => r.cancelRate, fmt: (n) => pct(n, 1) },
  ];
}

function dayColumns(): Col<{ name: string; late: number; total: number; rate: number }>[] {
  return [
    { key: "name", label: "Day", align: "left", value: (r) => r.name },
    { key: "late", label: "Late Cancels", value: (r) => r.late, fmt: intFmt, heat: true },
    { key: "total", label: "Total", value: (r) => r.total, fmt: intFmt },
    { key: "rate", label: "Late Rate", value: (r) => r.rate, fmt: (n) => pct(n, 1) },
  ];
}

function locationColumns(): Col<{ name: string; late: number; total: number; rate: number }>[] {
  return [
    { key: "name", label: "Location", align: "left", value: (r) => r.name },
    { key: "late", label: "Late Cancels", value: (r) => r.late, fmt: intFmt, heat: true },
    { key: "total", label: "Total", value: (r) => r.total, fmt: intFmt },
    { key: "rate", label: "Late Rate", value: (r) => r.rate, fmt: (n) => pct(n, 1) },
  ];
}

function offenderColumns(): Col<{ name: string; count: number; email: string }>[] {
  return [
    { key: "name", label: "Member", align: "left", value: (r) => r.name,
      render: (r) => <div><b className="block text-hi">{r.name}</b><small className="text-[9px] text-lo">{r.email || "—"}</small></div>
    },
    { key: "count", label: "Late Cancels", value: (r) => r.count, fmt: intFmt, heat: true },
  ];
}
