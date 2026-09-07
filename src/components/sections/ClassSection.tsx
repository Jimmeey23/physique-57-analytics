import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Target, TrendingUp } from "lucide-react";
import {
  aggregateSlots, computeClassKPIs, detectChanges, formatStats, sessionInLocations,
  teacherStats, type FlexTable, type FormatStat, type ScheduleChange, type SessionRow,
  type SlotAgg, type TeacherStat,
} from "../../lib/sessions";
import { formatHex } from "../../lib/theme";
import { compact, dec, intFmt, pct } from "../../lib/format";
import { DataTable, type Col } from "../DataTable";
import { Delta, Panel, Segmented, Tip } from "../ui";
import { Narrative } from "../tableKit";
import { Donut, RankBars, TrendChart } from "../Charts";
import { MetricCard } from "../MetricCard";
import { cn } from "../../utils/cn";
import { applyClassFilters, type ClassFilterState } from "../ClassFilters";

type Mode = "uid1" | "uid2";

const KIND_STYLE: Record<string, { icon: any; rule: string; text: string; label: string }> = {
  win: { icon: CheckCircle2, rule: "border-l-[rgb(var(--pos))]", text: "text-pos", label: "What worked" },
  risk: { icon: AlertTriangle, rule: "border-l-[rgb(var(--neg))]", text: "text-neg", label: "Red flag" },
  trend: { icon: TrendingUp, rule: "border-l-[rgb(var(--loc))]", text: "text-loc", label: "Pattern" },
  action: { icon: Target, rule: "border-l-[rgb(var(--warn))]", text: "text-warn", label: "Action" },
};

interface Props {
  sessions: SessionRow[];
  locations: string[];
  recurring: FlexTable;
  teacherRecurring: FlexTable;
  dark: boolean;
  filters: ClassFilterState;
}

