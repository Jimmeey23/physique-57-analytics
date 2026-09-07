import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { cn } from "../utils/cn";
import { Btn, Chip, Segmented, Tip } from "./ui";
import type { SessionRow } from "../lib/sessions";

export type ClassPreset = "all" | "l30" | "l60" | "l90" | "l180" | "mtd" | "lastmonth" | "custom";

export interface ClassFilterState {
  preset: ClassPreset;
  from: string;
  to: string;
  formats: string[];
  teachers: string[];
  sessionNames: string[];
  days: string[];
  dayPart: "all" | "weekday" | "weekend";
  timeBand: "all" | "morning" | "midday" | "evening";
  primeOnly: boolean;
  minCapacity: string;
  minFill: string;
  maxFill: string;
  minSessions: string;
  excludeEmpty: boolean;
  search: string;
}

export const emptyClassFilters: ClassFilterState = {
  preset: "all",
  from: "",
  to: "",
  formats: [],
  teachers: [],
  sessionNames: [],
  days: [],
  dayPart: "all",
  timeBand: "all",
  primeOnly: false,
  minCapacity: "",
  minFill: "",
  maxFill: "",
  minSessions: "1",
  excludeEmpty: false,
  search: "",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const PRESETS: { v: ClassPreset; l: string }[] = [
  { v: "all", l: "All time" },
  { v: "l30", l: "30 days" },
  { v: "l60", l: "60 days" },
  { v: "l90", l: "90 days" },
  { v: "l180", l: "6 months" },
  { v: "mtd", l: "MTD" },
  { v: "lastmonth", l: "Last month" },
  { v: "custom", l: "Custom" },
];

export function classPresetRange(f: ClassFilterState, maxDate: Date): [Date | null, Date | null] {
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59);
  const d = (n: number) => new Date(end.getTime() - n * 864e5);
  switch (f.preset) {
    case "l30": return [d(30), end];
    case "l60": return [d(60), end];
    case "l90": return [d(90), end];
    case "l180": return [d(180), end];
    case "mtd": return [new Date(end.getFullYear(), end.getMonth(), 1), end];
    case "lastmonth":
      return [new Date(end.getFullYear(), end.getMonth() - 1, 1), new Date(end.getFullYear(), end.getMonth(), 0, 23, 59, 59)];
    case "custom":
      return [f.from ? new Date(f.from + "T00:00:00") : null, f.to ? new Date(f.to + "T23:59:59") : null];
    default: return [null, null];
  }
}

export function applyClassFilters(rows: SessionRow[], f: ClassFilterState, maxDate: Date): SessionRow[] {
  const [from, to] = classPresetRange(f, maxDate);
  const q = f.search.trim().toLowerCase();
  const minCap = f.minCapacity ? parseFloat(f.minCapacity) : null;
  const minFill = f.minFill ? parseFloat(f.minFill) : null;
  const maxFill = f.maxFill ? parseFloat(f.maxFill) : null;
  const inList = (list: string[], v: string) => list.length === 0 || list.includes(v);
  return rows.filter((r) => {
    if (from && r.dateObj && r.dateObj < from) return false;
    if (to && r.dateObj && r.dateObj > to) return false;
    if (!inList(f.formats, r.format)) return false;
    if (!inList(f.teachers, r.trainerName)) return false;
    if (!inList(f.sessionNames, r.sessionName)) return false;
    if (f.days.length && !f.days.includes(r.day)) return false;
    if (f.dayPart === "weekend" && !(r.dow === 0 || r.dow === 6)) return false;
    if (f.dayPart === "weekday" && !(r.dow >= 1 && r.dow <= 5)) return false;
    if (f.timeBand === "morning" && !(r.hour < 12)) return false;
    if (f.timeBand === "midday" && !(r.hour >= 12 && r.hour < 17)) return false;
    if (f.timeBand === "evening" && !(r.hour >= 17)) return false;
    if (f.primeOnly && !r.prime) return false;
    if (minCap !== null && r.capacity < minCap) return false;
    if (minFill !== null && r.fillRate < minFill) return false;
    if (maxFill !== null && r.fillRate > maxFill) return false;
    if (f.excludeEmpty && r.checkedIn === 0) return false;
    if (q && !(
      r.sessionName.toLowerCase().includes(q) ||
      r.trainerName.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q) ||
      r.format.toLowerCase().includes(q) ||
      r.uniqueId1.toLowerCase().includes(q)
    )) return false;
    return true;
  });
}

