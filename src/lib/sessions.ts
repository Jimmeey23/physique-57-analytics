import type { KPI } from "./analytics";

/* ═══════════════════ Types ═══════════════════ */

export interface SessionRow {
  trainerId: string;
  firstName: string;
  lastName: string;
  trainerName: string;
  sessionId: string;
  sessionName: string;
  capacity: number;
  checkedIn: number;
  lateCancelled: number;
  booked: number;
  complimentary: number;
  location: string;
  date: string;
  day: string;
  time: string;
  revenue: number;
  nonPaid: number;
  uniqueId1: string;
  uniqueId2: string;
  memberships: number;
  packages: number;
  introOffers: number;
  singleClasses: number;
  format: string;
  delivery: string;
  classes: number;
  // derived
  dateObj: Date | null;
  ym: string;
  year: number;
  month: number;
  dow: number; // 0 Sun
  hour: number;
  slot: string; // HH:MM
  fillRate: number;
  bookRate: number;
  showRate: number;
  revPerHead: number;
  formatNorm: "barre" | "power" | "strength" | "other";
  prime: boolean;
}

/* ═══════════════════ Parsing ═══════════════════ */

const NUM = /[^0-9.\-]/g;

/** Safe string coerce — Sheets API returns numbers for numeric cells. */
const asStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v).trim();
};

const toNum = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = asStr(v);
  if (!t || t === "-") return 0;
  const n = parseFloat(t.replace(NUM, ""));
  return Number.isFinite(n) ? n : 0;
};

const DOWS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseDate(v: unknown): Date | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  const t = asStr(v);
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = parseFloat(t);
    if (n > 20000 && n < 80000) return new Date(Math.round((n - 25569) * 86400 * 1000));
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

/** Sheets time serials are fractions of a day (12:45 → 0.53125). */
function parseTime(v: unknown): { hour: number; slot: string; display: string } {
  const fracFromSerial = (n: number) => {
    const dayFrac = n - Math.floor(n);
    const totalMins = Math.round(dayFrac * 24 * 60) % (24 * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { hour: h + m / 60, slot, display: `${slot}:00` };
  };
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 2) return fracFromSerial(v);
  const t = asStr(v);
  const hm = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (hm) {
    const h = +hm[1];
    const m = +hm[2];
    const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return { hour: h + m / 60, slot, display: t };
  }
  const n = parseFloat(t);
  if (Number.isFinite(n) && n >= 0 && n < 2) return fracFromSerial(n);
  return { hour: 12, slot: t.slice(0, 5) || "12:00", display: t };
}

function normFormat(s: unknown): SessionRow["formatNorm"] {
  const t = asStr(s).toLowerCase();
  if (t.includes("power")) return "power";
  if (t.includes("strength")) return "strength";
  if (t.includes("barre")) return "barre";
  return "other";
}

