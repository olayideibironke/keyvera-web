// app/admin/agents/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";

type AgentOverview = {
  agent_user_id: string;
  agent_name: string;
  total_scheduled: number;
  total_completed: number;
  revenue_ngn: number;
  first_activity_at: string | null;
  last_activity_at: string | null;
};

type AgentPropertyRow = {
  property_id: string;
  property_label: string | null;
  scheduled_count: number;
  completed_count: number;
  revenue_ngn: number;
};

type AgentInspectionRow = {
  id: string;
  property_id: string | null;
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

function statusPill(status: string) {
  const base = "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold";
  const s = String(status || "").toLowerCase();

  if (s === "completed") return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (s === "scheduled") return `${base} border-[rgba(10,79,99,0.22)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]`;
  if (s === "paid") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (s === "requested") return `${base} border-black/10 bg-white/70 text-black/60`;
  if (s === "cancelled") return `${base} border-red-200 bg-red-50 text-red-700`;

  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function DataTableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">{children}</div>;
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

function SectionShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function GhostButton({
  children,
  onClick,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40 disabled:hover:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
    >
      {children}
    </Link>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "teal" | "tealDark" | "navy";
}) {
  const chip =
    accent === "teal"
      ? "from-[#0ea5a3] to-[#0a4f63]"
      : accent === "tealDark"
      ? "from-[#0a4f63] to-[#0b1f2a]"
      : "from-[#0b1f2a] to-[#0a4f63]";

  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-black/60">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{value}</div>
          {hint ? <div className="mt-2 text-xs text-black/50">{hint}</div> : null}
        </div>
        <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${chip} shadow-[0_14px_34px_rgba(10,79,99,0.22)]`} />
      </div>
    </div>
  );
}

export default function AdminAgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentUserId = String((params as any)?.id ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [properties, setProperties] = useState<AgentPropertyRow[]>([]);
  const [inspections, setInspections] = useState<AgentInspectionRow[]>([]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    try {
      if (!agentUserId) {
        setErrorMsg("Missing agent user id.");
        setOverview(null);
        setProperties([]);
        setInspections([]);
        setLoading(false);
        return;
      }

      const admin = await requireAdmin();
      if (!admin.ok) {
        router.push("/login");
        return;
      }

      const { data: ov, error: ovErr } = await supabase.rpc("admin_agent_overview", {
        agent_user_id_in: agentUserId,
      });
      if (ovErr) throw ovErr;

      const ovRow = Array.isArray(ov) ? (ov[0] as any) : (ov as any);
      if (!ovRow) {
        setErrorMsg("Agent not found.");
        setOverview(null);
        setProperties([]);
        setInspections([]);
        setLoading(false);
        return;
      }

      const normalizedOv: AgentOverview = {
        agent_user_id: String(ovRow.agent_user_id),
        agent_name: ovRow.agent_name ? String(ovRow.agent_name) : "Agent",
        total_scheduled: Number(ovRow.total_scheduled || 0),
        total_completed: Number(ovRow.total_completed || 0),
        revenue_ngn: Number(ovRow.revenue_ngn || 0),
        first_activity_at: ovRow.first_activity_at ? String(ovRow.first_activity_at) : null,
        last_activity_at: ovRow.last_activity_at ? String(ovRow.last_activity_at) : null,
      };
      setOverview(normalizedOv);

      const { data: props, error: propsErr } = await supabase.rpc("admin_agent_properties", {
        agent_user_id_in: agentUserId,
        days_in: 90,
        limit_in: 25,
      });
      if (propsErr) throw propsErr;

      const normalizedProps: AgentPropertyRow[] = (props ?? []).map((r: any) => ({
        property_id: String(r.property_id),
        property_label: r.property_label ? String(r.property_label) : null,
        scheduled_count: Number(r.scheduled_count || 0),
        completed_count: Number(r.completed_count || 0),
        revenue_ngn: Number(r.revenue_ngn || 0),
      }));
      setProperties(normalizedProps);

      const { data: ins, error: insErr } = await supabase.rpc("admin_agent_recent_inspections", {
        agent_user_id_in: agentUserId,
        limit_in: 200,
      });
      if (insErr) throw insErr;

      const normalizedIns: AgentInspectionRow[] = (ins ?? []).map((r: any) => ({
        id: String(r.id),
        property_id: r.property_id ? String(r.property_id) : null,
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
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load agent analytics.");
      setOverview(null);
      setProperties([]);
      setInspections([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentUserId]);

  const headerSubtitle = useMemo(() => {
    if (!overview) return `Agent • ${shortId(agentUserId || "—")}`;
    return `${overview.agent_name} • ${shortId(overview.agent_user_id)}`;
  }, [overview, agentUserId]);

  return (
    <main className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Agent Analytics</h1>
              <p className="mt-1 text-sm text-black/60">{headerSubtitle}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin/agents"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              ← Back to Agents
            </Link>
            <Link
              href="/admin/metrics"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              Metrics
            </Link>
            <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">
              Drill-down
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </GhostButton>
          <PrimaryButton href="/admin/properties">Property Queue</PrimaryButton>
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
            <KpiCard
              label="Scheduled"
              value={`${overview.total_scheduled}`}
              accent="teal"
              hint="Total inspections scheduled by this agent."
            />
            <KpiCard
              label="Completed"
              value={`${overview.total_completed}`}
              accent="navy"
              hint="Total inspections completed by this agent."
            />
            <KpiCard
              label="Revenue"
              value={formatNgn(overview.revenue_ngn)}
              accent="tealDark"
              hint="Attributed inspection fees (Paid+)."
            />
            <KpiCard
              label="Last activity"
              value={formatDt(overview.last_activity_at)}
              accent="navy"
              hint={`First seen: ${formatDt(overview.first_activity_at)}`}
            />
          </div>

          {/* Top properties */}
          <div className="mt-6">
            <SectionShell
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Top properties</h2>}
              subtitle="Where this agent is generating outcomes (last 90 days)."
              right={
                <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">
                  {properties.length} rows
                </span>
              }
            >
              {properties.length === 0 ? (
                <EmptyState
                  title="No property activity in the last 90 days."
                  body="When this agent schedules or completes inspections, properties will appear here."
                />
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">Property</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Scheduled</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Completed</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                        <th className="p-3"></th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {properties.map((p) => (
                        <tr key={p.property_id} className="border-t border-black/5">
                          <td className="p-3">
                            <div className="font-medium text-[#0b1f2a]">{p.property_label || "Property"}</div>
                            <div className="font-mono text-xs text-black/50">{shortId(p.property_id)}</div>
                          </td>
                          <td className="p-3 text-[#0b1f2a]">{p.scheduled_count}</td>
                          <td className="p-3 text-[#0b1f2a]">{p.completed_count}</td>
                          <td className="p-3 text-[#0b1f2a]">{formatNgn(p.revenue_ngn)}</td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/admin/properties/${p.property_id}`}
                              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>
          </div>

          {/* Recent inspections */}
          <div className="mt-6">
            <SectionShell
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Recent inspections</h2>}
              subtitle="Latest 200 inspections where this agent scheduled or completed."
              right={
                <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">
                  {inspections.length} rows
                </span>
              }
            >
              {inspections.length === 0 ? (
                <EmptyState title="No inspections found for this agent." />
              ) : (
                <DataTableShell>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <TableHead>
                        <tr>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Inspection</th>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Property</th>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Status</th>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Fee</th>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Paid</th>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Scheduled</th>
                          <th className="whitespace-nowrap p-3 text-xs font-semibold text-black/60">Completed</th>
                        </tr>
                      </TableHead>
                      <tbody>
                        {inspections.map((r) => (
                          <tr key={r.id} className="border-t border-black/5">
                            <td className="p-3">
                              <div className="font-mono text-xs text-[#0b1f2a]" title={r.id}>
                                {shortId(r.id)}
                              </div>
                              {r.payment_reference ? (
                                <div className="mt-1 font-mono text-[11px] text-black/50">{r.payment_reference}</div>
                              ) : null}
                            </td>

                            <td className="p-3">
                              {r.property_id ? (
                                <Link
                                  href={`/admin/properties/${r.property_id}`}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                                  title={r.property_id}
                                >
                                  {shortId(r.property_id)} <span aria-hidden>→</span>
                                </Link>
                              ) : (
                                <span className="text-black/60">—</span>
                              )}
                            </td>

                            <td className="p-3">
                              <span className={statusPill(r.status)}>{r.status}</span>
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
                </DataTableShell>
              )}
            </SectionShell>
          </div>
        </>
      )}
    </main>
  );
}