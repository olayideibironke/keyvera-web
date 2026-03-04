// app/admin/properties/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type OverviewRow = {
  id: string;
  title: string | null;
  address_line: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  rent_amount_ngn: number | null;
  rent_frequency: string | null;
  property_type: string | null;
  inspection_fee_ngn: number | null;
  property_class: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;

  total_inspections: number;
  paid_plus_inspections: number;
  revenue_ngn: number;
};

type InspectionRow = {
  id: string;
  status: string;
  tenant_user_id: string;
  inspection_fee_ngn: number;
  created_at: string;
  paid_at: string | null;
  scheduled_at: string | null;
  scheduled_by_user_id: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  payment_reference: string | null;
};

type AgentStatRow = {
  agent_user_id: string;
  agent_name: string;
  scheduled_count: number;
  completed_count: number;
  revenue_ngn: number;
};

type TrendRow = {
  day: string; // YYYY-MM-DD
  paidCount: number;
  revenue: number;
};

function formatNgn(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function shortId(id: string) {
  const s = String(id || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function formatDt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function lastNDaysKeys(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function toIsoDay(x: any) {
  if (!x) return null;
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maxNum(arr: number[]) {
  let m = 0;
  for (const x of arr) if (Number.isFinite(x) && x > m) m = x;
  return m;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "bad"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-black/10 bg-white/70 text-black/55";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function DataShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      {children}
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
      <div className="font-semibold text-[#0b1f2a]">{title}</div>
      {body ? <div className="mt-1 text-black/60">{body}</div> : null}
    </div>
  );
}

function WarnState({
  title,
  body,
  code,
}: {
  title: string;
  body: React.ReactNode;
  code?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-amber-900/80">{body}</div>
      {code ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3 font-mono text-xs text-amber-900/70">
          {code}
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-black/60">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{value}</div>
          {hint ? <div className="mt-2 text-xs text-black/50">{hint}</div> : null}
        </div>
        <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_14px_34px_rgba(11,31,42,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(14px_14px_at_32%_30%,rgba(14,165,163,0.95),transparent_60%),radial-gradient(18px_18px_at_72%_70%,rgba(10,79,99,0.92),transparent_58%)]" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/0" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.08)] backdrop-blur-xl">
      <div className="text-xs font-medium text-black/60">{label}</div>
      <div className={`mt-2 text-sm text-[#0b1f2a] ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function StatusChip({ status }: { status?: string | null }) {
  const s = String(status ?? "").toLowerCase();
  if (s === "live") return <Badge tone="good">live</Badge>;
  if (s === "approved") return <Badge tone="good">approved</Badge>;
  if (s === "pending_review") return <Badge tone="warn">pending_review</Badge>;
  if (s === "suspended") return <Badge tone="bad">suspended</Badge>;
  if (s === "archived") return <Badge>archived</Badge>;
  if (s === "draft") return <Badge>draft</Badge>;
  return <Badge>{status ?? "—"}</Badge>;
}

export default function AdminPropertyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = String((params as any)?.id ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewRow | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);

  const [agentStatsLoading, setAgentStatsLoading] = useState(false);
  const [agentStatsErr, setAgentStatsErr] = useState<string | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStatRow[]>([]);

  const [trendLoading, setTrendLoading] = useState(false);
  const [trendErr, setTrendErr] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);

  async function requireAdmin() {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      router.push("/login");
      return null;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    if (!profile || profile.role !== "admin") {
      router.push("/login");
      return null;
    }

    return user;
  }

  async function loadAgentStats() {
    setAgentStatsLoading(true);
    setAgentStatsErr(null);

    try {
      const { data, error } = await supabase.rpc("admin_property_agent_stats", {
        property_id_in: propertyId,
      });

      if (error) {
        setAgentStats([]);
        setAgentStatsErr(String(error.message || "Failed to load agent performance."));
        setAgentStatsLoading(false);
        return;
      }

      const normalized: AgentStatRow[] = (data ?? []).map((r: any) => ({
        agent_user_id: String(r.agent_user_id),
        agent_name: r.agent_name ? String(r.agent_name) : "Agent",
        scheduled_count: Number(r.scheduled_count || 0),
        completed_count: Number(r.completed_count || 0),
        revenue_ngn: Number(r.revenue_ngn || 0),
      }));

      setAgentStats(normalized);
      setAgentStatsLoading(false);
    } catch (e: any) {
      setAgentStats([]);
      setAgentStatsErr(e?.message ?? "Failed to load agent performance.");
      setAgentStatsLoading(false);
    }
  }

  async function loadTrend() {
    setTrendLoading(true);
    setTrendErr(null);

    try {
      const { data, error } = await supabase.rpc("admin_property_trend", {
        property_id_in: propertyId,
        days_in: 30,
      });

      if (error) {
        setTrend([]);
        setTrendErr(String(error.message || "Failed to load trend."));
        setTrendLoading(false);
        return;
      }

      const keys = lastNDaysKeys(30);
      const byDay: Record<string, { paidCount: number; revenue: number }> = {};
      for (const k of keys) byDay[k] = { paidCount: 0, revenue: 0 };

      (data ?? []).forEach((r: any) => {
        const k = toIsoDay(r.day);
        if (!k || !byDay[k]) return;
        byDay[k].paidCount = Number(r.paid_count || 0);
        byDay[k].revenue = Number(r.revenue_ngn || 0);
      });

      const merged: TrendRow[] = keys.map((k) => ({
        day: k,
        paidCount: byDay[k].paidCount,
        revenue: byDay[k].revenue,
      }));

      setTrend(merged);
      setTrendLoading(false);
    } catch (e: any) {
      setTrend([]);
      setTrendErr(e?.message ?? "Failed to load trend.");
      setTrendLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    try {
      if (!propertyId) {
        setErrorMsg("Missing property id.");
        setOverview(null);
        setInspections([]);
        setLoading(false);
        return;
      }

      const admin = await requireAdmin();
      if (!admin) return;

      const { data: ov, error: ovErr } = await supabase.rpc("admin_property_overview", {
        property_id_in: propertyId,
      });

      if (ovErr) throw ovErr;

      const ovRow = Array.isArray(ov) ? (ov[0] as any) : (ov as any);
      if (!ovRow) {
        setErrorMsg("Property not found.");
        setOverview(null);
        setInspections([]);
        setLoading(false);
        return;
      }

      const normalizedOv: OverviewRow = {
        id: String(ovRow.id),
        title: ovRow.title ?? null,
        address_line: ovRow.address_line ?? null,
        area: ovRow.area ?? null,
        city: ovRow.city ?? null,
        state: ovRow.state ?? null,
        country: ovRow.country ?? null,
        rent_amount_ngn: ovRow.rent_amount_ngn ?? null,
        rent_frequency: ovRow.rent_frequency ?? null,
        property_type: ovRow.property_type ?? null,
        inspection_fee_ngn: ovRow.inspection_fee_ngn ?? null,
        property_class: ovRow.property_class ?? null,
        status: ovRow.status ?? null,
        created_at: String(ovRow.created_at),
        updated_at: String(ovRow.updated_at),
        total_inspections: Number(ovRow.total_inspections || 0),
        paid_plus_inspections: Number(ovRow.paid_plus_inspections || 0),
        revenue_ngn: Number(ovRow.revenue_ngn || 0),
      };

      setOverview(normalizedOv);

      const { data: ins, error: insErr } = await supabase.rpc("admin_property_inspections", {
        property_id_in: propertyId,
        limit_in: 100,
      });

      if (insErr) throw insErr;

      const normalizedIns: InspectionRow[] = (ins ?? []).map((r: any) => ({
        id: String(r.id),
        status: String(r.status),
        tenant_user_id: String(r.tenant_user_id),
        inspection_fee_ngn: Number(r.inspection_fee_ngn || 0),
        created_at: String(r.created_at),
        paid_at: r.paid_at ? String(r.paid_at) : null,
        scheduled_at: r.scheduled_at ? String(r.scheduled_at) : null,
        scheduled_by_user_id: r.scheduled_by_user_id ? String(r.scheduled_by_user_id) : null,
        completed_at: r.completed_at ? String(r.completed_at) : null,
        completed_by_user_id: r.completed_by_user_id ? String(r.completed_by_user_id) : null,
        payment_reference: r.payment_reference ? String(r.payment_reference) : null,
      }));

      setInspections(normalizedIns);
      setLoading(false);

      loadAgentStats();
      loadTrend();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load property analytics.");
      setOverview(null);
      setInspections([]);
      setLoading(false);

      loadAgentStats();
      loadTrend();
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const headerLabel = useMemo(() => {
    if (!overview) return "Property";
    const parts = [
      overview.title || "",
      overview.address_line || "",
      [overview.area, overview.city, overview.state].filter(Boolean).join(", "),
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Property";
  }, [overview]);

  const trendMaxRevenue = useMemo(() => maxNum(trend.map((t) => t.revenue)), [trend]);
  const trendMaxCount = useMemo(() => maxNum(trend.map((t) => t.paidCount)), [trend]);

  return (
    <main className="min-h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-black/50">
              <Link
                href="/admin/properties"
                className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
              >
                ← Properties
              </Link>
              <Link
                href="/admin/metrics"
                className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
              >
                Metrics
              </Link>
              <Badge>{shortId(propertyId)}</Badge>
              {overview?.status ? <StatusChip status={overview.status} /> : null}
            </div>

            <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">
              Property analytics
            </h1>
            <p className="mt-2 text-sm text-black/60">{headerLabel}</p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Loading…
        </div>
      ) : !overview ? (
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          No data.
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Total inspections" value={`${overview.total_inspections}`} hint="Lifetime (this property)." />
            <KpiCard label="Paid+" value={`${overview.paid_plus_inspections}`} hint="Paid, Scheduled, or Completed." />
            <KpiCard label="Revenue" value={formatNgn(overview.revenue_ngn)} hint="Sum of fees for Paid+." />
            <KpiCard label="Status" value={`${overview.status ?? "—"}`} hint="Current listing state." />
          </div>

          {/* 30-day trend */}
          <div className="mt-6">
            <DataShell>
              <div className="flex flex-wrap items-end justify-between gap-3 p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#0b1f2a]">Last 30 days</h2>
                    <Badge>Trend</Badge>
                  </div>
                  <p className="mt-1 text-sm text-black/60">Daily paid+ count and revenue for this property.</p>
                </div>

                <button
                  onClick={loadTrend}
                  className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Refresh trend
                </button>
              </div>

              <div className="px-6 pb-6">
                {trendLoading ? (
                  <div className="text-sm text-black/60">Loading trend…</div>
                ) : trendErr ? (
                  <WarnState
                    title="Trend not ready yet"
                    body={
                      <>
                        Deploy the SQL function <span className="font-mono text-[12px]">admin_property_trend</span> to
                        enable this section.
                      </>
                    }
                    code={trendErr}
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <table className="w-full text-left text-sm">
                      <TableHead>
                        <tr>
                          <th className="p-3 text-xs font-semibold text-black/60">Day</th>
                          <th className="p-3 text-xs font-semibold text-black/60">Paid+ Count</th>
                          <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                        </tr>
                      </TableHead>
                      <tbody>
                        {trend.map((t) => {
                          const wRev = trendMaxRevenue > 0 ? Math.round((t.revenue / trendMaxRevenue) * 100) : 0;
                          const wCnt = trendMaxCount > 0 ? Math.round((t.paidCount / trendMaxCount) * 100) : 0;

                          return (
                            <tr key={t.day} className="border-t border-black/5">
                              <td className="p-3 font-medium text-[#0b1f2a]">{t.day}</td>

                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 text-right text-[#0b1f2a]">{t.paidCount}</div>
                                  <div className="h-2 flex-1 rounded-full bg-black/5">
                                    <div
                                      className="h-2 rounded-full bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63]"
                                      style={{ width: `${wCnt}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-28 text-[#0b1f2a]">{formatNgn(t.revenue)}</div>
                                  <div className="h-2 flex-1 rounded-full bg-black/5">
                                    <div
                                      className="h-2 rounded-full bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63]"
                                      style={{ width: `${wRev}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DataShell>
          </div>

          {/* Agent performance + Property details */}
          <section className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Agent performance */}
            <DataShell>
              <div className="flex flex-wrap items-end justify-between gap-3 p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-[#0b1f2a]">Agent performance</h2>
                    <Badge>Attribution</Badge>
                  </div>
                  <p className="mt-1 text-sm text-black/60">Scheduled, completed, and revenue for this property.</p>
                </div>

                <button
                  onClick={loadAgentStats}
                  className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Refresh
                </button>
              </div>

              <div className="px-6 pb-6">
                {agentStatsLoading ? (
                  <div className="text-sm text-black/60">Loading agent performance…</div>
                ) : agentStatsErr ? (
                  <WarnState
                    title="Agent performance not ready yet"
                    body={
                      <>
                        Deploy the SQL function{" "}
                        <span className="font-mono text-[12px]">admin_property_agent_stats</span> to enable this
                        section.
                      </>
                    }
                    code={agentStatsErr}
                  />
                ) : agentStats.length === 0 ? (
                  <EmptyState title="No agent activity yet." body="This property has no recorded scheduling or completion." />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <table className="w-full text-left text-sm">
                      <TableHead>
                        <tr>
                          <th className="p-3 text-xs font-semibold text-black/60">Agent</th>
                          <th className="p-3 text-xs font-semibold text-black/60">Scheduled</th>
                          <th className="p-3 text-xs font-semibold text-black/60">Completed</th>
                          <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                        </tr>
                      </TableHead>
                      <tbody>
                        {agentStats.map((a) => (
                          <tr key={a.agent_user_id} className="border-t border-black/5">
                            <td className="p-3">
                              <Link
                                href={`/admin/agents/${a.agent_user_id}`}
                                className="font-semibold text-[#0b1f2a] hover:text-[#0a4f63] hover:underline"
                              >
                                {a.agent_name || "Agent"}
                              </Link>
                              <div className="font-mono text-xs text-black/50">{shortId(a.agent_user_id)}</div>
                            </td>
                            <td className="p-3 text-[#0b1f2a]">{a.scheduled_count}</td>
                            <td className="p-3 text-[#0b1f2a]">{a.completed_count}</td>
                            <td className="p-3 text-[#0b1f2a]">{formatNgn(a.revenue_ngn)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DataShell>

            {/* Property details */}
            <DataShell>
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#0b1f2a]">Property details</h2>
                  <Badge>Snapshot</Badge>
                </div>
                <p className="mt-1 text-sm text-black/60">Key metadata used for review and enforcement.</p>

                <div className="mt-4 grid gap-4">
                  <InfoRow label="Property ID" value={overview.id} mono />
                  <InfoRow
                    label="Rent"
                    value={
                      overview.rent_amount_ngn != null
                        ? `${formatNgn(overview.rent_amount_ngn)}${
                            overview.rent_frequency ? ` / ${overview.rent_frequency}` : ""
                          }`
                        : "—"
                    }
                  />
                  <InfoRow label="Property type" value={overview.property_type ?? "—"} />
                  <InfoRow label="Property class" value={overview.property_class ?? "—"} />
                  <InfoRow
                    label="Inspection fee"
                    value={overview.inspection_fee_ngn != null ? formatNgn(overview.inspection_fee_ngn) : "—"}
                  />
                  <InfoRow label="Created" value={formatDt(overview.created_at)} />
                  <InfoRow label="Updated" value={formatDt(overview.updated_at)} />
                </div>
              </div>
            </DataShell>
          </section>

          {/* Inspections */}
          <div className="mt-6">
            <DataShell>
              <div className="p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[#0b1f2a]">Inspections</h2>
                      <Badge>Latest 100</Badge>
                    </div>
                    <p className="mt-1 text-sm text-black/60">Requests, payment reference, and lifecycle timestamps.</p>
                  </div>

                  <Link
                    href="/admin/metrics"
                    className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                  >
                    Open metrics
                  </Link>
                </div>

                <div className="mt-4">
                  {inspections.length === 0 ? (
                    <EmptyState title="No inspections for this property yet." body="When tenants request inspections, they’ll appear here." />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                      <table className="w-full text-left text-sm">
                        <TableHead>
                          <tr>
                            <th className="p-3 text-xs font-semibold text-black/60">Inspection</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Status</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Tenant</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Fee</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Paid</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Scheduled</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Completed</th>
                          </tr>
                        </TableHead>
                        <tbody>
                          {inspections.map((r) => (
                            <tr key={r.id} className="border-t border-black/5">
                              <td className="p-3">
                                <div className="font-mono text-xs text-[#0b1f2a]">{shortId(r.id)}</div>
                                {r.payment_reference ? (
                                  <div className="mt-1 font-mono text-[11px] text-black/50">{r.payment_reference}</div>
                                ) : null}
                              </td>

                              <td className="p-3">
                                <Badge
                                  tone={
                                    r.status === "completed"
                                      ? "good"
                                      : r.status === "scheduled"
                                      ? "good"
                                      : r.status === "paid"
                                      ? "warn"
                                      : r.status === "cancelled"
                                      ? "bad"
                                      : "neutral"
                                  }
                                >
                                  {r.status}
                                </Badge>
                              </td>

                              <td className="p-3">
                                <div className="font-mono text-xs text-[#0b1f2a]">{shortId(r.tenant_user_id)}</div>
                              </td>

                              <td className="p-3 text-[#0b1f2a]">{formatNgn(r.inspection_fee_ngn)}</td>
                              <td className="p-3 text-black/60">{formatDt(r.paid_at)}</td>
                              <td className="p-3 text-black/60">{formatDt(r.scheduled_at)}</td>
                              <td className="p-3 text-black/60">{formatDt(r.completed_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </DataShell>
          </div>
        </>
      )}
    </main>
  );
}