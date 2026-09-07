import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, BarChart3, Brain, CalendarClock, Dumbbell, Layers,
  LayoutGrid, Loader2, Moon, Package, Receipt, RefreshCw, Settings, Star, Sun, Table2,
  Trophy, Users, Wifi, Sparkles
} from "lucide-react";
import { cn } from "./utils/cn";
import { parseSheet, type SaleRow } from "./lib/types";
import { fetchDashboard } from "./lib/google";
import { applyFilters, applyFiltersIgnoringDate } from "./lib/filter";
import { applyGlobalFiltersToFlexTable } from "./lib/globalFilter";
import { computeKPIs, computeNewClientKPIs, computeLapsedKPIs, computeLateCancelKPIs, computeBookingsKPIs, computeFunnelKPIs, monthlySeries, aggregate, groupBy, isGood, type KPI } from "./lib/analytics";
import {
  parseFlexible, parseSessions, sessionInLocations, type FlexTable, type SessionRow,
} from "./lib/sessions";
import { applyAccent, buildLocationColors, locHex, locPairHex, NEUTRAL_ACCENT } from "./lib/theme";
import { compact, dateStr, intFmt, pct } from "./lib/format";
import { emptyFilters, FiltersBar, type FilterState } from "./components/Filters";
import { applyClassFilters, ClassFiltersBar, emptyClassFilters, type ClassFilterState } from "./components/ClassFilters";
import { MetricCard } from "./components/MetricCard";
import { Panel, SectionHeader, Btn, Tip } from "./components/ui";
import { TimeSection } from "./components/sections/TimeSection";
import { MixSection } from "./components/sections/MixSection";
import { PeopleSection } from "./components/sections/PeopleSection";
import { OpsSection } from "./components/sections/OpsSection";
import { InsightsSection } from "./components/sections/InsightsSection";
import { ClassSection } from "./components/sections/ClassSection";
import { AdvancedLabsSection } from "./components/sections/AdvancedLabsSection";
import { TeacherPerformanceSection } from "./components/sections/TeacherPerformanceSection";
import { NewClientsSection } from "./components/sections/NewClientsSection";
import { LapsedSection } from "./components/sections/LapsedSection";
import { LateCancellationSection } from "./components/sections/LateCancellationSection";
import { BookingsSection } from "./components/sections/BookingsSection";
import { FunnelSection } from "./components/sections/FunnelSection";
import { SettingsModal } from "./components/SettingsModal";
import { TrendChart, Donut } from "./components/Charts";

type View = "sales" | "classes" | "teachers" | "late" | "bookings" | "leads" | "members" | "newclients" | "lapsed";

const VIEW_TABS = [
  { id: "sales", label: "Sales", icon: BarChart3 },
  { id: "classes", label: "Classes", icon: Dumbbell },
  { id: "teachers", label: "Teachers", icon: Users },
  { id: "newclients", label: "New Clients", icon: Star },
  { id: "lapsed", label: "Lapsed", icon: AlertTriangle },
  { id: "late", label: "Late Cancels", icon: CalendarClock },
  { id: "bookings", label: "Bookings", icon: Receipt },
  { id: "leads", label: "Funnel", icon: Trophy },
  { id: "members", label: "Conversion", icon: Activity },
] as const;

const SALES_SECTIONS = [
  { id: "overview", label: "Overview", icon: BarChart3, title: "Command Centre",
    desc: "Headline numbers for the current selection, the full-history revenue trajectory and the category split." },
  { id: "time", label: "Time", icon: Activity, title: "Time Intelligence",
    desc: "MoM and YoY performance across the full history — date-filter independent — plus weekday economics and trading rhythm." },
  { id: "mix", label: "Mix", icon: Package, title: "Products, Categories & Locations",
    desc: "Revenue concentration, product-level economics, discounting behaviour and the cross-location distribution matrix." },
  { id: "people", label: "People", icon: Users, title: "Customers & Team",
    desc: "Lifetime value, RFM segmentation, acquisition cohorts and the sales-team leaderboard." },
  { id: "ops", label: "Ops", icon: Layers, title: "Memberships & Operations",
    desc: "Credit utilisation, deferred liability, renewal exposure, payment integrity and the raw transaction ledger." },
  { id: "insights", label: "Insights", icon: Brain, title: "Insights & Recommendations",
    desc: "Automatically generated patterns, red flags, what worked, what didn't, and a prioritised action list with modelled impact." },
  { id: "advancedlabs", label: "Smart Labs", icon: Sparkles, title: "Advanced Optimization Labs",
    desc: "What-If margin simulators, persistent pinboards, automatic alert monitors, executive markdown reports, and customer timeline explorers." },
] as const;

