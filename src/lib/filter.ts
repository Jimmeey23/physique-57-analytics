import type { SaleRow } from "./types";
import { presetRange, type FilterState } from "../components/Filters";

const inList = (list: string[], v: string) => list.length === 0 || list.includes(v);

export function staticPassFn(f: FilterState) {
  const min = f.minValue ? parseFloat(f.minValue) : null;
  const max = f.maxValue ? parseFloat(f.maxValue) : null;
  const q = f.search.trim().toLowerCase();
  return (r: SaleRow) =>
    inList(f.locations, r.location) &&
    inList(f.categories, r.category) &&
    inList(f.products, r.product) &&
    inList(f.sellers, r.soldBy) &&
    inList(f.methods, r.paymentMethod) &&
    inList(f.statuses, r.paymentStatus) &&
    inList(f.purchaseTypes, r.purchaseType) &&
    inList(f.sources, r.paymentSource) &&
    (f.discountCodes.length === 0 || f.discountCodes.includes(r.discountCode)) &&
    (f.customerType === "all" || (f.customerType === "new" ? r.isNew : !r.isNew)) &&
    (min === null || r.paymentValue >= min) &&
    (max === null || r.paymentValue <= max) &&
    (!f.excludeVoided || !r.isVoided) &&
    (!f.onlyDiscounted || r.discountValue > 0) &&
    (!q ||
      r.customerName.toLowerCase().includes(q) ||
      r.customerEmail.includes(q) ||
      r.transactionId.toLowerCase().includes(q) ||
      r.saleReference.toLowerCase().includes(q) ||
      r.product.toLowerCase().includes(q) ||
      r.memberId.includes(q));
}

function inWindow(r: SaleRow, a: Date | null, b: Date | null) {
  if (!r.paymentDate) return !a && !b;
  if (a && r.paymentDate < a) return false;
  if (b && r.paymentDate > b) return false;
  return true;
}

export function applyFilters(all: SaleRow[], f: FilterState, maxDate: Date) {
  const [from, to] = presetRange(f.preset, f.from, f.to, maxDate);
  const staticPass = staticPassFn(f);
  const current = all.filter((r) => staticPass(r) && inWindow(r, from, to));

  let pFrom: Date | null = null;
  let pTo: Date | null = null;
  if (from && to) {
    if (f.compare === "yoy") {
      pFrom = new Date(from);
      pFrom.setFullYear(pFrom.getFullYear() - 1);
      pTo = new Date(to);
      pTo.setFullYear(pTo.getFullYear() - 1);
    } else {
      const span = to.getTime() - from.getTime();
      pTo = new Date(from.getTime() - 1);
      pFrom = new Date(pTo.getTime() - span);
    }
  } else if (current.length) {
    const dates = current.map((r) => r.paymentDate?.getTime() || 0).filter(Boolean);
    const last = new Date(Math.max(...dates));
    const half = new Date(last.getFullYear(), last.getMonth() - 6, 1);
    pFrom = new Date(last.getFullYear() - 1, last.getMonth() - 5, 1);
    pTo = new Date(half.getTime() - 1);
  }
  const previous = pFrom && pTo ? all.filter((r) => staticPass(r) && inWindow(r, pFrom, pTo)) : [];

  return { current, previous, from, to, pFrom, pTo };
}

/**
 * Rows for MoM / YoY tables & graphs: every filter applies
 * EXCEPT the date range, so the full history is always shown.
 */
export function applyFiltersIgnoringDate(all: SaleRow[], f: FilterState) {
  const staticPass = staticPassFn(f);
  return all.filter((r) => staticPass(r));
}