function MultiSelect({
  label, options, selected, onChange, tip,
}: {
  label: string; options: { v: string; n: number }[]; selected: string[];
  onChange: (v: string[]) => void; tip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.v.toLowerCase().includes(q.toLowerCase())).slice(0, 200),
    [options, q]
  );
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="relative">
      <label className="mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-lo">
        {label} {tip && <Tip text={tip} />}
      </label>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11.5px] transition-all",
          selected.length ? "border-loc bg-loc-soft text-hi" : "border-line bg-surface text-lo hover:border-strong"
        )}
      >
        <span className="truncate">
          {selected.length === 0 ? `All (${options.length})` : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute z-50 mt-1.5 max-h-72 w-full min-w-[220px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            >
              <div className="border-b border-line p-2">
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
                  className="w-full rounded-md border border-line bg-surface2 px-2.5 py-1.5 text-[11.5px] text-hi outline-none focus:border-strong" />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {filtered.map((o) => {
                  const on = selected.includes(o.v);
                  return (
                    <button key={o.v} onClick={() => toggle(o.v)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[11.5px] text-hi transition-colors hover:bg-surface2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                          on ? "border-transparent bg-loc" : "border-line-strong")}>
                          {on && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="truncate">{o.v}</span>
                      </span>
                      <span className="num shrink-0 text-[9.5px] text-lo">{o.n}</span>
                    </button>
                  );
                })}
                {!filtered.length && <p className="px-2 py-3 text-center text-[10.5px] text-lo">No matches</p>}
              </div>
              <div className="flex justify-between border-t border-line p-1.5">
                <Btn size="xs" onClick={() => onChange([])}>Clear</Btn>
                <Btn size="xs" onClick={() => onChange(options.map((o) => o.v))}>Select all</Btn>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const counts = (rows: SessionRow[], f: (r: SessionRow) => string) => {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = f(r) || "—";
    m.set(k, (m.get(k) || 0) + 1);
  });
  return Array.from(m.entries()).map(([v, n]) => ({ v, n })).sort((a, b) => b.n - a.n);
};