const CLASS_RAIL = [
  { id: "c-overview", label: "Overview", icon: LayoutGrid },
  { id: "c-slots", label: "Slots", icon: Star },
  { id: "c-teachers", label: "Teachers", icon: Users },
  { id: "c-formats", label: "Formats", icon: Trophy },
  { id: "c-changes", label: "Changes", icon: CalendarClock },
  { id: "c-timetable", label: "Timetable", icon: Table2 },
  { id: "c-ledger", label: "Ledger", icon: Receipt },
  { id: "c-schedule", label: "Schedule", icon: Activity },
  { id: "c-insights", label: "Insights", icon: Brain },
] as const;

const SECTION_KPIS: Record<string, string[]> = {
  overview: ["rev", "txn", "cust", "aov", "discrate", "newc", "success", "repeat"],
  time: ["net", "vat", "units", "atv", "upt", "median", "dailyrev", "peak", "tradedays", "txnday"],
  mix: ["disc", "discshare", "listval", "retail", "pkg", "pt", "online"],
  people: ["arpc", "ret", "freq", "ltv", "conc", "newrevshare", "sellers", "revseller", "prods", "cats", "locs"],
  ops: ["refund", "failed", "void", "liab", "memrev", "memshare", "active", "expiring", "frozen",
    "credsold", "credused", "credutil", "revcred"],
  insights: [],
};

