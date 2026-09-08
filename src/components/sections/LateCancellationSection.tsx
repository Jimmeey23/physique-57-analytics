import { useMemo, useState } from "react";
import type { FlexTable } from "../../lib/sessions";
import { intFmt, pct, compact } from "../../lib/format";
import { cn } from "../../utils/cn";
import { MetricCard } from "../MetricCard";
import type { KPI } from "../../lib/analytics";
import { Panel, SectionHeader, Btn } from "../ui";
import { DataTable, type Col } from "../DataTable";
import { TrendChart, Donut, RankBars } from "../Charts";
import { DetailModal, ModalStat, ModalSection } from "../DetailModal";

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

export function LateCancellationSection({ bookings, kpis }: { bookings: FlexTable; kpis: KPI[] }) {
  const records = useMemo(() => parseBookings(bookings), [bookings]);
  const [tab, setTab] = useState<"late" | "all_cancelled" | "noshow">("late");
  const [selected, setSelected] = useState<BookingRecord | null>(null);

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
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <MetricCard key={k.id} kpi={k} index={i} />
        ))}
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
        subtitle={`${intFmt(displayed.length)} records · click a row for details`}
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
          onRowClick={setSelected}
        />
      </Panel>

      <DetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.customerName || "Record Details"}
        subtitle={selected?.customerEmail}
      >
        {selected && <LateCancelDetail record={selected} />}
      </DetailModal>
    </div>
  );
}

/* ── Components ── */

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

function LateCancelDetail({ record: r }: { record: BookingRecord }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModalStat
          label="Late Cancel"
          value={r.lateCancelled ? "Yes" : "No"}
          accent={r.lateCancelled ? "warn" : undefined}
        />
        <ModalStat
          label="Cancelled"
          value={r.cancelled ? "Yes" : "No"}
          accent={r.cancelled ? "neg" : undefined}
        />
        <ModalStat
          label="No Show"
          value={r.noShow ? "Yes" : "No"}
          accent={r.noShow ? "neg" : undefined}
        />
        <ModalStat label="Sale Value" value={compact(r.saleValue)} />
        <ModalStat label="Class" value={r.cleanedClass || "—"} accent="loc" />
        <ModalStat label="Teacher" value={r.teacherName || "—"} />
        <ModalStat label="Session Date" value={r.sessionDate || "—"} />
        <ModalStat label="Time Slot" value={r.timeSlot || "—"} />
        <ModalStat label="Location" value={r.location || "—"} />
        <ModalStat label="Day of Week" value={r.dayOfWeek || "—"} />
        <ModalStat label="Payment Method" value={r.paymentMethod || "—"} />
        <ModalStat label="Membership" value={r.membershipUsed || "—"} />
      </div>

      <ModalSection title="Cancellation Timeline">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-lo">Sale Date</p>
            <p className="mt-1 font-display text-base font-bold text-hi">{r.saleDate || "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-lo">Session Date</p>
            <p className="mt-1 font-display text-base font-bold text-hi">{r.sessionDate || "—"}</p>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Member & Sale Info">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] text-lo">Customer Name</span>
            <span className="text-[11px] font-medium text-hi">{r.customerName || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] text-lo">Email</span>
            <span className="text-[11px] font-medium text-hi">{r.customerEmail || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] text-lo">Sale Item</span>
            <span className="text-[11px] font-medium text-hi">{r.saleItem || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] text-lo">Sold By</span>
            <span className="text-[11px] font-medium text-hi">{r.soldBy || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] text-lo">Member ID</span>
            <span className="text-[11px] font-medium text-hi font-mono">{r.memberId || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-[11px] text-lo">New Member</span>
            <span className="text-[11px] font-medium text-hi">{r.isNew || "—"}</span>
          </div>
        </div>
      </ModalSection>
    </div>
  );
}
