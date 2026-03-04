// app/admin/agents/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";
import { useRouter } from "next/navigation";

type AgentRow = {
  id: string;
  user_id: string;
  kyc_status: "unsubmitted" | "pending" | "verified" | "rejected";
  license_number: string | null;
  created_at: string;
};

type ProfileMini = {
  user_id: string;
  account_status: string | null;
  full_name: string | null;
};

type EnforcementMode = null | {
  kind: "disable_agent" | "enable_agent";
  agent_id: string;
  user_id: string;
  agent_label: string;
};

function BadgeIcon({ size = 44 }: { size?: number }) {
  // Premium + neutral + consistent (no ribbons, no blobs)
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function shortId(id: string) {
  const s = String(id || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function fmtDate(x: string) {
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusPill(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold";
  if (s === "disabled") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "active") return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

async function getActorUserIdOrRedirect(router: ReturnType<typeof useRouter>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) {
    router.push("/login");
    return null;
  }
  return user.id;
}

async function logAudit(payload: {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string;
  before: any;
  after: any;
}) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_user_id: payload.actor_user_id,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    reason: payload.reason,
    before: payload.before,
    after: payload.after,
  });

  if (error) throw error;
}

export default function AdminAgentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [enforce, setEnforce] = useState<EnforcementMode>(null);
  const [reason, setReason] = useState("");
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg("");
    setAuditErr(null);

    try {
      const admin = await requireAdmin();
      if (!admin.ok) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("agents")
        .select("id,user_id,kyc_status,license_number,created_at")
        .eq("kyc_status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as AgentRow[];
      setRows(list);

      const userIds = Array.from(new Set(list.map((r) => String(r.user_id)).filter(Boolean)));

      if (userIds.length) {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("user_id,account_status,full_name")
          .in("user_id", userIds);

        if (pe) throw pe;

        const map: Record<string, ProfileMini> = {};
        (profs ?? []).forEach((p: any) => {
          map[String(p.user_id)] = {
            user_id: String(p.user_id),
            account_status: p.account_status ? String(p.account_status) : null,
            full_name: p.full_name ? String(p.full_name) : null,
          };
        });

        setProfiles(map);
      } else {
        setProfiles({});
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfileSnapshot(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,account_status,full_name,role,verification_status,country,created_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async function fetchAgentSnapshot(agentId: string) {
    const { data, error } = await supabase
      .from("agents")
      .select("id,user_id,kyc_status,license_number,created_at")
      .eq("id", agentId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  const updateKycStatus = async (row: AgentRow, status: "verified" | "rejected") => {
    setErrorMsg("");
    setAuditErr(null);
    setBusyId(row.id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchAgentSnapshot(row.id);

      const { error } = await supabase.from("agents").update({ kyc_status: status }).eq("id", row.id);
      if (error) throw error;

      const after = await fetchAgentSnapshot(row.id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: status === "verified" ? "approve_agent_kyc" : "reject_agent_kyc",
          entity_type: "agent",
          entity_id: row.id,
          reason: status === "verified" ? "Approve agent KYC" : "Reject agent KYC",
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`KYC updated, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to update KYC status.");
    } finally {
      setBusyId(null);
    }
  };

  const openEnforcement = (kind: "disable_agent" | "enable_agent", row: AgentRow) => {
    const p = profiles[row.user_id];
    const label = p?.full_name?.trim() || "Agent";
    setReason("");
    setAuditErr(null);
    setErrorMsg("");
    setEnforce({
      kind,
      agent_id: row.id,
      user_id: row.user_id,
      agent_label: `${label} • ${shortId(row.user_id)}`,
    });
  };

  const closeEnforcement = () => {
    if (busyId) return;
    setEnforce(null);
    setReason("");
    setAuditErr(null);
  };

  const confirmEnforcement = async () => {
    if (!enforce) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setAuditErr("Reason is required.");
      return;
    }

    setErrorMsg("");
    setAuditErr(null);
    setBusyId(enforce.agent_id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchProfileSnapshot(enforce.user_id);

      const nextStatus = enforce.kind === "disable_agent" ? "disabled" : "active";

      const { error: upErr } = await supabase.from("profiles").update({ account_status: nextStatus }).eq("user_id", enforce.user_id);

      if (upErr) throw upErr;

      const after = await fetchProfileSnapshot(enforce.user_id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: enforce.kind,
          entity_type: "agent",
          entity_id: enforce.user_id,
          reason: cleanReason,
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`Enforcement applied, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
      closeEnforcement();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to apply enforcement.");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = rows.length;

  const summary = useMemo(() => {
    if (loading) return { label: "Loading…", tone: "text-black/60" as const };
    if (errorMsg) return { label: "Attention needed", tone: "text-red-700" as const };
    if (pendingCount === 0) return { label: "All caught up", tone: "text-black/60" as const };
    return { label: `${pendingCount} pending review`, tone: "text-[#0a4f63]" as const };
  }, [loading, errorMsg, pendingCount]);

  return (
    <main className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Agent Verifications</h1>
              <p className="mt-1 text-sm text-black/60">Approve or reject agent KYC before they can operate.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              ← Admin Home
            </Link>
            <span className={`rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium ${summary.tone}`}>
              {summary.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Refresh
          </button>
          <Link
            href="/admin/audit"
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Audit Log
          </Link>
          <Link
            href="/admin/metrics"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
          >
            Metrics
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {auditErr ? (
        <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{auditErr}</div>
      ) : null}

      {/* Main card */}
      <section className="rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-[#0b1f2a]">Pending Agents</div>
            <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">{pendingCount}</span>
          </div>

          <div className="text-xs text-black/50">Queue ordered by oldest first.</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
              <div className="font-semibold text-[#0b1f2a]">No pending agents.</div>
              <div className="mt-1 text-black/60">When agents submit KYC, they’ll appear here for approval.</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-b from-black/5 to-black/0">
                <tr>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Agent ID</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">User</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Account</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">License</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Submitted</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const busy = busyId === r.id;
                  const p = profiles[r.user_id];
                  const account = (p?.account_status || "active").toLowerCase();
                  const isDisabled = account === "disabled";

                  return (
                    <tr key={r.id} className="border-t border-black/5">
                      <td className="p-4">
                        <div className="font-mono text-xs text-[#0b1f2a]" title={r.id}>
                          {shortId(r.id)}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-[#0b1f2a]">
                          <div className="font-semibold">{p?.full_name?.trim() || "Agent"}</div>
                          <div className="font-mono text-xs text-black/50" title={r.user_id}>
                            {shortId(r.user_id)}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={statusPill(account)}>{account}</span>
                      </td>

                      <td className="p-4 text-[#0b1f2a]">{r.license_number ?? "—"}</td>
                      <td className="p-4 text-black/60">{fmtDate(r.created_at)}</td>

                      <td className="p-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => updateKycStatus(r, "verified")}
                            disabled={busy}
                            className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                            }`}
                          >
                            {busy ? "Working…" : "Approve KYC"}
                          </button>

                          <button
                            onClick={() => updateKycStatus(r, "rejected")}
                            disabled={busy}
                            className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                            }`}
                          >
                            Reject
                          </button>

                          {isDisabled ? (
                            <button
                              onClick={() => openEnforcement("enable_agent", r)}
                              disabled={busy}
                              className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                                busy
                                  ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                  : "bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(11,31,42,0.20)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]"
                              }`}
                            >
                              Enable Agent
                            </button>
                          ) : (
                            <button
                              onClick={() => openEnforcement("disable_agent", r)}
                              disabled={busy}
                              className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                                busy
                                  ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              Disable Agent
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
        )}
      </section>

      {/* Enforcement modal */}
      {enforce ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeEnforcement} />
          <div className="relative w-full max-w-xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">Confirm enforcement</div>
                  <div className="mt-1 text-sm text-black/60">
                    {enforce.kind === "disable_agent" ? "Disable agent access" : "Enable agent access"} •{" "}
                    <span className="font-mono text-xs">{enforce.agent_label}</span>
                  </div>
                </div>

                <button
                  onClick={closeEnforcement}
                  disabled={!!busyId}
                  className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Close
                </button>
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-medium text-black/50">Reason (required)</div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Write the reason that will appear in the audit log…"
                  className="mt-1 w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                />
                {auditErr ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{auditErr}</div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  onClick={closeEnforcement}
                  disabled={!!busyId}
                  className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmEnforcement}
                  disabled={!!busyId}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    enforce.kind === "disable_agent"
                      ? "bg-gradient-to-r from-[#b91c1c] to-[#7f1d1d] shadow-[0_16px_38px_rgba(185,28,28,0.24)] hover:shadow-[0_20px_46px_rgba(185,28,28,0.30)]"
                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                  }`}
                >
                  {busyId ? "Working…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}