// app/agent/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type InspectionRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;

  scheduled_at?: string | null;
  scheduled_by_user_id?: string | null;
  completed_at?: string | null;
  completed_by_user_id?: string | null;

  // enriched
  tenant_full_name?: string | null;
};

type PropertyMini = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  state: string | null;
};

type AgentRecord = {
  id: string;
  user_id: string;
  kyc_status: string | null; // "verified" is approved
};

type AuthorizationStatus = "pending" | "approved" | "revoked";

function formatNgn(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatDt(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortId(id: string) {
  const v = String(id ?? "").trim();
  if (!v) return "";
  return v.length <= 10 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function statusTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "bg-[rgba(14,165,163,0.10)] text-[#0a4f63] border-[rgba(14,165,163,0.25)]";
  if (s === "scheduled") return "bg-[rgba(11,31,42,0.06)] text-[#0b1f2a] border-black/10";
  if (s === "paid") return "bg-[rgba(10,79,99,0.10)] text-[#0a4f63] border-[rgba(10,79,99,0.22)]";
  if (s === "requested") return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "cancelled") return "bg-red-50 text-red-800 border-red-200";
  return "bg-black/5 text-black/70 border-black/10";
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-88px)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
    </main>
  );
}

function Card({
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
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function InlinePill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {children}
    </span>
  );
}

function DataTableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">{children}</div>;
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
}

function Message({
  tone,
  children,
}: {
  tone: "error" | "success" | "info" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
      ? "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.08)] text-[#0a4f63]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-black/10 bg-white/70 text-black/70";

  return <div className={`rounded-[28px] border p-5 text-sm ${cls}`}>{children}</div>;
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a]">
      <span className="text-black/50">{label}:</span> {value}
    </div>
  );
}