export function parseSessions(values: string[][]): SessionRow[] {
  if (!values || values.length < 2) return [];
  const header = values[0].map((h) => (h || "").toLowerCase().trim().replace(/[^a-z0-9]/g, ""));
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const IDX = {
    trainerId: col("trainerid", "trainer", "coachid"),
    first: col("firstname", "fname"),
    last: col("lastname", "lname"),
    trainer: col("trainer", "trainername", "coach", "instructor"),
    sessionId: col("sessionid", "session", "id"),
    sessionName: col("sessionname", "classname", "name", "title"),
    capacity: col("capacity", "cap", "seats", "spots"),
    checked: col("checkedin", "checked", "attended", "attendance", "checkins"),
    late: col("latecancelled", "latecancel", "latecancels", "cancellations"),
    booked: col("booked", "bookings", "reserved", "registrations"),
    comp: col("complimentary", "comp", "comps", "free"),
    location: col("location", "studio", "venue", "site"),
    date: col("date", "sessiondate", "day", "classdate"),
    dayName: col("day", "weekday", "dayofweek"),
    time: col("time", "starttime", "sessiontime", "slot"),
    revenue: col("revenue", "rev", "sales", "amount", "total"),
    nonPaid: col("nonpaid", "unpaid", "noshow", "noshows"),
    uid1: col("uniqueid1", "uid1", "id1", "slotid"),
    uid2: col("uniqueid2", "uid2", "id2", "teacherslotid"),
    mem: col("memberships", "members"),
    pkg: col("packages"),
    intro: col("introoffers", "intro", "trial"),
    single: col("singleclasses", "singles", "dropin", "dropins"),
    format: col("type", "format", "program", "modality"),
    delivery: col("class", "classtype", "delivery", "category"),
    classes: col("classes"),
  };
  const g = (r: unknown[], i: number) => (i >= 0 ? asStr(r[i]) : "");
  const raw = (r: unknown[], i: number) => (i >= 0 ? r[i] : undefined);

  const out: SessionRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r || r.every((c) => !asStr(c))) continue;
    const first = g(r, IDX.first);
    const last = g(r, IDX.last);
    let trainer = g(r, IDX.trainer);
    if (!trainer) trainer = `${first} ${last}`.trim() || "Unknown";
    const dateRaw = raw(r, IDX.date);
    const dObj = parseDate(dateRaw);
    const dateStr = dObj
      ? `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`
      : asStr(dateRaw);
    const dayRaw = g(r, IDX.dayName) || (dObj ? ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dObj.getDay()] : "");
    const timeParsed = parseTime(raw(r, IDX.time));
    const timeRaw = timeParsed.display;
    const hour = timeParsed.hour;
    const slot = timeParsed.slot;
    const cap = toNum(g(r, IDX.capacity));
    const checked = toNum(g(r, IDX.checked));
    const booked = toNum(g(r, IDX.booked));
    const rev = toNum(g(r, IDX.revenue));
    const format = g(r, IDX.format) || g(r, IDX.delivery) || "Unknown";
    const fNorm = normFormat(format);
    const dow = DOWS.indexOf(dayRaw.toLowerCase());
    const prime =
      (dow >= 1 && dow <= 5 && ((hour >= 6.5 && hour < 10.5) || (hour >= 17 && hour < 20.5))) ||
      ((dow === 0 || dow === 6) && hour >= 8 && hour < 13.5);
    // fallback UIDs when sheet lacks them
    const loc = g(r, IDX.location) || "Unspecified";
    const uid1 =
      g(r, IDX.uid1) ||
      `${format}｜${dayRaw}｜${slot}｜${loc}`.toLowerCase();
    const uid2 = g(r, IDX.uid2) || `${uid1}｜${trainer}`.toLowerCase();
    out.push({
      trainerId: g(r, IDX.trainerId),
      firstName: first,
      lastName: last,
      trainerName: trainer,
      sessionId: g(r, IDX.sessionId) || `row-${i}`,
      sessionName: g(r, IDX.sessionName) || format,
      capacity: cap,
      checkedIn: checked,
      lateCancelled: toNum(g(r, IDX.late)),
      booked,
      complimentary: toNum(g(r, IDX.comp)),
      location: loc,
      date: dateStr,
      day: dayRaw || "—",
      time: timeRaw,
      revenue: rev,
      nonPaid: toNum(g(r, IDX.nonPaid)),
      uniqueId1: uid1,
      uniqueId2: uid2,
      memberships: toNum(g(r, IDX.mem)),
      packages: toNum(g(r, IDX.pkg)),
      introOffers: toNum(g(r, IDX.intro)),
      singleClasses: toNum(g(r, IDX.single)),
      format,
      delivery: g(r, IDX.delivery),
      classes: toNum(g(r, IDX.classes)),
      dateObj: dObj,
      ym: dObj ? `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}` : "",
      year: dObj ? dObj.getFullYear() : 0,
      month: dObj ? dObj.getMonth() + 1 : 0,
      dow: dow >= 0 ? dow : dObj ? dObj.getDay() : -1,
      hour,
      slot,
      fillRate: cap > 0 ? (checked / cap) * 100 : 0,
      bookRate: cap > 0 ? (Math.min(booked, cap * 2) / cap) * 100 : 0,
      showRate: booked > 0 ? (checked / booked) * 100 : 0,
      revPerHead: checked > 0 ? rev / checked : 0,
      formatNorm: fNorm,
      prime,
    });
  }
  return out;
}

/* ═══════════════════ Flexible table (recurring feeds) ═══════════════════ */

export interface FlexTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseFlexible(values: unknown[][]): FlexTable {
  if (!values || values.length < 2) return { headers: [], rows: [] };
  const headers = values[0].map((h) => asStr(h) || "col");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r || r.every((c) => !asStr(c))) continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, j) => (rec[h] = asStr(r[j])));
    rows.push(rec);
  }
  return { headers, rows };
}