export function ClassFiltersBar({
  rows, value, onChange, scopedCount,
}: {
  rows: SessionRow[];
  value: ClassFilterState;
  onChange: (f: ClassFilterState) => void;
  scopedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof ClassFilterState>(k: K, v: ClassFilterState[K]) => onChange({ ...value, [k]: v });

  const opts = useMemo(() => ({
    formats: counts(rows, (r) => r.format),
    teachers: counts(rows, (r) => r.trainerName),
    sessionNames: counts(rows, (r) => r.sessionName),
  }), [rows]);

  const activeCount =
    value.formats.length + value.teachers.length + value.sessionNames.length + value.days.length +
    (value.preset !== "all" ? 1 : 0) + (value.dayPart !== "all" ? 1 : 0) + (value.timeBand !== "all" ? 1 : 0) +
    (value.primeOnly ? 1 : 0) + (value.minCapacity ? 1 : 0) + (value.minFill ? 1 : 0) + (value.maxFill ? 1 : 0) +
    (value.minSessions !== "1" ? 1 : 0) + (value.excludeEmpty ? 1 : 0) + (value.search ? 1 : 0);

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] text-hi outline-none transition-colors placeholder:text-lo focus:border-strong";

  return (
    <div className="panel overflow-visible">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-t-[18px] px-5 py-3.5 transition-colors hover:bg-surface2"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-loc-soft text-loc">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div className="text-left">
            <span className="font-display text-[15px] font-semibold text-hi">Class Filters</span>
            <p className="text-[11px] text-lo">
              {PRESETS.find((p) => p.v === value.preset)?.l}
              {value.formats.length ? ` · ${value.formats.length} format${value.formats.length > 1 ? "s" : ""}` : ""}
              {value.teachers.length ? ` · ${value.teachers.length} teacher${value.teachers.length > 1 ? "s" : ""}` : ""}
              {" · "}<span className="num">{scopedCount}</span> sessions in scope
            </p>
          </div>
          {activeCount > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="num rounded-md bg-loc px-2 py-0.5 text-[10.5px] font-bold text-white">
              {activeCount} active
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(emptyClassFilters); }}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10.5px] font-medium text-mid transition-colors hover:border-strong hover:text-neg"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-lo transition-transform duration-300", open && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-visible border-t border-line"
          >
            <div className="space-y-6 p-6">
              {/* Date range */}
              <div>
                <p className="mb-2 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-lo">
                  Date range <Tip text="Applies to KPIs, rankings, teachers, format battle and the ledger. The full-history trend chart ignores it." />
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <Chip key={p.v} active={value.preset === p.v} onClick={() => set("preset", p.v)}>{p.l}</Chip>
                  ))}
                </div>
                {value.preset === "custom" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="date" value={value.from} onChange={(e) => set("from", e.target.value)} className={cn(inputCls, "w-auto")} />
                    <span className="text-[11px] text-lo">to</span>
                    <input type="date" value={value.to} onChange={(e) => set("to", e.target.value)} className={cn(inputCls, "w-auto")} />
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MultiSelect label="Format" options={opts.formats} selected={value.formats} onChange={(v) => set("formats", v)} tip="Class format / type column." />
                <MultiSelect label="Teacher" options={opts.teachers} selected={value.teachers} onChange={(v) => set("teachers", v)} />
                <MultiSelect label="Session name" options={opts.sessionNames} selected={value.sessionNames} onChange={(v) => set("sessionNames", v)} />
              </div>

              {/* Days */}
              <div>
                <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-lo">Weekdays</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const on = value.days.includes(d);
                    return (
                      <Chip key={d} active={on}
                        onClick={() => set("days", on ? value.days.filter((x) => x !== d) : [...value.days, d])}>
                        {d.slice(0, 3)}
                      </Chip>
                    );
                  })}
                  {value.days.length > 0 && (
                    <button onClick={() => set("days", [])} className="inline-flex items-center gap-1 text-[10.5px] text-lo hover:text-hi">
                      <X className="h-3 w-3" /> clear
                    </button>
                  )}
                </div>
              </div>

              {/* Segments */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-lo">Day part</label>
                  <Segmented value={value.dayPart} onChange={(v) => set("dayPart", v)}
                    options={[{ value: "all", label: "All" }, { value: "weekday", label: "Weekday" }, { value: "weekend", label: "Weekend" }]} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-lo">Time band</label>
                  <Segmented value={value.timeBand} onChange={(v) => set("timeBand", v)}
                    options={[{ value: "all", label: "All" }, { value: "morning", label: "AM" }, { value: "midday", label: "Midday" }, { value: "evening", label: "PM" }]} />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-lo">
                    Min sessions per slot <Tip text="Hide slots with too little evidence from the rankings." />
                  </label>
                  <Segmented value={value.minSessions} onChange={(v) => set("minSessions", v)}
                    options={[{ value: "1", label: "1+" }, { value: "3", label: "3+" }, { value: "6", label: "6+" }, { value: "10", label: "10+" }]} />
                </div>
              </div>

              {/* Numeric ranges + search */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-lo">Min capacity</label>
                  <input value={value.minCapacity} onChange={(e) => set("minCapacity", e.target.value)} placeholder="e.g. 10" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-lo">
                    Fill % range <Tip text="Session-level fill rate bounds." />
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input value={value.minFill} onChange={(e) => set("minFill", e.target.value)} placeholder="min" className={inputCls} />
                    <input value={value.maxFill} onChange={(e) => set("maxFill", e.target.value)} placeholder="max" className={inputCls} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-lo">Search</label>
                  <div className="relative">
                    <input value={value.search} onChange={(e) => set("search", e.target.value)}
                      placeholder="Session, teacher, location, format, UID…" className={cn(inputCls, "pr-8")} />
                    {value.search && (
                      <button onClick={() => set("search", "")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-lo hover:text-hi">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Chip active={value.primeOnly} onClick={() => set("primeOnly", !value.primeOnly)}>Prime time only</Chip>
                <Chip active={value.excludeEmpty} onClick={() => set("excludeEmpty", !value.excludeEmpty)}>Exclude zero-attendance</Chip>
                <span className="ml-auto text-[10.5px] text-lo">
                  Filters apply to every class table, chart, ranking and drill-down. Location tabs above still apply.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
