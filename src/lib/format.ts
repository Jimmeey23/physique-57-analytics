export const inr = (n: number, dp = 0) =>
  "₹" +
  (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

export const compact = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}K`;
  return `${s}₹${a.toFixed(0)}`;
};

export const intFmt = (n: number) => Math.round(n || 0).toLocaleString("en-IN");
export const pct = (n: number, dp = 1) => `${(n || 0).toFixed(dp)}%`;
export const dec = (n: number, dp = 2) => (n || 0).toFixed(dp);

export function fmtByType(v: number, t: "money" | "int" | "pct" | "dec", compactMoney = true) {
  switch (t) {
    case "money":
      return compactMoney ? compact(v) : inr(v);
    case "int":
      return intFmt(v);
    case "pct":
      return pct(v);
    default:
      return dec(v);
  }
}

export const dateStr = (d: Date | null) =>
  d
    ? `${String(d.getDate()).padStart(2, "0")} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getFullYear()}`
    : "—";

export const dateTimeStr = (d: Date | null) =>
  d ? `${dateStr(d)} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "—";

export const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
