import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { Info, TrendingUp, TrendingDown, Minus, Download, Rows3, Search, ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";

/* ───────────── Tooltip ───────────── */
export function Tip({
  text, children, side = "top", className,
}: {
  text: string; children?: React.ReactNode;
  side?: "top" | "bottom" | "left"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
    >
      {children ?? (
        <Info className="h-3 w-3 cursor-help text-lo transition-colors hover:text-mid" />
      )}
      {open && (
        <motion.span
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14 }}
          className={cn(
            "pointer-events-none absolute z-[60] w-56 rounded-lg border border-line bg-surface px-2.5 py-2 text-[11px] font-normal leading-relaxed text-mid shadow-lg",
            side === "top" && "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
            side === "bottom" && "top-full left-1/2 mt-1.5 -translate-x-1/2",
            side === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2"
          )}
        >
          {text}
        </motion.span>
      )}
    </span>
  );
}

/* ───────────── Animated number ───────────── */
export function AnimatedNumber({
  value, format, className,
}: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 20, mass: 0.6 });
  const [disp, setDisp] = useState(0);
  useEffect(() => { if (inView) mv.set(value); }, [inView, value, mv]);
  useEffect(() => spring.on("change", (v) => setDisp(v)), [spring]);
  return <span ref={ref} className={cn("num", className)}>{format(inView ? disp : 0)}</span>;
}

/* ───────────── Delta ───────────── */
export function Delta({
  value, invert = false, size = "sm",
}: { value: number | null; invert?: boolean; size?: "xs" | "sm" }) {
  if (value === null || !Number.isFinite(value))
    return (
      <span className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-surface2 px-1.5 py-0.5 font-medium text-lo",
        size === "xs" ? "text-[9.5px]" : "text-[10.5px]")}>
        —
      </span>
    );
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = Math.abs(value) < 0.05 ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      "num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
      size === "xs" ? "text-[9.5px]" : "text-[10.5px]",
      good ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"
    )}>
      <Icon className="h-2.5 w-2.5" />
      {up ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

/* ───────────── Section header — distinct elevated band ───────────── */
export function SectionHeader({
  index, title, description, meta,
}: { index: number; title: string; description: string; meta?: React.ReactNode }) {
  return (
    <div className="section-band mb-7 flex flex-wrap items-center gap-5 px-7 py-6 sm:px-8 sm:py-7">
      <span className="section-num flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[20px]">
        {String(index).padStart(2, "0")}
      </span>
      <div className="relative min-w-0 flex-1 basis-72">
        <p className="kicker mb-1.5">Section {String(index).padStart(2, "0")}</p>
        <h2 className="font-display text-[30px] font-bold leading-[1.05] tracking-tight text-hi sm:text-[36px]">
          {title}
        </h2>
        <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-mid">{description}</p>
      </div>
      {meta && <div className="relative flex shrink-0 flex-wrap items-center gap-2">{meta}</div>}
    </div>
  );
}

/* ───────────── Panel ───────────── */
export function Panel({
  title, subtitle, right, children, tip, className, dense,
}: {
  title?: string; subtitle?: string; right?: React.ReactNode;
  children: React.ReactNode; tip?: string; className?: string; dense?: boolean;
}) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {title && (
        <header className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-line",
          dense ? "px-4 py-3" : "px-5 py-4 sm:px-6"
        )}>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight text-hi">
              {title}
              {tip && <Tip text={tip} />}
            </h3>
            {subtitle && <p className="mt-1 text-[11.5px] leading-relaxed text-lo">{subtitle}</p>}
          </div>
          {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ───────────── Button ───────────── */
export function Btn({
  children, onClick, active, className, title, size = "sm",
}: {
  children: React.ReactNode; onClick?: () => void; active?: boolean;
  className?: string; title?: string; size?: "xs" | "sm";
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border font-medium transition-all duration-150 active:scale-[0.97]",
        size === "xs" ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1.5 text-[11.5px]",
        active
          ? "border-loc bg-loc-soft text-loc shadow-xs"
          : "border-line bg-surface text-mid hover:border-strong hover:bg-surface2 hover:text-hi",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ───────────── Segmented ───────────── */
export function Segmented<T extends string>({
  options, value, onChange, size = "sm",
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T; onChange: (v: T) => void; size?: "xs" | "sm";
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-[6px] font-medium transition-colors",
            size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
            value === o.value ? "text-hi" : "text-lo hover:text-mid"
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join("")}`}
              className="absolute inset-0 rounded-[6px] border border-strong bg-surface shadow-xs"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center gap-1">{o.icon}{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────────── Chip ───────────── */
export function Chip({
  active, onClick, children, count,
}: { active?: boolean; onClick?: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 active:scale-[0.97]",
        active
          ? "border-loc bg-loc-soft text-loc"
          : "border-line bg-surface2 text-mid hover:border-strong hover:text-hi"
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("num rounded px-1 text-[9px]", active ? "bg-loc/15" : "bg-surface3 text-lo")}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ───────────── Share bar ───────────── */
export function ShareBar({ value }: { value: number }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface3">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full bg-loc"
      />
    </div>
  );
}

/* ───────────── Sparkline ───────────── */
export function Sparkline({ data, height = 28 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const rng = max - min || 1;
  const w = 100;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${height - ((d - min) / rng) * height}`);
  const id = `sp${Math.round(data[0] * 7 + data.length * 13)}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--loc))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(var(--loc))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(" ")} ${w},${height}`} fill={`url(#${id})`} />
      <motion.polyline
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9 }}
        points={pts.join(" ")}
        fill="none"
        stroke="rgb(var(--loc))"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ───────────── Table toolbar ───────────── */
export function TableToolbar({
  q, setQ, shown, total, dense, setDense, onExport,
  canExpand, openCount = 0, onExpandAll, onCollapseAll, compact = false,
}: {
  q: string; setQ: (v: string) => void; shown: number; total: number;
  dense: boolean; setDense: (v: boolean) => void; onExport: () => void;
  canExpand?: boolean; openCount?: number; onExpandAll?: () => void; onCollapseAll?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 border-b border-line",
      compact ? "bg-surface px-3 py-2" : "bg-surface2/60 px-4 py-2.5"
    )}>
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-lo" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter rows…"
          className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2.5 text-[11.5px] text-hi outline-none transition-colors placeholder:text-lo focus:border-strong"
        />
      </div>
      <span className="num rounded-md bg-surface3 px-2 py-1 text-[10.5px] font-medium text-mid">
        {shown} <span className="text-lo">/ {total}</span>
      </span>
      {canExpand && (
        <div className="inline-flex overflow-hidden rounded-lg border border-line">
          <button onClick={onExpandAll} title="Expand visible rows"
            className="border-r border-line bg-surface px-2.5 py-1.5 text-[10.5px] font-medium text-mid transition-colors hover:bg-surface2 hover:text-hi">
            Expand all
          </button>
          <button onClick={onCollapseAll} title="Collapse all rows"
            className={cn("bg-surface px-2.5 py-1.5 text-[10.5px] font-medium transition-colors hover:bg-surface2 hover:text-hi",
              openCount > 0 ? "text-loc" : "text-mid")}>
            Collapse{openCount > 0 ? ` (${openCount})` : ""}
          </button>
        </div>
      )}
      <Btn size="xs" onClick={() => setDense(!dense)} active={dense} title="Toggle density">
        <Rows3 className="h-3 w-3" />
      </Btn>
      <Btn size="xs" onClick={onExport} title="Export CSV">
        <Download className="h-3 w-3" />
      </Btn>
    </div>
  );
}

export { ChevronDown };