export function ClassSection({ sessions, locations, recurring, teacherRecurring, dark, filters }: Props) {
  const [mode, setMode] = useState<Mode>("uid1");
  const [rankBy, setRankBy] = useState<"composite" | "fillRate" | "classAvg" | "revenue">("composite");

  const maxDate = useMemo(() => {
    const t = sessions.map((r) => r.dateObj?.getTime() || 0).filter(Boolean);
    return t.length ? new Date(Math.max(...t)) : new Date();
  }, [sessions]);

  /* location-scoped, date-independent — feeds the full-history trend */
  const locRows = useMemo(() => sessions.filter((r) => sessionInLocations(r, locations)), [sessions, locations]);
  /* fully filtered — feeds everything else */
  const rows = useMemo(() => applyClassFilters(locRows, filters, maxDate), [locRows, filters, maxDate]);

  const minSess = filters.minSessions || "1";
  const kpis = useMemo(() => computeClassKPIs(rows), [rows]);
  const slots = useMemo(
    () => aggregateSlots(rows, mode).filter((s) => s.sessions >= parseInt(minSess)),
    [rows, mode, minSess]
  );
  const ranked = useMemo(() => [...slots].sort((a, b) => b[rankBy] - a[rankBy]), [slots, rankBy]);
  const teachers = useMemo(() => teacherStats(rows), [rows]);
  const formats = useMemo(() => formatStats(rows), [rows]);
  const changes = useMemo(() => detectChanges(rows), [rows]);

  const monthly = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    locRows.forEach((r) => {
      if (!r.ym) return;
      const a = m.get(r.ym);
      if (a) a.push(r);
      else m.set(r.ym, [r]);
    });
    const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, list]) => {
        const cap = list.reduce((s, r) => s + r.capacity, 0) || 1;
        const [y, mo] = ym.split("-");
        return {
          label: `${M[+mo - 1]} ${y.slice(2)}`,
          sessions: list.length,
          fillRate: (list.reduce((s, r) => s + r.checkedIn, 0) / cap) * 100,
          checked: list.reduce((s, r) => s + r.checkedIn, 0),
          revenue: list.reduce((s, r) => s + r.revenue, 0),
        };
      });
  }, [locRows]);

  const fColors = useMemo(() => {
    const m: Record<string, string> = {};
    formats.forEach((f) => (m[f.key] = formatHex(f.label, dark)));
    return m;
  }, [formats, dark]);

  const fmtTrend = useMemo(() => {
    const yms = Array.from(new Set(formats.flatMap((f) => f.monthly.map((x) => x.ym)))).sort();
    return yms.map((ym) => {
      const row: any = { label: formats.flatMap((f) => f.monthly).find((x) => x.ym === ym)?.label || ym };
      formats.forEach((f) => {
        row[f.key] = f.monthly.find((x) => x.ym === ym)?.fill || 0;
      });
      return row;
    });
  }, [formats]);

  /* ---------- timetable heatmap (gray only) ---------- */
  const table = useMemo(() => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const grid = days.map(() => hours.map(() => ({ fill: [] as number[], n: 0 })));
    rows.forEach((r) => {
      const di = (r.dow + 6) % 7;
      const h = Math.floor(r.hour);
      const hi = hours.indexOf(h);
      if (di < 0 || hi < 0) return;
      grid[di][hi].fill.push(r.fillRate);
      grid[di][hi].n += 1;
    });
    return { days, hours, grid };
  }, [rows]);

  const insights = useMemo(
    () => buildClassInsights(slots, formats, teachers, changes, rows),
    [slots, formats, teachers, changes, rows]
  );
  const recs = useMemo(() => buildClassRecs(slots, formats, teachers, rows), [slots, formats, teachers, rows]);

  const coverage = useMemo(() => coveragePanel(rows, recurring), [rows, recurring]);
  const load = useMemo(() => teacherLoadPanel(rows, teacherRecurring), [rows, teacherRecurring]);

  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totalChecked = rows.reduce((s, r) => s + r.checkedIn, 0);
  const totalCap = rows.reduce((s, r) => s + r.capacity, 0) || 1;

  return (
    <div className="space-y-12">
      {/* ═══ KPI STRIP ═══ */}
      <div id="c-overview" className="scroll-mt-44">
        <SubHead n="01" title="Class KPI Strip" desc="Trailing-30-day performance with prior-30-day deltas. Click any card for the comparison." />
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {kpis.map((k, i) => (
            <MetricCard key={k.id} kpi={k} index={i} spark={monthly.map((m) => m.revenue).slice(-8)} />
          ))}
        </div>
      </div>

      {/* ═══ TREND + MIX ═══ */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Class Trend — Full History"
          subtitle="Sessions, attendance and revenue across every month on record"
          tip="Always spans the full session history. Location, format and teacher selections still apply.">
          <TrendChart
            data={monthly}
            bars={[{ key: "revenue", name: "Revenue" }]}
            lines={[{ key: "fillRate", name: "Fill %" }, { key: "checked", name: "Checked-in" }]}
            height={300}
          />
          <Narrative lines={[
            <>Across {monthly.length} months, {intFmt(rows.length)} sessions drew {intFmt(totalChecked)} heads at {pct((totalChecked / totalCap) * 100)} blended fill and {compact(totalRev)} revenue. When the revenue bars rise while the fill line stays flat, growth came from adding sessions — not from fuller rooms.</>,
          ]} />
        </Panel>
        <Panel title="Revenue by Format" subtitle="Share of class revenue">
          <Donut data={formats.map((f) => ({ name: f.label, value: f.revenue }))} height={286} inner={62}
            colors={formats.map((f) => fColors[f.key])} />
          <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-mid">
            <b className="text-hi">{formats[0]?.label}</b> leads with {pct(formats[0]?.share || 0)} ({compact(formats[0]?.revenue || 0)}).
            {formats[1] && <> Second is <b className="text-hi">{formats[1].label}</b> at {pct(formats[1].share)}.</>} Format colours are fixed: Barre blue, PowerCycle purple, Strength green.
          </p>
        </Panel>
      </div>

      {/* ═══ SLOT RANKINGS ═══ */}
      <div id="c-slots" className="scroll-mt-44">
        <SubHead n="02" title="Slot Rankings" desc="Every repeating slot ranked by composite score, fill, class average or revenue. UID1 = class + day + time + location. UID2 adds the teacher." />
        <Panel title={mode === "uid1" ? "Slots by UID1 — Class · Day · Time · Location" : "Slots by UID2 — Class · Day · Time · Location · Teacher"}
          subtitle={`${ranked.length} slots · ${intFmt(rows.length)} sessions in scope`}
          tip="Composite = fill 35 · revenue/session 25 · show-up 15 · consistency 15 · trend 10. Expand any row for the teacher split and the session history."
          right={
            <>
              <Segmented value={mode} onChange={(v) => setMode(v)}
                options={[{ value: "uid1", label: "UID1 · slot" }, { value: "uid2", label: "UID2 · slot + teacher" }]} />
              <Segmented value={rankBy} onChange={(v) => setRankBy(v)}
                options={[
                  { value: "composite", label: "★ Composite" },
                  { value: "fillRate", label: "Fill %" },
                  { value: "classAvg", label: "Class avg" },
                  { value: "revenue", label: "Revenue" },
                ]} />
            </>
          }>
          <DataTable key={`${mode}-${rankBy}`} cols={slotCols()} rows={ranked}
            rowKey={(r) => r.key} defaultSort={rankBy} csvName={`slots-${mode}`} initialLimit={14} maxHeight="600px"
            expand={(s) => <SlotDrill slot={s} mode={mode} dark={dark} />} />
          <Narrative tone="amber" lines={slotNarrative(ranked)} />
        </Panel>
      </div>

      {/* ═══ TEACHERS ═══ */}
      <div id="c-teachers" className="scroll-mt-44">
        <SubHead n="03" title="Teacher Leaderboard" desc="Fill, consistency and revenue per instructor — expand for their slots and session history." />
        <Panel title="Teacher Performance" subtitle={`${teachers.length} instructors in scope`}
          tip="Consistency = 100 minus the coefficient of variation of heads per session. Trend = last-third fill minus first-third fill.">
          <DataTable cols={teacherCols()} rows={teachers} rowKey={(r) => r.name}
            csvName="class-teachers" initialLimit={12}
            expand={(t) => <TeacherDrill t={t} dark={dark} />} />
          <Narrative lines={teacherNarrative(teachers)} />
        </Panel>
      </div>

      {/* ═══ FORMAT BATTLE ═══ */}
      <div id="c-formats" className="scroll-mt-44">
        <SubHead n="04" title="Format Battle — Barre 57 vs PowerCycle vs Strength Lab" desc="Head-to-head economics, prime-time behaviour and monthly momentum." />
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel className="lg:col-span-2" title="Monthly Fill by Format" subtitle="Who is gaining momentum, who is fading">
            <TrendChart data={fmtTrend}
              lines={formats.map((f) => ({ key: f.key, name: f.label, color: fColors[f.key] }))}
              height={290} />
          </Panel>
          <Panel title="Revenue per Session" subtitle="Ticket power per class held">
            <RankBars data={formats.map((f) => ({ name: f.label, value: f.revPerSession }))} height={290} />
          </Panel>
        </div>
        <Panel title="Format Scorecard" subtitle="Full economics per format — expand for monthly detail and top slots"
          tip="Prime = weekday 6:30–10:30 & 17:00–20:30, weekend 8:00–13:30. A large prime/off gap means the format is schedule-sensitive.">
          <DataTable cols={formatCols(fColors)} rows={formats} rowKey={(r) => r.key}
            csvName="format-battle" initialLimit={8}
            expand={(f) => <FormatDrill f={f} rows={rows} fColor={fColors[f.key]} />} />
          <Narrative tone="emerald" lines={formatNarrative(formats)} />
        </Panel>
      </div>

      {/* ═══ SCHEDULE CHANGES ═══ */}
      <div id="c-changes" className="scroll-mt-44">
        <SubHead n="05" title="Schedule Changes — What Worked, What Didn't" desc="Teacher swaps, launches, retirements, moves and capacity changes with before/after evidence." />
        <Panel title="Change Log with Evidence" subtitle={`${changes.length} detected changes · sorted by magnitude`}
          tip="Before/after windows are ±4 sessions around the change date. ±5pp is the significance threshold.">
          <DataTable cols={changeCols()} rows={changes} rowKey={(r) => r.kind + r.slot + r.date}
            defaultSort="deltaPP" csvName="schedule-changes" initialLimit={12}
            expand={(c) => <ChangeDrill c={c} />} />
          <Narrative tone={changes.some((c) => c.verdict === "didn't") ? "amber" : "violet"}
            lines={changeNarrative(changes)} />
        </Panel>
      </div>

      {/* ═══ TIMETABLE ═══ */}
      <div id="c-timetable" className="scroll-mt-44">
        <SubHead n="06" title="Timetable Heatmap" desc="Average fill by weekday and hour — gray scale. Darker = fuller." />
        <Panel title="Fill by Day × Hour" subtitle="Average fill rate across all sessions in the cell"
          tip="Use this to place new slots: strong neighbours mean proven demand at that hour; pale bands are where to test, discount or restaff.">
          <div className="overflow-x-auto p-3">
            <div className="min-w-[640px]">
              <div className="mb-1 flex gap-[2px] pl-14">
                {table.hours.map((h) => (
                  <div key={h} className="flex-1 text-center text-[8px] text-lo">{h % 2 === 0 ? `${h}:00` : ""}</div>
                ))}
              </div>
              {table.days.map((d, di) => (
                <div key={d} className="mb-[2px] flex items-center gap-[2px]">
                  <div className="w-14 shrink-0 text-[9.5px] text-lo">{d.slice(0, 3)}</div>
                  {table.hours.map((h, hi) => {
                    const cell = table.grid[di][hi];
                    const avg = cell.fill.length ? cell.fill.reduce((s, n) => s + n, 0) / cell.fill.length : 0;
                    const r = avg / 100;
                    return (
                      <Tip key={h} className="flex-1"
                        text={cell.n ? `${d} ${h}:00 — ${avg.toFixed(0)}% avg fill across ${cell.n} sessions` : `${d} ${h}:00 — no sessions`} >
                        <div className="heat-cell h-6 w-full rounded-[3px]" style={{
                          minWidth: 16,
                          background: cell.n
                            ? `color-mix(in srgb, rgb(100 116 139) ${(6 + r * 46).toFixed(1)}%, rgb(var(--surface-2)))`
                            : "rgb(var(--surface-2))",
                          opacity: cell.n ? 1 : 0.45,
                        }} />
                      </Tip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <Narrative lines={[
            <>Prime bands (weekday mornings/evenings, weekend mid-mornings) should read darkest. Any dark cell at an off-peak hour is a proven outlier — protect that teacher and time. Any pale cell in a prime band is a scheduling failure, not a demand failure.</>,
            <>Compare this grid against the slot rankings: the weakest slots almost always sit in pale cells. Moving them into adjacent darker hours typically lifts fill 8–15pp with zero marketing spend.</>,
          ]} />
        </Panel>
      </div>

      {/* ═══ LEDGER ═══ */}
      <div id="c-ledger" className="scroll-mt-44">
        <SubHead n="07" title="Session Ledger" desc="Every class held, with the full record on expand. The source of truth behind every aggregate above." />
        <Panel title="All Sessions" subtitle={`${intFmt(rows.length)} sessions`}>
          <DataTable cols={sessionCols()} rows={rows} rowKey={(r) => r.sessionId + r.date}
            defaultSort="date" csvName="session-ledger" initialLimit={15} maxHeight="620px"
            expand={(r) => <SessionRecord r={r} />} />
        </Panel>
      </div>

      {/* ═══ RECURRING / LOAD ═══ */}
      <div id="c-schedule" className="scroll-mt-44">
        <SubHead n="08" title="Recurring Schedule vs Actuals" desc="What the timetable promises versus what actually ran — coverage gaps and teacher load." />
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Slot Coverage" subtitle="Expected weekly slots vs sessions held in the last 4 weeks">
            <DataTable cols={coverageCols()} rows={coverage} rowKey={(r: any) => r.slot}
              csvName="slot-coverage" initialLimit={10} dense level={1} />
            <Narrative tone="amber" lines={[
              coverage.length
                ? <>Coverage below 90% on an Active slot means cancellations or missing teachers — each missed session is lost revenue that can never be recovered. Slots marked Moved/Retired in the recurring feed should show zero recent sessions; any activity there is a data or scheduling hygiene issue.</>
                : <>No recurring feed available — coverage is derived from recent session activity. Connect the recurring sheet to compare the promised timetable against actuals.</>,
            ]} />
          </Panel>
          <Panel title="Teacher Load" subtitle="Scheduled vs actual teaching load">
            <DataTable cols={loadCols()} rows={load} rowKey={(r: any) => r.teacher}
              csvName="teacher-load" initialLimit={10} dense level={1} />
            <Narrative lines={[
              <>Teachers running well above their scheduled load burn out; teachers well below it are under-utilised capacity. Pair this table with the leaderboard — a top-fill teacher with spare capacity is your best lever for new slots.</>,
            ]} />
          </Panel>
        </div>
      </div>

      {/* ═══ INSIGHTS ═══ */}
      <div id="c-insights" className="scroll-mt-44">
        <SubHead n="09" title="Class Insights & Recommendations" desc="Auto-generated from the session data — patterns, red flags and a prioritised action list." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((ins, i) => {
            const k = KIND_STYLE[ins.kind];
            const Icon = k.icon;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.35) }}
                className={cn("card border-l-[3px] p-4", k.rule)}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5", k.text)} />
                  <span className={cn("font-mono text-[9px] font-semibold uppercase tracking-[0.14em]", k.text)}>{k.label}</span>
                </div>
                <h4 className="mb-2 font-display text-[14px] font-bold leading-snug text-hi">{ins.title}</h4>
                <p className="text-[12px] leading-relaxed text-lo">{ins.body}</p>
              </motion.div>
            );
          })}
        </div>
        <Panel title="Prioritised Class Actions" subtitle="Ranked by modelled revenue impact"
          tip="Impact is modelled from live session data using the conservative assumptions stated in each row.">
          <DataTable cols={recCols()} rows={recs} rowKey={(r: any) => r.action}
            defaultSort="impact" csvName="class-recommendations" initialLimit={10} />
          <Narrative tone="emerald" lines={[
            <>Total modelled upside is <b>{compact(recs.reduce((s, r) => s + r.impact, 0))}</b> — {pct((recs.reduce((s, r) => s + r.impact, 0) / Math.max(1, totalRev)) * 100)} of current class revenue. Start with no-show recovery and bottom-slot repair: both need no new demand.</>,
          ]} />
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════ Sub header ═══════════════ */

function SubHead({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="mb-4 flex items-start gap-4 border-l-[3px] border-l-[rgb(var(--loc))] pl-4">
      <span className="num mt-0.5 rounded-lg bg-loc-soft px-2.5 py-1.5 text-[11px] font-bold text-loc">{n}</span>
      <div>
        <h3 className="font-display text-[22px] font-bold leading-tight tracking-tight text-hi">{title}</h3>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-lo">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════ Slot table ═══════════════ */

function slotCols(): Col<SlotAgg>[] {
  return [
    { key: "label", label: "Slot", align: "left", value: (r) => r.label, totalMode: "none", width: "210px",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-hi">{r.label}</p>
          <p className="truncate font-mono text-[9px] text-lo">{r.key}</p>
        </div>
      ) },
    { key: "format", label: "Format", align: "left", value: (r) => r.format, totalMode: "none" },
    { key: "location", label: "Location", align: "left", value: (r) => r.location, totalMode: "none" },
    { key: "sessions", label: "Sess", value: (r) => r.sessions, fmt: intFmt },
    { key: "checked", label: "Heads", value: (r) => r.checked, fmt: intFmt, heat: true },
    { key: "fillRate", label: "Fill %", value: (r) => r.fillRate, fmt: (n) => pct(n), heat: true, totalMode: "avg",
      render: (r) => <span className={cn("num font-semibold", r.fillRate >= 80 ? "text-pos" : r.fillRate >= 55 ? "text-warn" : "text-neg")}>{pct(r.fillRate)}</span> },
    { key: "classAvg", label: "Class Avg", value: (r) => r.classAvg, fmt: (n) => dec(n, 1), totalMode: "avg" },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "revPerSession", label: "Rev/Sess", value: (r) => r.revPerSession, fmt: compact, totalMode: "avg" },
    { key: "showRate", label: "Show %", value: (r) => r.showRate, fmt: (n) => pct(n), totalMode: "avg" },
    { key: "consistency", label: "Consist.", value: (r) => r.consistency, fmt: (n) => pct(n, 0), totalMode: "avg",
      tip: "100 minus volatility of heads per session. High = predictable demand." },
    { key: "trendPP", label: "Trend", value: (r) => r.trendPP, fmt: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}pp`, totalMode: "none",
      render: (r) => <Delta value={r.trendPP} /> },
    { key: "composite", label: "★ Score", value: (r) => r.composite, fmt: (n) => dec(n, 1), heat: true, totalMode: "avg",
      tip: "Composite = fill 35 · revenue/session 25 · show-up 15 · consistency 15 · trend 10." },
  ];
}

function SlotDrill({ slot, mode, dark }: { slot: SlotAgg; mode: Mode; dark: boolean }) {
  const byTeacher = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    slot.rows.forEach((r) => {
      const a = m.get(r.trainerName);
      if (a) a.push(r);
      else m.set(r.trainerName, [r]);
    });
    return Array.from(m.entries()).map(([t, rs]) => {
      const cap = rs.reduce((s, r) => s + r.capacity, 0) || 1;
      return {
        teacher: t,
        sessions: rs.length,
        fill: (rs.reduce((s, r) => s + r.checkedIn, 0) / cap) * 100,
        avg: rs.reduce((s, r) => s + r.checkedIn, 0) / rs.length,
        rev: rs.reduce((s, r) => s + r.revenue, 0),
        rows: rs,
      };
    }).sort((a, b) => b.fill - a.fill);
  }, [slot]);
  const fColor = formatHex(slot.format, dark);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-lo">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1">
          <span className="h-2 w-2 rounded-full" style={{ background: fColor }} />
          <b className="text-hi">{slot.format}</b>
        </span>
        <span>First held <b className="text-hi">{slot.firstDate || "—"}</b></span>
        <span>Last held <b className="text-hi">{slot.lastDate || "—"}</b></span>
        <span>No-show <b className="text-hi">{pct(slot.noShowRate)}</b></span>
        <span>Comp <b className="text-hi">{pct(slot.compShare)}</b></span>
        <span>Late cancels <b className="text-hi">{intFmt(slot.lateCancelled)}</b></span>
      </div>
      {mode === "uid1" && byTeacher.length > 1 && (
        <div className="tbl-drill-inner">
          <p className="border-b border-line px-3 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-widest text-lo">
            Teacher split — same slot, different instructors
          </p>
          <DataTable
            cols={[
              { key: "teacher", label: "Teacher", align: "left", value: (r: any) => r.teacher, totalMode: "none" },
              { key: "sessions", label: "Sess", value: (r: any) => r.sessions, fmt: intFmt },
              { key: "fill", label: "Fill %", value: (r: any) => r.fill, fmt: (n: number) => pct(n), render: (r: any) => <span className={r.fill >= 75 ? "text-pos" : r.fill >= 55 ? "text-warn" : "text-neg"}>{pct(r.fill)}</span> },
              { key: "avg", label: "Avg", value: (r: any) => r.avg, fmt: (n: number) => dec(n, 1) },
              { key: "rev", label: "Revenue", value: (r: any) => r.rev, fmt: compact },
            ]}
            rows={byTeacher} rowKey={(r: any) => r.teacher} csvName="slot-teachers" initialLimit={6} dense level={1} />
        </div>
      )}
      <div className="tbl-drill-inner">
        <p className="border-b border-line px-3 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-widest text-lo">
          Session history ({slot.sessions})
        </p>
        <DataTable cols={sessionCols()} rows={slot.rows} rowKey={(r) => r.sessionId + r.date}
          csvName="slot-sessions" initialLimit={8} dense level={1} />
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-lo">
        <b className="text-hi">{slot.label}</b> averages {dec(slot.classAvg, 1)} heads at {pct(slot.fillRate)} fill.
        {slot.trendPP >= 5 ? " Momentum is strongly positive — protect this time and teacher." : slot.trendPP <= -5 ? " The trend is deteriorating — check for a teacher, time or competition change before it compounds." : " Trend is flat — stable but not growing."}
        {slot.noShowRate > 15 ? ` No-shows at ${pct(slot.noShowRate)} are blocking real demand — tighten the cancellation policy.` : ""}
      </p>
    </div>
  );
}

function slotNarrative(ranked: SlotAgg[]): React.ReactNode[] {
  if (!ranked.length) return [<>No slots in scope — loosen the filters.</>];
  const top = ranked[0];
  const weak = ranked.filter((s) => s.sessions >= 4 && s.fillRate < 50);
  const full = ranked.filter((s) => s.sessions >= 4 && s.fillRate > 95);
  const volatile = ranked.filter((s) => s.sessions >= 6 && s.consistency < 45);
  return [
    <><b>{top.label}</b> leads on composite ({dec(top.composite, 1)}) with {pct(top.fillRate)} fill and {compact(top.revPerSession)} per session. Study it: the format, hour and teacher combination here is the template to replicate.</>,
    weak.length
      ? <><b>{weak.length} slots fill under 50%</b> with 4+ sessions of evidence. These are not slow starters — they are structurally weak times, prices or teachers. Move, merge or retire them.</>
      : <>No slot with 4+ sessions sits under 50% fill — the timetable has no structural dead weight right now.</>,
    full.length
      ? <><b>{full.length} slots run above 95% fill</b> — demand is being turned away. Add capacity, a second section, or dynamic pricing before members learn that booking is pointless.</>
      : <>Nothing is capacity-constrained above 95% — growth must come from filling rooms, not adding them.</>,
    volatile.length
      ? <><b>{volatile.length} slots are highly volatile</b> (consistency under 45). Volatile demand usually means teacher-dependent or weather/event-sensitive demand — stabilise with a fixed popular teacher or a standing waitlist nudge.</>
      : <>Consistency is healthy across the board — demand is predictable, which makes staffing and inventory planning reliable.</>,
  ];
}

/* ═══════════════ Teacher table ═══════════════ */

function teacherCols(): Col<TeacherStat>[] {
  return [
    { key: "name", label: "Teacher", align: "left", value: (r) => r.name, totalMode: "none", width: "150px",
      render: (r) => <span className="font-medium text-hi">{r.name}</span> },
    { key: "sessions", label: "Sess", value: (r) => r.sessions, fmt: intFmt, heat: true },
    { key: "checked", label: "Heads", value: (r) => r.checked, fmt: intFmt, heat: true },
    { key: "fillRate", label: "Fill %", value: (r) => r.fillRate, fmt: (n) => pct(n), totalMode: "avg",
      render: (r) => <span className={cn("num font-semibold", r.fillRate >= 78 ? "text-pos" : r.fillRate >= 58 ? "text-warn" : "text-neg")}>{pct(r.fillRate)}</span> },
    { key: "classAvg", label: "Avg", value: (r) => r.classAvg, fmt: (n) => dec(n, 1), totalMode: "avg" },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "revPerSession", label: "Rev/Sess", value: (r) => r.revPerSession, fmt: compact, totalMode: "avg" },
    { key: "consistency", label: "Consist.", value: (r) => r.consistency, fmt: (n) => pct(n, 0), totalMode: "avg" },
    { key: "trendPP", label: "Trend", value: (r) => r.trendPP, totalMode: "none", render: (r) => <Delta value={r.trendPP} /> },
    { key: "bestSlot", label: "Best Slot", align: "left", value: (r) => r.bestSlot, totalMode: "none",
      render: (r) => <span className="text-mid">{r.bestSlot} <span className="num text-lo">· {pct(r.bestSlotFill)}</span></span> },
  ];
}

function TeacherDrill({ t, dark }: { t: TeacherStat; dark: boolean }) {
  const slots = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    t.rows.forEach((r) => {
      const a = m.get(r.uniqueId1);
      if (a) a.push(r);
      else m.set(r.uniqueId1, [r]);
    });
    return Array.from(m.entries()).map(([k, rs]) => {
      const cap = rs.reduce((s, r) => s + r.capacity, 0) || 1;
      return {
        key: k,
        slot: `${rs[0].sessionName} · ${rs[0].day} ${rs[0].slot}`,
        format: rs[0].format,
        fColor: formatHex(rs[0].format, dark),
        sessions: rs.length,
        fill: (rs.reduce((s, r) => s + r.checkedIn, 0) / cap) * 100,
        avg: rs.reduce((s, r) => s + r.checkedIn, 0) / rs.length,
        rev: rs.reduce((s, r) => s + r.revenue, 0),
        rows: rs,
      };
    }).sort((a, b) => b.fill - a.fill);
  }, [t, dark]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[10.5px] text-lo">
        <span className="rounded-md border border-line bg-surface px-2 py-1">Formats <b className="text-hi">{t.formats.join(", ")}</b></span>
        <span className="rounded-md border border-line bg-surface px-2 py-1">Locations <b className="text-hi">{t.locations.join(", ")}</b></span>
        <span className="rounded-md border border-line bg-surface px-2 py-1">Show-up <b className="text-hi">{pct(t.showRate)}</b></span>
      </div>
      <div className="tbl-drill-inner">
        <DataTable
          cols={[
            { key: "slot", label: "Slot", align: "left", value: (r: any) => r.slot, totalMode: "none",
              render: (r: any) => <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: r.fColor }} />{r.slot}</span> },
            { key: "sessions", label: "Sess", value: (r: any) => r.sessions, fmt: intFmt },
            { key: "fill", label: "Fill %", value: (r: any) => r.fill, fmt: (n: number) => pct(n) },
            { key: "avg", label: "Avg", value: (r: any) => r.avg, fmt: (n: number) => dec(n, 1) },
            { key: "rev", label: "Revenue", value: (r: any) => r.rev, fmt: compact },
          ]}
          rows={slots} rowKey={(r: any) => r.key} csvName="teacher-slots" initialLimit={8} dense level={1}
          expand={(s: any) => <DataTable cols={sessionCols()} rows={s.rows} rowKey={(r: SessionRow) => r.sessionId + r.date} csvName="t-sessions" initialLimit={8} dense level={1} />} />
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-lo">
        <b className="text-hi">{t.name}</b> draws {dec(t.classAvg, 1)} heads at {pct(t.fillRate)} fill
        {t.trendPP >= 5 ? " and is gaining momentum — give them the growth slots." : t.trendPP <= -5 ? " but is fading — check burnout, schedule overload or a format mismatch." : " with a stable trend."}
      </p>
    </div>
  );
}

function teacherNarrative(teachers: TeacherStat[]): React.ReactNode[] {
  if (!teachers.length) return [<>No teachers in scope.</>];
  const top = teachers.slice().sort((a, b) => b.fillRate - a.fillRate)[0];
  const rev = teachers[0];
  const fading = teachers.filter((t) => t.sessions >= 6 && t.trendPP <= -8);
  return [
    <><b>{top.name}</b> fills best at {pct(top.fillRate)} ({dec(top.classAvg, 1)} heads), while <b>{rev.name}</b> generates the most revenue ({compact(rev.revenue)}). When fill and revenue leaders differ, the revenue leader is usually teaching bigger rooms or pricier formats — not necessarily teaching better.</>,
    <><b>Consistency</b> separates draw from luck: a teacher with high fill but low consistency is riding a few great slots. Pair them with a mentor on their weak slots rather than praising the average.</>,
    fading.length
      ? <><b>{fading.map((t) => t.name).join(", ")}</b> {fading.length > 1 ? "are" : "is"} fading 8pp or more. Intervene early — observe a class, refresh choreography, or rotate them into a stronger slot before members form a habit of skipping.</>
      : <>No established teacher is fading materially — the roster is stable.</>,
  ];
}

/* ═══════════════ Format battle ═══════════════ */

function formatCols(colors: Record<string, string>): Col<FormatStat>[] {
  return [
    { key: "label", label: "Format", align: "left", value: (r) => r.label, totalMode: "none", width: "140px",
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-medium text-hi">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[r.key] }} />{r.label}
        </span>
      ) },
    { key: "sessions", label: "Sess", value: (r) => r.sessions, fmt: intFmt },
    { key: "checked", label: "Heads", value: (r) => r.checked, fmt: intFmt, heat: true },
    { key: "fillRate", label: "Fill %", value: (r) => r.fillRate, fmt: (n) => pct(n), heat: true,
      render: (r) => <span className={cn("num font-semibold", r.fillRate >= 75 ? "text-pos" : r.fillRate >= 55 ? "text-warn" : "text-neg")}>{pct(r.fillRate)}</span> },
    { key: "classAvg", label: "Avg", value: (r) => r.classAvg, fmt: (n) => dec(n, 1) },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "revPerSession", label: "Rev/Sess", value: (r) => r.revPerSession, fmt: compact },
    { key: "revPerHead", label: "Rev/Head", value: (r) => r.revPerHead, fmt: compact },
    { key: "share", label: "Share", value: (r) => r.share, fmt: (n) => pct(n) },
    { key: "primeFill", label: "Prime", value: (r) => r.primeFill, fmt: (n) => pct(n),
      tip: "Fill in prime hours (weekday mornings/evenings, weekend mid-mornings)." },
    { key: "offFill", label: "Off-peak", value: (r) => r.offFill, fmt: (n) => pct(n),
      tip: "Fill outside prime hours. A large prime/off gap = schedule-sensitive demand." },
    { key: "slots", label: "Slots", value: (r) => r.slots, fmt: intFmt },
    { key: "teachers", label: "Teachers", value: (r) => r.teachers, fmt: intFmt },
  ];
}

function FormatDrill({ f, rows, fColor }: { f: FormatStat; rows: SessionRow[]; fColor: string }) {
  const fr = rows.filter((r) => (r.formatNorm === "other" ? r.format : r.formatNorm) === f.key);
  const topSlots = aggregateSlots(fr, "uid1").slice(0, 6);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[10.5px] text-lo">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1">
          <span className="h-2 w-2 rounded-full" style={{ background: fColor }} />
          Show-up <b className="text-hi">{pct(f.showRate)}</b>
        </span>
        <span className="rounded-md border border-line bg-surface px-2 py-1">Late-cancel <b className="text-hi">{pct(f.lateRate)}</b></span>
        <span className="rounded-md border border-line bg-surface px-2 py-1">Comp share <b className="text-hi">{pct(f.compShare)}</b></span>
        <span className="rounded-md border border-line bg-surface px-2 py-1">Prime/off gap <b className="text-hi">{(f.primeFill - f.offFill).toFixed(1)}pp</b></span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="tbl-drill-inner">
          <p className="border-b border-line px-3 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-widest text-lo">Monthly momentum</p>
          <DataTable
            cols={[
              { key: "label", label: "Month", align: "left", value: (r: any) => r.label, totalMode: "none" },
              { key: "sessions", label: "Sess", value: (r: any) => r.sessions, fmt: intFmt },
              { key: "fill", label: "Fill %", value: (r: any) => r.fill, fmt: (n: number) => pct(n) },
              { key: "revenue", label: "Revenue", value: (r: any) => r.revenue, fmt: compact },
            ]}
            rows={f.monthly} rowKey={(r: any) => r.ym} csvName="format-monthly" initialLimit={8} dense level={1} />
        </div>
        <div className="tbl-drill-inner">
          <p className="border-b border-line px-3 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-widest text-lo">Top slots</p>
          <DataTable
            cols={[
              { key: "label", label: "Slot", align: "left", value: (r: SlotAgg) => r.label, totalMode: "none" },
              { key: "fillRate", label: "Fill %", value: (r: SlotAgg) => r.fillRate, fmt: (n: number) => pct(n) },
              { key: "classAvg", label: "Avg", value: (r: SlotAgg) => r.classAvg, fmt: (n: number) => dec(n, 1) },
              { key: "revenue", label: "Revenue", value: (r: SlotAgg) => r.revenue, fmt: compact },
            ]}
            rows={topSlots} rowKey={(r: SlotAgg) => r.key} csvName="format-slots" initialLimit={6} dense level={1} />
        </div>
      </div>
    </div>
  );
}

function formatNarrative(formats: FormatStat[]): React.ReactNode[] {
  if (!formats.length) return [<>No formats in scope.</>];
  const byFill = [...formats].sort((a, b) => b.fillRate - a.fillRate)[0];
  const byRev = formats[0];
  const byTicket = [...formats].sort((a, b) => b.revPerHead - a.revPerHead)[0];
  const gap = [...formats].sort((a, b) => (b.primeFill - b.offFill) - (a.primeFill - a.offFill))[0];
  const momentum = (f: FormatStat) => {
    if (f.monthly.length < 3) return 0;
    return f.monthly[f.monthly.length - 1].fill - f.monthly[0].fill;
  };
  const rising = [...formats].sort((a, b) => momentum(b) - momentum(a))[0];
  return [
    <><b>{byRev.label}</b> earns the most ({compact(byRev.revenue)}, {pct(byRev.share)} share), <b>{byFill.label}</b> fills best ({pct(byFill.fillRate)}), and <b>{byTicket.label}</b> commands the highest ticket ({compact(byTicket.revPerHead)} per head). Judge each format on its own job: volume engines on fill, premium formats on ticket.</>,
    <><b>{gap.label}</b> has the widest prime/off gap ({(gap.primeFill - gap.offFill).toFixed(1)}pp) — its demand is the most schedule-sensitive. Concentrate its slots in prime bands and stop defending weak off-peak hours.</>,
    <><b>{rising.label}</b> has the strongest fill momentum ({momentum(rising) >= 0 ? "+" : ""}{momentum(rising).toFixed(1)}pp across the window). Momentum deserves investment: add sections and marketing behind the riser, not the legacy leader.</>,
    <>If one format dominates revenue share above 60%, the timetable has concentration risk — a single instructor exit or trend shift can hollow the week. Build the second format deliberately with prime placements, not leftover hours.</>,
  ];
}

/* ═══════════════ Changes ═══════════════ */

function changeCols(): Col<ScheduleChange>[] {
  return [
    { key: "kind", label: "Change", align: "left", value: (r) => r.kind, totalMode: "none", width: "120px",
      render: (r) => <span className="rounded-md bg-gray-soft px-2 py-0.5 text-[10px] font-semibold text-mid">{r.kind}</span> },
    { key: "slot", label: "Slot", align: "left", value: (r) => r.slot, totalMode: "none", width: "230px",
      render: (r) => <span className="font-medium text-hi">{r.slot}</span> },
    { key: "detail", label: "Detail", align: "left", value: (r) => r.detail, totalMode: "none",
      render: (r) => <span className="text-mid">{r.detail}</span> },
    { key: "beforeFill", label: "Before", value: (r) => r.beforeFill ?? 0, fmt: (n) => pct(n), totalMode: "none",
      render: (r) => <span className="num text-mid">{r.beforeFill === null ? "—" : pct(r.beforeFill)}</span> },
    { key: "afterFill", label: "After", value: (r) => r.afterFill ?? 0, fmt: (n) => pct(n), totalMode: "none",
      render: (r) => <span className="num text-mid">{r.afterFill === null ? "—" : pct(r.afterFill)}</span> },
    { key: "deltaPP", label: "Δ", value: (r) => r.deltaPP ?? 0, totalMode: "none",
      render: (r) => (r.deltaPP === null ? <span className="text-lo">—</span> : <Delta value={r.deltaPP} />) },
    { key: "verdict", label: "Verdict", align: "left", value: (r) => r.verdict, totalMode: "none",
      render: (r) => (
        <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold",
          r.verdict === "worked" ? "bg-pos-soft text-pos" : r.verdict === "didn't" ? "bg-neg-soft text-neg"
          : r.verdict === "watch" ? "bg-warn-soft text-warn" : "bg-surface2 text-lo")}>
          {r.verdict === "worked" ? "✓ Worked" : r.verdict === "didn't" ? "✕ Didn't" : r.verdict === "watch" ? "◷ Watch" : "· Info"}
        </span>
      ) },
    { key: "date", label: "Date", align: "left", value: (r) => r.date, totalMode: "none" },
  ];
}

function ChangeDrill({ c }: { c: ScheduleChange }) {
  return (
    <div className="tbl-drill-inner">
      <DataTable cols={sessionCols()} rows={c.rows} rowKey={(r) => r.sessionId + r.date}
        csvName="change-sessions" initialLimit={10} dense level={1} />
    </div>
  );
}

function changeNarrative(changes: ScheduleChange[]): React.ReactNode[] {
  const worked = changes.filter((c) => c.verdict === "worked");
  const didnt = changes.filter((c) => c.verdict === "didn't");
  return [
    worked.length
      ? <><b>{worked.length} changes worked:</b> {worked.slice(0, 3).map((c) => `${c.slot.split("·")[0].trim()} (${c.detail.split("·")[0].trim()}, ${c.deltaPP! >= 0 ? "+" : ""}${c.deltaPP!.toFixed(0)}pp)`).join("; ")}. Codify why — same teacher quality bar, better hour, right capacity — and repeat the pattern elsewhere.</>
      : <>No change has yet cleared the +5pp bar. Give recent launches at least 6 sessions before judging; early fills always understate.</>,
    didnt.length
      ? <><b>{didnt.length} changes backfired:</b> {didnt.slice(0, 3).map((c) => `${c.slot.split("·")[0].trim()} (${c.deltaPP!.toFixed(0)}pp)`).join("; ")}. Revert fast — every week a weak change runs, members build a skip habit that outlasts the fix.</>
      : <>Nothing has materially backfired. That usually means changes are too timid — healthy timetables retire and test constantly.</>,
    <>Teacher swaps are the highest-leverage change on this page: same room, same hour, different draw. Track every swap's 4-session before/after as standard practice.</>,
  ];
}

/* ═══════════════ Session ledger ═══════════════ */

function sessionCols(): Col<SessionRow>[] {
  return [
    { key: "date", label: "Date", align: "left", value: (r) => r.dateObj?.getTime() || 0, totalMode: "none", width: "92px",
      render: (r) => <span className="num text-[10.5px]">{r.date}</span> },
    { key: "sessionName", label: "Session", align: "left", value: (r) => r.sessionName, totalMode: "none",
      render: (r) => <span className="font-medium text-hi">{r.sessionName}</span> },
    { key: "format", label: "Format", align: "left", value: (r) => r.format, totalMode: "none" },
    { key: "trainerName", label: "Teacher", align: "left", value: (r) => r.trainerName, totalMode: "none" },
    { key: "location", label: "Location", align: "left", value: (r) => r.location, totalMode: "none" },
    { key: "slot", label: "Slot", align: "left", value: (r) => `${r.day} ${r.slot}`, totalMode: "none" },
    { key: "capacity", label: "Cap", value: (r) => r.capacity, fmt: intFmt },
    { key: "booked", label: "Booked", value: (r) => r.booked, fmt: intFmt },
    { key: "checkedIn", label: "In", value: (r) => r.checkedIn, fmt: intFmt, heat: true },
    { key: "fillRate", label: "Fill %", value: (r) => r.fillRate, fmt: (n) => pct(n), totalMode: "avg",
      render: (r) => <span className={cn("num", r.fillRate >= 85 ? "text-pos" : r.fillRate >= 55 ? "text-mid" : "text-neg")}>{pct(r.fillRate)}</span> },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true },
    { key: "lateCancelled", label: "Late", value: (r) => r.lateCancelled, fmt: intFmt },
  ];
}

function SessionRecord({ r }: { r: SessionRow }) {
  const items: [string, string][] = [
    ["Session ID", r.sessionId], ["UID1", r.uniqueId1], ["UID2", r.uniqueId2],
    ["Trainer ID", r.trainerId || "—"], ["Delivery", r.delivery || "—"],
    ["Book rate", pct(r.bookRate)], ["Show-up", pct(r.showRate)], ["Rev/head", compact(r.revPerHead)],
    ["Non-paid", intFmt(r.nonPaid)], ["Complimentary", intFmt(r.complimentary)],
    ["Memberships", intFmt(r.memberships)], ["Packages", intFmt(r.packages)],
    ["Intro offers", intFmt(r.introOffers)], ["Single classes", intFmt(r.singleClasses)],
    ["Prime time", r.prime ? "Yes" : "No"], ["Month", r.ym || "—"],
  ];
  return (
    <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-line/60 py-1 text-[11px]">
          <span className="text-lo">{k}</span>
          <span className="num truncate text-hi">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════ Coverage & load ═══════════════ */

function coveragePanel(rows: SessionRow[], recurring: FlexTable): any[] {
  const times = rows.map((r) => r.dateObj?.getTime() || 0).filter(Boolean);
  const end = times.length ? Math.max(...times) : Date.now();
  const recent = rows.filter((r) => (r.dateObj?.getTime() || 0) > end - 28 * 86400000);
  const bySlot = new Map<string, SessionRow[]>();
  rows.forEach((r) => {
    const a = bySlot.get(r.uniqueId1);
    if (a) a.push(r);
    else bySlot.set(r.uniqueId1, [r]);
  });
  const recentBy = new Map<string, number>();
  recent.forEach((r) => recentBy.set(r.uniqueId1, (recentBy.get(r.uniqueId1) || 0) + 1));
  const statusOf = (slot: string, last: number) => {
    if (recurring.rows.length) {
      const hit = recurring.rows.find((rec) =>
        Object.values(rec).some((v) => v && slot.toLowerCase().includes(v.toLowerCase().slice(0, 12)) && v.length > 4)
      );
      if (hit) {
        const st = Object.entries(hit).find(([k]) => /status|state/i.test(k))?.[1] || "";
        if (st) return st;
      }
    }
    return last > end - 21 * 86400000 ? "Active" : "Retired";
  };
  return Array.from(bySlot.entries()).map(([slot, list]) => {
    const last = Math.max(...list.map((r) => r.dateObj?.getTime() || 0));
    const held = recentBy.get(slot) || 0;
    const expected = 4;
    return {
      slot: `${list[0].sessionName} · ${list[0].day} ${list[0].slot}`,
      location: list[0].location,
      status: statusOf(slot, last),
      expected,
      held,
      coverage: (held / expected) * 100,
    };
  }).sort((a, b) => a.coverage - b.coverage);
}

function coverageCols(): Col<any>[] {
  return [
    { key: "slot", label: "Slot", align: "left", value: (r) => r.slot, totalMode: "none" },
    { key: "status", label: "Status", align: "left", value: (r) => r.status, totalMode: "none",
      render: (r: any) => (
        <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold",
          /active/i.test(r.status) ? "bg-pos-soft text-pos" : /retire|moved|pause/i.test(r.status) ? "bg-surface2 text-lo" : "bg-warn-soft text-warn")}>
          {r.status}
        </span>
      ) },
    { key: "expected", label: "Exp/4w", value: (r) => r.expected, fmt: intFmt },
    { key: "held", label: "Held", value: (r) => r.held, fmt: intFmt },
    { key: "coverage", label: "Cover %", value: (r) => r.coverage, fmt: (n: number) => pct(n), totalMode: "avg",
      render: (r: any) => <span className={cn("num font-semibold", r.coverage >= 90 ? "text-pos" : r.coverage >= 70 ? "text-warn" : "text-neg")}>{pct(r.coverage)}</span> },
  ];
}

function teacherLoadPanel(rows: SessionRow[], teacherRec: FlexTable): any[] {
  const times = rows.map((r) => r.dateObj?.getTime() || 0).filter(Boolean);
  const end = times.length ? Math.max(...times) : Date.now();
  const recent = rows.filter((r) => (r.dateObj?.getTime() || 0) > end - 28 * 86400000);
  const actual = new Map<string, number>();
  recent.forEach((r) => actual.set(r.trainerName, (actual.get(r.trainerName) || 0) + 1));
  const scheduled = new Map<string, number>();
  teacherRec.rows.forEach((rec) => {
    const vals = Object.values(rec);
    const name = vals.find((v) => v && v.includes(" ")) || vals[0];
    const num = vals.map((v) => parseFloat(v)).find((n) => Number.isFinite(n) && n > 0 && n < 30);
    if (name) scheduled.set(name, (num || 1) * 4);
  });
  // fallback: scheduled = distinct slots × 4
  if (!scheduled.size) {
    const per = new Map<string, Set<string>>();
    rows.forEach((r) => {
      if (!per.has(r.trainerName)) per.set(r.trainerName, new Set());
      per.get(r.trainerName)!.add(r.uniqueId1);
    });
    per.forEach((s, t) => scheduled.set(t, s.size * 4));
  }
  const names = Array.from(new Set([...actual.keys(), ...scheduled.keys()]));
  return names.map((t) => {
    const exp = scheduled.get(t) || 0;
    const got = actual.get(t) || 0;
    return { teacher: t, expected: exp, actual: got, load: exp ? (got / exp) * 100 : 0 };
  }).sort((a, b) => b.load - a.load);
}

function loadCols(): Col<any>[] {
  return [
    { key: "teacher", label: "Teacher", align: "left", value: (r) => r.teacher, totalMode: "none" },
    { key: "expected", label: "Sched/4w", value: (r) => r.expected, fmt: intFmt },
    { key: "actual", label: "Taught", value: (r) => r.actual, fmt: intFmt },
    { key: "load", label: "Load %", value: (r) => r.load, fmt: (n: number) => pct(n), totalMode: "avg",
      render: (r: any) => <span className={cn("num font-semibold", r.load > 115 ? "text-neg" : r.load >= 85 ? "text-pos" : "text-warn")}>{pct(r.load)}</span> },
  ];
}

/* ═══════════════ Insights & recommendations ═══════════════ */

interface CInsight { kind: "win" | "risk" | "trend" | "action"; title: string; body: string }

function buildClassInsights(
  slots: SlotAgg[], formats: FormatStat[], teachers: TeacherStat[], changes: ScheduleChange[], rows: SessionRow[]
): CInsight[] {
  const out: CInsight[] = [];
  if (!rows.length) return out;
  const top = slots[0];
  if (top) {
    out.push({
      kind: "win",
      title: `${top.label} is the benchmark at ${pct(top.fillRate)} fill`,
      body: `${dec(top.classAvg, 1)} heads per session and ${compact(top.revPerSession)} revenue across ${top.sessions} sessions with ${pct(top.consistency, 0)} consistency. Clone its hour, format and teacher profile when opening new slots.`,
    });
  }
  const weak = slots.filter((s) => s.sessions >= 4 && s.fillRate < 50);
  if (weak.length) {
    out.push({
      kind: "risk",
      title: `${weak.length} slots run below 50% fill with 4+ sessions of proof`,
      body: `${weak.slice(0, 3).map((s) => s.label.split("·")[0].trim()).join(", ")}${weak.length > 3 ? ` and ${weak.length - 3} more` : ""} are structurally weak. Each session burns teacher cost and room time for under half a room — move, merge or retire them.`,
    });
  }
  const over = slots.filter((s) => s.sessions >= 4 && s.fillRate > 95);
  if (over.length) {
    out.push({
      kind: "action",
      title: `${over.length} slots turn demand away above 95% fill`,
      body: `Waitlists feel like success but train members that booking is futile. Add a second section or expand capacity on ${over.slice(0, 2).map((s) => s.label).join("; ")} before the goodwill expires.`,
    });
  }
  if (formats.length > 1) {
    const f0 = formats[0];
    out.push({
      kind: "trend",
      title: `${f0.label} dominates at ${pct(f0.share)} of class revenue`,
      body: `Prime fill ${pct(f0.primeFill)} vs off-peak ${pct(f0.offFill)}. ${formats.length > 2 ? `${formats[1].label} trails at ${pct(formats[1].share)} — it needs prime placements, not leftover hours, to become a real second pillar.` : ""}`,
    });
  }
  const multi = slots.filter((s) => s.teachers > 1);
  if (multi.length) {
    const biggest = multi
      .map((s) => {
        const m = new Map<string, { c: number; cap: number }>();
        s.rows.forEach((r) => {
          const e = m.get(r.trainerName) || { c: 0, cap: 0 };
          e.c += r.checkedIn;
          e.cap += r.capacity;
          m.set(r.trainerName, e);
        });
        const fills = Array.from(m.values()).map((e) => (e.c / Math.max(1, e.cap)) * 100);
        return { s, spread: Math.max(...fills) - Math.min(...fills) };
      })
      .sort((a, b) => b.spread - a.spread)[0];
    if (biggest && biggest.spread >= 10) {
      out.push({
        kind: "trend",
        title: `Teacher effect is ${biggest.spread.toFixed(0)}pp on ${biggest.s.label}`,
        body: `Same room, same hour — different draw. The teacher, not the slot, explains the gap. Put your strongest available instructor on shared slots and codify what they do differently.`,
      });
    }
  }
  const noShow = rows.reduce((s, r) => s + Math.max(0, r.booked - r.checkedIn), 0);
  const booked = rows.reduce((s, r) => s + r.booked, 0) || 1;
  if ((noShow / booked) * 100 > 12) {
    out.push({
      kind: "risk",
      title: `${pct((noShow / booked) * 100)} of bookings never show up`,
      body: `${intFmt(noShow)} ghost bookings blocked real demand. Same-day reminders, a visible late-cancel fee and auto-promoted waitlists typically recover a third of this within a month.`,
    });
  }
  const worked = changes.filter((c) => c.verdict === "worked").length;
  const didnt = changes.filter((c) => c.verdict === "didn't").length;
  if (worked || didnt) {
    out.push({
      kind: didnt > worked ? "risk" : "win",
      title: `Schedule record: ${worked} worked, ${didnt} backfired`,
      body: didnt > worked
        ? "More changes hurt than helped — slow down, lengthen trial windows to 6 sessions, and revert the failures before skip-habits set in."
        : "The timetable team is beating the market. Keep the experiment cadence: test one change per location per month with a written hypothesis.",
    });
  }
  const fading = teachers.filter((t) => t.sessions >= 6 && t.trendPP <= -8);
  if (fading.length) {
    out.push({
      kind: "action",
      title: `${fading.map((t) => t.name).join(", ")} fading fast`,
      body: `Down 8pp+ on trend with 6+ sessions taught. Observe a class this week — usually stale programming, burnout, or a format mismatch. Early coaching is cheap; a hollowed slot is expensive.`,
    });
  }
  return out;
}

interface CRec { priority: string; action: string; metric: string; impact: number; effort: string; why: string }

function buildClassRecs(slots: SlotAgg[], formats: FormatStat[], teachers: TeacherStat[], rows: SessionRow[]): CRec[] {
  const out: CRec[] = [];
  const revPerHead = rows.reduce((s, r) => s + r.revenue, 0) / Math.max(1, rows.reduce((s, r) => s + r.checkedIn, 0));
  const fills = slots.filter((s) => s.sessions >= 4).map((s) => s.fillRate).sort((a, b) => a - b);
  const median = fills.length ? fills[Math.floor(fills.length / 2)] : 60;

  const weak = slots.filter((s) => s.sessions >= 4 && s.fillRate < median - 10);
  if (weak.length) {
    const upside = weak.reduce((s, x) => s + ((median - x.fillRate) / 100) * (x.capacity / Math.max(1, x.sessions)) * 4 * revPerHead, 0);
    out.push({
      priority: "P1",
      action: `Repair ${weak.length} sub-median slots to median fill (${median.toFixed(0)}%)`,
      metric: "Fill rate",
      impact: upside,
      effort: "Medium — retime, restaff or merge; 4-week trial each",
      why: `${weak.slice(0, 3).map((s) => s.label).join("; ")} sit 10pp+ below median with 4+ sessions of evidence. Lifting them to median is worth roughly ${compact(upside)} per month at current ticket.`,
    });
  }
  const noShow = rows.reduce((s, r) => s + Math.max(0, r.booked - r.checkedIn), 0);
  if (noShow > 0) {
    out.push({
      priority: "P1",
      action: `Recover a third of ${intFmt(noShow)} no-shows`,
      metric: "Show-up rate",
      impact: (noShow / Math.max(1, rows.length)) * 30 * revPerHead * 0.33 * 4,
      effort: "Low — reminders + visible late fee + auto waitlist",
      why: `Ghost bookings block paying demand. Industry playbooks recover 25–35% within a month with same-day reminders and enforced late-cancel fees.`,
    });
  }
  const over = slots.filter((s) => s.sessions >= 4 && s.fillRate > 95);
  if (over.length) {
    const upside = over.reduce((s, x) => s + x.revPerSession * 4 * 0.25, 0);
    out.push({
      priority: "P2",
      action: `Add capacity to ${over.length} over-full slots`,
      metric: "Revenue / session",
      impact: upside,
      effort: "Medium — second section or bigger room",
      why: `Above 95% fill, every session turns members away. A second weekly section capturing even a quarter of overflow pays for itself immediately.`,
    });
  }
  if (formats.length > 1) {
    const second = formats[1];
    const gap = second.primeFill - second.offFill;
    if (gap > 15) {
      out.push({
        priority: "P2",
        action: `Concentrate ${second.label} into prime hours`,
        metric: "Prime/off gap",
        impact: second.revenue * 0.08,
        effort: "Medium — timetable reshape",
        why: `${second.label} fills ${pct(second.primeFill)} in prime vs ${pct(second.offFill)} off-peak — a ${gap.toFixed(0)}pp gap. Moving two off-peak sections into proven prime bands typically lifts format revenue ~8%.`,
      });
    }
  }
  const star = teachers.slice().sort((a, b) => b.fillRate - a.fillRate)[0];
  if (star && star.sessions >= 6) {
    out.push({
      priority: "P2",
      action: `Clone ${star.name}'s playbook across the roster`,
      metric: "Teacher consistency",
      impact: rows.reduce((s, r) => s + r.revenue, 0) * 0.03,
      effort: "Low — observe, document, train",
      why: `${star.name} fills ${pct(star.fillRate)} at ${pct(star.consistency, 0)} consistency. A 3% roster-wide lift from codified best practice compounds every week.`,
    });
  }
  const stale = slots.filter((s) => s.sessions >= 8 && s.trendPP <= -10);
  if (stale.length) {
    out.push({
      priority: "P3",
      action: `Intervene on ${stale.length} deteriorating slots (trend ≤ −10pp)`,
      metric: "Trend",
      impact: stale.reduce((s, x) => s + x.revPerSession * 4 * 0.15, 0),
      effort: "Medium — refresh programming or rotate teacher",
      why: `Steady decline over 8+ sessions is never random — it is stale programming, a fading teacher, or new competition. Refresh now while the slot still has an audience.`,
    });
  }
  return out.sort((a, b) => b.impact - a.impact);
}

function recCols(): Col<CRec>[] {
  return [
    { key: "priority", label: "Pri", align: "left", value: (r) => r.priority, totalMode: "none", width: "52px",
      render: (r) => (
        <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px] font-bold",
          r.priority === "P1" ? "bg-neg-soft text-neg" : r.priority === "P2" ? "bg-warn-soft text-warn" : "bg-surface2 text-lo")}>
          {r.priority}
        </span>
      ) },
    { key: "action", label: "Recommended Action", align: "left", value: (r) => r.action, totalMode: "none", width: "300px",
      render: (r) => <span className="font-medium text-hi">{r.action}</span> },
    { key: "metric", label: "Moves", align: "left", value: (r) => r.metric, totalMode: "none" },
    { key: "impact", label: "Est. Impact/mo", value: (r) => r.impact, fmt: compact, heat: true,
      tip: "Modelled monthly value at the stated conversion assumption." },
    { key: "effort", label: "Effort", align: "left", value: (r) => r.effort, totalMode: "none", width: "250px",
      render: (r) => <span className="text-[10.5px] text-lo">{r.effort}</span> },
    { key: "why", label: "Rationale", align: "left", value: (r) => r.why, totalMode: "none",
      render: (r) => <span className="text-[10.5px] leading-relaxed text-mid">{r.why}</span> },
  ];
}
