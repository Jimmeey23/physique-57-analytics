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
  syncedAt: string;
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardPayload> {
  const response = await fetch("/api/dashboard", { signal, headers: { Accept: "application/json" } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Dashboard sync failed (${response.status}).`);
  return json as DashboardPayload;
}