/* ═══════════════════ Location matching (sales tabs ↔ sessions) ═══════════════════ */

function locKey(s: unknown) {
  return asStr(s).toLowerCase().split(",")[0].replace(/[^a-z0-9 ]/g, "").trim();
}

export function sessionInLocations(s: SessionRow, selected: string[]): boolean {
  if (!selected.length) return true;
  const k = locKey(s.location);
  return selected.some((l) => {
    const lk = locKey(l);
    return k === lk || k.includes(lk) || lk.includes(k);
  });
}

/* ═══════════════════ Aggregations ═══════════════════ */

export interface SlotAgg {
  key: string;
  label: string;
  format: string;
  formatNorm: SessionRow["formatNorm"];
  location: string;
  day: string;
  slot: string;
  teacher: string; // for uid2 (primary); for uid1: "n teachers"
  teachers: number;
  sessions: number;
  capacity: number;
  booked: number;
  checked: number;
  lateCancelled: number;
  comp: number;
  revenue: number;
  fillRate: number;
  bookRate: number;
  showRate: number;
  classAvg: number;
  revPerSession: number;
  revPerHead: number;
  noShowRate: number;
  compShare: number;
  consistency: number;
  trendPP: number;
  composite: number;
  firstDate: string;
  lastDate: string;
  rows: SessionRow[];
}

function std(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  return Math.sqrt(nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length);
}

export function aggregateSlots(rows: SessionRow[], mode: "uid1" | "uid2"): SlotAgg[] {
  const m = new Map<string, SessionRow[]>();
  rows.forEach((r) => {
    const k = mode === "uid1" ? r.uniqueId1 : r.uniqueId2;
    if (!k) return;
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  });
  const aggs: SlotAgg[] = Array.from(m.entries()).map(([key, rs]) => {
    const sorted = [...rs].sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
    const cap = rs.reduce((s, r) => s + r.capacity, 0);
    const booked = rs.reduce((s, r) => s + r.booked, 0);
    const checked = rs.reduce((s, r) => s + r.checkedIn, 0);
    const rev = rs.reduce((s, r) => s + r.revenue, 0);
    const late = rs.reduce((s, r) => s + r.lateCancelled, 0);
    const comp = rs.reduce((s, r) => s + r.complimentary, 0);
    const perSession = rs.map((r) => r.checkedIn);
    const mean = perSession.length ? checked / perSession.length : 0;
    const cv = mean > 0 ? std(perSession) / mean : 1;
    const consistency = Math.max(0, Math.min(100, 100 - cv * 120));
    const third = Math.max(1, Math.floor(sorted.length / 3));
    const firstFills = sorted.slice(0, third).map((r) => r.fillRate);
    const lastFills = sorted.slice(-third).map((r) => r.fillRate);
    const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
    const trendPP = sorted.length >= 4 ? avg(lastFills) - avg(firstFills) : 0;
    const teachers = new Set(rs.map((r) => r.trainerName)).size;
    const f0 = rs[0];
    return {
      key,
      label: `${f0.sessionName} · ${f0.day} ${f0.slot}`,
      format: f0.format,
      formatNorm: f0.formatNorm,
      location: f0.location,
      day: f0.day,
      slot: f0.slot,
      teacher: mode === "uid2" ? f0.trainerName : teachers === 1 ? f0.trainerName : `${teachers} teachers`,
      teachers,
      sessions: rs.length,
      capacity: cap,
      booked,
      checked,
      lateCancelled: late,
      comp,
      revenue: rev,
      fillRate: cap ? (checked / cap) * 100 : 0,
      bookRate: cap ? (booked / cap) * 100 : 0,
      showRate: booked ? (checked / booked) * 100 : 0,
      classAvg: rs.length ? checked / rs.length : 0,
      revPerSession: rs.length ? rev / rs.length : 0,
      revPerHead: checked ? rev / checked : 0,
      noShowRate: booked ? (Math.max(0, booked - checked) / booked) * 100 : 0,
      compShare: checked + comp ? (comp / (checked + comp)) * 100 : 0,
      consistency,
      trendPP,
      composite: 0,
      firstDate: sorted[0]?.date || "",
      lastDate: sorted[sorted.length - 1]?.date || "",
      rows: sorted,
    };
  });
  // composite: fill 35 · rev/session (norm) 25 · show 15 · consistency 15 · trend 10
  const maxRev = Math.max(1, ...aggs.map((a) => a.revPerSession));
  aggs.forEach((a) => {
    const trendScore = Math.max(0, Math.min(100, 50 + a.trendPP * 2.5));
    a.composite =
      a.fillRate * 0.35 +
      (a.revPerSession / maxRev) * 100 * 0.25 +
      Math.min(100, a.showRate) * 0.15 +
      a.consistency * 0.15 +
      trendScore * 0.1;
  });
  return aggs.sort((a, b) => b.composite - a.composite);
}

