"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";
import { useRouter } from "next/navigation";

type PropertyRow = {
  id: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "live" | "suspended" | "archived";
  city: string | null;
  state: string | null;
  inspection_fee_ngn: number | null;
  inspection_fee_validated: boolean;
  created_at: string;
};

type EnforcementMode = null | {
  kind: "suspend_property" | "unsuspend_property";
  property_id: string;
  property_label: string;
};

function BadgeIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function fmtDate(x: string) {
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatNgn(n: number | null | undefined) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `₦${v.toLocaleString()}`;
}

function shortId(id: string) {
  const s = String(id || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function statusPill(status: PropertyRow["status"]) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (status === "pending_review") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (status === "approved")
    return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (status === "live") return `${base} border-[rgba(10,79,99,0.20)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]`;
  if (status === "suspended") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (status === "draft") return `${base} border-black/10 bg-white/70 text-black/60`;
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function yesNoPill(value: boolean) {
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
    value
      ? "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : "border-black/10 bg-white/70 text-black/60"
  }`;
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

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-[11px] font-semibold text-black/55">
      {children}
    </span>
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

export default function AdminPropertiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
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
        .from("properties")
        .select("id,title,status,city,state,inspection_fee_ngn,inspection_fee_validated,created_at")
        .in("status", ["pending_review", "approved", "live", "suspended"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as PropertyRow[];
      setRows(list);

      const map: Record<string, string> = {};
      list.forEach((r) => {
        map[r.id] = r.inspection_fee_ngn ? String(r.inspection_fee_ngn) : "";
      });
      setFeeInputs(map);
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

  async function fetchPropertySnapshot(propertyId: string) {
    const { data, error } = await supabase
      .from("properties")
      .select("id,title,status,inspection_fee_ngn,inspection_fee_validated,city,state,created_at")
      .eq("id", propertyId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  const updateStatus = async (row: PropertyRow, status: PropertyRow["status"], auditReason = "Admin action") => {
    setErrorMsg("");
    setAuditErr(null);
    setBusyId(row.id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchPropertySnapshot(row.id);

      const { error } = await supabase.from("properties").update({ status }).eq("id", row.id);
      if (error) throw error;

      const after = await fetchPropertySnapshot(row.id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: "update_property_status",
          entity_type: "property",
          entity_id: row.id,
          reason: auditReason,
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`Status updated, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const setInspectionFee = async (row: PropertyRow) => {
    setErrorMsg("");
    setAuditErr(null);
    setBusyId(row.id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const raw = feeInputs[row.id];
      const value = Number(raw);

      if (!Number.isFinite(value) || value <= 0) {
        setErrorMsg("Inspection fee must be greater than 0.");
        return;
      }

      const before = await fetchPropertySnapshot(row.id);

      const { error } = await supabase
        .from("properties")
        .update({
          inspection_fee_ngn: value,
          inspection_fee_validated: false,
        })
        .eq("id", row.id);

      if (error) throw error;

      const after = await fetchPropertySnapshot(row.id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: "set_inspection_fee",
          entity_type: "property",
          entity_id: row.id,
          reason: "Set inspection fee",
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`Fee updated, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to set inspection fee.");
    } finally {
      setBusyId(null);
    }
  };

  const validateFee = async (row: PropertyRow) => {
    setErrorMsg("");
    setAuditErr(null);
    setBusyId(row.id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const snap = await fetchPropertySnapshot(row.id);
      if (!snap?.inspection_fee_ngn || snap.inspection_fee_ngn <= 0) {
        setErrorMsg("Set inspection fee before validating.");
        return;
      }

      const before = snap;

      const { error } = await supabase.from("properties").update({ inspection_fee_validated: true }).eq("id", row.id);
      if (error) throw error;

      const after = await fetchPropertySnapshot(row.id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: "validate_inspection_fee",
          entity_type: "property",
          entity_id: row.id,
          reason: "Validate inspection fee",
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`Fee validated, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to validate inspection fee.");
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (row: PropertyRow) => {
    const snap = await fetchPropertySnapshot(row.id);
    if (!snap?.inspection_fee_ngn || snap.inspection_fee_ngn <= 0) {
      setErrorMsg("Cannot approve until inspection fee is set.");
      return;
    }
    await updateStatus(row, "approved", "Approve property");
  };

  const goLive = async (row: PropertyRow) => {
    const snap = await fetchPropertySnapshot(row.id);
    if (!snap?.inspection_fee_validated) {
      setErrorMsg("Cannot go live until inspection fee is validated.");
      return;
    }
    await updateStatus(row, "live", "Go live");
  };

  const openEnforcement = (kind: "suspend_property" | "unsuspend_property", row: PropertyRow) => {
    setReason("");
    setAuditErr(null);
    setErrorMsg("");
    setEnforce({
      kind,
      property_id: row.id,
      property_label: `${row.title} • ${shortId(row.id)}`,
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
    setBusyId(enforce.property_id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchPropertySnapshot(enforce.property_id);

      const nextStatus: PropertyRow["status"] = enforce.kind === "suspend_property" ? "suspended" : "approved";

      const { error: upErr } = await supabase.from("properties").update({ status: nextStatus }).eq("id", enforce.property_id);
      if (upErr) throw upErr;

      const after = await fetchPropertySnapshot(enforce.property_id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: enforce.kind,
          entity_type: "property",
          entity_id: enforce.property_id,
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

  const queueCount = rows.length;

  const summary = useMemo(() => {
    if (loading) return { label: "Loading…", tone: "text-black/60" as const };
    if (errorMsg) return { label: "Attention needed", tone: "text-red-700" as const };
    if (queueCount === 0) return { label: "Queue is empty", tone: "text-black/60" as const };
    return { label: `${queueCount} in queue`, tone: "text-[#0a4f63]" as const };
  }, [loading, errorMsg, queueCount]);

  return (
    <main className="min-h-[calc(100vh-120px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Property Approvals</h1>
              <p className="mt-1 text-sm text-black/60">Review → Set Fee → Validate → Approve → Live</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              ← Admin Home
            </Link>
            <span className={`rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-medium ${summary.tone}`}>
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

      <SectionShell
        title={
          <>
            <div className="text-sm font-semibold text-[#0b1f2a]">Review Queue</div>
            <SectionBadge>{queueCount}</SectionBadge>
          </>
        }
        subtitle="Includes pending_review, approved, live, and suspended. Keep fee validation and launch actions clean."
        right={<div className="text-xs text-black/50">Premium approval flow</div>}
      >
        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No items."
            body="When properties need review or actions, they’ll appear here."
          />
        ) : (
          <>
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1420px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Property</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Status</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Location</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Fee setup</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Validated</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Created</th>
                      <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-semibold text-black/60">Actions</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {rows.map((r) => {
                      const busy = busyId === r.id;
                      const loc = [r.city, r.state].filter(Boolean).join(", ") || "—";
                      const feeIsSet = !!(r.inspection_fee_ngn && r.inspection_fee_ngn > 0);

                      return (
                        <tr key={r.id} className="border-t border-black/5 align-top">
                          <td className="px-5 py-5">
                            <div className="text-[#0b1f2a]">
                              <div className="font-semibold">{r.title}</div>
                              <div className="mt-1 font-mono text-xs text-black/50" title={r.id}>
                                {shortId(r.id)}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5">
                            <span className={statusPill(r.status)}>{r.status}</span>
                          </td>

                          <td className="px-5 py-5 text-black/60">{loc}</td>

                          <td className="px-5 py-5">
                            <div className="flex min-w-[250px] items-center gap-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                className="w-32 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                                value={feeInputs[r.id] ?? ""}
                                onChange={(e) =>
                                  setFeeInputs({
                                    ...feeInputs,
                                    [r.id]: e.target.value,
                                  })
                                }
                                placeholder="e.g. 5000"
                                disabled={busy}
                              />
                              <span className="text-xs text-black/50">{feeIsSet ? formatNgn(r.inspection_fee_ngn) : "Not set"}</span>
                            </div>
                          </td>

                          <td className="px-5 py-5">
                            <span className={yesNoPill(r.inspection_fee_validated)}>
                              {r.inspection_fee_validated ? "Yes" : "No"}
                            </span>
                          </td>

                          <td className="px-5 py-5 text-black/60">{fmtDate(r.created_at)}</td>

                          <td className="px-5 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/admin/properties/${r.id}`}
                                className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                              >
                                View
                              </Link>

                              <button
                                onClick={() => setInspectionFee(r)}
                                disabled={busy}
                                className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                  busy
                                    ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                    : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                                }`}
                              >
                                {busy ? "Working…" : "Set Fee"}
                              </button>

                              {!r.inspection_fee_validated ? (
                                <button
                                  onClick={() => validateFee(r)}
                                  disabled={busy}
                                  className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                      : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                                  }`}
                                >
                                  Validate
                                </button>
                              ) : null}

                              {r.status === "pending_review" ? (
                                <>
                                  <button
                                    onClick={() => approve(r)}
                                    disabled={busy}
                                    className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                      busy
                                        ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                        : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                                    }`}
                                  >
                                    Approve
                                  </button>

                                  <button
                                    onClick={() => updateStatus(r, "draft", "Reject property (back to draft)")}
                                    disabled={busy}
                                    className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                      busy
                                        ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                        : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                                    }`}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}

                              {r.status === "approved" ? (
                                <button
                                  onClick={() => goLive(r)}
                                  disabled={busy}
                                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                      : "bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(11,31,42,0.20)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]"
                                  }`}
                                >
                                  Go Live
                                </button>
                              ) : null}

                              {r.status !== "suspended" ? (
                                <button
                                  onClick={() => openEnforcement("suspend_property", r)}
                                  disabled={busy}
                                  className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                      : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  }`}
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => openEnforcement("unsuspend_property", r)}
                                  disabled={busy}
                                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                                  }`}
                                >
                                  Unsuspend
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
                const busy = busyId === r.id;
                const loc = [r.city, r.state].filter(Boolean).join(", ") || "—";
                const feeIsSet = !!(r.inspection_fee_ngn && r.inspection_fee_ngn > 0);

                return (
                  <article
                    key={r.id}
                    className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0b1f2a]">{r.title}</div>
                        <div className="mt-1 font-mono text-xs text-black/50" title={r.id}>
                          {shortId(r.id)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={statusPill(r.status)}>{r.status}</span>
                        <span className={yesNoPill(r.inspection_fee_validated)}>
                          {r.inspection_fee_validated ? "Validated" : "Not validated"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Location</div>
                        <div className="mt-1 text-sm text-black/60">{loc}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Created</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(r.created_at)}</div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Inspection fee</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            className="w-36 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                            value={feeInputs[r.id] ?? ""}
                            onChange={(e) =>
                              setFeeInputs({
                                ...feeInputs,
                                [r.id]: e.target.value,
                              })
                            }
                            placeholder="e.g. 5000"
                            disabled={busy}
                          />
                          <span className="text-xs text-black/50">{feeIsSet ? formatNgn(r.inspection_fee_ngn) : "Not set"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Link
                        href={`/admin/properties/${r.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      >
                        View
                      </Link>

                      <button
                        onClick={() => setInspectionFee(r)}
                        disabled={busy}
                        className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                          busy
                            ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                            : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                        }`}
                      >
                        {busy ? "Working…" : "Set Fee"}
                      </button>

                      {!r.inspection_fee_validated ? (
                        <button
                          onClick={() => validateFee(r)}
                          disabled={busy}
                          className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                              : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                          }`}
                        >
                          Validate
                        </button>
                      ) : null}

                      {r.status === "pending_review" ? (
                        <>
                          <button
                            onClick={() => approve(r)}
                            disabled={busy}
                            className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                            }`}
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => updateStatus(r, "draft", "Reject property (back to draft)")}
                            disabled={busy}
                            className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                            }`}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      {r.status === "approved" ? (
                        <button
                          onClick={() => goLive(r)}
                          disabled={busy}
                          className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                              : "bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(11,31,42,0.20)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]"
                          }`}
                        >
                          Go Live
                        </button>
                      ) : null}

                      {r.status !== "suspended" ? (
                        <button
                          onClick={() => openEnforcement("suspend_property", r)}
                          disabled={busy}
                          className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => openEnforcement("unsuspend_property", r)}
                          disabled={busy}
                          className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                              : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                          }`}
                        >
                          Unsuspend
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </SectionShell>

      {enforce ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeEnforcement} />
          <div className="relative w-full max-w-xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">Confirm enforcement</div>
                  <div className="mt-1 text-sm text-black/60">
                    {enforce.kind === "suspend_property" ? "Suspend property listing" : "Unsuspend property listing"} •{" "}
                    <span className="font-mono text-xs">{enforce.property_label}</span>
                  </div>
                  {enforce.kind === "unsuspend_property" ? (
                    <div className="mt-2 text-xs text-black/50">
                      Unsuspend returns the property to <span className="font-semibold">approved</span>. It does not auto-return to live.
                    </div>
                  ) : null}
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
                    enforce.kind === "suspend_property"
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
