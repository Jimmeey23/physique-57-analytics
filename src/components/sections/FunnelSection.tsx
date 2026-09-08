import { useMemo, useState } from "react";
import type { FlexTable } from "../../lib/sessions";
import { intFmt, pct } from "../../lib/format";
import { cn } from "../../utils/cn";
import { MetricCard } from "../MetricCard";
import type { KPI } from "../../lib/analytics";
import { Panel, SectionHeader, Btn, ShareBar } from "../ui";
import { DataTable, type Col } from "../DataTable";
import { TrendChart, Donut, RankBars } from "../Charts";

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  createdAt: string;
  createdAtObj: Date | null;
  source: string;
  memberId: string;
  convertedAt: string;
  stageName: string;
  associate: string;
  remarks: string;
  followUp1Date: string;
  followUp1Comments: string;
  followUp2Date: string;
  followUp2Comments: string;
  followUp3Date: string;
  followUp3Comments: string;
  followUp4Date: string;
  followUp4Comments: string;
  center: string;
  classType: string;
  hostId: string;
  status: string;
  channel: string;
  period: string;
}

const pick = (row: Record<string, string>, ...keys: string[]) => {
  const norm = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), v]));
  for (const k of keys) {
    const v = norm.get(k.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (v !== undefined) return v;
  }
  return "";
};

