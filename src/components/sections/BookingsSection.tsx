import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Receipt, Calendar, Users,
  Star, BarChart3, TrendingDown,
} from "lucide-react";
import type { FlexTable } from "../../lib/sessions";
import { compact, intFmt, pct } from "../../lib/format";
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

export function BookingsSection({ bookings }: { bookings: FlexTable }) {
  const records = useMemo(() => parseBookings(bookings), [bookings]);
  const [tab, setTab] = useState<"all" | "confirmed" | "cancelled" | "new">("all");

  const stats = useMemo(() => {
    const total = records.length;
    const confirmed = records.filter((r) => !r.cancelled && !r.noShow).length;
    const cancelled = records.filter((r) => r.cancelled).length;
    const lateCancelled = records.filter((r) => r.lateCancelled).length;
    const noShows = records.filter((r) => r.noShow).length;
    const showRate = total ? (confirmed / total) * 100 : 0;
    const totalValue = records.reduce((s, r) => s + r.saleValue, 0);
    const newBookings = records.filter((r) => /new/i.test(r.isNew)).length;
    const uniqueMembers = new Set(records.map((r) => r.memberId)).size;
    const uniqueClasses = new Set(records.map((r) => r.cleanedClass)).size;
    return { total, confirmed, cancelled, lateCancelled, noShows, showRate, totalValue, newBookings, uniqueMembers, uniqueClasses };
  }, [records]);

  const filtered = useMemo(() => {
    switch (tab) {
      case "confirmed": return records.filter((r) => !r.cancelled && !r.noShow);
      case "cancelled": return records.filter((r) => r.cancelled || r.lateCancelled);
      case "new": return records.filter((r) => /new/i.test(r.isNew));
      default: return records;
    }
  }, [records, tab]);

  // Monthly booking trend
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { bookings: number; confirmed: number; cancelled: number; revenue: number }>();
    records.forEach((r) => {
      if (!r.sessionDateObj) return;
      const ym = `${r.sessionDateObj.getFullYear()}-${String(r.sessionDateObj.getMonth() + 1).padStart(2, "0")}`;
      const e = map.get(ym) || { bookings: 0, confirmed: 0, cancelled: 0, revenue: 0 };
      e.bookings++;
      if (!r.cancelled && !r.noShow) e.confirmed++;
      if (r.cancelled) e.cancelled++;
      e.revenue += r.saleValue;
      map.set(ym, e);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, d]) => ({
      label: label.replace(/^\d{4}-/, ""),
      bookings: d.bookings,
      confirmed: d.confirmed,
      cancelled: d.cancelled,
      revenue: d.revenue,
    }));
  }, [records]);

  // By class
  const byClass = useMemo(() => {
    const map = new Map<string, { total: number; confirmed: number; cancelled: number }>();
    records.forEach((r) => {
      const cls = r.cleanedClass || "Unknown";
      const e = map.get(cls) || { total: 0, confirmed: 0, cancelled: 0 };
      e.total++;
      if (!r.cancelled && !r.noShow) e.confirmed++;
      if (r.cancelled) e.cancelled++;
      map.set(cls, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name: name.length > 30 ? name.slice(0, 27) + "…" : name,
      total: d.total,
      confirmed: d.confirmed,
      cancelled: d.cancelled,
      showRate: d.total ? (d.confirmed / d.total) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [records]);

  // By time slot
  const byTimeSlot = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const slot = r.timeSlot || "Unknown";
      map.set(slot, (map.get(slot) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [records]);

  // By teacher
  const byTeacher = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const t = r.teacherName || "Unknown";
      map.set(t, (map.get(t) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name, value }));
  }, [records]);

  // By day of week
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const day = r.dayOfWeek || "Unknown";
      map.set(day, (map.get(day) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [records]);

  // By location
  const byLocation = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const loc = r.location || "Unknown";
      map.set(loc, (map.get(loc) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [records]);

  // Booking lead time (days between sale and session)
  const leadTimeDist = useMemo(() => {
    const buckets = [
      { label: "Same day", min: 0, max: 1 },
      { label: "1-3 days", min: 1, max: 3 },
      { label: "4-7 days", min: 4, max: 7 },
      { label: "1-2 weeks", min: 8, max: 14 },
      { label: "2+ weeks", min: 15, max: 999999 },
    ];
    const withBoth = records.filter((r) => r.sessionDateObj && r.saleDateObj);
    return buckets.map((b) => ({
      name: b.label,
      value: withBoth.filter((r) => {
        const diff = (r.sessionDateObj!.getTime() - r.saleDateObj!.getTime()) / 86400000;
        return diff >= b.min && diff < b.max;
      }).length,
    }));
  }, [records]);

  const cols = bookingColumns();

  return (
    <div className="space-y-8">
      <SectionHeader
        index={1}
        title="Bookings Intelligence"
        description="Member-level booking patterns, demand distribution, show rates, and the booking-to-attendance pipeline."
        meta={<span className="source-badge"><span className="source-dot" />{intFmt(stats.total)} bookings tracked</span>}
      />

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <BStatCard icon={<Receipt />} label="Total Bookings" value={intFmt(stats.total)} accent="blue" />
        <BStatCard icon={<Star />} label="Confirmed" value={intFmt(stats.confirmed)} sub={pct(stats.showRate)} accent="emerald" />
        <BStatCard icon={<TrendingDown />} label="Cancelled" value={intFmt(stats.cancelled)} accent="rose" />
        <BStatCard icon={<Calendar />} label="New Bookings" value={intFmt(stats.newBookings)} accent="violet" />
        <BStatCard icon={<Users />} label="Unique Members" value={intFmt(stats.uniqueMembers)} accent="amber" />
        <BStatCard icon={<BarChart3 />} label="Unique Classes" value={intFmt(stats.uniqueClasses)} accent="teal" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Booking Volume Trend" subtitle="Monthly bookings, confirmed and cancelled">
          {monthlyTrend.length > 0 ? (
            <TrendChart
              data={monthlyTrend}
              bars={[{ key: "bookings", name: "Total Bookings" }]}
              lines={[{ key: "confirmed", name: "Confirmed" }]}
              height={280}
            />
          ) : (
            <EmptyChart msg="No trend data available" />
          )}
        </Panel>
        <Panel title="Bookings by Class" subtitle="Demand distribution across class types">
          <DataTable
            cols={classColumns()}
            rows={byClass}
            rowKey={(r) => r.name}
            defaultSort="total"
            initialLimit={12}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="By Time Slot" subtitle="Most popular booking times">
          {byTimeSlot.length > 0 ? <Donut data={byTimeSlot.slice(0, 8)} height={260} /> : <EmptyChart msg="No data" />}
        </Panel>
        <Panel title="By Day of Week" subtitle="Demand distribution by day">
          {byDay.length > 0 ? <Donut data={byDay} height={260} /> : <EmptyChart msg="No data" />}
        </Panel>
        <Panel title="Booking Lead Time" subtitle="Days between booking and session">
          {leadTimeDist.some((d) => d.value > 0) ? <Donut data={leadTimeDist} height={260} /> : <EmptyChart msg="No date data" />}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top Teachers by Bookings" subtitle="Instructor demand ranking">
          {byTeacher.length > 0 ? <RankBars data={byTeacher} height={280} /> : <EmptyChart msg="No data" />}
        </Panel>
        <Panel title="By Location" subtitle="Studio booking distribution">
          {byLocation.length > 0 ? <Donut data={byLocation} height={260} /> : <EmptyChart msg="No data" />}
        </Panel>
      </div>

      {/* Records table */}
      <Panel
        title="Booking Records"
        subtitle={`${intFmt(filtered.length)} records`}
        right={
          <div className="flex items-center gap-1.5">
            {(["all", "confirmed", "cancelled", "new"] as const).map((t) => (
              <Btn key={t} size="xs" active={tab === t} onClick={() => setTab(t)}>
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Btn>
            ))}
          </div>
        }
      >
        <DataTable
          cols={cols}
          rows={filtered}
          rowKey={(r) => `${r.memberId}-${r.sessionDate}-${r.saleId}`}
          defaultSort="sessionDate"
          initialLimit={25}
          csvName="bookings"
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
  teal: "from-teal-500/10 to-teal-600/5 border-teal-500/20 text-teal-600 dark:text-teal-400",
  rose: "from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-600 dark:text-rose-400",
};

function BStatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
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

function bookingColumns(): Col<BookingRecord>[] {
  return [
    { key: "customerName", label: "Member", align: "left", value: (r) => r.customerName, totalMode: "none", width: "180px",
      render: (r) => <div><b className="block text-hi">{r.customerName || "—"}</b><small className="text-[9px] text-lo">{r.customerEmail || "—"}</small></div>
    },
    { key: "cleanedClass", label: "Class", value: (r) => r.cleanedClass },
    { key: "teacherName", label: "Teacher", value: (r) => r.teacherName },
    { key: "sessionDate", label: "Session Date", value: (r) => r.sessionDate },
    { key: "timeSlot", label: "Time Slot", value: (r) => r.timeSlot },
    { key: "location", label: "Location", value: (r) => r.location },
    { key: "saleValue", label: "Value", value: (r) => r.saleValue, fmt: compact },
    { key: "cancelled", label: "Status", value: (r) => r.cancelled ? 2 : r.noShow ? 1 : 0,
      render: (r) => {
        if (r.noShow) return <span className="inline-flex rounded-md bg-neg-soft px-2 py-0.5 text-[10px] font-semibold text-neg">No Show</span>;
        if (r.lateCancelled) return <span className="inline-flex rounded-md bg-warn-soft px-2 py-0.5 text-[10px] font-semibold text-warn">Late Cancel</span>;
        if (r.cancelled) return <span className="inline-flex rounded-md bg-neg-soft px-2 py-0.5 text-[10px] font-semibold text-neg">Cancelled</span>;
        return <span className="inline-flex rounded-md bg-pos-soft px-2 py-0.5 text-[10px] font-semibold text-pos">Confirmed</span>;
      }
    },
    { key: "paymentMethod", label: "Payment", value: (r) => r.paymentMethod },
    { key: "dayOfWeek", label: "Day", value: (r) => r.dayOfWeek },
  ];
}

function classColumns(): Col<{ name: string; total: number; confirmed: number; cancelled: number; showRate: number }>[] {
  return [
    { key: "name", label: "Class", align: "left", value: (r) => r.name },
    { key: "total", label: "Bookings", value: (r) => r.total, fmt: intFmt, heat: true },
    { key: "confirmed", label: "Confirmed", value: (r) => r.confirmed, fmt: intFmt },
    { key: "cancelled", label: "Cancelled", value: (r) => r.cancelled, fmt: intFmt },
    { key: "showRate", label: "Show Rate", value: (r) => r.showRate, fmt: (n) => pct(n, 1) },
  ];
}
