export interface SaleRow {
  memberId: string;
  customerName: string;
  customerEmail: string;
  payingMemberId: string;
  saleItemId: string;
  paymentDate: Date | null;
  paymentValue: number;
  paidInMoneyCredits: number;
  paymentVAT: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string;
  soldBy: string;
  saleReference: string;
  location: string;
  product: string;
  category: string;
  hostId: string;
  purchaseType: string;
  paymentSource: string;
  paidInEventCredits: number;
  priceExVat: number;
  discountValue: number;
  discountCode: string;
  createdAt: Date | null;
  saleId: string;
  saleTotalDiscount: number;
  quantity: number;
  unitPriceIncVat: number;
  unitPriceExVat: number;
  unitVat: number;
  unitDiscount: number;
  isVoided: boolean;
  membershipId: string;
  membershipStart: Date | null;
  membershipEnd: Date | null;
  membershipTotalClasses: number;
  membershipClassesLeft: number;
  membershipTotalMoney: number;
  membershipMoneyLeft: number;
  membershipType: string;
  membershipFreezed: boolean;
  membershipUsedCredits: number;
  membershipRevPerCredit: number;
  membershipName: string;
  // derived
  ym: string; // 2026-08
  year: number;
  month: number; // 1-12
  day: number;
  dow: number; // 0 Sun
  hour: number;
  isNew: boolean; // first purchase for that member (computed later)
}

const norm = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const NUM_CLEAN = /[^0-9.\-]/g;

export function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s || s === "-" || s === "—") return 0;
  const n = parseFloat(s.replace(NUM_CLEAN, ""));
  return Number.isFinite(n) ? n : 0;
}

export function toBool(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

export function toDate(v: unknown): Date | null {
  const s = String(v ?? "").trim();
  if (!s || s === "-") return null;
  // 2026-08-26 18:09:24  |  2026-08-26T18:09:24  |  26/08/2026 18:09
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (m) {
    return new Date(
      +m[1],
      +m[2] - 1,
      +m[3],
      m[4] ? +m[4] : 0,
      m[5] ? +m[5] : 0,
      m[6] ? +m[6] : 0
    );
  }
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T]?(\d{1,2})?:?(\d{2})?/);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const KEYS: Record<string, string[]> = {
  memberId: ["memberid"],
  customerName: ["customername"],
  customerEmail: ["customeremail"],
  payingMemberId: ["payingmemberid"],
  saleItemId: ["saleitemid"],
  paymentDate: ["paymentdate"],
  paymentValue: ["paymentvalue"],
  paidInMoneyCredits: ["paidinmoneycredits"],
  paymentVAT: ["paymentvat"],
  paymentStatus: ["paymentstatus"],
  paymentMethod: ["paymentmethod"],
  transactionId: ["paymenttransactionid"],
  soldBy: ["soldby"],
  saleReference: ["salereference"],
  location: ["calculatedlocation", "location"],
  product: ["cleanedproduct", "product"],
  category: ["cleanedcategory", "category"],
  hostId: ["hostid"],
  purchaseType: ["purchasetype"],
  paymentSource: ["paymentsource"],
  paidInEventCredits: ["paidineventcredits"],
  priceExVat: ["priceexcludingvatincurrency"],
  discountValue: ["discountvalueincurrency"],
  discountCode: ["discountcode"],
  createdAt: ["createdat"],
  saleId: ["saleid"],
  saleTotalDiscount: ["saletotaldiscountvalue"],
  quantity: ["saleitemquantity"],
  unitPriceIncVat: ["saleitemunitpriceincludingvat"],
  unitPriceExVat: ["saleitemunitpriceexcludingvat"],
  unitVat: ["saleitemunitvatamount"],
  unitDiscount: ["saleitemunitdiscountvalue"],
  isVoided: ["secisvoided"],
  membershipId: ["secmembershipid"],
  membershipStart: ["secmembershipstartdate"],
  membershipEnd: ["secmembershipenddate"],
  membershipTotalClasses: ["secmembershiptotalclasses"],
  membershipClassesLeft: ["secmembershipclassesleft"],
  membershipTotalMoney: ["secmembershiptotalmoney"],
  membershipMoneyLeft: ["secmembershipmoneyleft"],
  membershipType: ["secmembershiptype"],
  membershipFreezed: ["secmembershipisfreezed"],
  membershipUsedCredits: ["secmembershipusedsessioncredits"],
  membershipRevPerCredit: ["secmembershiprevenuepereventcreditinclvat"],
  membershipName: ["secmembershipname"],
};

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "-" || s === "—" ? "" : s;
};

