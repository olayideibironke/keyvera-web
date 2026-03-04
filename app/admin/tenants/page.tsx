// app/admin/tenants/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";

type VerificationStatus = "unsubmitted" | "pending" | "verified" | "rejected";
type AccountStatus = "active" | "disabled";

type TenantRow = {
  user_id: string;
  role: "tenant";
  verification_status: VerificationStatus;
  account_status: AccountStatus;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
};

type EnforcementKind =
  | "verify_tenant"
  | "reject_tenant"
  | "set_pending_tenant"
  | "disable_tenant"
  | "enable_tenant";

type EnforcementMode = null | {
  kind: EnforcementKind;
  user_id: string;
  label: string;
};

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

function statusPill(x: string | null | undefined) {
  const s = String(x || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (s === "verified")
    return `${base} border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (s === "pending") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (s === "rejected") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "disabled") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "active")
    return `${base} border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  return `${base} border-black/10 bg-white/70 text-black/55`;
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

function DataShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      {children}
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
      <div className="font-semibold text-[#0b1f2a]">{title}</div>
      <div className="mt-1 text-black/60">{body}</div>
    </div>
  );
}

export default function AdminTenantsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [enforce, setEnforce] = useState<EnforcementMode>(null);
  const [reason, setReason] = useState("");
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const isBusy = !!busyId;

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
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
        .eq("role", "tenant")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setRows((data ?? []) as TenantRow[]);
    } catch (e: any) {
      setRows([]);
      setErrorMsg(e?.message ?? "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = useMemo(() => rows.filter((r) => r.verification_status === "pending").length, [rows]);

  const summary = useMemo(() => {
    if (loading) return { label: "Loading…", tone: "neutral" as const };
    if (errorMsg) return { label: "Attention needed", tone: "bad" as const };
    if (pendingCount === 0) return { label: "All caught up", tone: "neutral" as const };
    return { label: `${pendingCount} pending review`, tone: "good" as const };
  }, [loading, errorMsg, pendingCount]);

  const openEnforcement = (kind: EnforcementKind, row: TenantRow) => {
    if (isBusy) return;
    const label = (row.full_name || "").trim() || "Tenant";
    setReason("");
    setAuditErr(null);
    setErrorMsg(null);
    setEnforce({
      kind,
      user_id: row.user_id,
      label: `${label} • ${shortId(row.user_id)}`,
    });
  };

  const closeEnforcement = () => {
    if (isBusy) return;
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

    setErrorMsg(null);
    setAuditErr(null);
    setBusyId(enforce.user_id);

    try {
      const {
        data: { user },
        error: ue,
      } = await supabase.auth.getUser();
      if (ue) throw ue;
      if (!user) {
        router.push("/login");
        return;
      }

      // BEFORE snapshot
      const { data: beforeRow, error: be } = await supabase
        .from("profiles")
        .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
        .eq("user_id", enforce.user_id)
        .maybeSingle();
      if (be) throw be;

      const before = beforeRow ?? null;

      // APPLY (only columns we actually update)
      const patch: Partial<Pick<TenantRow, "verification_status" | "account_status">> = {};

      if (enforce.kind === "verify_tenant") patch.verification_status = "verified";
      if (enforce.kind === "reject_tenant") patch.verification_status = "rejected";
      if (enforce.kind === "set_pending_tenant") patch.verification_status = "pending";
      if (enforce.kind === "disable_tenant") patch.account_status = "disabled";
      if (enforce.kind === "enable_tenant") patch.account_status = "active";

      const { error: upErr } = await supabase.from("profiles").update(patch).eq("user_id", enforce.user_id);
      if (upErr) throw upErr;

      // AFTER snapshot
      const { data: afterRow, error: ae } = await supabase
        .from("profiles")
        .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
        .eq("user_id", enforce.user_id)
        .maybeSingle();
      if (ae) throw ae;

      try {
        await logAudit({
          actor_user_id: user.id,
          action: enforce.kind,
          entity_type: "tenant",
          entity_id: enforce.user_id,
          reason: cleanReason,
          before,
          after: afterRow ?? null,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(
          `Change applied, but audit log is not deployed yet. Create table "admin_audit_logs". (${auditInsertErr?.message ?? "audit error"})`
        );
      }

      await load();
      closeEnforcement();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to apply tenant action.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_44px_rgba(11,31,42,0.12)]">
                <div className="absolute inset-0 bg-[radial-gradient(16px_16px_at_32%_30%,rgba(14,165,163,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(10,79,99,0.92),transparent_58%)]" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/0" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Tenant management</h1>
                <p className="mt-1 text-sm text-black/60">Review verification and enforce account access.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
              >
                ← Admin Home
              </Link>
              <Badge tone={summary.tone}>{summary.label}</Badge>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Refresh
            </button>
            <Link
              href="/admin/audit"
              className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
            >
              Audit Log
            </Link>
            <Link
              href="/admin/metrics"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f2a] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(11,31,42,0.20)] transition hover:shadow-[0_22px_56px_rgba(11,31,42,0.26)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Metrics
            </Link>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      <DataShell>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-[#0b1f2a]">Tenants</div>
            <Badge>{rows.length}</Badge>
          </div>

          <div className="text-xs text-black/50">Role = tenant • Ordered by oldest first</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No tenants found." body="Once tenants exist in profiles, they’ll show here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <TableHead>
                <tr>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Tenant</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">User</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Verification</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Account</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Phone</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Country</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Created</th>
                  <th className="whitespace-nowrap p-4 text-right text-xs font-semibold text-black/60">Actions</th>
                </tr>
              </TableHead>

              <tbody>
                {rows.map((r) => {
                  const busy = busyId === r.user_id;
                  const name = (r.full_name || "").trim() || "Tenant";
                  const phone = (r.phone || "").trim() || "—";
                  const country = (r.country || "").trim() || "—";

                  return (
                    <tr key={r.user_id} className="border-t border-black/5">
                      <td className="p-4">
                        <div className="text-[#0b1f2a]">
                          <div className="font-semibold">{name}</div>
                          <div className="font-mono text-xs text-black/50" title={r.user_id}>
                            {shortId(r.user_id)}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-mono text-xs text-[#0b1f2a]" title={r.user_id}>
                          {shortId(r.user_id)}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={statusPill(r.verification_status)}>{r.verification_status}</span>
                      </td>

                      <td className="p-4">
                        <span className={statusPill(r.account_status)}>{r.account_status}</span>
                      </td>

                      <td className="p-4 text-black/60">{phone}</td>
                      <td className="p-4 text-black/60">{country}</td>
                      <td className="p-4 text-black/60">{fmtDate(r.created_at)}</td>

                      <td className="p-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => openEnforcement("verify_tenant", r)}
                            disabled={busy}
                            className={[
                              "rounded-2xl px-4 py-2 text-xs font-semibold transition",
                              busy
                                ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]",
                            ].join(" ")}
                          >
                            {busy ? "Working…" : "Verify"}
                          </button>

                          <button
                            onClick={() => openEnforcement("set_pending_tenant", r)}
                            disabled={busy}
                            className={[
                              "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                              busy
                                ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
                            ].join(" ")}
                          >
                            Pending
                          </button>

                          <button
                            onClick={() => openEnforcement("reject_tenant", r)}
                            disabled={busy}
                            className={[
                              "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                              busy
                                ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                            ].join(" ")}
                          >
                            Reject
                          </button>

                          {r.account_status === "disabled" ? (
                            <button
                              onClick={() => openEnforcement("enable_tenant", r)}
                              disabled={busy}
                              className={[
                                "rounded-2xl px-4 py-2 text-xs font-semibold transition",
                                busy
                                  ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                  : "bg-[#0b1f2a] text-white shadow-[0_14px_34px_rgba(11,31,42,0.22)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]",
                              ].join(" ")}
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              onClick={() => openEnforcement("disable_tenant", r)}
                              disabled={busy}
                              className={[
                                "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                                busy
                                  ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                              ].join(" ")}
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
      </DataShell>

      {/* Enforcement modal */}
      {enforce ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!isBusy) closeEnforcement();
            }}
          />
          <div className="relative w-full max-w-xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">Confirm action</div>
                  <div className="mt-1 text-sm text-black/60">
                    <span className="font-semibold">{enforce.kind}</span> •{" "}
                    <span className="font-mono text-xs">{enforce.label}</span>
                  </div>
                </div>

                <button
                  onClick={closeEnforcement}
                  disabled={isBusy}
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
                  disabled={isBusy}
                  className="mt-1 w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)] disabled:cursor-not-allowed disabled:text-black/50"
                />
                {auditErr ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{auditErr}</div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  onClick={closeEnforcement}
                  disabled={isBusy}
                  className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmEnforcement}
                  disabled={isBusy}
                  className={[
                    "rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
                    enforce.kind.includes("reject") || enforce.kind.includes("disable")
                      ? "bg-gradient-to-r from-[#b91c1c] to-[#7f1d1d] shadow-[0_16px_38px_rgba(185,28,28,0.24)] hover:shadow-[0_20px_46px_rgba(185,28,28,0.30)]"
                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]",
                  ].join(" ")}
                >
                  {isBusy ? "Working…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}