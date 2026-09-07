import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, CornerDownRight } from "lucide-react";
import { cn } from "../utils/cn";
import { Tip, TableToolbar, ShareBar } from "./ui";
import { downloadCsv } from "../lib/format";
import { grayHeat } from "../lib/theme";

export interface Col<T> {
  key: string;
  label: string;
  tip?: string;
  align?: "left" | "right";
  value: (r: T) => number | string;
  render?: (r: T) => React.ReactNode;
  fmt?: (n: number) => string;
  totalMode?: "sum" | "avg" | "none" | "custom";
  totalValue?: (rows: T[]) => number | string;
  heat?: boolean;
  bar?: boolean;
  width?: string;
  sticky?: boolean;
}

interface Props<T> {
  cols: Col<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  defaultSort?: string;
  expand?: (r: T) => React.ReactNode;
  initialLimit?: number;
  csvName?: string;
  dense?: boolean;
  maxHeight?: string;
  onRowClick?: (r: T) => void;
  /** Nesting level — inner tables render with a compact, flatter chrome. */
  level?: number;
}

export function DataTable<T>({
  cols, rows, rowKey, defaultSort, expand, initialLimit = 12,
  csvName = "table", dense: denseDefault = false, maxHeight, onRowClick, level = 0,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: defaultSort || cols[1]?.key || cols[0].key, dir: "desc",
  });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [limit, setLimit] = useState(initialLimit);
  const [dense, setDense] = useState(denseDefault || level > 0);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter((r) => cols.some((c) => String(c.value(r)).toLowerCase().includes(t)));
  }, [rows, q, cols]);

  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = col.value(a), vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      return sort.dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sort, cols]);

  const visible = sorted.slice(0, limit);
  const pad = dense ? "h-10 max-h-10 px-3 py-0" : "h-10 max-h-10 px-4 py-0";
  const openCount = Object.values(open).filter(Boolean).length;

  const ranges = useMemo(() => {
    const m: Record<string, { min: number; max: number }> = {};
    cols.forEach((c) => {
      if (!c.heat && !c.bar) return;
      const vals = sorted.map((r) => Number(c.value(r))).filter((n) => Number.isFinite(n));
      m[c.key] = { min: Math.min(...vals, 0), max: Math.max(...vals, 1) };
    });
    return m;
  }, [sorted, cols]);

  const totals = useMemo(() => {
    const t: Record<string, string | number> = {};
    cols.forEach((c) => {
      if (c.totalMode === "none") { t[c.key] = ""; return; }
      if (c.totalMode === "custom" && c.totalValue) { t[c.key] = c.totalValue(sorted); return; }
      const vals = sorted.map((r) => c.value(r));
      if (vals.length && typeof vals[0] === "number") {
        const nums = vals as number[];
        const s = nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
        t[c.key] = c.totalMode === "avg" ? s / (nums.length || 1) : s;
      } else t[c.key] = "";
    });
    return t;
  }, [sorted, cols]);

  const exportCsv = () => {
    const body = sorted.map((r) => cols.map((c) => c.value(r)));
    const tot = cols.map((c) => totals[c.key] ?? "");
    downloadCsv(`${csvName}.csv`, [cols.map((c) => c.label), ...body, tot]);
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    visible.forEach((r) => (next[rowKey(r)] = true));
    setOpen(next);
  };
  const collapseAll = () => setOpen({});

  return (
    <div className="w-full">
      <TableToolbar
        q={q} setQ={setQ} shown={visible.length} total={sorted.length}
        dense={dense} setDense={setDense} onExport={exportCsv}
        canExpand={!!expand} openCount={openCount} onExpandAll={expandAll} onCollapseAll={collapseAll}
        compact={level > 0}
      />

      <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="tbl w-full text-[12px]">
          <thead className="tbl-head sticky top-0 z-20">
            <tr>
              {expand && <th className="w-10" />}
              {cols.map((c, i) => {
                const active = sort.key === c.key;
                const right = c.align === "right" || (i > 0 && !c.align);
                return (
                  <th key={c.key}
                    onClick={() => setSort((s) => s.key === c.key
                      ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                      : { key: c.key, dir: "desc" })}
                    className={cn(
                      "group cursor-pointer select-none whitespace-nowrap transition-colors",
                      dense ? "h-10 px-3 py-0" : "h-10 px-4 py-0",
                      right ? "text-right" : "text-left",
                      active ? "!text-hi" : "hover:!text-mid"
                    )}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    <span className={cn("inline-flex items-center gap-1.5", right && "flex-row-reverse")}>
                      {c.label}
                      {c.tip && <Tip text={c.tip} side="bottom" />}
                      {active
                        ? (sort.dir === "desc"
                          ? <ArrowDown className="h-3 w-3 text-loc" />
                          : <ArrowUp className="h-3 w-3 text-loc" />)
                        : <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, ri) => {
              const k = rowKey(r);
              const isOpen = !!open[k];
              return (
                <React.Fragment key={k}>
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(ri * 0.01, 0.2) }}
                    className={cn("tbl-row", isOpen && "tbl-row-open", (expand || onRowClick) && "cursor-pointer")}
                    onClick={() => { if (expand) setOpen((o) => ({ ...o, [k]: !o[k] })); onRowClick?.(r); }}
                  >
                    {expand && (
                      <td className={cn(pad, "text-lo")}>
                        <motion.span
                          animate={{ rotate: isOpen ? 90 : 0 }}
                          transition={{ duration: 0.18 }}
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                            isOpen ? "border-loc bg-loc-soft text-loc" : "border-line bg-surface"
                          )}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </motion.span>
                      </td>
                    )}
                    {cols.map((c, ci) => {
                      const raw = c.value(r);
                      const num = typeof raw === "number" ? raw : null;
                      const range = ranges[c.key];
                      const ratio = num !== null && range && range.max !== range.min
                        ? (num - range.min) / (range.max - range.min) : 0;
                      const right = c.align === "right" || (ci > 0 && !c.align);
                      return (
                        <td key={c.key}
                          className={cn(pad, right ? "text-right num" : "text-left", ci === 0 ? "font-medium text-hi" : "text-mid")}
                          style={c.heat && num !== null ? { background: grayHeat(ratio) } : undefined}
                        >
                          {c.render ? c.render(r)
                            : num !== null ? (c.fmt ? c.fmt(num) : num.toLocaleString("en-IN"))
                            : String(raw)}
                          {c.bar && num !== null && <div className="mt-1.5"><ShareBar value={ratio * 100} /></div>}
                        </td>
                      );
                    })}
                  </motion.tr>
                  <AnimatePresence initial={false}>
                    {isOpen && expand && (
                      <tr>
                        <td colSpan={cols.length + 1} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            className="tbl-drill overflow-hidden"
                          >
                            <div className="flex gap-3 px-4 py-4">
                              <div className="flex shrink-0 flex-col items-center pt-1">
                                <CornerDownRight className="h-3.5 w-3.5 text-loc" />
                                <div className="mt-1 w-px flex-1 bg-[rgb(var(--line-strong))]" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-3">{expand(r)}</div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={cols.length + 1} className="px-4 py-12 text-center text-xs text-lo">
                  No rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="tbl-foot sticky bottom-0 z-20">
            <tr>
              {expand && <td className={pad} />}
              {cols.map((c, ci) => {
                const t = totals[c.key];
                const right = c.align === "right" || (ci > 0 && !c.align);
                return (
                  <td key={c.key}
                    className={cn(
                      pad, "num text-[11.5px] font-semibold text-hi",
                      right ? "text-right" : "text-left",
                      ci === 0 && "font-sans text-[10.5px] font-semibold uppercase tracking-wider text-lo"
                    )}>
                    {ci === 0 ? "Total" : typeof t === "number" ? (c.fmt ? c.fmt(t) : Math.round(t).toLocaleString("en-IN")) : t}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {sorted.length > visible.length && (
        <div className="flex justify-center border-t border-line py-3">
          <button onClick={() => setLimit((l) => l + 20)}
            className="rounded-lg border border-line bg-surface px-3.5 py-1.5 text-[11px] font-medium text-mid transition-colors hover:border-strong hover:text-hi">
            Show 20 more · {sorted.length - visible.length} hidden
          </button>
        </div>
      )}
    </div>
  );
}
