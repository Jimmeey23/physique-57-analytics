import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  X, Eye, EyeOff, Check, AlertTriangle, Loader2,
  Key, Wifi, ShieldCheck, ExternalLink, Save, Trash2,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  fetchSettings, saveSettings, testConnection,
  type SettingsPayload, type SaveSettingsPayload,
} from "../lib/google";
import { Panel, Btn } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
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
}

const emptyForm: FormState = {
  clientId: "", clientSecret: "", refreshToken: "",
  salesSpreadsheetId: "", salesSheetName: "",
  classSpreadsheetId: "", payrollSpreadsheetId: "",
  leadsSpreadsheetId: "", lapsedSpreadsheetId: "", checkinsSpreadsheetId: "",
};

type TestStatus = "idle" | "testing" | "success" | "error";

export function SettingsModal({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);

  // Fetch current settings when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchSettings()
      .then((data) => {
        setSettings(data);
        setForm({
          clientId: data.clientId || "",
          clientSecret: data.clientSecret || "",
          refreshToken: data.refreshToken || "",
          salesSpreadsheetId: data.salesSpreadsheetId || "",
          salesSheetName: data.salesSheetName || "Sales",
          classSpreadsheetId: data.classSpreadsheetId || "",
          payrollSpreadsheetId: data.payrollSpreadsheetId || "",
          leadsSpreadsheetId: data.leadsSpreadsheetId || "",
          lapsedSpreadsheetId: data.lapsedSpreadsheetId || "",
          checkinsSpreadsheetId: data.checkinsSpreadsheetId || "",
        });
        setDirty({});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const toggleShow = (field: string) => setShow((s) => ({ ...s, [field]: !s[field] }));

  const updateField = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    // Mark field as dirty only if the user actually changed it from the loaded value
    const currentVal = settings ? (settings as unknown as Record<string, string>)[field] || "" : "";
    setDirty((d) => ({ ...d, [field]: value !== currentVal && value !== "" }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const payload: SaveSettingsPayload = {};
      for (const key of Object.keys(dirty) as (keyof FormState)[]) {
        if (dirty[key] && form[key]) {
          (payload as Record<string, string>)[key] = form[key];
        }
      }
      if (Object.keys(payload).length === 0) {
        setSaveMsg("No changes to save.");
        return;
      }
      const res = await saveSettings(payload);
      setSaveMsg(`Saved ${res.updated.length} field${res.updated.length === 1 ? "" : "s"} successfully.`);
      // Re-fetch to get masked values
      const fresh = await fetchSettings();
      setSettings(fresh);
      setForm((f) => ({
        ...f,
        clientId: fresh.clientId,
        clientSecret: fresh.clientSecret,
        refreshToken: fresh.refreshToken,
      }));
      setDirty({});
      onSaved();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [dirty, form, onSaved]);

  const handleTest = useCallback(async () => {
    setTestStatus("testing");
    setTestMsg(null);
    try {
      const res = await testConnection();
      setTestStatus("success");
      setTestMsg(res.message || "Connection successful!");
    } catch (err: unknown) {
      setTestStatus("error");
      setTestMsg(err instanceof Error ? err.message : "Connection test failed.");
    }
  }, []);

  const clearField = (field: keyof FormState) => {
    setForm((f) => ({ ...f, [field]: "" }));
    setDirty((d) => ({ ...d, [field]: true }));
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="my-8 w-full max-w-3xl rounded-2xl border border-line bg-app shadow-2xl"
      >
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-loc-soft text-loc">
              <Key className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-hi">Settings</h2>
              <p className="text-[11px] text-lo">Google OAuth credentials & spreadsheet configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-line text-lo hover:bg-surface2 hover:text-hi">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-lo" />
              <span className="ml-3 text-sm text-lo">Loading settings…</span>
            </div>
          ) : (
            <>
              {/* Status banner */}
              <StatusBanner
                hasCredentials={settings?.hasCredentials ?? false}
                fromEnv={settings?.fromEnv}
              />

              {/* ── OAuth Credentials ── */}
              <Panel title="Google OAuth Credentials" subtitle="Required to fetch data from Google Sheets">
                <div className="space-y-4 p-5">
                  <InfoLink
                    text="Need help getting these? Create credentials in Google Cloud Console"
                    href="https://console.cloud.google.com/apis/credentials"
                  />

                  <Field
                    label="Client ID"
                    value={form.clientId}
                    onChange={(v) => updateField("clientId", v)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    showToggle
                    showValue={show.clientId}
                    onToggleShow={() => toggleShow("clientId")}
                    dirty={Boolean(dirty.clientId)}
                    fromEnv={Boolean(settings?.fromEnv.clientId)}
                    onClear={() => clearField("clientId")}
                  />
                  <Field
                    label="Client Secret"
                    value={form.clientSecret}
                    onChange={(v) => updateField("clientSecret", v)}
                    placeholder="GOCSPX-xxxxx"
                    showToggle
                    showValue={show.clientSecret}
                    onToggleShow={() => toggleShow("clientSecret")}
                    dirty={Boolean(dirty.clientSecret)}
                    fromEnv={Boolean(settings?.fromEnv.clientSecret)}
                    onClear={() => clearField("clientSecret")}
                  />
                  <Field
                    label="Refresh Token"
                    value={form.refreshToken}
                    onChange={(v) => updateField("refreshToken", v)}
                    placeholder="1//xxxxx"
                    showToggle
                    showValue={show.refreshToken}
                    onToggleShow={() => toggleShow("refreshToken")}
                    dirty={Boolean(dirty.refreshToken)}
                    fromEnv={Boolean(settings?.fromEnv.refreshToken)}
                    onClear={() => clearField("refreshToken")}
                  />

                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    <button
                      onClick={handleTest}
                      disabled={testStatus === "testing"}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-semibold transition-colors",
                        testStatus === "testing" ? "border-line bg-surface2 text-lo cursor-wait" :
                        testStatus === "success" ? "border-pos/30 bg-pos-soft text-pos hover:bg-pos-soft/80" :
                        testStatus === "error" ? "border-neg/30 bg-neg-soft text-neg hover:bg-neg-soft/80" :
                        "border-line bg-surface text-mid hover:bg-surface2 hover:text-hi"
                      )}
                    >
                      {testStatus === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                       testStatus === "success" ? <Check className="h-3.5 w-3.5" /> :
                       testStatus === "error" ? <AlertTriangle className="h-3.5 w-3.5" /> :
                       <Wifi className="h-3.5 w-3.5" />}
                      {testStatus === "testing" ? "Testing…" : "Test Connection"}
                    </button>
                    {testMsg && (
                      <span className={cn(
                        "text-[11.5px] font-medium",
                        testStatus === "success" ? "text-pos" : testStatus === "error" ? "text-neg" : "text-mid"
                      )}>
                        {testMsg}
                      </span>
                    )}
                  </div>
                </div>
              </Panel>

              {/* ── Spreadsheet IDs ── */}
              <Panel title="Spreadsheet Configuration" subtitle="Google Sheets IDs and tab names for each data source">
                <div className="space-y-4 p-5">
                  <Field
                    label="Sales Spreadsheet ID"
                    value={form.salesSpreadsheetId}
                    onChange={(v) => updateField("salesSpreadsheetId", v)}
                    placeholder="1HbGnJk-peffUp7XoXSlsL55924E9yUt8cP_h93cdTT0"
                    dirty={Boolean(dirty.salesSpreadsheetId)}
                    onClear={() => clearField("salesSpreadsheetId")}
                  />
                  <Field
                    label="Sales Sheet Tab Name"
                    value={form.salesSheetName}
                    onChange={(v) => updateField("salesSheetName", v)}
                    placeholder="Sales"
                    dirty={Boolean(dirty.salesSheetName)}
                    onClear={() => clearField("salesSheetName")}
                  />
                  <Field
                    label="Classes Spreadsheet ID"
                    value={form.classSpreadsheetId}
                    onChange={(v) => updateField("classSpreadsheetId", v)}
                    placeholder="16wFlke0bHFcmfn-3UyuYlGnImBq0DY7ouVYAlAFTZys"
                    dirty={Boolean(dirty.classSpreadsheetId)}
                    onClear={() => clearField("classSpreadsheetId")}
                  />

                  <div className="border-t border-line pt-4">
                    <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-lo">Optional Data Sources</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Payroll / New / Bookings Spreadsheet ID"
                        value={form.payrollSpreadsheetId}
                        onChange={(v) => updateField("payrollSpreadsheetId", v)}
                        placeholder="Spreadsheet ID"
                        dirty={Boolean(dirty.payrollSpreadsheetId)}
                        compact
                        onClear={() => clearField("payrollSpreadsheetId")}
                      />
                      <Field
                        label="Leads Spreadsheet ID"
                        value={form.leadsSpreadsheetId}
                        onChange={(v) => updateField("leadsSpreadsheetId", v)}
                        placeholder="Spreadsheet ID"
                        dirty={Boolean(dirty.leadsSpreadsheetId)}
                        compact
                        onClear={() => clearField("leadsSpreadsheetId")}
                      />
                      <Field
                        label="Lapsed Members Spreadsheet ID"
                        value={form.lapsedSpreadsheetId}
                        onChange={(v) => updateField("lapsedSpreadsheetId", v)}
                        placeholder="Spreadsheet ID"
                        dirty={Boolean(dirty.lapsedSpreadsheetId)}
                        compact
                        onClear={() => clearField("lapsedSpreadsheetId")}
                      />
                      <Field
                        label="Checkins Spreadsheet ID"
                        value={form.checkinsSpreadsheetId}
                        onChange={(v) => updateField("checkinsSpreadsheetId", v)}
                        placeholder="Spreadsheet ID"
                        dirty={Boolean(dirty.checkinsSpreadsheetId)}
                        compact
                        onClear={() => clearField("checkinsSpreadsheetId")}
                      />
                    </div>
                  </div>
                </div>
              </Panel>

              {/* ── Save bar ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface2/60 px-5 py-4">
                <div>
                  {saveError ? (
                    <p className="flex items-center gap-2 text-[12px] font-medium text-neg">
                      <AlertTriangle className="h-4 w-4" /> {saveError}
                    </p>
                  ) : saveMsg ? (
                    <p className="flex items-center gap-2 text-[12px] font-medium text-pos">
                      <Check className="h-4 w-4" /> {saveMsg}
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-lo">
                      {Object.values(dirty).some(Boolean)
                        ? `${Object.values(dirty).filter(Boolean).length} field${Object.values(dirty).filter(Boolean).length === 1 ? "" : "s"} modified`
                        : "No unsaved changes"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Btn onClick={onClose}>Cancel</Btn>
                  <button
                    onClick={handleSave}
                    disabled={saving || !Object.values(dirty).some(Boolean)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-semibold transition-all",
                      saving || !Object.values(dirty).some(Boolean)
                        ? "bg-surface3 text-lo cursor-not-allowed"
                        : "bg-loc text-white shadow-md hover:opacity-90 active:scale-[0.98]"
                    )}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sub-components ──

function StatusBanner({ hasCredentials, fromEnv }: { hasCredentials: boolean; fromEnv?: { clientId: boolean; clientSecret: boolean; refreshToken: boolean } }) {
  const envCount = fromEnv ? [fromEnv.clientId, fromEnv.clientSecret, fromEnv.refreshToken].filter(Boolean).length : 0;

  if (hasCredentials) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-pos/20 bg-pos-soft/50 px-4 py-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-pos" />
        <div>
          <p className="text-[12px] font-semibold text-pos">Credentials configured</p>
          <p className="text-[11px] text-pos/70">
            {envCount > 0
              ? `${envCount} credential${envCount === 1 ? "" : "s"} loaded from environment variables. UI changes are saved on top.`
              : "All credentials are set. Use Test Connection to verify access."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-warn/20 bg-warn-soft/50 px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
      <div>
        <p className="text-[12px] font-semibold text-warn">No credentials configured</p>
        <p className="text-[11px] text-warn/70">
          Add your Google OAuth Client ID, Client Secret, and Refresh Token below to connect to Google Sheets.
        </p>
      </div>
    </div>
  );
}

function InfoLink({ text, href }: { text: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-loc/20 bg-loc-soft/40 px-3 py-2.5 text-[11.5px] font-medium text-loc transition-colors hover:bg-loc-soft/70"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {text}
    </a>
  );
}

function Field({
  label, value, onChange, placeholder, showToggle, showValue, onToggleShow,
  dirty, fromEnv, compact, onClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showToggle?: boolean;
  showValue?: boolean;
  onToggleShow?: () => void;
  dirty?: boolean;
  fromEnv?: boolean;
  compact?: boolean;
  onClear?: () => void;
}) {
  return (
    <label className={cn("block", !compact && "space-y-1.5")}>
      <div className={cn("flex items-center gap-2", compact ? "mb-1" : "mb-1.5")}>
        <span className={cn("font-semibold text-hi", compact ? "text-[11px]" : "text-[11.5px]")}>{label}</span>
        {dirty && <span className="rounded bg-loc-soft px-1.5 py-0.5 text-[9px] font-bold text-loc">Modified</span>}
        {fromEnv && <span className="rounded bg-surface3 px-1.5 py-0.5 text-[9px] font-bold text-lo">From env</span>}
      </div>
      <div className="relative">
        <input
          type={showToggle && !showValue ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border bg-surface py-2.5 font-mono text-[12px] text-hi outline-none transition-colors placeholder:text-lo/50",
            dirty ? "border-loc/50 ring-1 ring-loc/20" : "border-line",
            "focus:border-strong focus:ring-1 focus:ring-strong/30",
            compact ? "px-3 py-2 text-[11px]" : "px-4"
          )}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="grid h-6 w-6 place-items-center rounded-md text-lo hover:bg-surface2 hover:text-neg"
              title="Clear field"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          {showToggle && onToggleShow && (
            <button
              type="button"
              onClick={onToggleShow}
              className="grid h-6 w-6 place-items-center rounded-md text-lo hover:bg-surface2 hover:text-hi"
              title={showValue ? "Hide" : "Show"}
            >
              {showValue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
    </label>
  );
}