function parseDate(v: string): Date | null {
  if (!v) return null;
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const m2 = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return new Date(+m2[3], +m2[2] - 1, +m2[1]);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseLeads(data: FlexTable): Lead[] {
  return data.rows.map((row) => ({
    id: pick(row, "ID", "Id"),
    fullName: pick(row, "Full Name"),
    phone: pick(row, "Phone Number"),
    email: pick(row, "Email"),
    createdAt: pick(row, "Created At"),
    createdAtObj: parseDate(pick(row, "Created At")),
    source: pick(row, "Source Name", "Source"),
    memberId: pick(row, "Member ID"),
    convertedAt: pick(row, "Converted To Customer At"),
    stageName: pick(row, "Stage Name"),
    associate: pick(row, "Associate"),
    remarks: pick(row, "Remarks"),
    followUp1Date: pick(row, "Follow Up 1 Date"),
    followUp1Comments: pick(row, "Follow Up Comments (1)"),
    followUp2Date: pick(row, "Follow Up 2 Date"),
    followUp2Comments: pick(row, "Follow Up Comments (2)"),
    followUp3Date: pick(row, "Follow Up 3 Date"),
    followUp3Comments: pick(row, "Follow Up Comments (3)"),
    followUp4Date: pick(row, "Follow Up 4 Date"),
    followUp4Comments: pick(row, "Follow Up Comments (4)"),
    center: pick(row, "Center"),
    classType: pick(row, "Class Type"),
    hostId: pick(row, "Host ID"),
    status: pick(row, "Status"),
    channel: pick(row, "Channel"),
    period: pick(row, "Period"),
  }));
}

export function FunnelSection({ leads, kpis }: { leads: FlexTable; kpis: KPI[] }) {
  const leadsData = useMemo(() => parseLeads(leads), [leads]);
  const [tab, setTab] = useState<"all" | "won" | "lost" | "active">("all");

  const stats = useMemo(() => {
    const total = leadsData.length;
    const won = leadsData.filter((l) => /won/i.test(l.status)).length;
    const lost = leadsData.filter((l) => /lost/i.test(l.status)).length;
    const active = total - won - lost;
    const winRate = total ? (won / total) * 100 : 0;
    const lostRate = total ? (lost / total) * 100 : 0;
    return { total, won, lost, active, winRate, lostRate };
  }, [leadsData]);

  const filtered = useMemo(() => {
    switch (tab) {
      case "won": return leadsData.filter((l) => /won/i.test(l.status));
      case "lost": return leadsData.filter((l) => /lost/i.test(l.status));
      case "active": return leadsData.filter((l) => !/won|lost/i.test(l.status));
      default: return leadsData;
    }
  }, [leadsData, tab]);

  // Lead creation trend
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { leads: number; won: number; lost: number }>();
    leadsData.forEach((l) => {
      if (!l.createdAtObj) return;
      const ym = `${l.createdAtObj.getFullYear()}-${String(l.createdAtObj.getMonth() + 1).padStart(2, "0")}`;
      const e = map.get(ym) || { leads: 0, won: 0, lost: 0 };
      e.leads++;
      if (/won/i.test(l.status)) e.won++;
      if (/lost/i.test(l.status)) e.lost++;
      map.set(ym, e);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, d]) => ({
      label: label.replace(/^\d{4}-/, ""),
      leads: d.leads,
      won: d.won,
      lost: d.lost,
      winRate: d.leads ? (d.won / d.leads) * 100 : 0,
    }));
  }, [leadsData]);

  // By source
  const bySource = useMemo(() => {
    const map = new Map<string, { total: number; won: number; lost: number }>();
    leadsData.forEach((l) => {
      const src = l.source || "Unknown";
      const e = map.get(src) || { total: 0, won: 0, lost: 0 };
      e.total++;
      if (/won/i.test(l.status)) e.won++;
      if (/lost/i.test(l.status)) e.lost++;
      map.set(src, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name,
      total: d.total,
      won: d.won,
      lost: d.lost,
      winRate: d.total ? (d.won / d.total) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [leadsData]);

  // By channel
  const byChannel = useMemo(() => {
    const map = new Map<string, number>();
    leadsData.forEach((l) => {
      const ch = l.channel || "Unknown";
      map.set(ch, (map.get(ch) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [leadsData]);

  // By stage
  const byStage = useMemo(() => {
    const map = new Map<string, number>();
    leadsData.forEach((l) => {
      const stage = l.stageName || "Unknown";
      map.set(stage, (map.get(stage) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [leadsData]);

  // By associate
  const byAssociate = useMemo(() => {
    const map = new Map<string, { total: number; won: number; lost: number }>();
    leadsData.forEach((l) => {
      const a = l.associate || "Unassigned";
      const e = map.get(a) || { total: 0, won: 0, lost: 0 };
      e.total++;
      if (/won/i.test(l.status)) e.won++;
      if (/lost/i.test(l.status)) e.lost++;
      map.set(a, e);
    });
    return [...map.entries()].map(([name, d]) => ({
      name,
      total: d.total,
      won: d.won,
      lost: d.lost,
      winRate: d.total ? (d.won / d.total) * 100 : 0,
    })).sort((a, b) => b.won - a.won);
  }, [leadsData]);

  // By center
  const byCenter = useMemo(() => {
    const map = new Map<string, number>();
    leadsData.forEach((l) => {
      const c = l.center || "Unknown";
      map.set(c, (map.get(c) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [leadsData]);

  // Follow-up activity
  const followUpStats = useMemo(() => {
    const withFollowUp = leadsData.filter((l) => l.followUp1Date || l.followUp2Date || l.followUp3Date || l.followUp4Date);
    const avgFollowUps = leadsData.length ? withFollowUp.reduce((s, l) => {
      let count = 0;
      if (l.followUp1Date) count++;
      if (l.followUp2Date) count++;
      if (l.followUp3Date) count++;
      if (l.followUp4Date) count++;
      return s + count;
    }, 0) / leadsData.length : 0;
    return { withFollowUp: withFollowUp.length, avgFollowUps };
  }, [leadsData]);

  const cols = leadColumns();

  return (
    <div className="space-y-8">
      <SectionHeader
        index={1}
        title="Leads & Sales Funnel Intelligence"
        description="Lead flow, conversion pipeline, source attribution, associate performance, and follow-up discipline."
        meta={<span className="source-badge"><span className="source-dot" />{intFmt(leadsData.length)} leads tracked</span>}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <MetricCard key={k.id} kpi={k} index={i} />
        ))}
      </div>

      {/* Funnel visualization */}
      <Panel title="Sales Funnel" subtitle="Lead pipeline from creation to outcome">
        <div className="grid gap-0 sm:grid-cols-4">
          <FunnelBlock label="Total Leads" value={stats.total} total={stats.total} color="blue" />
          <FunnelBlock label="Engaged (Follow-up)" value={followUpStats.withFollowUp} total={stats.total} color="violet" />
          <FunnelBlock label="Won" value={stats.won} total={stats.total} color="emerald" />
          <FunnelBlock label="Lost" value={stats.lost} total={stats.total} color="rose" />
        </div>
      </Panel>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Lead Creation Trend" subtitle="Monthly lead flow and conversion outcomes">
          {monthlyTrend.length > 0 ? (
            <TrendChart
              data={monthlyTrend}
              bars={[{ key: "leads", name: "New Leads" }]}
              lines={[{ key: "won", name: "Won" }, { key: "lost", name: "Lost" }]}
              height={280}
            />
          ) : (
            <EmptyChart msg="No trend data available" />
          )}
        </Panel>
        <Panel title="Funnel Stage Distribution" subtitle="Where leads sit in the pipeline">
          {byStage.length > 0 ? <Donut data={byStage.slice(0, 8)} height={280} /> : <EmptyChart msg="No stage data" />}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Source Performance" subtitle="Lead source → volume → win rate">
          <DataTable
            cols={sourceColumns()}
            rows={bySource}
            rowKey={(r) => r.name}
            defaultSort="total"
            initialLimit={15}
          />
        </Panel>
        <Panel title="Associate Leaderboard" subtitle="Sales associate conversion performance">
          <DataTable
            cols={associateColumns()}
            rows={byAssociate}
            rowKey={(r) => r.name}
            defaultSort="won"
            initialLimit={15}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="By Channel" subtitle="Lead acquisition channels">
          {byChannel.length > 0 ? <Donut data={byChannel.slice(0, 8)} height={260} /> : <EmptyChart msg="No data" />}
        </Panel>
        <Panel title="By Center" subtitle="Studio lead distribution">
          {byCenter.length > 0 ? <Donut data={byCenter} height={260} /> : <EmptyChart msg="No data" />}
        </Panel>
        <Panel title="Source Win Rates" subtitle="Which sources convert best">
          {bySource.length > 0 ? (
            <RankBars
              data={bySource.filter((s) => s.total >= 3).sort((a, b) => b.winRate - a.winRate).slice(0, 10).map((s) => ({ name: s.name, value: s.winRate }))}
              height={260}
              dataKey="value"
            />
          ) : <EmptyChart msg="No data" />}
        </Panel>
      </div>

      {/* Leads table */}
      <Panel
        title="Lead Pipeline"
        subtitle={`${intFmt(filtered.length)} leads`}
        right={
          <div className="flex items-center gap-1.5">
            {(["all", "won", "lost", "active"] as const).map((t) => (
              <Btn key={t} size="xs" active={tab === t} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Btn>
            ))}
          </div>
        }
      >
        <DataTable
          cols={cols}
          rows={filtered}
          rowKey={(r) => r.id || `${r.fullName}-${r.createdAt}`}
          defaultSort="createdAt"
          initialLimit={25}
          csvName="leads-funnel"
        />
      </Panel>
    </div>
  );
}

/* ── Components ── */

function FunnelBlock({ label, value, total }: { label: string; value: number; total: number; color: string }) {
  const pctVal = total ? (value / total) * 100 : 0;
  return (
    <div className="border-b border-line p-4 sm:border-b-0 sm:border-r last:border-r-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-lo">{label}</p>
      <p className="mt-1 font-display text-[28px] font-bold text-hi">{intFmt(value)}</p>
      <ShareBar value={pctVal} />
      <p className="mt-1 text-[10.5px] text-lo">{pct(pctVal)} of total</p>
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return <div className="flex h-[260px] items-center justify-center text-[12px] text-lo">{msg}</div>;
}

function sourceColumns(): Col<{ name: string; total: number; won: number; lost: number; winRate: number }>[] {
  return [
    { key: "name", label: "Source", align: "left", value: (r) => r.name },
    { key: "total", label: "Total Leads", value: (r) => r.total, fmt: intFmt, heat: true },
    { key: "won", label: "Won", value: (r) => r.won, fmt: intFmt },
    { key: "lost", label: "Lost", value: (r) => r.lost, fmt: intFmt },
    { key: "winRate", label: "Win Rate", value: (r) => r.winRate, fmt: (n) => pct(n, 1) },
  ];
}

function associateColumns(): Col<{ name: string; total: number; won: number; lost: number; winRate: number }>[] {
  return [
    { key: "name", label: "Associate", align: "left", value: (r) => r.name },
    { key: "total", label: "Total Leads", value: (r) => r.total, fmt: intFmt },
    { key: "won", label: "Won", value: (r) => r.won, fmt: intFmt, heat: true },
    { key: "lost", label: "Lost", value: (r) => r.lost, fmt: intFmt },
    { key: "winRate", label: "Win Rate", value: (r) => r.winRate, fmt: (n) => pct(n, 1) },
  ];
}

function leadColumns(): Col<Lead>[] {
  return [
    { key: "fullName", label: "Lead", align: "left", value: (r) => r.fullName, totalMode: "none", width: "200px",
      render: (r) => <div><b className="block text-hi">{r.fullName || "—"}</b><small className="text-[9px] text-lo">{r.email || r.phone || "—"}</small></div>
    },
    { key: "source", label: "Source", value: (r) => r.source },
    { key: "stageName", label: "Stage", value: (r) => r.stageName },
    { key: "status", label: "Status", value: (r) => r.status,
      render: (r) => {
        const won = /won/i.test(r.status);
        const lost = /lost/i.test(r.status);
        return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold",
          won ? "bg-pos-soft text-pos" : lost ? "bg-neg-soft text-neg" : "bg-warn-soft text-warn"
        )}>{r.status || "Active"}</span>;
      }
    },
    { key: "associate", label: "Associate", value: (r) => r.associate },
    { key: "createdAt", label: "Created", value: (r) => r.createdAt },
    { key: "channel", label: "Channel", value: (r) => r.channel },
    { key: "center", label: "Center", value: (r) => r.center },
    { key: "remarks", label: "Remarks", value: (r) => r.remarks },
    { key: "convertedAt", label: "Converted At", value: (r) => r.convertedAt },
  ];
}