export default function AgentPortalPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, PropertyMini>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const [agentRecord, setAgentRecord] = useState<AgentRecord | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);

  const [authorizedPropertyIds, setAuthorizedPropertyIds] = useState<string[]>([]);

  async function requireAgentUser() {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/agent")}`);
      return null;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    if (!profile || profile.role !== "agent") {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/agent")}`);
      return null;
    }

    return user;
  }

  async function loadAgentRecord(agentUserId: string) {
    setAgentLoading(true);
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("id,user_id,kyc_status")
        .eq("user_id", agentUserId)
        .maybeSingle();

      if (error) throw error;

      setAgentRecord((data ?? null) as AgentRecord | null);
      return (data ?? null) as AgentRecord | null;
    } finally {
      setAgentLoading(false);
    }
  }

  async function loadAuthorizedPropertyIds(agentId: string) {
    const { data, error } = await supabase
      .from("agent_property_authorizations")
      .select("property_id,status")
      .eq("agent_id", agentId)
      .eq("status", "approved" satisfies AuthorizationStatus);

    if (error) throw error;

    const ids = Array.from(new Set((data ?? []).map((r: any) => String(r.property_id)).filter(Boolean)));
    setAuthorizedPropertyIds(ids);
    return ids;
  }

  async function hydrateTenantNames(list: InspectionRow[]) {
    const tenantIds = Array.from(new Set(list.map((r) => String(r.tenant_user_id ?? "")).filter(Boolean)));
    if (tenantIds.length === 0) return list;

    const { data: profs, error } = await supabase.from("profiles").select("user_id,full_name").in("user_id", tenantIds);
    if (error) throw error;

    const nameMap: Record<string, string | null> = {};
    (profs ?? []).forEach((p: any) => {
      nameMap[String(p.user_id)] = (p.full_name ?? null) as string | null;
    });

    return list.map((r) => ({
      ...r,
      tenant_full_name: nameMap[String(r.tenant_user_id)] ?? null,
    }));
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    setToastMsg(null);

    try {
      const agentUser = await requireAgentUser();
      if (!agentUser) return;

      const a = await loadAgentRecord(agentUser.id);
      if (!a) {
        setRows([]);
        setPropertyMap({});
        setAuthorizedPropertyIds([]);
        setLoading(false);
        return;
      }

      const propertyIds = await loadAuthorizedPropertyIds(a.id);

      if (propertyIds.length === 0) {
        setRows([]);
        setPropertyMap({});
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("inspection_requests")
        .select(
          "id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,scheduled_at,scheduled_by_user_id,completed_at,completed_by_user_id"
        )
        .in("status", ["paid", "scheduled"])
        .in("property_id", propertyIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const base = (data ?? []) as InspectionRow[];
      const list = await hydrateTenantNames(base);
      setRows(list);

      const uniquePropertyIds = Array.from(new Set(list.map((x) => x.property_id)));
      if (uniquePropertyIds.length === 0) {
        setPropertyMap({});
        setLoading(false);
        return;
      }

      const { data: propsData, error: propsErr } = await supabase
        .from("properties")
        .select("id,title,area,city,state")
        .in("id", uniquePropertyIds);

      if (propsErr) throw propsErr;

      const map: Record<string, PropertyMini> = {};
      (propsData ?? []).forEach((p: any) => {
        map[p.id] = p as PropertyMini;
      });
      setPropertyMap(map);

      setLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load agent inspections.");
      setRows([]);
      setPropertyMap({});
      setAuthorizedPropertyIds([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => sub?.subscription?.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isKycVerified = useMemo(() => agentRecord?.kyc_status === "verified", [agentRecord?.kyc_status]);

  const counts = useMemo(() => {
    let paid = 0;
    let scheduled = 0;
    for (const r of rows) {
      if (r.status === "paid") paid++;
      if (r.status === "scheduled") scheduled++;
    }
    return { paid, scheduled, total: rows.length };
  }, [rows]);

  async function rpcCall(
    fn: "agent_mark_inspection_scheduled" | "agent_mark_inspection_completed" | "agent_cancel_inspection",
    id: string
  ) {
    const { error } = await supabase.rpc(fn, { p_inspection_id: id });
    if (error) throw error;
  }

  async function markScheduled(id: string) {
    setErrorMsg(null);
    setToastMsg(null);
    setActionId(id);

    try {
      const agentUser = await requireAgentUser();
      if (!agentUser) return;

      await rpcCall("agent_mark_inspection_scheduled", id);
      setToastMsg("Marked as scheduled.");
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to mark scheduled.");
    } finally {
      setActionId(null);
    }
  }

  async function markCompleted(id: string) {
    setErrorMsg(null);
    setToastMsg(null);
    setActionId(id);

    try {
      const agentUser = await requireAgentUser();
      if (!agentUser) return;

      await rpcCall("agent_mark_inspection_completed", id);
      setToastMsg("Marked as completed.");
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to mark completed.");
    } finally {
      setActionId(null);
    }
  }

  async function cancelRequest(id: string) {
    setErrorMsg(null);
    setToastMsg(null);
    setActionId(id);

    try {
      const agentUser = await requireAgentUser();
      if (!agentUser) return;

      await rpcCall("agent_cancel_inspection", id);
      setToastMsg("Inspection cancelled.");
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to cancel.");
    } finally {
      setActionId(null);
    }
  }

  const actionsDisabledGlobal = agentLoading || !isKycVerified;

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Agent Inspections</h1>
              <p className="mt-1 text-sm text-black/60">Schedule paid inspections and mark them complete.</p>
            </div>
          </div>

          {authorizedPropertyIds.length ? (
            <div className="mt-3 text-xs text-black/50">
              Authorized properties: <span className="font-semibold">{authorizedPropertyIds.length}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </GhostButton>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6">
          <Message tone="error">{errorMsg}</Message>
        </div>
      ) : null}

      {toastMsg ? (
        <div className="mb-6">
          <Message tone="success">{toastMsg}</Message>
        </div>
      ) : null}

      {!agentLoading && !isKycVerified ? (
        <div className="mb-6">
          <Message tone="warn">
            <div className="font-semibold">Verification required</div>
            <div className="mt-1">
              Your KYC must be <span className="font-semibold">verified</span> before you can schedule or complete
              inspections.
            </div>
            <div className="mt-2 text-xs">
              Current status: <span className="font-semibold">{agentRecord?.kyc_status ?? "unverified"}</span>
            </div>
          </Message>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Queue summary</h2>}
          subtitle="Paid needs scheduling. Scheduled needs completion."
          right={
            <div className="flex flex-wrap gap-2">
              <StatChip label="Paid" value={counts.paid} />
              <StatChip label="Scheduled" value={counts.scheduled} />
              <StatChip label="Total" value={counts.total} />
            </div>
          }
        >
          <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
            Actions are disabled until KYC is verified.
          </div>
        </Card>

        <div className="md:col-span-2">
          <Card
            title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Inspection Queue</h2>}
            subtitle="Only paid and scheduled inspections for properties you’re authorized on."
            right={
              <div className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/60">
                Live view
              </div>
            }
          >
            {loading ? (
              <div className="rounded-2xl border border-black/10 bg-white p-8 text-sm text-black/60">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-10 text-center text-black/60">
                No paid or scheduled inspections right now.
              </div>
            ) : (
              <DataTableShell>
                <table className="w-full text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="p-4 text-xs font-semibold text-black/60">Property</th>
                      <th className="p-4 text-xs font-semibold text-black/60">Tenant</th>
                      <th className="p-4 text-xs font-semibold text-black/60">Location</th>
                      <th className="p-4 text-xs font-semibold text-black/60">Fee</th>
                      <th className="p-4 text-xs font-semibold text-black/60">Status</th>
                      <th className="p-4 text-xs font-semibold text-black/60">Scheduled</th>
                      <th className="p-4 text-xs font-semibold text-black/60">Completed</th>
                      <th className="p-4 text-xs font-semibold text-black/60 text-right">Actions</th>
                    </tr>
                  </TableHead>

                  <tbody>
                    {rows.map((r) => {
                      const p = propertyMap[r.property_id];
                      const loc = p ? [p.area, p.city, p.state].filter(Boolean).join(", ") : "—";
                      const busy = actionId === r.id;

                      const actionsDisabled = busy || actionsDisabledGlobal;

                      const tenantName = r.tenant_full_name ?? "Tenant";
                      const tenantIdShort = shortId(r.tenant_user_id);

                      return (
                        <tr key={r.id} className="border-t border-black/5">
                          <td className="p-4">
                            <div className="font-semibold text-[#0b1f2a]">{p?.title ?? "Property"}</div>
                            <div className="mt-1 font-mono text-xs text-black/50">{shortId(r.property_id)}</div>
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-[#0b1f2a]">{tenantName}</div>
                            <div className="mt-1 font-mono text-xs text-black/50">{tenantIdShort}</div>
                          </td>

                          <td className="p-4 text-black/70">{loc || "—"}</td>

                          <td className="p-4">
                            <div className="font-semibold text-[#0b1f2a]">{formatNgn(r.inspection_fee_ngn)}</div>
                          </td>

                          <td className="p-4">
                            <InlinePill tone={statusTone(r.status)}>{r.status}</InlinePill>
                          </td>

                          <td className="p-4 text-black/70">{formatDt(r.scheduled_at)}</td>
                          <td className="p-4 text-black/70">{formatDt(r.completed_at)}</td>

                          <td className="p-4 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {r.status === "paid" ? (
                                <PrimaryButton
                                  onClick={() => markScheduled(r.id)}
                                  disabled={actionsDisabled}
                                  className="px-4 py-2 text-xs"
                                >
                                  {busy ? "Working…" : "Mark Scheduled"}
                                </PrimaryButton>
                              ) : null}

                              {r.status === "scheduled" ? (
                                <PrimaryButton
                                  onClick={() => markCompleted(r.id)}
                                  disabled={actionsDisabled}
                                  className="px-4 py-2 text-xs"
                                >
                                  {busy ? "Working…" : "Mark Completed"}
                                </PrimaryButton>
                              ) : null}

                              <GhostButton
                                onClick={() => cancelRequest(r.id)}
                                disabled={actionsDisabled}
                                className="px-4 py-2 text-xs"
                              >
                                {busy ? "Working…" : "Cancel"}
                              </GhostButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTableShell>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}