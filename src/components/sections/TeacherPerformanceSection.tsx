import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, BarChart3, CalendarDays, GitCompareArrows, Layers3, Medal, TrendingUp, Users, X } from "lucide-react";
import type { FlexTable, SessionRow } from "../../lib/sessions";
import { compact, dec, intFmt, pct } from "../../lib/format";
import { cn } from "../../utils/cn";
import { DataTable, type Col } from "../DataTable";
import { TrendChart } from "../Charts";
import { Btn, Panel, SectionHeader } from "../ui";

type MetricKey = "sessions" | "checkedIn" | "bookings" | "lateCancels" | "revenue" | "classAvg" | "conversionRate" | "retentionRate";

interface TeacherMonth {
  key: string;
  teacherId: string;
  name: string;
  email: string;
  month: string;
  locations: Set<string>;
  cycle: number;
  strength: number;
  barre: number;
  sessions: number;
  empty: number;
  nonEmpty: number;
  checkedIn: number;
  revenue: number;
  newMembers: number;
  converted: number;
  retained: number;
  bookings: number;
  lateCancels: number;
}

interface TeacherTotal extends Omit<TeacherMonth, "key" | "month" | "locations"> {
  rank: number;
  locations: string[];
  months: TeacherMonth[];
  classAvg: number;
  revPerSession: number;
  conversionRate: number;
  retentionRate: number;
  lateCancelRate: number;
  emptyRate: number;
}

