import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../utils/cn";
import { AnimatedNumber, Delta, Sparkline, Tip } from "./ui";
import { fmtByType } from "../lib/format";
import type { KPI } from "../lib/analytics";
import { delta } from "../lib/analytics";

export function MetricCard({
  kpi, spark, index = 0,
}: { kpi: KPI; spark?: number[]; index?: number }) {
  const [flip, setFlip] = useState(false);
  const d = delta(kpi.value, kpi.prev);
  const diff = kpi.value - kpi.prev;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.38, delay: Math.min(index * 0.022, 0.32), ease: [0.22, 1, 0.36, 1] }}
      onClick={() => setFlip((f) => !f)}
      className="card group w-full px-4 py-3.5 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-lo">
          <span className="truncate">{kpi.label}</span>
          <Tip text={kpi.hint} />
        </span>
        <Delta value={d} invert={kpi.invert} size="xs" />
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <AnimatedNumber
          value={kpi.value}
          format={(n) => fmtByType(n, kpi.format)}
          className="font-display text-[24px] font-bold leading-none tracking-tight text-hi"
        />
        {spark && spark.length > 1 && (
          <div className="h-7 w-16 shrink-0 opacity-50 transition-opacity duration-200 group-hover:opacity-100">
            <Sparkline data={spark} height={28} />
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {flip && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 space-y-1 border-t border-line pt-2 text-[10px]">
              <div className="flex justify-between text-lo">
                <span>Previous</span>
                <span className="num text-mid">{fmtByType(kpi.prev, kpi.format)}</span>
              </div>
              <div className="flex justify-between text-lo">
                <span>Absolute</span>
                <span className={cn("num font-semibold", diff >= 0 ? "text-pos" : "text-neg")}>
                  {diff >= 0 ? "+" : ""}{fmtByType(diff, kpi.format)}
                </span>
              </div>
              <p className="pt-1 leading-relaxed text-lo">{kpi.hint}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
