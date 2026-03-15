"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  completed_at?: string | null;
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
  kyc_status: string | null;
  license_number: string | null;
};

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

function BadgeIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function StatusPill({ status }: { status: InspectionStatus }) {
  const cls =
    status === "requested"
      ? "border-black/10 bg-white/70 text-black/60"
      : status === "paid"
      ? "border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : status === "scheduled"
      ? "border-[rgba(10,79,99,0.20)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]"
      : status === "completed"
      ? "border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function InfoBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-black/10 bg-white/70 text-black/55";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "teal" | "navy" | "amber";
}) {
  const ring =
    tone === "teal"
      ? "border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.06)]"
      : tone === "navy"
      ? "border-black/10 bg-[rgba(11,31,42,0.04)]"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50/70"
      : "border-black/10 bg-white/70";

  const dot =
    tone === "teal"
      ? "bg-[#0ea5a3]"
      : tone === "navy"
      ? "bg-[#0b1f2a]"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-black/40";

  return (
    <div className={`rounded-[22px] border p-5 shadow-[0_12px_30px_rgba(11,31,42,0.06)] backdrop-blur ${ring}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-black/60">{label}</div>
        <span className={`h-2 w-2 rounded-full ${dot}`} style={{ opacity: 0.75 }} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{value}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-8">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
        <div className="font-semibold text-[#0b1f2a]">{title}</div>
        <div className="mt-1 text-black/60">{body}</div>
      </div>
    </div>
  );
}

export default function AgentInspectionsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, PropertyMini>>({});
  const [agentRecord, setAgentRecord] = useState<AgentRecord | null>(null);
  const [authorizedPropertyIds, setAuthorizedPropertyIds] = useState<string[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function resolveAgentAccess() {
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr) throw sessionErr;

    if (!session?.user) {
      setHasSession(false);
      setAuthorized(false);
      setRedirectingTo(null);
      setAuthChecked(true);
      return null;
    }

    const user = session.user;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    const role = String(profile?.role || "").toLowerCase();

    if (role === "agent") {
      setHasSession(true);
      setAuthorized(true);
      setRedirectingTo(null);
      setAuthChecked(true);
      return user;
    }

    if (role === "landlord") {
      setHasSession(true);
      setAuthorized(false);
      setRedirectingTo("/landlord");
      setAuthChecked(true);
      router.replace("/landlord");
      return null;
    }

    if (role === "tenant") {
      setHasSession(true);
      setAuthorized(false);
      setRedirectingTo("/tenant");
      setAuthChecked(true);
      router.replace("/tenant");
      return null;
    }

    if (role === "admin") {
      setHasSession(true);
      setAuthorized(false);
      setRedirectingTo("/admin");
      setAuthChecked(true);
      router.replace("/admin");
      return null;
    }

    setHasSession(false);
    setAuthorized(false);
    setRedirectingTo(null);
    setAuthChecked(true);
    return null;
  }

  async function loadAgentRecord(agentUserId: string) {
    const { data, error } = await supabase
      .from("agents")
      .select("id,user_id,kyc_status,license_number")
      .eq("user_id", agentUserId)
      .maybeSingle();

    if (error) throw error;

    const record = (data ?? null) as AgentRecord | null;
    setAgentRecord(record);
    return record;
  }

  async function loadAuthorizedPropertyIds(agentId: string) {
    const { data, error } = await supabase
      .from("agent_property_authorizations")
      .select("property_id")
      .eq("agent_id", agentId)
      .eq("status", "approved");

    if (error) throw error;

    const ids = (data ?? []).map((r: any) => r.property_id as string);
    setAuthorizedPropertyIds(ids);
    return ids;
  }

  async function hydrateTenantNames(list: InspectionRow[]) {
    const tenantIds = Array.from(new Set(list.map((r) => r.tenant_user_id).filter(Boolean)));

    if (tenantIds.length === 0) return list;

    const { data, error } = await supabase.from("profiles").select("user_id,full_name").in("user_id", tenantIds);

    if (error) throw error;

    const map: Record<string, string> = {};
    (data ?? []).forEach((p: any) => {
      map[String(p.user_id)] = String(p.full_name ?? "");
    });

    return list.map((r) => ({
      ...r,
      tenant_full_name: map[r.tenant_user_id] || null,
    }));
  }

  async function load() {
    setLoading(true);
    setErrorMsg("");

    try {
      const agentUser = await resolveAgentAccess();

      if (!agentUser) {
        setRows([]);
        setPropertyMap({});
        setAgentRecord(null);
        setAuthorizedPropertyIds([]);
        return;
      }

      const agent = await loadAgentRecord(agentUser.id);

      if (!agent) {
        setRows([]);
        setPropertyMap({});
        setAuthorizedPropertyIds([]);
        return;
      }

      const propertyIds = await loadAuthorizedPropertyIds(agent.id);

      if (!propertyIds.length) {
        setRows([]);
        setPropertyMap({});
        return;
      }

      const { data, error } = await supabase
        .from("inspection_requests")
        .select("id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,scheduled_at,completed_at")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const hydrated = await hydrateTenantNames((data ?? []) as InspectionRow[]);
      setRows(hydrated);

      const propIds = Array.from(new Set(hydrated.map((r) => r.property_id).filter(Boolean)));

      if (!propIds.length) {
        setPropertyMap({});
        return;
      }

      const { data: props, error: propsErr } = await supabase
        .from("properties")
        .select("id,title,area,city,state")
        .in("id", propIds);

      if (propsErr) throw propsErr;

      const map: Record<string, PropertyMini> = {};
      (props ?? []).forEach((p: any) => {
        map[String(p.id)] = p as PropertyMini;
      });

      setPropertyMap(map);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load inspection queue.");
    } finally {
      setAuthChecked(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function rpcCall(fn: string, id: string) {
    const { error } = await supabase.rpc(fn, { p_inspection_id: id });
    if (error) throw error;
  }

  async function markScheduled(id: string) {
    setActionId(id);
    setErrorMsg("");
    try {
      await rpcCall("agent_mark_inspection_scheduled", id);
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to mark inspection as scheduled.");
    } finally {
      setActionId(null);
    }
  }

  async function markCompleted(id: string) {
    setActionId(id);
    setErrorMsg("");
    try {
      await rpcCall("agent_mark_inspection_completed", id);
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to mark inspection as completed.");
    } finally {
      setActionId(null);
    }
  }

  async function cancelInspection(id: string) {
    setActionId(id);
    setErrorMsg("");
    try {
      await rpcCall("agent_cancel_inspection", id);
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to cancel inspection.");
    } finally {
      setActionId(null);
    }
  }

  const isKycVerified = agentRecord?.kyc_status === "verified";
  const isKycPending = agentRecord?.kyc_status === "pending";
  const isKycRejected = agentRecord?.kyc_status === "rejected";

  const requestedCount = useMemo(() => rows.filter((r) => r.status === "requested").length, [rows]);
  const paidCount = useMemo(() => rows.filter((r) => r.status === "paid").length, [rows]);
  const scheduledCount = useMemo(() => rows.filter((r) => r.status === "scheduled").length, [rows]);
  const completedCount = useMemo(() => rows.filter((r) => r.status === "completed").length, [rows]);

  const queueValue = useMemo(() => rows.reduce((sum, r) => sum + Number(r.inspection_fee_ngn || 0), 0), [rows]);

  if (!authChecked) {
    return null;
  }

  if (redirectingTo) {
    return (
      <main className="min-h-[calc(100vh-140px)]">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
          <div className="text-lg font-semibold text-[#0b1f2a]">Redirecting…</div>
          <p className="mt-2 text-sm text-black/60">Taking you to the correct dashboard.</p>
        </section>
      </main>
    );
  }

  if (!hasSession || !authorized) {
    return (
      <main className="min-h-[calc(100vh-140px)]">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
          <div className="text-lg font-semibold text-[#0b1f2a]">Agent sign-in required</div>
          <p className="mt-2 text-sm text-black/60">
            This inspection queue is only available to signed-in agent accounts.
          </p>
          <div className="mt-5">
            <Link
              href="/login?next=/agent/inspections"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
            >
              Sign In
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-140px)]">
      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <BadgeIcon size={44} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">
                Agent Inspection Queue
              </h1>
              <p className="mt-1 text-sm text-black/60">
                Full inspection view for authorized properties under this agent account.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <InfoBadge tone={isKycVerified ? "good" : "warn"}>
              {isKycVerified
                ? "KYC verified"
                : isKycPending
                ? "KYC under review"
                : isKycRejected
                ? "KYC rejected"
                : "KYC verification required"}
            </InfoBadge>
            <InfoBadge>{authorizedPropertyIds.length} authorized properties</InfoBadge>
            <InfoBadge>{rows.length} total inspections</InfoBadge>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Link
            href="/agent"
            className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
          >
            ← Back to Agent
          </Link>
          <button
            onClick={load}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {!isKycVerified ? (
        <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your account can view the queue, but status-changing actions remain locked until agent KYC is verified.
        </div>
      ) : null}

      <section className="mb-6 grid gap-3 md:grid-cols-5">
        <StatCard label="Requested" value={String(requestedCount)} tone="neutral" />
        <StatCard label="Paid" value={String(paidCount)} tone="teal" />
        <StatCard label="Scheduled" value={String(scheduledCount)} tone="navy" />
        <StatCard label="Completed" value={String(completedCount)} tone="teal" />
        <StatCard label="Queue value" value={formatNgn(queueValue)} tone="amber" />
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 p-5 md:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-[#0b1f2a]">All authorized inspections</div>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-black/60">
              Requested, paid, scheduled, completed, and cancelled records across your approved property assignments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-black/50">Full operations view</div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No inspections."
            body="When inspections are tied to your approved properties, they’ll appear here."
          />
        ) : (
          <>
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Property</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Tenant</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Location</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Fee</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Status</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Created</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Scheduled</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Completed</th>
                      <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-semibold text-black/60">Actions</th>
                    </tr>
                  </TableHead>

                  <tbody>
                    {rows.map((r) => {
                      const p = propertyMap[r.property_id];
                      const loc = p ? [p.area, p.city, p.state].filter(Boolean).join(", ") : "—";
                      const busy = actionId === r.id;

                      return (
                        <tr key={r.id} className="border-t border-black/5 align-top">
                          <td className="px-5 py-5">
                            <div className="font-semibold text-[#0b1f2a]">{p?.title ?? "Property"}</div>
                            <div className="mt-1 text-xs text-black/50">{shortId(r.property_id)}</div>
                          </td>

                          <td className="px-5 py-5">
                            <div className="text-[#0b1f2a]">{r.tenant_full_name ?? "Tenant"}</div>
                            <div className="mt-1 text-xs text-black/50">{shortId(r.tenant_user_id)}</div>
                          </td>

                          <td className="px-5 py-5 text-black/60">{loc}</td>
                          <td className="px-5 py-5 font-semibold text-[#0b1f2a]">{formatNgn(r.inspection_fee_ngn)}</td>

                          <td className="px-5 py-5">
                            <StatusPill status={r.status} />
                          </td>

                          <td className="px-5 py-5 text-black/60">{formatDt(r.created_at)}</td>
                          <td className="px-5 py-5 text-black/60">{formatDt(r.scheduled_at)}</td>
                          <td className="px-5 py-5 text-black/60">{formatDt(r.completed_at)}</td>

                          <td className="px-5 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              {r.status === "paid" ? (
                                <button
                                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                    !isKycVerified || busy
                                      ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                                  }`}
                                  onClick={() => markScheduled(r.id)}
                                  disabled={!isKycVerified || busy}
                                >
                                  {busy ? "Working…" : "Mark Scheduled"}
                                </button>
                              ) : null}

                              {r.status === "scheduled" ? (
                                <button
                                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                    !isKycVerified || busy
                                      ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                                  }`}
                                  onClick={() => markCompleted(r.id)}
                                  disabled={!isKycVerified || busy}
                                >
                                  {busy ? "Working…" : "Mark Completed"}
                                </button>
                              ) : null}

                              {(r.status === "requested" || r.status === "paid" || r.status === "scheduled") && (
                                <button
                                  className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                      : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                                  }`}
                                  onClick={() => cancelInspection(r.id)}
                                  disabled={busy}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 p-4 md:p-5 xl:hidden">
              {rows.map((r) => {
                const p = propertyMap[r.property_id];
                const loc = p ? [p.area, p.city, p.state].filter(Boolean).join(", ") : "—";
                const busy = actionId === r.id;

                return (
                  <article
                    key={r.id}
                    className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0b1f2a]">{p?.title ?? "Property"}</div>
                        <div className="mt-1 text-xs text-black/50">{shortId(r.property_id)}</div>
                      </div>

                      <StatusPill status={r.status} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Tenant</div>
                        <div className="mt-1 text-sm text-[#0b1f2a]">{r.tenant_full_name ?? "Tenant"}</div>
                        <div className="mt-1 text-xs text-black/50">{shortId(r.tenant_user_id)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Location</div>
                        <div className="mt-1 text-sm text-black/60">{loc}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Fee</div>
                        <div className="mt-1 text-sm font-semibold text-[#0b1f2a]">{formatNgn(r.inspection_fee_ngn)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Created</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.created_at)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Scheduled</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.scheduled_at)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Completed</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.completed_at)}</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {r.status === "paid" ? (
                        <button
                          className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                            !isKycVerified || busy
                              ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                              : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                          }`}
                          onClick={() => markScheduled(r.id)}
                          disabled={!isKycVerified || busy}
                        >
                          {busy ? "Working…" : "Mark Scheduled"}
                        </button>
                      ) : null}

                      {r.status === "scheduled" ? (
                        <button
                          className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                            !isKycVerified || busy
                              ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                              : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                          }`}
                          onClick={() => markCompleted(r.id)}
                          disabled={!isKycVerified || busy}
                        >
                          {busy ? "Working…" : "Mark Completed"}
                        </button>
                      ) : null}

                      {(r.status === "requested" || r.status === "paid" || r.status === "scheduled") && (
                        <button
                          className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                              : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                          }`}
                          onClick={() => cancelInspection(r.id)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}