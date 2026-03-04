// app/admin/landlords/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";

type LandlordRow = {
  user_id: string;
  role: string;
  verification_status: string | null;
  account_status: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
};

type EnforcementMode = null | {
  kind: "disable_landlord" | "enable_landlord";
  user_id: string;
  label: string;
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

function verifyPill(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold";
  if (s === "verified") return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (s === "pending") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (s === "rejected") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "unsubmitted") return `${base} border-black/10 bg-white/70 text-black/60`;
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

export default function AdminLandlordsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LandlordRow[]>([]);
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
        .from("profiles")
        .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
        .eq("role", "landlord")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setRows((data ?? []) as LandlordRow[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Unknown error");
      setRows([]);
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
      .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  const updateVerification = async (row: LandlordRow, next: "verified" | "rejected") => {
    setErrorMsg("");
    setAuditErr(null);
    setBusyId(row.user_id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchProfileSnapshot(row.user_id);

      const { error } = await supabase
        .from("profiles")
        .update({ verification_status: next })
        .eq("user_id", row.user_id);

      if (error) throw error;

      const after = await fetchProfileSnapshot(row.user_id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: next === "verified" ? "verify_landlord" : "reject_landlord",
          entity_type: "landlord",
          entity_id: row.user_id,
          reason: next === "verified" ? "Verify landlord" : "Reject landlord",
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`Update applied, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to update landlord verification.");
    } finally {
      setBusyId(null);
    }
  };

  const openEnforcement = (kind: "disable_landlord" | "enable_landlord", row: LandlordRow) => {
    const label = (row.full_name || "").trim() || "Landlord";
    setReason("");
    setAuditErr(null);
    setErrorMsg("");
    setEnforce({
      kind,
      user_id: row.user_id,
      label: `${label} • ${shortId(row.user_id)}`,
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
    setBusyId(enforce.user_id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchProfileSnapshot(enforce.user_id);

      const nextStatus = enforce.kind === "disable_landlord" ? "disabled" : "active";

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ account_status: nextStatus })
        .eq("user_id", enforce.user_id);

      if (upErr) throw upErr;

      const after = await fetchProfileSnapshot(enforce.user_id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: enforce.kind,
          entity_type: "landlord",
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

  const count = rows.length;

  const summary = useMemo(() => {
    if (loading) return { label: "Loading…", tone: "text-black/60" as const };
    if (errorMsg) return { label: "Attention needed", tone: "text-red-700" as const };
    if (count === 0) return { label: "No landlords yet", tone: "text-black/60" as const };
    return { label: `${count} landlords`, tone: "text-[#0a4f63]" as const };
  }, [loading, errorMsg, count]);

  return (
    <main className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Landlord Verifications</h1>
              <p className="mt-1 text-sm text-black/60">Verify landlords and control platform access.</p>
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
            <div className="text-sm font-semibold text-[#0b1f2a]">Landlords</div>
            <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">{count}</span>
          </div>
          <div className="text-xs text-black/50">Oldest first.</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
              <div className="font-semibold text-[#0b1f2a]">No landlords found.</div>
              <div className="mt-1 text-black/60">Once landlords sign up, they will appear here.</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-b from-black/5 to-black/0">
                <tr>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Landlord</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Verification</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Account</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Country</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Created</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const busy = busyId === r.user_id;
                  const verification = (r.verification_status || "unsubmitted").toLowerCase();
                  const account = (r.account_status || "active").toLowerCase();
                  const isDisabled = account === "disabled";

                  return (
                    <tr key={r.user_id} className="border-t border-black/5">
                      <td className="p-4">
                        <div className="text-[#0b1f2a]">
                          <div className="font-semibold">{(r.full_name || "").trim() || "Landlord"}</div>
                          <div className="mt-1 font-mono text-xs text-black/50" title={r.user_id}>
                            {shortId(r.user_id)}
                          </div>
                          {r.phone ? <div className="mt-1 text-xs text-black/50">{r.phone}</div> : null}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={verifyPill(verification)}>{verification}</span>
                      </td>

                      <td className="p-4">
                        <span className={statusPill(account)}>{account}</span>
                      </td>

                      <td className="p-4 text-black/60">{r.country ? String(r.country) : "—"}</td>
                      <td className="p-4 text-black/60">{fmtDate(r.created_at)}</td>

                      <td className="p-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => updateVerification(r, "verified")}
                            disabled={busy}
                            className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                            }`}
                          >
                            {busy ? "Working…" : "Verify"}
                          </button>

                          <button
                            onClick={() => updateVerification(r, "rejected")}
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
                              onClick={() => openEnforcement("enable_landlord", r)}
                              disabled={busy}
                              className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                                busy
                                  ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                  : "bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(11,31,42,0.20)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]"
                              }`}
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              onClick={() => openEnforcement("disable_landlord", r)}
                              disabled={busy}
                              className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                                busy
                                  ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              Disable
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
                    {enforce.kind === "disable_landlord" ? "Disable landlord access" : "Enable landlord access"} •{" "}
                    <span className="font-mono text-xs">{enforce.label}</span>
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
                    enforce.kind === "disable_landlord"
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