export function parseSheet(values: string[][]): SaleRow[] {
  if (!values || values.length < 2) return [];
  const header = values[0].map(norm);
  const idx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(KEYS)) {
    for (const a of aliases) {
      const i = header.indexOf(a);
      if (i >= 0) {
        idx[field] = i;
        break;
      }
    }
  }
  const g = (r: string[], f: string) => (idx[f] === undefined ? "" : r[idx[f]] ?? "");

  const rows: SaleRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r || r.every((c) => !String(c ?? "").trim())) continue;
    const d = toDate(g(r, "paymentDate")) ?? toDate(g(r, "createdAt"));
    const row: SaleRow = {
      memberId: clean(g(r, "memberId")),
      customerName: clean(g(r, "customerName")) || "Unknown",
      customerEmail: clean(g(r, "customerEmail")).toLowerCase(),
      payingMemberId: clean(g(r, "payingMemberId")),
      saleItemId: clean(g(r, "saleItemId")),
      paymentDate: d,
      paymentValue: toNum(g(r, "paymentValue")),
      paidInMoneyCredits: toNum(g(r, "paidInMoneyCredits")),
      paymentVAT: toNum(g(r, "paymentVAT")),
      paymentStatus: clean(g(r, "paymentStatus")) || "unknown",
      paymentMethod: clean(g(r, "paymentMethod")) || "unknown",
      transactionId: clean(g(r, "transactionId")),
      soldBy: clean(g(r, "soldBy")) || "Unassigned",
      saleReference: clean(g(r, "saleReference")),
      location: clean(g(r, "location")) || "Unspecified",
      product: clean(g(r, "product")) || "Unspecified",
      category: clean(g(r, "category")) || "Uncategorised",
      hostId: clean(g(r, "hostId")),
      purchaseType: clean(g(r, "purchaseType")) || "unknown",
      paymentSource: clean(g(r, "paymentSource")) || "unknown",
      paidInEventCredits: toNum(g(r, "paidInEventCredits")),
      priceExVat: toNum(g(r, "priceExVat")),
      discountValue: toNum(g(r, "discountValue")),
      discountCode: clean(g(r, "discountCode")),
      createdAt: toDate(g(r, "createdAt")),
      saleId: clean(g(r, "saleId")),
      saleTotalDiscount: toNum(g(r, "saleTotalDiscount")),
      quantity: toNum(g(r, "quantity")) || 1,
      unitPriceIncVat: toNum(g(r, "unitPriceIncVat")),
      unitPriceExVat: toNum(g(r, "unitPriceExVat")),
      unitVat: toNum(g(r, "unitVat")),
      unitDiscount: toNum(g(r, "unitDiscount")),
      isVoided: toBool(g(r, "isVoided")),
      membershipId: clean(g(r, "membershipId")),
      membershipStart: toDate(g(r, "membershipStart")),
      membershipEnd: toDate(g(r, "membershipEnd")),
      membershipTotalClasses: toNum(g(r, "membershipTotalClasses")),
      membershipClassesLeft: toNum(g(r, "membershipClassesLeft")),
      membershipTotalMoney: toNum(g(r, "membershipTotalMoney")),
      membershipMoneyLeft: toNum(g(r, "membershipMoneyLeft")),
      membershipType: clean(g(r, "membershipType")),
      membershipFreezed: toBool(g(r, "membershipFreezed")),
      membershipUsedCredits: toNum(g(r, "membershipUsedCredits")),
      membershipRevPerCredit: toNum(g(r, "membershipRevPerCredit")),
      membershipName: clean(g(r, "membershipName")),
      ym: "",
      year: 0,
      month: 0,
      day: 0,
      dow: 0,
      hour: 0,
      isNew: false,
    };
    if (d) {
      row.year = d.getFullYear();
      row.month = d.getMonth() + 1;
      row.day = d.getDate();
      row.dow = d.getDay();
      row.hour = d.getHours();
      row.ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
    }
    if (!row.priceExVat) row.priceExVat = row.paymentValue - row.paymentVAT;
    rows.push(row);
  }
  return markNewCustomers(rows);
}

export function markNewCustomers(rows: SaleRow[]): SaleRow[] {
  const first = new Map<string, number>();
  for (const r of rows) {
    const k = r.customerEmail || r.memberId || r.customerName;
    const t = r.paymentDate ? r.paymentDate.getTime() : Infinity;
    if (!first.has(k) || t < (first.get(k) as number)) first.set(k, t);
  }
  for (const r of rows) {
    const k = r.customerEmail || r.memberId || r.customerName;
    r.isNew = r.paymentDate ? r.paymentDate.getTime() === first.get(k) : false;
  }
  return rows;
}