export interface FormatStat {
  key: string;
  label: string;
  sessions: number;
  capacity: number;
  booked: number;
  checked: number;
  revenue: number;
  fillRate: number;
  showRate: number;
  classAvg: number;
  revPerSession: number;
  revPerHead: number;
  share: number;
  primeFill: number;
  offFill: number;
  teachers: number;
  locations: number;
  slots: number;
  lateRate: number;
  compShare: number;
  monthly: { ym: string; label: string; sessions: number; fill: number; checked: number; revenue: number }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatStats(rows: SessionRow[]): FormatStat[] {
  const total = rows.reduce((s, r) => s + r.revenue, 0) || 1;
  const by = new Map<string, SessionRow[]>();
  rows.forEach((r) => {
    const k = r.formatNorm === "other" ? r.format : r.formatNorm;
    const a = by.get(k);
    if (a) a.push(r);
    else by.set(k, [r]);
  });
  const labelFor = (k: string) =>
    k === "barre" ? "Barre 57" : k === "power" ? "PowerCycle" : k === "strength" ? "Strength Lab" : k;
  return Array.from(by.entries())
    .map(([key, rs]) => {
      const cap = rs.reduce((s, r) => s + r.capacity, 0);
      const booked = rs.reduce((s, r) => s + r.booked, 0);
      const checked = rs.reduce((s, r) => s + r.checkedIn, 0);
      const rev = rs.reduce((s, r) => s + r.revenue, 0);
      const prime = rs.filter((r) => r.prime);
      const off = rs.filter((r) => !r.prime);
      const pCap = prime.reduce((s, r) => s + r.capacity, 0) || 1;
      const oCap = off.reduce((s, r) => s + r.capacity, 0) || 1;
      const mm = new Map<string, SessionRow[]>();
      rs.forEach((r) => {
        if (!r.ym) return;
        const a = mm.get(r.ym);
        if (a) a.push(r);
        else mm.set(r.ym, [r]);
      });
      const monthly = Array.from(mm.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([ym, list]) => {
          const c = list.reduce((s, r) => s + r.capacity, 0) || 1;
          const [y, m] = ym.split("-");
          return {
            ym,
            label: `${MONTHS[+m - 1]} ${y.slice(2)}`,
            sessions: list.length,
            fill: (list.reduce((s, r) => s + r.checkedIn, 0) / c) * 100,
            checked: list.reduce((s, r) => s + r.checkedIn, 0),
            revenue: list.reduce((s, r) => s + r.revenue, 0),
          };
        });
      return {
        key,
        label: labelFor(key),
        sessions: rs.length,
        capacity: cap,
        booked,
        checked,
        revenue: rev,
        fillRate: cap ? (checked / cap) * 100 : 0,
        showRate: booked ? (checked / booked) * 100 : 0,
        classAvg: rs.length ? checked / rs.length : 0,
        revPerSession: rs.length ? rev / rs.length : 0,
        revPerHead: checked ? rev / checked : 0,
        share: (rev / total) * 100,
        primeFill: (prime.reduce((s, r) => s + r.checkedIn, 0) / pCap) * 100,
        offFill: (off.reduce((s, r) => s + r.checkedIn, 0) / oCap) * 100,
        teachers: new Set(rs.map((r) => r.trainerName)).size,
        locations: new Set(rs.map((r) => r.location)).size,
        slots: new Set(rs.map((r) => r.uniqueId1)).size,
        lateRate: booked ? (rs.reduce((s, r) => s + r.lateCancelled, 0) / booked) * 100 : 0,
        compShare: checked ? (rs.reduce((s, r) => s + r.complimentary, 0) / checked) * 100 : 0,
        monthly,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface TeacherStat {
  name: string;
  sessions: number;
  formats: string[];
  locations: string[];
  capacity: number;
  booked: number;
  checked: number;
  revenue: number;
  fillRate: number;
  showRate: number;
  classAvg: number;
  revPerSession: number;
  consistency: number;
  trendPP: number;
  bestSlot: string;
  bestSlotFill: number;
  rows: SessionRow[];
}

export function teacherStats(rows: SessionRow[]): TeacherStat[] {
  const by = new Map<string, SessionRow[]>();
  rows.forEach((r) => {
    const a = by.get(r.trainerName);
    if (a) a.push(r);
    else by.set(r.trainerName, [r]);
  });
  return Array.from(by.entries())
    .map(([name, rs]) => {
      const sorted = [...rs].sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
      const cap = rs.reduce((s, r) => s + r.capacity, 0);
      const booked = rs.reduce((s, r) => s + r.booked, 0);
      const checked = rs.reduce((s, r) => s + r.checkedIn, 0);
      const per = rs.map((r) => r.checkedIn);
      const mean = per.length ? checked / per.length : 0;
      const cv = mean > 0 ? std(per) / mean : 1;
      const third = Math.max(1, Math.floor(sorted.length / 3));
      const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
      const trendPP =
        sorted.length >= 4
          ? avg(sorted.slice(-third).map((r) => r.fillRate)) - avg(sorted.slice(0, third).map((r) => r.fillRate))
          : 0;
      const slotMap = new Map<string, SessionRow[]>();
      rs.forEach((r) => {
        const a = slotMap.get(r.uniqueId1);
        if (a) a.push(r);
        else slotMap.set(r.uniqueId1, [r]);
      });
      let best = "", bestF = -1;
      slotMap.forEach((list) => {
        if (list.length < 3) return;
        const c = list.reduce((s, r) => s + r.capacity, 0) || 1;
        const f = (list.reduce((s, r) => s + r.checkedIn, 0) / c) * 100;
        if (f > bestF) {
          bestF = f;
          best = `${list[0].sessionName} · ${list[0].day} ${list[0].slot}`;
        }
      });
      return {
        name,
        sessions: rs.length,
        formats: Array.from(new Set(rs.map((r) => r.format))),
        locations: Array.from(new Set(rs.map((r) => r.location))),
        capacity: cap,
        booked,
        checked,
        revenue: rs.reduce((s, r) => s + r.revenue, 0),
        fillRate: cap ? (checked / cap) * 100 : 0,
        showRate: booked ? (checked / booked) * 100 : 0,
        classAvg: rs.length ? checked / rs.length : 0,
        revPerSession: rs.length ? rs.reduce((s, r) => s + r.revenue, 0) / rs.length : 0,
        consistency: Math.max(0, Math.min(100, 100 - cv * 120)),
        trendPP,
        bestSlot: best || "—",
        bestSlotFill: bestF < 0 ? 0 : bestF,
        rows: sorted,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/* ═══════════════════ Schedule changes ═══════════════════ */

export interface ScheduleChange {
  kind: "Teacher swap" | "New slot" | "Retired slot" | "Capacity change" | "Slot moved";
  slot: string;
  detail: string;
  beforeFill: number | null;
  afterFill: number | null;
  deltaPP: number | null;
  verdict: "worked" | "didn't" | "watch" | "info";
  date: string;
  rows: SessionRow[];
}

export function detectChanges(rows: SessionRow[]): ScheduleChange[] {
  const out: ScheduleChange[] = [];
  if (!rows.length) return out;
  const times = rows.map((r) => r.dateObj?.getTime() || 0).filter(Boolean);
  const gStart = Math.min(...times);
  const gEnd = Math.max(...times);
  const DAY = 86400000;

  const byUid1 = new Map<string, SessionRow[]>();
  rows.forEach((r) => {
    const a = byUid1.get(r.uniqueId1);
    if (a) a.push(r);
    else byUid1.set(r.uniqueId1, [r]);
  });

  byUid1.forEach((list) => {
    const sorted = [...list].sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
    const label = `${sorted[0].sessionName} · ${sorted[0].day} ${sorted[0].slot} · ${sorted[0].location}`;
    const avgFill = (l: SessionRow[]) => {
      const c = l.reduce((s, r) => s + r.capacity, 0) || 1;
      return (l.reduce((s, r) => s + r.checkedIn, 0) / c) * 100;
    };
    // teacher swaps
    const teachers = Array.from(new Set(sorted.map((r) => r.trainerName)));
    if (teachers.length > 1 && sorted.length >= 6) {
      const mid = teachers[1];
      const idx = sorted.findIndex((r) => r.trainerName === mid);
      const before = sorted.slice(Math.max(0, idx - 4), idx);
      const after = sorted.slice(idx, idx + 4);
      if (before.length >= 2 && after.length >= 2) {
        const bf = avgFill(before);
        const af = avgFill(after);
        const d = af - bf;
        out.push({
          kind: "Teacher swap",
          slot: label,
          detail: `${sorted[0].trainerName} → ${mid}`,
          beforeFill: bf,
          afterFill: af,
          deltaPP: d,
          verdict: d >= 5 ? "worked" : d <= -5 ? "didn't" : "watch",
          date: sorted[idx]?.date || "",
          rows: sorted,
        });
      }
    }
    // capacity change
    const caps = Array.from(new Set(sorted.map((r) => r.capacity)));
    if (caps.length > 1 && sorted.length >= 6) {
      const idx = sorted.findIndex((r) => r.capacity !== sorted[0].capacity);
      const before = sorted.slice(Math.max(0, idx - 4), idx);
      const after = sorted.slice(idx, idx + 4);
      if (before.length >= 2 && after.length >= 2) {
        const bf = avgFill(before);
        const af = avgFill(after);
        const revB = before.reduce((s, r) => s + r.revenue, 0) / before.length;
        const revA = after.reduce((s, r) => s + r.revenue, 0) / after.length;
        out.push({
          kind: "Capacity change",
          slot: label,
          detail: `${sorted[0].capacity} → ${sorted[idx].capacity} seats · rev/session ${Math.round(revB)} → ${Math.round(revA)}`,
          beforeFill: bf,
          afterFill: af,
          deltaPP: af - bf,
          verdict: revA >= revB * 1.05 ? "worked" : revA < revB * 0.95 ? "didn't" : "watch",
          date: sorted[idx]?.date || "",
          rows: sorted,
        });
      }
    }
    // new / retired
    const first = sorted[0].dateObj?.getTime() || 0;
    const last = sorted[sorted.length - 1].dateObj?.getTime() || 0;
    if (first > gStart + 21 * DAY && sorted.length >= 3) {
      const early = avgFill(sorted.slice(0, 3));
      const late = avgFill(sorted.slice(-3));
      out.push({
        kind: "New slot",
        slot: label,
        detail: `Launched ${sorted[0].date} · ${sorted.length} sessions held`,
        beforeFill: null,
        afterFill: late,
        deltaPP: late - early,
        verdict: late >= 60 ? "worked" : late >= 40 ? "watch" : "didn't",
        date: sorted[0].date,
        rows: sorted,
      });
    } else if (last < gEnd - 21 * DAY && sorted.length >= 4) {
      out.push({
        kind: "Retired slot",
        slot: label,
        detail: `Last held ${sorted[sorted.length - 1].date} · ended at ${avgFill(sorted.slice(-3)).toFixed(0)}% fill`,
        beforeFill: avgFill(sorted.slice(0, 3)),
        afterFill: avgFill(sorted.slice(-3)),
        deltaPP: avgFill(sorted.slice(-3)) - avgFill(sorted.slice(0, 3)),
        verdict: "info",
        date: sorted[sorted.length - 1].date,
        rows: sorted,
      });
    }
  });

  // moved slots: retired + launched siblings (same format+location+day, different time, within 6 weeks)
  const retired = out.filter((c) => c.kind === "Retired slot");
  const launched = out.filter((c) => c.kind === "New slot");
  retired.forEach((r) => {
    const rf = r.rows[0];
    const sib = launched.find((l) => {
      const lf = l.rows[0];
      if (!rf || !lf) return false;
      const dt = Math.abs((lf.dateObj?.getTime() || 0) - (r.rows[r.rows.length - 1].dateObj?.getTime() || 0));
      return (
        lf.formatNorm === rf.formatNorm &&
        lf.location === rf.location &&
        lf.day === rf.day &&
        lf.slot !== rf.slot &&
        dt < 45 * DAY
      );
    });
    if (sib && rf) {
      out.push({
        kind: "Slot moved",
        slot: `${rf.sessionName} · ${rf.day}`,
        detail: `${rf.slot} → ${sib.rows[0].slot} at ${rf.location}`,
        beforeFill: r.afterFill,
        afterFill: sib.afterFill,
        deltaPP: (sib.afterFill || 0) - (r.afterFill || 0),
        verdict: (sib.afterFill || 0) >= (r.afterFill || 0) + 5 ? "worked" : (sib.afterFill || 0) <= (r.afterFill || 0) - 5 ? "didn't" : "watch",
        date: sib.date,
        rows: [...r.rows, ...sib.rows],
      });
    }
  });

  return out.sort((a, b) => Math.abs(b.deltaPP || 0) - Math.abs(a.deltaPP || 0));
}

/* ═══════════════════ Class KPIs ═══════════════════ */

export function computeClassKPIs(rows: SessionRow[]): KPI[] {
  const withDates = rows.filter((r) => r.dateObj).sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
  const end = withDates.length ? withDates[withDates.length - 1].dateObj!.getTime() : Date.now();
  const cur = withDates.filter((r) => r.dateObj!.getTime() > end - 30 * 86400000);
  const prev = withDates.filter(
    (r) => r.dateObj!.getTime() <= end - 30 * 86400000 && r.dateObj!.getTime() > end - 60 * 86400000
  );
  const agg = (list: SessionRow[]) => {
    const cap = list.reduce((s, r) => s + r.capacity, 0);
    const booked = list.reduce((s, r) => s + r.booked, 0);
    const checked = list.reduce((s, r) => s + r.checkedIn, 0);
    const rev = list.reduce((s, r) => s + r.revenue, 0);
    const late = list.reduce((s, r) => s + r.lateCancelled, 0);
    const comp = list.reduce((s, r) => s + r.complimentary, 0);
    return {
      sessions: list.length,
      checked,
      revenue: rev,
      fill: cap ? (checked / cap) * 100 : 0,
      avg: list.length ? checked / list.length : 0,
      show: booked ? (checked / booked) * 100 : 0,
      revSess: list.length ? rev / list.length : 0,
      revHead: checked ? rev / checked : 0,
      lateRate: booked ? (late / booked) * 100 : 0,
      compShare: checked ? (comp / checked) * 100 : 0,
      slots: new Set(list.map((r) => r.uniqueId1)).size,
      teachers: new Set(list.map((r) => r.trainerName)).size,
    };
  };
  const c = agg(cur.length ? cur : rows);
  const p = agg(prev.length ? prev : []);
  const K = (
    id: string, label: string, format: KPI["format"], group: string, hint: string,
    f: (x: ReturnType<typeof agg>) => number, invert = false
  ): KPI => ({ id, label, format, group, hint, value: f(c) || 0, prev: f(p) || 0, invert });
  return [
    K("csess", "Sessions (30d)", "int", "Classes", "Classes held in the trailing 30 days.", (x) => x.sessions),
    K("ccheck", "Heads Through Door", "int", "Classes", "Total checked-in attendance, trailing 30 days.", (x) => x.checked),
    K("crev", "Class Revenue", "money", "Classes", "Session revenue, trailing 30 days.", (x) => x.revenue),
    K("cfill", "Avg Fill Rate", "pct", "Classes", "Checked-in ÷ capacity. 75%+ is healthy; under 55% needs action.", (x) => x.fill),
    K("cavg", "Class Average", "dec", "Classes", "Average heads per session.", (x) => x.avg),
    K("cshow", "Show-up Rate", "pct", "Classes", "Checked-in ÷ booked. Below 80% signals booking friction or reminders gap.", (x) => x.show),
    K("crevsess", "Revenue / Session", "money", "Classes", "Average revenue per class held.", (x) => x.revSess),
    K("crevhead", "Revenue / Head", "money", "Classes", "Average revenue per attending head.", (x) => x.revHead),
    K("clate", "Late-Cancel Rate", "pct", "Classes", "Late cancels ÷ booked. Above 6% blocks real demand.", (x) => x.lateRate, true),
    K("ccomp", "Comp Share", "pct", "Classes", "Complimentary ÷ checked-in. Watch for margin dilution.", (x) => x.compShare, true),
    K("cslots", "Active Slots", "int", "Classes", "Distinct UID1 slots that ran in the window.", (x) => x.slots),
    K("cteach", "Active Teachers", "int", "Classes", "Distinct instructors who taught in the window.", (x) => x.teachers),
  ];
}
