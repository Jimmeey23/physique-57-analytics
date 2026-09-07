import React from "react";
import { motion } from "framer-motion";
import type { Agg } from "../lib/analytics";
import { compact, dec, intFmt, pct } from "../lib/format";
import type { Col } from "./DataTable";
import { ShareBar, Delta } from "./ui";

const TONE_CLS: Record<string, { border: string; bg: string; label: string; text: string }> = {
  violet:   { border: "border-l-[rgb(var(--loc))]",  bg: "bg-surface2",            label: "text-loc",  text: "text-mid" },
  amber:    { border: "border-l-[rgb(var(--warn))]", bg: "bg-warn-soft",           label: "text-warn", text: "text-mid" },
  emerald:  { border: "border-l-[rgb(var(--pos))]",  bg: "bg-pos-soft",            label: "text-pos",  text: "text-mid" },
  rose:     { border: "border-l-[rgb(var(--neg))]",  bg: "bg-neg-soft",            label: "text-neg",  text: "text-mid" },
};

/** Written summary attached beneath every table. */
export function Narrative({ lines, tone = "violet" }: { lines: React.ReactNode[]; tone?: string }) {
  const t = TONE_CLS[tone] || TONE_CLS.violet;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className={`border-t border-l-[3px] border-line   px-6 py-4`}
    >
      <p className={`mb-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] ${t.label}`}>
        Reading the table
      </p>
      <ul className="space-y-2">
        {lines.filter(Boolean).map((l, i) => (
          <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-mid">
            <span className="num mt-[1px] shrink-0 text-[9.5px] font-semibold text-lo">{String(i + 1).padStart(2, "0")}</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/** Standard analytical columns for an Agg-based table. */
export function aggCols(labelHeader: string, extra?: Col<Agg>[]): Col<Agg>[] {
  const base: Col<Agg>[] = [
    {
      key: "key", label: labelHeader, align: "left", value: (r) => r.key,
      totalMode: "none", width: "170px",
      render: (r) => <span className="truncate font-medium text-hi">{r.key}</span>,
    },
    { key: "revenue", label: "Revenue", value: (r) => r.revenue, fmt: compact, heat: true, tip: "Gross revenue incl. VAT from successful, non-voided sales." },
    {
      key: "share", label: "Share", value: (r) => r.share, tip: "Percent of total filtered revenue.",
      render: (r) => (
        <div className="min-w-[62px]">
          <span className="num text-mid">{pct(r.share)}</span>
          <ShareBar value={r.share} />
        </div>
      ),
      totalMode: "sum",
    },
    { key: "txns", label: "Txns", value: (r) => r.txns, fmt: intFmt, tip: "Distinct successful transactions." },
    { key: "units", label: "Units", value: (r) => r.units, fmt: intFmt, tip: "Total quantity sold." },
    { key: "customers", label: "Cust", value: (r) => r.customers, fmt: intFmt, tip: "Distinct paying customers.", totalMode: "sum" },
    { key: "newCustomers", label: "New", value: (r) => r.newCustomers, fmt: intFmt, tip: "First-time buyers in this group." },
    {
      key: "aov", label: "AOV", value: (r) => r.aov, fmt: compact, tip: "Average order value = revenue ÷ transactions.",
      totalMode: "custom",
      totalValue: (rows) => { const rev = rows.reduce((s, r) => s + r.revenue, 0); const t = rows.reduce((s, r) => s + r.txns, 0); return t ? compact(rev / t) : "—"; },
    },
    {
      key: "upt", label: "UPT", value: (r) => r.upt, fmt: (n) => dec(n, 2), tip: "Units per transaction — basket depth.",
      totalMode: "custom",
      totalValue: (rows) => { const u = rows.reduce((s, r) => s + r.units, 0); const t = rows.reduce((s, r) => s + r.txns, 0); return t ? dec(u / t, 2) : "—"; },
    },
    {
      key: "arpc", label: "Rev/Cust", value: (r) => r.arpc, fmt: compact, tip: "Average revenue per unique customer.",
      totalMode: "custom",
      totalValue: (rows) => { const rev = rows.reduce((s, r) => s + r.revenue, 0); const c = rows.reduce((s, r) => s + r.customers, 0); return c ? compact(rev / c) : "—"; },
    },
    { key: "discount", label: "Disc", value: (r) => r.discount, fmt: compact, tip: "Total discount value given." },
    {
      key: "discountRate", label: "Disc %", value: (r) => r.discountRate, tip: "Discount ÷ list value. Above 12% erodes margin.",
      totalMode: "custom",
      totalValue: (rows) => { const d = rows.reduce((s, r) => s + r.discount, 0); const l = rows.reduce((s, r) => s + r.listValue, 0); return l ? pct((d / l) * 100) : "—"; },
      render: (r) => (
        <span className={`num ${r.discountRate > 12 ? "text-neg" : r.discountRate > 6 ? "text-warn" : "text-mid"}`}>
          {pct(r.discountRate)}
        </span>
      ),
    },
    { key: "exVat", label: "Net ex-VAT", value: (r) => r.exVat, fmt: compact, tip: "Revenue excluding tax." },
  ];
  return extra ? [...base, ...extra] : base;
}

export function growthCol(map: Map<string, number>): Col<Agg> {
  return {
    key: "growth", label: "Δ", value: (r) => map.get(r.key) ?? 0,
    tip: "Growth in revenue versus the comparison period.", totalMode: "none",
    render: (r) => <Delta value={map.has(r.key) ? (map.get(r.key) as number) : null} />,
  };
}
