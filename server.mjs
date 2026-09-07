import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);

// ── Persistent settings file ──
const SETTINGS_PATH = path.join(root, ".settings.json");

function loadSettingsFile() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    }
  } catch (err) {
    console.warn("Could not read .settings.json:", err.message);
  }
  return {};
}

function saveSettingsFile(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ── Runtime config (env defaults, overlaid with saved settings) ──
const envDefaults = {
  clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || "",
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN || process.env.VITE_GOOGLE_REFRESH_TOKEN || "",
  salesSpreadsheetId: process.env.SALES_SPREADSHEET_ID || process.env.VITE_SALES_SPREADSHEET_ID || "1HbGnJk-peffUp7XoXSlsL55924E9yUt8cP_h93cdTT0",
  salesSheetName: process.env.SALES_SHEET_NAME || "Sales",
  classSpreadsheetId: process.env.CLASS_SPREADSHEET_ID || process.env.VITE_SESSIONS_SPREADSHEET_ID || "16wFlke0bHFcmfn-3UyuYlGnImBq0DY7ouVYAlAFTZys",
  payrollSpreadsheetId: process.env.PAYROLL_SPREADSHEET_ID || process.env.VITE_PAYROLL_SPREADSHEET_ID || "149ILDqovzZA6FRUJKOwzutWdVqmqWBtWPfzG3A0zxTI",
  leadsSpreadsheetId: process.env.LEADS_SPREADSHEET_ID || "1dQMNF69WnXVQdhlLvUZTig3kL97NA21k6eZ9HRu6xiQ",
  lapsedSpreadsheetId: process.env.LAPSED_SPREADSHEET_ID || "1x-0iFgnYmEqt-b2MfAgHVx5CErcX5NtZYB9p5Rh6f1I",
  checkinsSpreadsheetId: process.env.CHECKINS_SPREADSHEET_ID || "1a7XKv2WCog7o8nYuV8YcFdqtfPYJNRO6DelJ6Hn_z6Q",
};

const savedSettings = loadSettingsFile();
const config = { ...envDefaults };

// Overlay saved settings (non-empty values override env defaults)
for (const key of Object.keys(envDefaults)) {
  if (savedSettings[key] && String(savedSettings[key]).trim()) {
    config[key] = savedSettings[key];
  }
}

const classSheets = {
  sessions: ["sessions", "Sessions", "SESSIONS", "Session", "session", "Class Sessions"],
  recurring: ["recurring", "Recurring", "RECURRING", "recurrings"],
  teacherRecurring: ["teacher recurring", "Teacher Recurring", "TEACHER RECURRING", "teacher_recurring", "TeacherRecurring", "teacher-recurring"],
};
const intelligenceSheets = {
  payroll: ["payroll", "Payroll", "PAYROLL"],
  members: ["New", "new", "NEW"],
  bookings: ["bookings", "Bookings", "BOOKINGS"],
  leads: ["◉ Leads", "Leads", "leads", "LEADS"],
  lapsed: ["Lapsed", "lapsed", "LAPSED"],
  checkins: ["Checkins", "checkins", "CHECKINS", "Check-ins", "CheckIns"],
};
let tokenCache = null;

function assertConfigured() {
  const missing = [];
  if (!config.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!config.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!config.refreshToken) missing.push("GOOGLE_REFRESH_TOKEN");
  if (missing.length) throw new Error(`Server configuration is missing ${missing.join(", ")}. Open Settings to add your Google OAuth credentials.`);
}

async function accessToken() {
  assertConfigured();
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token" }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google authentication failed (${response.status}): ${json.error_description || json.error || "check the server credentials"}`);
  tokenCache = { value: json.access_token, expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000 };
  return tokenCache.value;
}

async function sheetValues(spreadsheetId, sheetName, formatted = false) {
  const token = await accessToken();
  const range = encodeURIComponent(`${sheetName}!A1:BZ200000`);
  const render = formatted ? "FORMATTED_VALUE" : "UNFORMATTED_VALUE";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS&valueRenderOption=${render}&dateTimeRenderOption=FORMATTED_STRING`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google Sheets error (${response.status}): ${json?.error?.message || `unable to read ${sheetName}`}`);
  return Array.isArray(json.values) ? json.values.map((row) => Array.isArray(row) ? row.map((cell) => cell == null ? "" : String(cell)) : []) : [];
}

async function firstAvailable(spreadsheetId, candidates, formatted = false) {
  const errors = [];
  for (const sheet of candidates) {
    try {
      const values = await sheetValues(spreadsheetId, sheet, formatted);
      if (values.length > 1) return { values, sheet };
    } catch (error) { errors.push(`${sheet}: ${error.message}`); }
  }
  throw new Error(errors.slice(0, 3).join(" · ") || "No matching sheet with data was found.");
}

// ── Helpers ──
const mask = (value) => {
  if (!value || String(value).length < 8) return value ? "••••••••" : "";
  const s = String(value);
  return s.slice(0, 4) + "••••••••" + s.slice(-4);
};

// ── JSON body parser ──
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// ── Health ──
app.get("/api/health", (_request, response) => response.json({
  ok: true,
  googleConfigured: Boolean(config.clientId && config.clientSecret && config.refreshToken),
}));

// ── Settings: read ──
app.get("/api/settings", (_request, response) => {
  response.json({
    clientId: mask(config.clientId),
    clientSecret: mask(config.clientSecret),
    refreshToken: mask(config.refreshToken),
    salesSpreadsheetId: config.salesSpreadsheetId,
    salesSheetName: config.salesSheetName,
    classSpreadsheetId: config.classSpreadsheetId,
    payrollSpreadsheetId: config.payrollSpreadsheetId,
    leadsSpreadsheetId: config.leadsSpreadsheetId,
    lapsedSpreadsheetId: config.lapsedSpreadsheetId,
    checkinsSpreadsheetId: config.checkinsSpreadsheetId,
    hasCredentials: Boolean(config.clientId && config.clientSecret && config.refreshToken),
    fromEnv: {
      clientId: Boolean(envDefaults.clientId),
      clientSecret: Boolean(envDefaults.clientSecret),
      refreshToken: Boolean(envDefaults.refreshToken),
    },
  });
});

