"use client";

import Link from "next/link";
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
    status === "paid"
      ? "border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : status === "scheduled"
      ? "border-[rgba(10,79,99,0.20)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]"
      : status === "completed"
      ? "border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : status === "cancelled"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-black/10 bg-white/70 text-black/60";

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
    <section className="rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 p-5 md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
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

export default function AgentPortalPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, PropertyMini>>({});
  const [agentRecord, setAgentRecord] = useState<AgentRecord | null>(null);
  const [authorizedPropertyIds, setAuthorizedPropertyIds] = useState<string[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  async function requireAgentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/agent")}`);
      return null;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();

    if (!profile || profile.role !== "agent") {
      router.replace(`/login`);
      return null;
    }

    return user;
  }

  async function loadAgentRecord(agentUserId: string) {
    const { data } = await supabase.from("agents").select("id,user_id,kyc_status").eq("user_id", agentUserId).maybeSingle();

    setAgentRecord((data ?? null) as AgentRecord | null);
    return data as AgentRecord | null;
  }

  async function loadAuthorizedPropertyIds(agentId: string) {
    const { data } = await supabase
      .from("agent_property_authorizations")
      .select("property_id")
      .eq("agent_id", agentId)
      .eq("status", "approved");

    const ids = (data ?? []).map((r: any) => r.property_id);
    setAuthorizedPropertyIds(ids);
    return ids;
  }

  async function hydrateTenantNames(list: InspectionRow[]) {
    const tenantIds = Array.from(new Set(list.map((r) => r.tenant_user_id)));

    const { data } = await supabase.from("profiles").select("user_id,full_name").in("user_id", tenantIds);

    const map: Record<string, string> = {};

    (data ?? []).forEach((p: any) => {
      map[p.user_id] = p.full_name;
    });

    return list.map((r) => ({
      ...r,
      tenant_full_name: map[r.tenant_user_id] ?? null,
    }));
  }

  async function load() {
    setLoading(true);

    const agentUser = await requireAgentUser();
    if (!agentUser) return;

    const agent = await loadAgentRecord(agentUser.id);
    if (!agent) return;

    const propertyIds = await loadAuthorizedPropertyIds(agent.id);

    const { data } = await supabase
      .from("inspection_requests")
      .select("*")
      .in("status", ["paid", "scheduled"])
      .in("property_id", propertyIds)
      .order("created_at");

    const hydrated = await hydrateTenantNames((data ?? []) as InspectionRow[]);
    setRows(hydrated);

    const propIds = Array.from(new Set(hydrated.map((r) => r.property_id)));

    const { data: props } = await supabase.from("properties").select("id,title,area,city,state").in("id", propIds);

    const map: Record<string, PropertyMini> = {};
    (props ?? []).forEach((p: any) => {
      map[p.id] = p;
    });

    setPropertyMap(map);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rpcCall(fn: string, id: string) {
    await supabase.rpc(fn, { p_inspection_id: id });
  }

  async function markScheduled(id: string) {
    setActionId(id);
    await rpcCall("agent_mark_inspection_scheduled", id);
    await load();
    setActionId(null);
  }

  async function markCompleted(id: string) {
    setActionId(id);
    await rpcCall("agent_mark_inspection_completed", id);
    await load();
    setActionId(null);
  }

  async function cancelInspection(id: string) {
    setActionId(id);
    await rpcCall("agent_cancel_inspection", id);
    await load();
    setActionId(null);
  }

  const isKycVerified = agentRecord?.kyc_status === "verified";

  const paidCount = useMemo(() => rows.filter((r) => r.status === "paid").length, [rows]);
  const scheduledCount = useMemo(() => rows.filter((r) => r.status === "scheduled").length, [rows]);
  const totalFees = useMemo(() => rows.reduce((sum, r) => sum + Number(r.inspection_fee_ngn || 0), 0), [rows]);

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <BadgeIcon size={44} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">
                  Agent Inspections
                </h1>
                <p className="mt-1 text-sm text-black/60">
                  Manage approved inspection assignments, scheduling, and completion flow.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <InfoBadge tone={isKycVerified ? "good" : "warn"}>
                {isKycVerified ? "KYC verified" : "KYC verification required"}
              </InfoBadge>
              <InfoBadge>{authorizedPropertyIds.length} authorized properties</InfoBadge>
              <InfoBadge>{rows.length} active inspections</InfoBadge>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <button
              onClick={load}
              className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
            >
              Refresh
            </button>
            <Link
              href="/agent/inspections"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f2a] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(11,31,42,0.20)] transition hover:shadow-[0_22px_56px_rgba(11,31,42,0.26)]"
            >
              Open Full Queue
            </Link>
          </div>
        </div>
      </div>

      {!isKycVerified ? (
        <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Your agent account is not yet verified. You can still view assignments, but scheduling and completion actions stay locked until KYC is verified.
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
          <div className="text-xs font-semibold text-black/55">Awaiting scheduling</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{paidCount}</div>
          <div className="mt-2 text-xs text-black/50">Paid inspections ready for scheduling.</div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
          <div className="text-xs font-semibold text-black/55">Scheduled</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{scheduledCount}</div>
          <div className="mt-2 text-xs text-black/50">Inspections currently in progress.</div>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
          <div className="text-xs font-semibold text-black/55">Fee volume</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{formatNgn(totalFees)}</div>
          <div className="mt-2 text-xs text-black/50">Total inspection value in your active queue.</div>
        </div>
      </section>

      <SectionShell
        title={<div className="text-sm font-semibold text-[#0b1f2a]">Active assignments</div>}
        subtitle="Authorized paid and scheduled inspections for this agent account."
        right={<div className="text-xs text-black/50">Premium operations view</div>}
      >
        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No inspections."
            body="When paid inspections are assigned to your authorized properties, they’ll appear here."
          />
        ) : (
          <>
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1220px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Property</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Tenant</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Location</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Fee</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Status</th>
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

                          <td className="px-5 py-5 text-black/60">{formatDt(r.scheduled_at)}</td>

                          <td className="px-5 py-5 text-black/60">{formatDt(r.completed_at)}</td>

                          <td className="px-5 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              {r.status === "paid" && (
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
                              )}

                              {r.status === "scheduled" && (
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
                              )}

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
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Scheduled</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.scheduled_at)}</div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Completed</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.completed_at)}</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {r.status === "paid" && (
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
                      )}

                      {r.status === "scheduled" && (
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
                      )}

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
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </SectionShell>
    </main>
  );
}