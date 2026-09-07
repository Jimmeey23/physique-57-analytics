export interface DashboardPayload {
  sales: string[][];
  classes: {
    sessions: string[][];
    sessionsSheet: string;
    recurring: string[][];
    recurringSheet: string;
    teacherRecurring: string[][];
    teacherSheet: string;
  };
  intelligence: {
    payroll: string[][];
    payrollSheet: string;
    members: string[][];
    membersSheet: string;
    bookings: string[][];
    bookingsSheet: string;
    leads: string[][];
    leadsSheet: string;
    lapsed: string[][];
    lapsedSheet: string;
    checkins: string[][];
    checkinsSheet: string;
  };
  syncedAt: string;
  _demo?: boolean;
  _demoReason?: string;
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardPayload> {
  const response = await fetch("/api/dashboard", { signal, headers: { Accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Dashboard sync failed (${response.status}).`);
  return json as DashboardPayload;
}

// ── Settings API ──

export interface SettingsPayload {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  salesSpreadsheetId: string;
  salesSheetName: string;
  classSpreadsheetId: string;
  payrollSpreadsheetId: string;
  leadsSpreadsheetId: string;
  lapsedSpreadsheetId: string;
  checkinsSpreadsheetId: string;
  hasCredentials: boolean;
  fromEnv: {
    clientId: boolean;
    clientSecret: boolean;
    refreshToken: boolean;
  };
}

export async function fetchSettings(signal?: AbortSignal): Promise<SettingsPayload> {
  const response = await fetch("/api/settings", { signal, headers: { Accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Failed to load settings (${response.status}).`);
  return json as SettingsPayload;
}

export interface SaveSettingsPayload {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  salesSpreadsheetId?: string;
  salesSheetName?: string;
  classSpreadsheetId?: string;
  payrollSpreadsheetId?: string;
  leadsSpreadsheetId?: string;
  lapsedSpreadsheetId?: string;
  checkinsSpreadsheetId?: string;
}

export interface SaveSettingsResponse {
  ok: boolean;
  updated: string[];
  hasCredentials: boolean;
}

export async function saveSettings(settings: SaveSettingsPayload): Promise<SaveSettingsResponse> {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Failed to save settings (${response.status}).`);
  return json as SaveSettingsResponse;
}

export interface TestConnectionResponse {
  ok: boolean;
  message?: string;
  spreadsheetTitle?: string;
  sheetCount?: number;
  sheetNames?: string[];
  error?: string;
}

export async function testConnection(): Promise<TestConnectionResponse> {
  const response = await fetch("/api/settings/test", { method: "POST" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Server returned error — surface the detailed error message
    throw new Error(json.error || `Connection test failed (${response.status}).`);
  }
  return json as TestConnectionResponse;
}