const money = (value: string | undefined) => Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
const num = (value: string | undefined) => Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
const pick = (row: Record<string, string>, ...keys: string[]) => {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]));
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (value !== undefined) return value;
  }
  return "";
};
const monthKey = (value: string) => {
  const text = String(value || "").trim();
  const named = text.match(/^([A-Za-z]{3,9})[-\s](\d{4})$/);
  if (named) {
    const date = new Date(`${named[1]} 1, ${named[2]}`);
    if (!Number.isNaN(date.getTime())) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return year && month ? new Date(year, month - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : value;
};

function buildTeacherData(payroll: FlexTable, sessions: SessionRow[], members: FlexTable): TeacherMonth[] {
  const map = new Map<string, TeacherMonth>();
  payroll.rows.forEach((row) => {
    const name = pick(row, "Teacher Name").trim();
    const month = monthKey(pick(row, "Month Year"));
    if (!name || !month) return;
    const key = `${name.toLowerCase()}|${month}`;
    const current = map.get(key) || {
      key, teacherId: pick(row, "Teacher ID"), name, email: pick(row, "Teacher Email"), month,
      locations: new Set<string>(), cycle: 0, strength: 0, barre: 0, sessions: 0, empty: 0,
      nonEmpty: 0, checkedIn: 0, revenue: 0, newMembers: 0, converted: 0, retained: 0,
      bookings: 0, lateCancels: 0,
    };
    const location = pick(row, "Location");
    if (location) current.locations.add(location);
    current.cycle += num(pick(row, "Cycle Sessions"));
    current.strength += num(pick(row, "Strength Sessions"));
    current.barre += num(pick(row, "Barre Sessions"));
    current.sessions += num(pick(row, "Total Sessions"));
    current.empty += num(pick(row, "Total Empty Sessions"));
    current.nonEmpty += num(pick(row, "Total Non-Empty Sessions"));
    current.checkedIn += num(pick(row, "Total Customers"));
    current.revenue += money(pick(row, "Total Paid"));
    current.newMembers += num(pick(row, "New"));
    current.converted += num(pick(row, "Converted"));
    current.retained += num(pick(row, "Retained"));
    map.set(key, current);
  });
  sessions.forEach((session) => {
    const current = map.get(`${session.trainerName.toLowerCase()}|${session.ym}`);
    if (!current) return;
    current.bookings += session.booked;
    current.lateCancels += session.lateCancelled;
  });
  const memberOutcomes = new Map<string, { newMembers: number; converted: number; retained: number }>();
  members.rows.forEach((row) => {
    const name = pick(row, "Trainer Name", "Teacher Name").trim();
    const month = monthKey(pick(row, "Month Year", "First Visit Date"));
    if (!name || !month || !/^new\b/i.test(pick(row, "Is New"))) return;
    const key = `${name.toLowerCase()}|${month}`;
    const outcome = memberOutcomes.get(key) || { newMembers: 0, converted: 0, retained: 0 };
    outcome.newMembers += 1;
    if (/^converted$/i.test(pick(row, "Conversion Status"))) outcome.converted += 1;
    if (/^retained$/i.test(pick(row, "Retention Status"))) outcome.retained += 1;
    memberOutcomes.set(key, outcome);
  });
  memberOutcomes.forEach((outcome, key) => {
    const current = map.get(key);
    if (!current) return;
    current.newMembers = outcome.newMembers;
    current.converted = outcome.converted;
    current.retained = outcome.retained;
  });
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function aggregateTeachers(months: TeacherMonth[], month: string): TeacherTotal[] {
  const scoped = month === "all" ? months : months.filter((item) => item.month === month);
  const grouped = new Map<string, TeacherMonth[]>();
  scoped.forEach((item) => grouped.set(item.name, [...(grouped.get(item.name) || []), item]));
  const totals = [...grouped.entries()].map(([name, entries]) => {
    const sum = (key: keyof TeacherMonth) => entries.reduce((total, item) => total + Number(item[key] || 0), 0);
    const sessions = sum("sessions");
    const checkedIn = sum("checkedIn");
    const revenue = sum("revenue");
    const newMembers = sum("newMembers");
    const bookings = sum("bookings");
    const empty = sum("empty");
    return {
      teacherId: entries[0].teacherId, name, email: entries[0].email, rank: 0,
      locations: [...new Set(entries.flatMap((item) => [...item.locations]))], months: [...entries].sort((a, b) => b.month.localeCompare(a.month)),
      cycle: sum("cycle"), strength: sum("strength"), barre: sum("barre"), sessions,
      empty, nonEmpty: sum("nonEmpty"), checkedIn, revenue, newMembers,
      converted: sum("converted"), retained: sum("retained"), bookings, lateCancels: sum("lateCancels"),
      classAvg: sessions ? checkedIn / sessions : 0,
      revPerSession: sessions ? revenue / sessions : 0,
      conversionRate: newMembers ? (sum("converted") / newMembers) * 100 : 0,
      retentionRate: newMembers ? (sum("retained") / newMembers) * 100 : 0,
      lateCancelRate: bookings ? (sum("lateCancels") / bookings) * 100 : 0,
      emptyRate: sessions ? (empty / sessions) * 100 : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.checkedIn - a.checkedIn);
  totals.forEach((teacher, index) => { teacher.rank = index + 1; });
  return totals;
}

const badge = (value: number, good: number, warn: number, suffix = "%") => (
  <span className={cn("num inline-flex rounded-md border px-2 py-0.5 text-[10.5px] font-semibold", value >= good ? "border-pos/20 bg-pos-soft text-pos" : value >= warn ? "border-warn/20 bg-warn-soft text-warn" : "border-neg/20 bg-neg-soft text-neg")}>{dec(value, 1)}{suffix}</span>
);

function columns(): Col<TeacherTotal>[] {
  return [
    { key: "rank", label: "Rank", value: (r) => r.rank, width: "64px", render: (r) => <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-bold", r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank <= 3 ? "bg-loc-soft text-loc" : "bg-surface3 text-lo")}>#{r.rank}</span> },
    { key: "name", label: "Trainer", align: "left", value: (r) => r.name, totalMode: "none", width: "190px", render: (r) => <div className="flex items-center gap-2"><span className="trainer-avatar">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9.5px] text-lo">{r.locations.slice(0, 2).join(" · ")}</small></span></div> },
    { key: "sessions", label: "Classes", value: (r) => r.sessions, fmt: intFmt, heat: true },
    { key: "empty", label: "Empty", value: (r) => r.empty, fmt: intFmt },
    { key: "nonEmpty", label: "Non-empty", value: (r) => r.nonEmpty, fmt: intFmt },
    { key: "newMembers", label: "New", value: (r) => r.newMembers, fmt: intFmt, heat: true },
    { key: "converted", label: "Converted", value: (r) => r.converted, fmt: intFmt },
    { key: "retained", label: "Retained", value: (r) => r.retained, fmt: intFmt },
    { key: "checkedIn", label: "Checked in", value: (r) => r.checkedIn, fmt: intFmt, heat: true },
    { key: "bookings", label: "Bookings", value: (r) => r.bookings, fmt: intFmt },
    { key: "lateCancels", label: "Late cancel", value: (r) => r.lateCancels, fmt: intFmt },
    { key: "conversionRate", label: "Conversion", value: (r) => r.conversionRate, totalMode: "avg", render: (r) => badge(r.conversionRate, 35, 20) },
    { key: "retentionRate", label: "Retention", value: (r) => r.retentionRate, totalMode: "avg", render: (r) => badge(r.retentionRate, 45, 25) },
    { key: "classAvg", label: "Class avg", value: (r) => r.classAvg, fmt: (n) => dec(n, 1), totalMode: "avg" },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "revPerSession", label: "Rev/session", value: (r) => r.revPerSession, fmt: compact, totalMode: "avg" },
  ];
}

function revenueColumns(): Col<TeacherTotal>[] {
  return [
    { key: "rank", label: "Rank", value: (r) => r.rank, width: "64px", render: (r) => <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-bold", r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank <= 3 ? "bg-loc-soft text-loc" : "bg-surface3 text-lo")}>#{r.rank}</span> },
    { key: "name", label: "Trainer", align: "left", value: (r) => r.name, totalMode: "none", width: "190px", render: (r) => <div className="flex items-center gap-2"><span className="trainer-avatar">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9.5px] text-lo">{r.locations.slice(0, 2).join(" · ")}</small></span></div> },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "sessions", label: "Classes", value: (r) => r.sessions, fmt: intFmt },
    { key: "revPerSession", label: "Rev/Class", value: (r) => r.revPerSession, fmt: compact, totalMode: "avg" },
    { key: "checkedIn", label: "Attendance", value: (r) => r.checkedIn, fmt: intFmt },
  ];
}

function sessionsColumns(): Col<TeacherTotal>[] {
  return [
    { key: "rank", label: "Rank", value: (r) => r.rank, width: "64px", render: (r) => <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-bold", r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank <= 3 ? "bg-loc-soft text-loc" : "bg-surface3 text-lo")}>#{r.rank}</span> },
    { key: "name", label: "Trainer", align: "left", value: (r) => r.name, totalMode: "none", width: "190px", render: (r) => <div className="flex items-center gap-2"><span className="trainer-avatar">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9.5px] text-lo">{r.locations.slice(0, 2).join(" · ")}</small></span></div> },
    { key: "sessions", label: "Classes", value: (r) => r.sessions, fmt: intFmt, heat: true },
    { key: "checkedIn", label: "Total Attendance", value: (r) => r.checkedIn, fmt: intFmt },
    { key: "classAvg", label: "Avg Class Size", value: (r) => r.classAvg, fmt: (n) => dec(n, 1), totalMode: "avg" },
    { key: "empty", label: "Empty Classes", value: (r) => r.empty, fmt: intFmt },
  ];
}

function conversionColumns(): Col<TeacherTotal>[] {
  return [
    { key: "rank", label: "Rank", value: (r) => r.rank, width: "64px", render: (r) => <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-bold", r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank <= 3 ? "bg-loc-soft text-loc" : "bg-surface3 text-lo")}>#{r.rank}</span> },
    { key: "name", label: "Trainer", align: "left", value: (r) => r.name, totalMode: "none", width: "190px", render: (r) => <div className="flex items-center gap-2"><span className="trainer-avatar">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9.5px] text-lo">{r.locations.slice(0, 2).join(" · ")}</small></span></div> },
    { key: "conversionRate", label: "Conversion Rate", value: (r) => r.conversionRate, totalMode: "avg", render: (r) => badge(r.conversionRate, 35, 20) },
    { key: "newMembers", label: "New Members", value: (r) => r.newMembers, fmt: intFmt },
    { key: "converted", label: "Converted", value: (r) => r.converted, fmt: intFmt, heat: true },
    { key: "retained", label: "Retained", value: (r) => r.retained, fmt: intFmt },
  ];
}

function retentionColumns(): Col<TeacherTotal>[] {
  return [
    { key: "rank", label: "Rank", value: (r) => r.rank, width: "64px", render: (r) => <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-bold", r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank <= 3 ? "bg-loc-soft text-loc" : "bg-surface3 text-lo")}>#{r.rank}</span> },
    { key: "name", label: "Trainer", align: "left", value: (r) => r.name, totalMode: "none", width: "190px", render: (r) => <div className="flex items-center gap-2"><span className="trainer-avatar">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9.5px] text-lo">{r.locations.slice(0, 2).join(" · ")}</small></span></div> },
    { key: "retentionRate", label: "Retention Rate", value: (r) => r.retentionRate, totalMode: "avg", render: (r) => badge(r.retentionRate, 45, 25) },
    { key: "newMembers", label: "New Members", value: (r) => r.newMembers, fmt: intFmt },
    { key: "retained", label: "Retained", value: (r) => r.retained, fmt: intFmt, heat: true },
    { key: "converted", label: "Converted", value: (r) => r.converted, fmt: intFmt },
  ];
}

function classAvgColumns(): Col<TeacherTotal>[] {
  return [
    { key: "rank", label: "Rank", value: (r) => r.rank, width: "64px", render: (r) => <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-bold", r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank <= 3 ? "bg-loc-soft text-loc" : "bg-surface3 text-lo")}>#{r.rank}</span> },
    { key: "name", label: "Trainer", align: "left", value: (r) => r.name, totalMode: "none", width: "190px", render: (r) => <div className="flex items-center gap-2"><span className="trainer-avatar">{r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span><span><b className="block text-hi">{r.name}</b><small className="text-[9.5px] text-lo">{r.locations.slice(0, 2).join(" · ")}</small></span></div> },
    { key: "classAvg", label: "Avg Class Size", value: (r) => r.classAvg, fmt: (n) => dec(n, 1), totalMode: "avg", heat: true },
    { key: "sessions", label: "Classes", value: (r) => r.sessions, fmt: intFmt },
    { key: "checkedIn", label: "Total Attendance", value: (r) => r.checkedIn, fmt: intFmt },
    { key: "emptyRate", label: "Empty Rate", value: (r) => r.emptyRate, totalMode: "avg", render: (r) => badge(r.emptyRate, 5, 15, "% empty") },
  ];
}

export function TeacherPerformanceSection({ payroll, sessions, members }: { payroll: FlexTable; sessions: SessionRow[]; members: FlexTable }) {
  const monthly = useMemo(() => buildTeacherData(payroll, sessions, members), [payroll, sessions, members]);
  const months = useMemo(() => [...new Set(monthly.map((item) => item.month))].sort().reverse(), [monthly]);
  const [month, setMonth] = useState("all");
  const [selected, setSelected] = useState<TeacherTotal | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const teachers = useMemo(() => aggregateTeachers(monthly, month), [monthly, month]);
  
  // Calculate aggregate stats
  const totalRevenue = teachers.reduce((sum, item) => sum + item.revenue, 0);
  const totalSessions = teachers.reduce((sum, item) => sum + item.sessions, 0);
  const totalNewMembers = teachers.reduce((sum, item) => sum + item.newMembers, 0);
  const totalConverted = teachers.reduce((sum, item) => sum + item.converted, 0);
  const avgConversionRate = totalNewMembers > 0 ? (totalConverted / totalNewMembers) * 100 : 0;
  
  // Rankings by different criteria
  const byRevenue = useMemo(() => [...teachers].sort((a, b) => b.revenue - a.revenue), [teachers]);
  const bySessions = useMemo(() => [...teachers].sort((a, b) => b.sessions - a.sessions), [teachers]);
  const byConversion = useMemo(() => [...teachers].filter(t => t.newMembers > 0).sort((a, b) => b.conversionRate - a.conversionRate), [teachers]);
  const byRetention = useMemo(() => [...teachers].filter(t => t.newMembers > 0).sort((a, b) => b.retentionRate - a.retentionRate), [teachers]);
  const byClassAvg = useMemo(() => [...teachers].sort((a, b) => b.classAvg - a.classAvg), [teachers]);
  
  // MoM data for top performer
  const topTeacher = byRevenue[0];
  const topTeacherMoM = useMemo(() => {
    if (!topTeacher) return [];
    return topTeacher.months.map((item) => ({ label: monthLabel(item.month), revenue: item.revenue, sessions: item.sessions, checkedIn: item.checkedIn }));
  }, [topTeacher]);

  return (
    <div className="space-y-8">
      <SectionHeader index={1} title="Teacher Performance" description="Comprehensive trainer-level analytics: revenue generation, class performance, member conversion, retention outcomes, and month-on-month trends." meta={<span className="source-badge"><span className="source-dot" />Payroll + bookings + members</span>} />
      
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Summary icon={<Users />} label="Active Trainers" value={intFmt(teachers.length)} tone="blue" />
        <Summary icon={<BarChart3 />} label="Total Classes" value={intFmt(totalSessions)} tone="violet" />
        <Summary icon={<TrendingUp />} label="Total Revenue" value={compact(totalRevenue)} tone="emerald" />
        <Summary icon={<Award />} label="Top Performer" value={topTeacher?.name || "—"} sub={topTeacher ? compact(topTeacher.revenue) : undefined} tone="amber" />
        <Summary icon={<Users />} label="New Members" value={intFmt(totalNewMembers)} tone="teal" />
        <Summary icon={<TrendingUp />} label="Avg Conversion" value={pct(avgConversionRate)} tone="rose" />
      </div>

      {/* MoM Performance Section */}
      <SectionHeader index={2} title="Month-on-Month Performance" description="Track how teacher performance evolves over time. Click any trainer row to see detailed month-on-month trends." />
      
      <Panel title="Trainer MoM performance" subtitle={`Showing ${month === "all" ? "all months" : monthLabel(month)} · expand a trainer, then expand any month for its child metrics`} right={
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-lg border border-line bg-surface2 px-3 text-[11px] font-medium text-hi">
            <option value="all">All months</option>
            {months.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}
          </select>
          <Btn active onClick={() => setCompareOpen(true)}>
            <GitCompareArrows className="h-3.5 w-3.5" /> Compare trainers
          </Btn>
        </div>
      }>
        <DataTable cols={columns()} rows={teachers} rowKey={(r) => r.name} defaultSort="revenue" initialLimit={20} csvName="teacher-performance"
          expand={(teacher) => <TeacherMoMTable teacher={teacher} onOpen={() => setSelected(teacher)} />} />
      </Panel>

      {topTeacher && topTeacherMoM.length > 1 && (
        <Panel title={`${topTeacher.name} · MoM trend`} subtitle="The current revenue leader shown here so the trend stays inside the Month-on-Month section.">
          <TrendChart data={[...topTeacherMoM].reverse()} bars={[{ key: "revenue", name: "Revenue" }]} lines={[{ key: "sessions", name: "Classes" }, { key: "checkedIn", name: "Attendance" }]} height={300} />
        </Panel>
      )}

      {/* Rankings by Revenue */}
      <SectionHeader index={3} title="Revenue Rankings" description="Trainers ranked by total revenue generated. Revenue is the primary commercial metric reflecting both class volume and pricing power." />
      <Panel title="Revenue Leaderboard" subtitle="Click any row to view detailed performance breakdown">
        <DataTable cols={revenueColumns()} rows={byRevenue.slice(0, 10)} rowKey={(r) => r.name} defaultSort="revenue" initialLimit={10} onRowClick={setSelected} />
      </Panel>

      {/* Rankings by Sessions */}
      <SectionHeader index={4} title="Class Volume Rankings" description="Trainers ranked by number of classes taught. High volume indicates reliability and scheduling preference." />
      <Panel title="Class Volume Leaderboard" subtitle="Number of classes taught in the selected period">
        <DataTable cols={sessionsColumns()} rows={bySessions.slice(0, 10)} rowKey={(r) => r.name} defaultSort="sessions" initialLimit={10} onRowClick={setSelected} />
      </Panel>

      {/* Conversion & Retention Rankings */}
      <SectionHeader index={5} title="Member Conversion & Retention" description="How effectively trainers convert new members and retain them long-term. These metrics reflect teaching quality and member experience." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Conversion Rate Rankings" subtitle="Percentage of new members converted to paying customers">
          <DataTable cols={conversionColumns()} rows={byConversion.slice(0, 10)} rowKey={(r) => r.name} defaultSort="conversionRate" initialLimit={10} onRowClick={setSelected} />
        </Panel>
        <Panel title="Retention Rate Rankings" subtitle="Percentage of new members retained long-term">
          <DataTable cols={retentionColumns()} rows={byRetention.slice(0, 10)} rowKey={(r) => r.name} defaultSort="retentionRate" initialLimit={10} onRowClick={setSelected} />
        </Panel>
      </div>

      {/* Class Performance */}
      <SectionHeader index={6} title="Class Performance Metrics" description="Average class size and utilization efficiency. Higher class averages indicate better member engagement and scheduling optimization." />
      <Panel title="Class Average Rankings" subtitle="Average number of attendees per class">
        <DataTable cols={classAvgColumns()} rows={byClassAvg.slice(0, 10)} rowKey={(r) => r.name} defaultSort="classAvg" initialLimit={10} onRowClick={setSelected} />
      </Panel>

      <AnimatePresence>{selected && <TrainerModal teacher={selected} allMonths={monthly.filter((item) => item.name === selected.name)} onClose={() => setSelected(null)} />}</AnimatePresence>
      <AnimatePresence>{compareOpen && <CompareModal teachers={aggregateTeachers(monthly, "all")} onClose={() => setCompareOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function Summary({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`teacher-summary teacher-summary-${tone}`}><span className="teacher-summary-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong>{sub && <small>{sub}</small>}</div></motion.div>;
}

interface MonthRow extends TeacherMonth {
  classAvg: number;
  revPerSession: number;
  conversionRate: number;
  retentionRate: number;
  lateCancelRate: number;
}

const toMonthRow = (item: TeacherMonth): MonthRow => ({
  ...item,
  classAvg: item.sessions ? item.checkedIn / item.sessions : 0,
  revPerSession: item.sessions ? item.revenue / item.sessions : 0,
  conversionRate: item.newMembers ? (item.converted / item.newMembers) * 100 : 0,
  retentionRate: item.newMembers ? (item.retained / item.newMembers) * 100 : 0,
  lateCancelRate: item.bookings ? (item.lateCancels / item.bookings) * 100 : 0,
});

function monthColumns(): Col<MonthRow>[] {
  return [
    { key: "month", label: "Month", align: "left", value: (r) => r.month, totalMode: "none", width: "116px", render: (r) => <span className="mom-month-badge"><CalendarDays className="h-3 w-3" />{monthLabel(r.month)}</span> },
    { key: "sessions", label: "Classes", value: (r) => r.sessions, fmt: intFmt },
    { key: "checkedIn", label: "Checked in", value: (r) => r.checkedIn, fmt: intFmt },
    { key: "bookings", label: "Bookings", value: (r) => r.bookings, fmt: intFmt },
    { key: "lateCancels", label: "Late cancels", value: (r) => r.lateCancels, fmt: intFmt },
    { key: "newMembers", label: "New", value: (r) => r.newMembers, fmt: intFmt },
    { key: "converted", label: "Converted", value: (r) => r.converted, fmt: intFmt },
    { key: "retained", label: "Retained", value: (r) => r.retained, fmt: intFmt },
    { key: "classAvg", label: "Class avg", value: (r) => r.classAvg, fmt: (n) => dec(n, 1), totalMode: "avg" },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "revPerSession", label: "Rev/class", value: (r) => r.revPerSession, fmt: compact, totalMode: "avg" },
  ];
}

function TeacherMoMTable({ teacher, onOpen }: { teacher: TeacherTotal; onOpen: () => void }) {
  const rows = teacher.months.map(toMonthRow).sort((a, b) => b.month.localeCompare(a.month));
  return <div className="mom-nested-shell">
    <div className="mom-nested-head">
      <div><p className="kicker">Monthly history</p><h4>{teacher.name}</h4></div>
      <Btn size="xs" active onClick={onOpen}><TrendingUp className="h-3 w-3" /> Open full analysis</Btn>
    </div>
    <DataTable cols={monthColumns()} rows={rows} rowKey={(r) => r.month} defaultSort="month" initialLimit={rows.length} csvName={`${teacher.name}-mom`}
      dense level={1} expand={(row) => <MonthMetricChildren row={row} />} />
  </div>;
}

function MonthMetricChildren({ row }: { row: MonthRow }) {
  const childRows = [
    { group: "Delivery", tone: "violet", primary: `${intFmt(row.sessions)} classes`, secondary: `${intFmt(row.nonEmpty)} non-empty · ${intFmt(row.empty)} empty`, detail: `${intFmt(row.cycle)} Cycle · ${intFmt(row.strength)} Strength · ${intFmt(row.barre)} Barre` },
    { group: "Demand", tone: "blue", primary: `${intFmt(row.checkedIn)} checked in`, secondary: `${intFmt(row.bookings)} bookings · ${intFmt(row.lateCancels)} late cancels`, detail: `${dec(row.classAvg, 1)} class average · ${pct(row.lateCancelRate)} late-cancel rate` },
    { group: "Member outcomes", tone: "emerald", primary: `${intFmt(row.newMembers)} new members`, secondary: `${intFmt(row.converted)} converted · ${intFmt(row.retained)} retained`, detail: `${pct(row.conversionRate)} conversion · ${pct(row.retentionRate)} retention` },
    { group: "Commercial", tone: "amber", primary: compact(row.revenue), secondary: `${compact(row.revPerSession)} per class`, detail: `${row.locations.size} location${row.locations.size === 1 ? "" : "s"} · ${[...row.locations].join(" · ") || "No location recorded"}` },
  ];
  return <div className="mom-child-grid">{childRows.map((child) => <div key={child.group} className={`mom-child-card mom-child-${child.tone}`}><span className="mom-child-icon"><Layers3 className="h-3.5 w-3.5" /></span><div><p>{child.group}</p><strong>{child.primary}</strong><span>{child.secondary}</span><small>{child.detail}</small></div></div>)}</div>;
}

function TrainerModal({ teacher, allMonths, onClose }: { teacher: TeacherTotal; allMonths: TeacherMonth[]; onClose: () => void }) {
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const sortedMonths = [...allMonths].sort((a, b) => b.month.localeCompare(a.month));
  const data = [...sortedMonths].reverse().map((item) => ({ label: monthLabel(item.month), value: metricValue(item, metric) }));
  return <ModalShell title={teacher.name} subtitle={`Rank #${teacher.rank} · ${teacher.locations.join(" · ")}`} onClose={onClose}>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
      ["Classes", intFmt(teacher.sessions)], ["Checked in", intFmt(teacher.checkedIn)], ["Bookings", intFmt(teacher.bookings)], ["Late cancels", intFmt(teacher.lateCancels)],
      ["New members", intFmt(teacher.newMembers)], ["Converted", intFmt(teacher.converted)], ["Retained", intFmt(teacher.retained)], ["Revenue", compact(teacher.revenue)],
    ].map(([label, value]) => <div key={label} className="mini-stat"><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="panel overflow-hidden"><div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3"><b className="mr-auto text-[12px] text-hi">Month-on-month performance</b>{metricOptions.map((option) => <Btn key={option.key} size="xs" active={metric === option.key} onClick={() => setMetric(option.key)}>{option.label}</Btn>)}</div><TrendChart data={data} bars={[{ key: "value", name: metricOptions.find((o) => o.key === metric)?.label || metric }]} height={260} /><div className="border-t border-line"><DataTable cols={monthColumns()} rows={sortedMonths.map(toMonthRow)} rowKey={(r) => r.month} defaultSort="month" initialLimit={sortedMonths.length} csvName={`${teacher.name}-mom-detail`} dense level={1} expand={(row) => <MonthMetricChildren row={row} />} /></div></div>
  </ModalShell>;
}

function CompareModal({ teachers, onClose }: { teachers: TeacherTotal[]; onClose: () => void }) {
  const [leftName, setLeftName] = useState(teachers[0]?.name || "");
  const [rightName, setRightName] = useState(teachers[1]?.name || teachers[0]?.name || "");
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const left = teachers.find((item) => item.name === leftName);
  const right = teachers.find((item) => item.name === rightName);
  const months = [...new Set([...(left?.months || []), ...(right?.months || [])].map((item) => item.month))].sort();
  const data = months.map((month) => ({ label: monthLabel(month), left: metricValue(left?.months.find((item) => item.month === month), metric), right: metricValue(right?.months.find((item) => item.month === month), metric) }));
  return <ModalShell title="Trainer comparison" subtitle="Side-by-side outcomes and month-on-month trend" onClose={onClose} wide>
    <div className="grid gap-3 sm:grid-cols-2"><TrainerSelect label="Trainer A" value={leftName} onChange={setLeftName} teachers={teachers} /><TrainerSelect label="Trainer B" value={rightName} onChange={setRightName} teachers={teachers} /></div>
    <div className="flex flex-wrap gap-2">{metricOptions.map((option) => <Btn key={option.key} size="xs" active={metric === option.key} onClick={() => setMetric(option.key)}>{option.label}</Btn>)}</div>
    <div className="panel p-2"><TrendChart data={data} lines={[{ key: "left", name: leftName }, { key: "right", name: rightName, color: "rgb(var(--loc-2))" }]} height={320} /></div>
    <div className="grid gap-3 sm:grid-cols-2">{[left, right].map((trainer) => trainer && <div key={trainer.name} className="comparison-card"><span className="trainer-avatar"><Medal className="h-3.5 w-3.5" /></span><div><b>{trainer.name}</b><p>#{trainer.rank} · {intFmt(trainer.sessions)} classes · {compact(trainer.revenue)} revenue · {pct(trainer.conversionRate)} conversion</p></div></div>)}</div>
  </ModalShell>;
}

const metricOptions: { key: MetricKey; label: string }[] = [
  { key: "revenue", label: "Revenue" }, { key: "sessions", label: "Classes" }, { key: "checkedIn", label: "Checked in" },
  { key: "bookings", label: "Bookings" }, { key: "lateCancels", label: "Late cancels" }, { key: "classAvg", label: "Class avg" },
  { key: "conversionRate", label: "Conversion" }, { key: "retentionRate", label: "Retention" },
];
function metricValue(item: TeacherMonth | undefined, metric: MetricKey) {
  if (!item) return 0;
  if (metric === "classAvg") return item.sessions ? item.checkedIn / item.sessions : 0;
  if (metric === "conversionRate") return item.newMembers ? (item.converted / item.newMembers) * 100 : 0;
  if (metric === "retentionRate") return item.newMembers ? (item.retained / item.newMembers) * 100 : 0;
  return item[metric];
}
function TrainerSelect({ label, value, onChange, teachers }: { label: string; value: string; onChange: (value: string) => void; teachers: TeacherTotal[] }) {
  return <label className="text-[10px] font-semibold uppercase tracking-wider text-lo">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-line bg-surface2 px-3 text-[12px] normal-case tracking-normal text-hi">{teachers.map((teacher) => <option key={teacher.name}>{teacher.name}</option>)}</select></label>;
}
function ModalShell({ title, subtitle, onClose, wide, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} className={cn("max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-line bg-app shadow-lg", wide ? "max-w-6xl" : "max-w-4xl")}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur"><div><h2 className="font-display text-lg font-semibold text-hi">{title}</h2><p className="mt-0.5 text-[11px] text-lo">{subtitle}</p></div><button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl border border-line text-lo transition-colors hover:bg-surface2 hover:text-hi"><X className="h-4 w-4" /></button></header><div className="space-y-4 p-5">{children}</div></motion.div></motion.div>;
}