export default function App() {
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<View>("sales");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [recurring, setRecurring] = useState<FlexTable>({ headers: [], rows: [] });
  const [teacherRec, setTeacherRec] = useState<FlexTable>({ headers: [], rows: [] });
  const [payroll, setPayroll] = useState<FlexTable>({ headers: [], rows: [] });
  const [members, setMembers] = useState<FlexTable>({ headers: [], rows: [] });
  const [bookings, setBookings] = useState<FlexTable>({ headers: [], rows: [] });
  const [leads, setLeads] = useState<FlexTable>({ headers: [], rows: [] });
  const [lapsed, setLapsed] = useState<FlexTable>({ headers: [], rows: [] });
  const [classMeta, setClassMeta] = useState({ sessionsSheet: "", recurringSheet: "", teacherSheet: "" });
  const [loading, setLoading] = useState(true);
  const [classLoading, setClassLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [classFilters, setClassFilters] = useState<ClassFilterState>(emptyClassFilters);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoReason, setDemoReason] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setClassLoading(true);
    setError(null);
    setClassError(null);
    try {
      const payload = await fetchDashboard(signal);
      const parsed = parseSheet(payload.sales);
      if (!parsed.length) throw new Error("The sales sheet returned no usable rows — check the tab name.");
      setRows(parsed);
      const parsedSessions = parseSessions(payload.classes.sessions);
      setSessions(parsedSessions);
      setRecurring(parseFlexible(payload.classes.recurring));
      setTeacherRec(parseFlexible(payload.classes.teacherRecurring));
      setPayroll(parseFlexible(payload.intelligence.payroll));
      setMembers(parseFlexible(payload.intelligence.members));
      setBookings(parseFlexible(payload.intelligence.bookings));
      setLeads(parseFlexible(payload.intelligence.leads));
      setLapsed(parseFlexible(payload.intelligence.lapsed));
      setClassMeta({
        sessionsSheet: payload.classes.sessionsSheet || "sessions",
        recurringSheet: payload.classes.recurringSheet || "—",
        teacherSheet: payload.classes.teacherSheet || "—",
      });
      if (!parsedSessions.length) setClassError("The sessions sheet returned no usable rows.");
      setLastSync(new Date(payload.syncedAt));
      setDemoMode(!!payload._demo);
      setDemoReason(payload._demoReason || null);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const message = e instanceof Error ? e.message : String(e);
      setRows([]);
      setSessions([]);
      setRecurring({ headers: [], rows: [] });
      setTeacherRec({ headers: [], rows: [] });
      setPayroll({ headers: [], rows: [] });
      setMembers({ headers: [], rows: [] });
      setBookings({ headers: [], rows: [] });
      setLeads({ headers: [], rows: [] });
      setLapsed({ headers: [], rows: [] });
      setError(message);
      setClassError(message);
      setDemoMode(false);
      setDemoReason(null);
    } finally {
      setLoading(false);
      setClassLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const maxDate = useMemo(() => {
    const t = rows.map((r) => r.paymentDate?.getTime() || 0).filter(Boolean);
    return t.length ? new Date(Math.max(...t)) : new Date();
  }, [rows]);

  /* union of sales + session locations for shared tabs */
  const locations = useMemo(() => {
    const rev = new Map<string, number>();
    rows.filter(isGood).forEach((r) => rev.set(r.location, (rev.get(r.location) || 0) + r.paymentValue));
    const sess = new Map<string, number>();
    sessions.forEach((r) => sess.set(r.location, (sess.get(r.location) || 0) + 1));
    const names = Array.from(new Set([...rev.keys(), ...sess.keys()]));
    return names
      .map((n) => ({ name: n, revenue: rev.get(n) || 0, sessions: sess.get(n) || 0 }))
      .sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);
  }, [rows, sessions]);

  const locColors = useMemo(
    () => buildLocationColors(locations.map((l) => l.name)),
    [locations]
  );

  useEffect(() => {
    const sel = filters.locations;
    const c = sel.length === 1 ? locColors.get(sel[0]) : NEUTRAL_ACCENT;
    applyAccent(locHex(c, dark), locPairHex(c, dark));
  }, [filters.locations, locColors, dark]);

  /* scroll spy across the active view */
  useEffect(() => {
    const ids = view === "sales" ? SALES_SECTIONS.map((s) => s.id) : view === "classes" ? CLASS_RAIL.map((s) => s.id) : [];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveSection(vis[0].target.id);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = view === "sales" ? sectionRefs.current[id] : document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [view, rows.length, sessions.length]);

  const { current, previous } = useMemo(() => applyFilters(rows, filters, maxDate), [rows, filters, maxDate]);
  const timeRows = useMemo(() => applyFiltersIgnoringDate(rows, filters), [rows, filters]);
  const kpis = useMemo(() => computeKPIs(current, previous), [current, previous]);
  const timeSeries = useMemo(() => monthlySeries(timeRows), [timeRows]);
  const total = useMemo(() => aggregate(current, "all"), [current]);
  const cats = useMemo(() => groupBy(current.filter(isGood), (r) => r.category), [current]);

  // Apply global filters to FlexTable data
  const filteredMembers = useMemo(() => applyGlobalFiltersToFlexTable(members, filters, maxDate), [members, filters, maxDate]);
  const filteredLapsed = useMemo(() => applyGlobalFiltersToFlexTable(lapsed, filters, maxDate), [lapsed, filters, maxDate]);
  const filteredBookings = useMemo(() => applyGlobalFiltersToFlexTable(bookings, filters, maxDate), [bookings, filters, maxDate]);
  const filteredLeads = useMemo(() => applyGlobalFiltersToFlexTable(leads, filters, maxDate), [leads, filters, maxDate]);
  const filteredPayroll = useMemo(() => applyGlobalFiltersToFlexTable(payroll, filters, maxDate), [payroll, filters, maxDate]);

  // KPIs for new sections (using filtered data)
  const newClientKpis = useMemo(() => computeNewClientKPIs(filteredMembers), [filteredMembers]);
  const lapsedKpis = useMemo(() => computeLapsedKPIs(filteredLapsed), [filteredLapsed]);
  const lateCancelKpis = useMemo(() => computeLateCancelKPIs(filteredBookings), [filteredBookings]);
  const bookingsKpis = useMemo(() => computeBookingsKPIs(filteredBookings), [filteredBookings]);
  const funnelKpis = useMemo(() => computeFunnelKPIs(filteredLeads), [filteredLeads]);

  const sectionKpis = useMemo(() => {
    const m: Record<string, KPI[]> = {};
    for (const s of SALES_SECTIONS) m[s.id] = kpis.filter((k) => (SECTION_KPIS[s.id] || []).includes(k.id));
    return m;
  }, [kpis]);

  const sparks = useMemo(() => {
    const base: Record<string, number[]> = {};
    timeSeries.forEach((s) => {
      const put = (k: string, v: number) => {
        (base[k] = base[k] || []).push(v);
      };
      put("rev", s.revenue); put("net", s.exVat); put("vat", s.vat); put("txn", s.txns);
      put("units", s.units); put("aov", s.aov); put("atv", s.atv); put("upt", s.upt);
      put("median", s.aov); put("cust", s.customers); put("newc", s.newCustomers);
      put("arpc", s.arpc); put("disc", s.discount); put("discrate", s.discountRate);
      put("listval", s.listValue); put("retail", s.retailRev); put("memrev", s.membershipRev);
      put("refund", s.refunded); put("dailyrev", s.revenue / 22); put("peak", s.revenue);
      put("tradedays", 22); put("txnday", s.txns / 22); put("discshare", s.discountedShare);
      put("pkg", s.membershipRev * 0.3); put("pt", s.membershipRev * 0.15);
      put("liab", s.membershipRev * 0.3); put("memshare", s.revenue ? (s.membershipRev / s.revenue) * 100 : 0);
      put("credutil", 65); put("revcred", s.membershipRev / Math.max(1, s.units * 2));
      put("online", 65); put("cats", 7); put("locs", 3); put("prods", 15);
      put("failed", s.refunded); put("void", s.refunded / 2); put("success", 98);
      put("credsold", s.units * 2); put("credused", s.units);
      put("freq", s.txns / Math.max(1, s.customers));
      put("ltv", s.arpc); put("conc", 45); put("newrevshare", s.customers ? (s.newCustomers / s.customers) * 100 : 0);
      put("ret", Math.max(0, s.customers - s.newCustomers));
      put("repeat", 40); put("revseller", s.revenue / 5); put("sellers", 6);
      put("active", s.customers * 0.4); put("expiring", s.customers * 0.08);
      put("frozen", s.customers * 0.03);
    });
    return base;
  }, [timeSeries]);

  const classLocRows = useMemo(
    () => sessions.filter((s) => sessionInLocations(s, filters.locations)),
    [sessions, filters.locations]
  );
  const classMaxDate = useMemo(() => {
    const t = sessions.map((r) => r.dateObj?.getTime() || 0).filter(Boolean);
    return t.length ? new Date(Math.max(...t)) : new Date();
  }, [sessions]);
  const classRows = useMemo(
    () => applyClassFilters(classLocRows, classFilters, classMaxDate),
    [classLocRows, classFilters, classMaxDate]
  );
  const classRev = classRows.reduce((s, r) => s + r.revenue, 0);

  const toggleLoc = (l: string) =>
    setFilters((f) => ({
      ...f,
      locations: f.locations.includes(l) ? f.locations.filter((x) => x !== l) : [...f.locations, l],
    }));

  const goTo = (id: string) => {
    const el = view === "sales" ? sectionRefs.current[id] : document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const KpiRow = ({ list }: { list: KPI[] }) =>
    !list.length ? null : (
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {list.map((k, i) => (
          <MetricCard key={k.id} kpi={k} index={i} spark={sparks[k.id]} />
        ))}
      </div>
    );

  const rail = view === "sales" ? SALES_SECTIONS : view === "classes" ? CLASS_RAIL : [];
  const activeView = VIEW_TABS.find((item) => item.id === view) || VIEW_TABS[0];
  const ActiveViewIcon = activeView.icon;

  return (
    <div className="min-h-screen bg-app text-hi">
      {/* ══════════ HEADER ══════════ */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-8 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-5 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-loc text-white shadow-md">
                <motion.span animate={{ rotate: [0, -7, 7, 0], scale: [1, 1.08, 1.08, 1] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 2 }}><ActiveViewIcon className="h-5 w-5" /></motion.span>
              </div>
              <div>
                <h1 className="font-display text-[28px] font-bold leading-none tracking-tight sm:text-[32px]">
                  {activeView.label} Intelligence
                </h1>
                <p className="mt-1.5 text-[12px] text-lo">
                  {view === "sales"
                    ? `${intFmt(rows.length)} line items · ${locations.length} locations · through ${dateStr(maxDate)}`
                    : view === "classes" ? `${intFmt(sessions.length)} sessions · ${locations.length} locations · ${classMeta.sessionsSheet || "sessions"}`
                    : view === "teachers" ? `${intFmt(payroll.rows.length)} payroll records · ${intFmt(bookings.rows.length)} booking records`
                    : view === "newclients" || view === "members" ? `${intFmt(members.rows.length)} new client records`
                    : view === "lapsed" ? `${intFmt(lapsed.rows.length)} lapsed member records`
                    : view === "late" || view === "bookings" ? `${intFmt(bookings.rows.length)} booking records`
                    : view === "leads" ? `${intFmt(leads.rows.length)} leads in pipeline`
                    : "Live operational intelligence from Google Sheets"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* view switch */}
              <div className="no-scrollbar mr-1 flex max-w-[72vw] overflow-x-auto rounded-xl border border-line bg-surface2 p-1">
                {VIEW_TABS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setView(item.id)} className={cn("relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors", view === item.id ? "text-white" : "text-lo hover:text-mid")}>
                  {view === item.id && <motion.span layoutId="viewpill" className="absolute inset-0 rounded-lg bg-loc" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <Icon className="relative h-3.5 w-3.5" /><span className="relative">{item.label}</span>
                </button>; })}
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold",
                loading || classLoading
                  ? "border-line bg-surface2 text-lo"
                  : demoMode
                    ? "border-amber-300/40 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-400"
                    : (view === "sales" ? !error : !classError)
                      ? "border-pos/30 bg-pos-soft text-pos"
                      : "border-neg/30 bg-neg-soft text-neg"
              )}>
                {loading || classLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : demoMode ? <Sparkles className="h-3.5 w-3.5" /> : !error ? <Wifi className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {loading || classLoading ? "Syncing" : demoMode ? "Demo data" : !error ? "Live sheets" : "Unavailable"}
              </span>
              {lastSync && <span className="hidden num text-[10px] text-lo md:inline">{lastSync.toLocaleTimeString()}</span>}
              <Btn onClick={() => loadData()} title="Refresh data">
                {loading || classLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Btn>
              <button onClick={() => setDark((d) => !d)}
                className="relative flex h-9 w-[62px] items-center rounded-full border border-line bg-surface2 px-1 transition-colors"
                title="Toggle theme">
                <motion.span layout transition={{ type: "spring", stiffness: 480, damping: 32 }}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-full shadow-sm",
                    dark ? "ml-auto bg-surface3" : "mr-auto bg-surface")}>
                  {dark ? <Moon className="h-3.5 w-3.5 text-hi" /> : <Sun className="h-3.5 w-3.5 text-warn" />}
                </motion.span>
              </button>
              <button onClick={() => setSettingsOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface2 text-lo transition-colors hover:bg-surface2 hover:text-hi"
                title="Settings">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── LOCATION TABS ── */}
          <div className="flex flex-wrap items-center gap-2.5 pb-4">
            <span className="mr-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-lo">
              Locations
            </span>
            <button
              onClick={() => setFilters((f) => ({ ...f, locations: [] }))}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.98]",
                filters.locations.length === 0
                  ? "border-transparent bg-loc text-white shadow-md"
                  : "border-line bg-surface text-mid hover:border-strong hover:text-hi"
              )}>
              All locations
              <span className={cn("num rounded-md px-1.5 py-px text-[10px]",
                filters.locations.length === 0 ? "bg-white/20 text-white" : "bg-surface3 text-lo")}>
                {view === "sales"
                  ? compact(locations.reduce((s, l) => s + l.revenue, 0))
                  : `${intFmt(locations.reduce((s, l) => s + l.sessions, 0))} sess`}
              </span>
            </button>
            {locations.map((l) => {
              const on = filters.locations.includes(l.name);
              const c = locColors.get(l.name);
              const hex = locHex(c, dark);
              return (
                <button key={l.name} onClick={() => toggleLoc(l.name)}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.98]",
                    !on && "border-line bg-surface text-mid hover:border-strong hover:text-hi"
                  )}
                  style={on ? { borderColor: hex, backgroundColor: hex, color: "#fff", boxShadow: `0 6px 18px -6px ${hex}99` } : undefined}>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full ring-2 transition-transform duration-200 group-hover:scale-125",
                    on ? "ring-white/60" : "ring-transparent")}
                    style={{ background: on ? "#fff" : hex }} />
                  {l.name}
                  <span className={cn("num rounded-md px-1.5 py-px text-[10px]", on ? "bg-white/20 text-white" : "bg-surface3 text-lo")}>
                    {view === "sales" ? compact(l.revenue) : `${intFmt(l.sessions)} sess`}
                  </span>
                </button>
              );
            })}
            {filters.locations.length > 1 && (
              <span className="num rounded-lg bg-loc-soft px-2.5 py-1 text-[10.5px] font-semibold text-loc">
                {filters.locations.length} combined
              </span>
            )}
          </div>
        </div>

        {/* ── Section rail ── */}
        {rail.length > 0 && (
        <div className="border-t border-line bg-surface2/70">
          <div className="no-scrollbar mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-8 lg:px-12">
            {rail.map((s) => {
              const Icon = s.icon;
              const on = activeSection === s.id;
              return (
                <button key={s.id} onClick={() => goTo(s.id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 px-4 py-3 text-[12.5px] font-medium transition-colors",
                    on ? "text-hi" : "text-lo hover:text-mid"
                  )}>
                  <Icon className={cn("h-3.5 w-3.5", on && "text-loc")} />
                  {s.label}
                  {on && (
                    <motion.span layoutId="rail" className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-t-full bg-loc"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </header>

      {/* ══════════ MAIN ══════════ */}
      <main className="mx-auto max-w-[1600px] space-y-16 px-8 py-10 lg:px-12">
        {demoMode && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-sm dark:border-amber-700/30 dark:from-amber-950/40 dark:to-orange-950/40"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Demo Mode — Sample Data
                  </h3>
                  <span className="rounded-md bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-800/40 dark:text-amber-400">
                    Not live
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-amber-700/80 dark:text-amber-400/70">
                  {demoReason
                    ? <>Live data unavailable — {demoReason}. Showing sample data instead. You can configure credentials in{" "}</>
                    : <>Showing sample data to preview the dashboard. Connect your Google Sheets in{" "}</>}
                  <button onClick={() => setSettingsOpen(true)} className="font-semibold underline underline-offset-2 transition-colors hover:text-amber-900 dark:hover:text-amber-200">
                    Settings
                  </button>{" "}
                  to load live data.
                </p>
              </div>
            </div>
          </motion.div>
        )}
        <FiltersBar rows={rows} value={filters} onChange={setFilters} />

        {view === "classes" && (
          <div className="space-y-4">
            <ClassFiltersBar rows={classLocRows} value={classFilters} onChange={setClassFilters} scopedCount={classRows.length} />
            <div className="panel px-6 py-4">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <span className="kicker">Data source</span>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold",
                    classLoading ? "border-line bg-surface2 text-lo" : classError ? "border-neg/30 bg-neg-soft text-neg" : "border-pos/30 bg-pos-soft text-pos"
                  )}>
                    {classLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : classError ? <AlertTriangle className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                    {classLoading ? "Syncing" : classError ? "Unavailable" : "Live sheet"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-[11.5px] text-lo">
                  <span>Sessions <b className="num text-hi">{intFmt(sessions.length)}</b></span>
                  <span>Recurring <b className="num text-hi">{intFmt(recurring.rows.length)}</b></span>
                  <span>Teachers <b className="num text-hi">{intFmt(teacherRec.rows.length)}</b></span>
                  <span>In scope <b className="num text-loc">{intFmt(classRows.length)}</b></span>
                </div>
                {classLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-lo" />}
              </div>
              {classError && (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-neg/20 bg-neg-soft px-3.5 py-2.5 text-[11.5px] text-neg" role="alert">
                  <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{classError.slice(0, 240)}</span>
                  <Btn size="xs" onClick={() => loadData()}>Retry</Btn>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && !rows.length && view === "sales" ? (
          <DashboardLoader label="Syncing sales intelligence" />
        ) : error && !rows.length && view === "sales" ? (
          <LoadError title="Sales data is unavailable" message={error} onRetry={() => loadData()} onOpenSettings={() => setSettingsOpen(true)} />
        ) : view === "sales" ? (
          <>
            <section id="overview" ref={(el) => { sectionRefs.current.overview = el; }} className="scroll-mt-44">
              <SectionHeader index={1} title={SALES_SECTIONS[0].title} description={SALES_SECTIONS[0].desc}
                meta={<span className="num rounded-lg border border-line bg-surface px-2.5 py-1 text-[10.5px] text-lo">
                  {compact(total.revenue)} gross · {intFmt(total.customers)} customers
                </span>} />
              <div className="space-y-6">
                <KpiRow list={sectionKpis.overview} />
                <div className="grid gap-5 lg:grid-cols-3">
                  <Panel className="lg:col-span-2" title="Revenue Trajectory — Full History"
                    subtitle="Toggle the primary metric and overlay to test relationships"
                    tip="Always spans the full history; only the date filter is bypassed. Location and other filters still apply."
                    right={<span className="num rounded-md border border-line bg-surface2 px-2 py-1 text-[9.5px] font-semibold text-lo">Full history · ignores date filter</span>}>
                    <OverviewChart series={timeSeries} />
                  </Panel>
                  <Panel title="Category Mix" subtitle="Share of filtered revenue">
                    <Donut data={cats.slice(0, 7).map((c) => ({ name: c.key, value: c.revenue }))} height={296} inner={64} />
                    <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-mid">
                      <b className="text-hi">{cats[0]?.key}</b> leads with {pct(cats[0]?.share || 0)} of revenue
                      ({compact(cats[0]?.revenue || 0)}). Concentration above 45% in one line is a resilience risk.
                    </p>
                  </Panel>
                </div>
              </div>
            </section>

            <section id="time" ref={(el) => { sectionRefs.current.time = el; }} className="scroll-mt-44">
              <SectionHeader index={2} title={SALES_SECTIONS[1].title} description={SALES_SECTIONS[1].desc} />
              <div className="space-y-6">
                <KpiRow list={sectionKpis.time} />
                <TimeSection rows={current} timeRows={timeRows} />
              </div>
            </section>

            <section id="mix" ref={(el) => { sectionRefs.current.mix = el; }} className="scroll-mt-44">
              <SectionHeader index={3} title={SALES_SECTIONS[2].title} description={SALES_SECTIONS[2].desc} />
              <div className="space-y-6">
                <KpiRow list={sectionKpis.mix} />
                <MixSection rows={current} prevRows={previous} />
              </div>
            </section>

            <section id="people" ref={(el) => { sectionRefs.current.people = el; }} className="scroll-mt-44">
              <SectionHeader index={4} title={SALES_SECTIONS[3].title} description={SALES_SECTIONS[3].desc} />
              <div className="space-y-6">
                <KpiRow list={sectionKpis.people} />
                <PeopleSection rows={current} />
              </div>
            </section>

            <section id="ops" ref={(el) => { sectionRefs.current.ops = el; }} className="scroll-mt-44">
              <SectionHeader index={5} title={SALES_SECTIONS[4].title} description={SALES_SECTIONS[4].desc} />
              <div className="space-y-6">
                <KpiRow list={sectionKpis.ops} />
                <OpsSection rows={current} />
              </div>
            </section>

            <section id="insights" ref={(el) => { sectionRefs.current.insights = el; }} className="scroll-mt-44">
              <SectionHeader index={6} title={SALES_SECTIONS[5].title} description={SALES_SECTIONS[5].desc} />
              <InsightsSection rows={current} prevRows={previous} />
            </section>

            <section id="advancedlabs" ref={(el) => { sectionRefs.current.advancedlabs = el; }} className="scroll-mt-44">
              <SectionHeader index={7} title={SALES_SECTIONS[6].title} description={SALES_SECTIONS[6].desc} />
              <AdvancedLabsSection sales={current} sessions={sessions} dark={dark} />
            </section>
          </>
        ) : view === "classes" ? (
          <>
            {classLoading && !sessions.length ? (
              <DashboardLoader label="Syncing class intelligence" />
            ) : classError && !sessions.length ? (
              <LoadError title="Class data is unavailable" message={classError} onRetry={() => loadData()} onOpenSettings={() => setSettingsOpen(true)} />
            ) : (
              <ClassSection
                sessions={sessions}
                locations={filters.locations}
                recurring={recurring}
                teacherRecurring={teacherRec}
                dark={dark}
                filters={classFilters}
              />
            )}
          </>
        ) : loading ? (
          <DashboardLoader label={`Syncing ${activeView.label.toLowerCase()} intelligence`} />
        ) : error ? (
          <LoadError title={`${activeView.label} data is unavailable`} message={error} onRetry={() => loadData()} onOpenSettings={() => setSettingsOpen(true)} />
        ) : view === "teachers" ? (
          <TeacherPerformanceSection payroll={filteredPayroll} sessions={sessions} members={filteredMembers} />
        ) : view === "newclients" ? (
          <NewClientsSection members={filteredMembers} kpis={newClientKpis} />
        ) : view === "lapsed" ? (
          <LapsedSection lapsed={filteredLapsed} kpis={lapsedKpis} />
        ) : view === "late" ? (
          <LateCancellationSection bookings={filteredBookings} kpis={lateCancelKpis} />
        ) : view === "bookings" ? (
          <BookingsSection bookings={filteredBookings} kpis={bookingsKpis} />
        ) : view === "leads" ? (
          <FunnelSection leads={filteredLeads} kpis={funnelKpis} />
        ) : (
          <NewClientsSection members={filteredMembers} kpis={newClientKpis} />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-[10.5px] text-lo">
          <span className="num">
            {view === "sales"
              ? `${intFmt(current.length)} rows in scope · ${compact(total.revenue)} gross · ${intFmt(total.customers)} customers`
              : `${intFmt(classRows.length)} sessions in scope · ${compact(classRev)} revenue`}
          </span>
          <span className="num">
            {demoMode
              ? "Demo data · Configure Google Sheets in Settings for live data"
              : view === "sales"
                ? "Server-managed Google Sheets feed"
                : `${classMeta.sessionsSheet || "sessions"} · ${classMeta.recurringSheet || "recurring"} · ${classMeta.teacherSheet || "teacher recurring"}`}
          </span>
        </footer>
      </main>

      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onSaved={() => loadData()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardLoader({ label }: { label: string }) {
  return (
    <div className="loader-stage" role="status" aria-live="polite" aria-label={label}>
      <div className="loader-brand" aria-hidden="true">
        <span className="loader-orbit loader-orbit-a" />
        <span className="loader-orbit loader-orbit-b" />
        <BarChart3 className="h-5 w-5" />
      </div>
      <div className="text-center">
        <p className="font-display text-sm font-semibold text-hi">{label}</p>
        <p className="mt-1 text-[11px] text-lo">Reading the latest Google Sheets data securely</p>
      </div>
      <div className="loader-progress" aria-hidden="true"><span /></div>
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => <div key={index} className="skeleton h-[86px] rounded-xl" style={{ animationDelay: `${index * 35}ms` }} />)}
      </div>
    </div>
  );
}

function LoadError({ title, message, onRetry, onOpenSettings }: { title: string; message: string; onRetry: () => void; onOpenSettings?: () => void }) {
  const isCredentialsError = /missing|credential|configuration|GOOGLE_CLIENT|OAuth/i.test(message);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-neg/20 bg-surface px-8 py-12 text-center shadow-sm" role="alert">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neg-soft text-neg"><AlertTriangle className="h-5 w-5" /></span>
      <h2 className="font-display text-lg font-semibold text-hi">{title}</h2>
      <p className="mt-2 max-w-md text-[12px] leading-relaxed text-mid">{message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-loc px-5 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loc focus-visible:ring-offset-2">
          <RefreshCw className="h-3.5 w-3.5" /> Retry sync
        </button>
        {isCredentialsError && onOpenSettings && (
          <button onClick={onOpenSettings} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-loc/30 bg-loc-soft px-5 py-2.5 text-[12px] font-semibold text-loc transition-colors hover:bg-loc-soft/80">
            <Settings className="h-3.5 w-3.5" /> Open Settings
          </button>
        )}
      </div>
      {isCredentialsError && (
        <p className="mt-4 max-w-md text-[11px] leading-relaxed text-lo">
          Configure your Google OAuth credentials in Settings to connect to your spreadsheets.
        </p>
      )}
    </div>
  );
}

/* ── Interactive overview chart (full history) ── */
function OverviewChart({ series }: {
  series: { label: string; revenue: number; txns: number; aov: number; cumulative: number; newCustomers: number }[];
}) {
  const [metric, setMetric] = useState<"revenue" | "txns" | "aov" | "cumulative">("revenue");
  const [overlay, setOverlay] = useState<"txns" | "aov" | "newCustomers" | "none">("aov");

  const data = series.map((s) => ({
    label: s.label, revenue: s.revenue, txns: s.txns,
    aov: s.aov, cumulative: s.cumulative, newCustomers: s.newCustomers,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface2/50 px-3 py-2">
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">Primary</span>
        {(["revenue", "txns", "aov", "cumulative"] as const).map((m) => (
          <Btn key={m} size="xs" active={metric === m} onClick={() => setMetric(m)}>{m}</Btn>
        ))}
        <span className="mx-1 h-4 w-px bg-[rgb(var(--line))]" />
        <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-wider text-lo">Overlay</span>
        {(["none", "txns", "aov", "newCustomers"] as const).map((m) => (
          <Btn key={m} size="xs" active={overlay === m} onClick={() => setOverlay(m)}>{m === "none" ? "off" : m}</Btn>
        ))}
      </div>
      <div className="p-2">
        <TrendChart data={data}
          bars={[{ key: metric, name: metric }]}
          lines={overlay === "none" ? [] : [{ key: overlay, name: overlay }]}
          height={300} />
      </div>
      <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-mid">
        When the bars move but the overlay line stays flat, growth is <b className="text-hi">volume-led</b> and durable.
        When the line drives the bars, growth is <b className="text-hi">ticket-led</b> and more fragile — check whether
        discounting or mix is doing the work.
      </p>
    </div>
  );
}
