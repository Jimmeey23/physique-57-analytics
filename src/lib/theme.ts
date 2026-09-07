/* ────────────────────────────────────────────────
   Location identity — deep jewel accents, each paired
   with a complementary secondary hue.
   ──────────────────────────────────────────────── */

export interface LocColor {
  id: string;
  light: string;
  dark: string;
  pairLight: string;
  pairDark: string;
  name: string;
}

const LOC_PALETTE: LocColor[] = [
  { id: "cobalt",   light: "#1e40af", dark: "#6094ff", pairLight: "#be185d", pairDark: "#f472b6", name: "Cobalt" },
  { id: "emerald",  light: "#047857", dark: "#34d399", pairLight: "#b45309", pairDark: "#fbbf24", name: "Emerald" },
  { id: "violet",   light: "#5b21b6", dark: "#a78bfa", pairLight: "#0e7490", pairDark: "#22d3ee", name: "Violet" },
  { id: "crimson",  light: "#9f1239", dark: "#fb7185", pairLight: "#1d4ed8", pairDark: "#60a5fa", name: "Crimson" },
  { id: "teal",     light: "#0f766e", dark: "#2dd4bf", pairLight: "#c2410c", pairDark: "#fb923c", name: "Teal" },
  { id: "indigo",   light: "#3730a3", dark: "#818cf8", pairLight: "#b91c1c", pairDark: "#f87171", name: "Indigo" },
  { id: "amber",    light: "#92400e", dark: "#fbbf24", pairLight: "#1e3a8a", pairDark: "#93c5fd", name: "Amber" },
  { id: "fuchsia",  light: "#86198f", dark: "#e879f9", pairLight: "#065f46", pairDark: "#6ee7b7", name: "Fuchsia" },
];

export const LOC_HEXES = LOC_PALETTE.map((p) => p.light);

/** Deterministic: alphabetical order of all location names. */
export function buildLocationColors(names: string[]): Map<string, LocColor> {
  const sorted = Array.from(new Set(names.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const m = new Map<string, LocColor>();
  sorted.forEach((n, i) => m.set(n, LOC_PALETTE[i % LOC_PALETTE.length]));
  return m;
}

export function locHex(c: LocColor | undefined, dark: boolean): string {
  if (!c) return dark ? LOC_PALETTE[0].dark : LOC_PALETTE[0].light;
  return dark ? c.dark : c.light;
}

export function locPairHex(c: LocColor | undefined, dark: boolean): string {
  if (!c) return dark ? LOC_PALETTE[0].pairDark : LOC_PALETTE[0].pairLight;
  return dark ? c.pairDark : c.pairLight;
}

export const NEUTRAL_ACCENT: LocColor = LOC_PALETTE[0];

export function applyAccent(hex: string, pairHex?: string) {
  const root = document.documentElement;
  root.style.setProperty("--loc", hexToRgbTriplet(hex));
  root.style.setProperty("--loc-hex", hex);
  if (pairHex) root.style.setProperty("--loc-2", hexToRgbTriplet(pairHex));
}

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/* Gray ramp — the only scale for heat / hovers / share bars / sparklines */
export const GRAY_RAMP = ["#6b7a94", "#8a98b0", "#a9b5c8", "#5a6880", "#c4cddb", "#485468", "#d9dfe9", "#3d4a5e"];

export function grayHeat(ratio: number): string {
  const r = Math.min(1, Math.max(0, ratio));
  return `color-mix(in srgb, rgb(104 116 138) ${(5 + r * 28).toFixed(1)}%, transparent)`;
}

/* Class format identity — fixed deep hues */
export const FORMAT_COLORS: Record<string, { light: string; dark: string }> = {
  "barre 57":     { light: "#1e40af", dark: "#6094ff" },
  barre:          { light: "#1e40af", dark: "#6094ff" },
  powercycle:     { light: "#5b21b6", dark: "#a78bfa" },
  "power cycle":  { light: "#5b21b6", dark: "#a78bfa" },
  "strength lab": { light: "#047857", dark: "#34d399" },
  strength:       { light: "#047857", dark: "#34d399" },
};

export function formatHex(name: string, dark: boolean): string {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(FORMAT_COLORS)) {
    if (key.includes(k)) return dark ? v.dark : v.light;
  }
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return GRAY_RAMP[h % GRAY_RAMP.length];
}

export const CATEGORICAL = ["#1e40af", ...GRAY_RAMP];