// ── Settings: save ──
app.post("/api/settings", (request, response) => {
  try {
    const body = request.body || {};
    const updates = {};
    const keys = [
      "clientId", "clientSecret", "refreshToken",
      "salesSpreadsheetId", "salesSheetName", "classSpreadsheetId",
      "payrollSpreadsheetId", "leadsSpreadsheetId",
      "lapsedSpreadsheetId", "checkinsSpreadsheetId",
    ];
    for (const key of keys) {
      if (body[key] !== undefined) {
        const val = String(body[key] || "").trim();
        // Skip masked values (user didn't change the field)
        if (/^.{4}•{8}.{4}$/.test(val)) continue;
        updates[key] = val;
      }
    }

    // Persist to disk
    const current = loadSettingsFile();
    const merged = { ...current, ...updates };
    saveSettingsFile(merged);

    // Apply to runtime config
    for (const [key, val] of Object.entries(updates)) {
      if (val) config[key] = val;
    }

    // Clear token cache when credentials change so next call uses new creds
    if (updates.clientId || updates.clientSecret || updates.refreshToken) {
      tokenCache = null;
    }

    response.json({
      ok: true,
      updated: Object.keys(updates),
      hasCredentials: Boolean(config.clientId && config.clientSecret && config.refreshToken),
    });
  } catch (error) {
    console.error("Settings save failed:", error.message);
    response.status(500).json({ error: error.message || "Failed to save settings." });
  }
});

// ── Settings: test connection ──
app.post("/api/settings/test", async (_request, response) => {
  try {
    const token = await accessToken();
    // Quick test: list sheets from the sales spreadsheet
    const testUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.salesSpreadsheetId}?fields=properties.title`;
    const testRes = await fetch(testUrl, { headers: { Authorization: `Bearer ${token}` } });
    const testJson = await testRes.json().catch(() => ({}));
    if (!testRes.ok) {
      throw new Error(testJson?.error?.message || `Sheets API returned ${testRes.status}`);
    }
    response.json({
      ok: true,
      message: `Connected successfully to "${testJson?.properties?.title || config.salesSpreadsheetId}"`,
      spreadsheetTitle: testJson?.properties?.title || "",
    });
  } catch (error) {
    console.error("Settings test failed:", error.message);
    response.status(400).json({ ok: false, error: error.message });
  }
});

// ── Dashboard ──
app.get("/api/dashboard", async (_request, response) => {
  try {
    const [sales, sessions, recurring, teacherRecurring, payroll, members, bookings, leads, lapsed, checkins] = await Promise.all([
      sheetValues(config.salesSpreadsheetId, config.salesSheetName),
      firstAvailable(config.classSpreadsheetId, classSheets.sessions, true),
      firstAvailable(config.classSpreadsheetId, classSheets.recurring, true).catch(() => ({ values: [], sheet: "" })),
      firstAvailable(config.classSpreadsheetId, classSheets.teacherRecurring, true).catch(() => ({ values: [], sheet: "" })),
      config.payrollSpreadsheetId ? firstAvailable(config.payrollSpreadsheetId, intelligenceSheets.payroll, true).catch(() => ({ values: [], sheet: "" })) : { values: [], sheet: "" },
      config.payrollSpreadsheetId ? firstAvailable(config.payrollSpreadsheetId, intelligenceSheets.members, true).catch(() => ({ values: [], sheet: "" })) : { values: [], sheet: "" },
      config.payrollSpreadsheetId ? firstAvailable(config.payrollSpreadsheetId, ["bookings", "Bookings", "Late Cancellations"], true).catch(() => ({ values: [], sheet: "" })) : { values: [], sheet: "" },
      config.leadsSpreadsheetId ? firstAvailable(config.leadsSpreadsheetId, intelligenceSheets.leads, true).catch(() => ({ values: [], sheet: "" })) : { values: [], sheet: "" },
      config.lapsedSpreadsheetId ? firstAvailable(config.lapsedSpreadsheetId, intelligenceSheets.lapsed, true).catch(() => ({ values: [], sheet: "" })) : { values: [], sheet: "" },
      config.checkinsSpreadsheetId ? firstAvailable(config.checkinsSpreadsheetId, intelligenceSheets.checkins, true).catch(() => ({ values: [], sheet: "" })) : { values: [], sheet: "" },
    ]);
    response.set("Cache-Control", "no-store").json({
      sales,
      classes: { sessions: sessions.values, sessionsSheet: sessions.sheet, recurring: recurring.values, recurringSheet: recurring.sheet, teacherRecurring: teacherRecurring.values, teacherSheet: teacherRecurring.sheet },
      intelligence: {
        payroll: payroll.values, payrollSheet: payroll.sheet,
        members: members.values, membersSheet: members.sheet,
        bookings: bookings.values, bookingsSheet: bookings.sheet,
        leads: leads.values, leadsSheet: leads.sheet,
        lapsed: lapsed.values, lapsedSheet: lapsed.sheet,
        checkins: checkins.values, checkinsSheet: checkins.sheet,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Dashboard sync failed:", error.message);
    response.status(502).json({ error: error.message || "Unable to load Google Sheets data." });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("*path", (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, "0.0.0.0", () => console.log(`Physique 57 Analytics running at http://localhost:${port}`));
