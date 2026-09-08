import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}

/**
 * Reusable detail modal for drill-down views.
 * Used across all sections for row-level detail exploration.
 */
export function DetailModal({ open, onClose, title, subtitle, children, maxWidth = "max-w-3xl" }: DetailModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn("max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-line bg-app shadow-2xl", maxWidth)}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold text-hi">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-[11px] text-lo">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-lo transition-colors hover:bg-surface2 hover:text-hi"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Compact stat card used inside detail modals */
export function ModalStat({ label, value, accent }: { label: string; value: ReactNode; accent?: "pos" | "neg" | "loc" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-lo">{label}</p>
      <p className={cn(
        "mt-1 font-display text-sm font-bold",
        accent === "pos" ? "text-pos" : accent === "neg" ? "text-neg" : accent === "loc" ? "text-loc" : accent === "warn" ? "text-warn" : "text-hi"
      )}>
        {value}
      </p>
    </div>
  );
}

/** A section heading used inside modals */
export function ModalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-wider text-lo">{title}</h3>
      {children}
    </div>
  );
}
