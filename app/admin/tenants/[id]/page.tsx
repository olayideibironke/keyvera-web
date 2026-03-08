"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type InspectionRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;
  paid_at?: string | null;
  scheduled_at?: string | null;
  completed_at?: string | null;
};

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  before: any | null;
  after: any | null;
  created_at: string;
};

type EnforcementKind =
  | "verify_tenant"
  | "reject_tenant"
  | "set_pending_tenant"
  | "disable_tenant"
  | "enable_tenant";

type EnforcementState = {
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

function formatNgn(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `₦${Number(n).toLocaleString()}`;
}

function statusPill(x: string | null | undefined) {
  const s = String(x || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (s === "verified") return `${base} border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (s === "pending") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (s === "rejected") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "disabled") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "active") return `${base} border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  return `${base} border-black/10 bg-white/70 text-black/55`;
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

function pillTone(action: string) {
  const a = String(action || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold";
  if (a.includes("reject") || a.includes("disable")) return `${base} border-red-200 bg-red-50 text-red-700`;
  if (a.includes("verify") || a.includes("enable") || a.includes("pending")) {
    return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  }
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function jsonSafe(x: any) {
  try {
    if (x == null) return null;
    return typeof x === "string" ? JSON.parse(x) : x;
  } catch {
    return x;
  }
}

function jsonPretty(x: any) {
  try {
    if (x == null) return "—";
    return JSON.stringify(x, null, 2);
  } catch {
    return "—";
  }
}

function diffTopLevel(beforeRaw: any, afterRaw: any) {
  const before = (jsonSafe(beforeRaw) ?? {}) as Record<string, any>;
  const after = (jsonSafe(afterRaw) ?? {}) as Record<string, any>;

  const keys = new Set<string>([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const out: Array<{ key: string; before: any; after: any; changed: boolean }> = [];

  Array.from(keys)
    .sort()
    .forEach((k) => {
      const b = before?.[k];
      const a = after?.[k];
      const changed = JSON.stringify(b) !== JSON.stringify(a);
      out.push({ key: k, before: b, after: a, changed });
    });

  return out.filter((x) => x.changed);
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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DataTableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">{children}</div>;
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "dark",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "dark" | "good" | "bad";
}) {
  const cls =
    tone === "bad"
      ? "bg-gradient-to-r from-[#b91c1c] to-[#7f1d1d] shadow-[0_16px_38px_rgba(185,28,28,0.24)] hover:shadow-[0_20px_46px_rgba(185,28,28,0.30)]"
      : tone === "good"
      ? "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
      : "bg-[#0b1f2a] shadow-[0_18px_48px_rgba(11,31,42,0.20)] hover:shadow-[0_22px_56px_rgba(11,31,42,0.26)]";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-2xl px-4 py-2 text-sm font-semibold text-white transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        disabled ? "cursor-not-allowed opacity-60" : "",
        cls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition",
        "hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function AdminTenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = String((params as any)?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);

  const [busy, setBusy] = useState(false);

  const [enforce, setEnforce] = useState<EnforcementState | null>(null);
  const [reason, setReason] = useState("");
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<AuditRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<"diff" | "before" | "after">("diff");

  const openDrawer = (row: AuditRow) => {
    setDrawerRow(row);
    setDrawerTab("diff");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerRow(null);
  };

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

      if (!tenantId) {
        setErrorMsg("Missing tenant id.");
        setLoading(false);
        return;
      }

      const { data: t, error: te } = await supabase
        .from("profiles")
        .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
        .eq("user_id", tenantId)
        .maybeSingle();

      if (te) throw te;
      if (!t || t.role !== "tenant") {
        setTenant(null);
        setInspections([]);
        setAudits([]);
        setErrorMsg("Tenant not found (or role is not tenant).");
        setLoading(false);
        return;
      }

      setTenant(t as TenantRow);

      const { data: ins, error: ie } = await supabase
        .from("inspection_requests")
        .select("id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,paid_at,scheduled_at,completed_at")
        .eq("tenant_user_id", tenantId)
        .order("created_at", { ascending: false });

      if (ie) {
        setInspections([]);
      } else {
        setInspections((ins ?? []) as InspectionRow[]);
      }

      const { data: al, error: ae } = await supabase
        .from("admin_audit_logs")
        .select("id,actor_user_id,action,entity_type,entity_id,reason,before,after,created_at")
        .eq("entity_type", "tenant")
        .eq("entity_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (ae) {
        setAudits([]);
      } else {
        setAudits((al ?? []) as AuditRow[]);
      }

      setLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load tenant detail.");
      setTenant(null);
      setInspections([]);
      setAudits([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const computed = useMemo(() => {
    const counts: Record<InspectionStatus, number> = {
      requested: 0,
      paid: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };

    let revenue = 0;
    for (const r of inspections) {
      counts[r.status] += 1;
      if (r.status === "paid" || r.status === "scheduled" || r.status === "completed") revenue += Number(r.inspection_fee_ngn || 0);
    }

    return { counts, revenue, total: inspections.length };
  }, [inspections]);

  const openEnforcement = (kind: EnforcementKind) => {
    if (!tenant) return;
    const label = (tenant.full_name || "").trim() || "Tenant";
    setReason("");
    setAuditErr(null);
    setEnforce({
      kind,
      user_id: tenant.user_id,
      label: `${label} • ${shortId(tenant.user_id)}`,
    });
  };

  const closeEnforcement = () => {
    setEnforce(null);
    setReason("");
    setAuditErr(null);
  };

  const confirmEnforcement = async () => {
    if (!tenant || !enforce) return;

    const cleanReason = reason.trim();
    if (!cleanReason) {
      setAuditErr("Reason is required.");
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setAuditErr(null);

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

      const { data: beforeRow, error: be } = await supabase
        .from("profiles")
        .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
        .eq("user_id", tenant.user_id)
        .maybeSingle();

      if (be) throw be;

      const patch: Partial<TenantRow> = {};
      if (enforce.kind === "verify_tenant") patch.verification_status = "verified";
      if (enforce.kind === "reject_tenant") patch.verification_status = "rejected";
      if (enforce.kind === "set_pending_tenant") patch.verification_status = "pending";
      if (enforce.kind === "disable_tenant") patch.account_status = "disabled";
      if (enforce.kind === "enable_tenant") patch.account_status = "active";

      const { error: upErr } = await supabase.from("profiles").update(patch).eq("user_id", tenant.user_id);
      if (upErr) throw upErr;

      const { data: afterRow, error: ae } = await supabase
        .from("profiles")
        .select("user_id,role,verification_status,account_status,full_name,phone,country,created_at,updated_at")
        .eq("user_id", tenant.user_id)
        .maybeSingle();

      if (ae) throw ae;

      try {
        await logAudit({
          actor_user_id: user.id,
          action: enforce.kind,
          entity_type: "tenant",
          entity_id: tenant.user_id,
          reason: cleanReason,
          before: beforeRow ?? null,
          after: afterRow ?? null,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(
          `Change applied, but audit log is not deployed yet. Create table "admin_audit_logs". (${auditInsertErr?.message ?? "audit error"})`
        );
      }

      closeEnforcement();
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to apply tenant action.");
    } finally {
      setBusy(false);
    }
  };

  const drawerDiff = useMemo(() => {
    if (!drawerRow) return [];
    return diffTopLevel(drawerRow.before, drawerRow.after);
  }, [drawerRow]);

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_44px_rgba(11,31,42,0.12)]">
                <div className="absolute inset-0 bg-[radial-gradient(16px_16px_at_32%_30%,rgba(14,165,163,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(10,79,99,0.92),transparent_58%)]" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/0" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Tenant detail</h1>
                <p className="mt-1 text-sm text-black/60">Profile, inspection history, and enforcement trail.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
              >
                ← Admin Home
              </Link>
              <Link
                href="/admin/tenants"
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
              >
                ← Tenants
              </Link>
              <Badge>{tenantId ? shortId(tenantId) : "—"}</Badge>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <SecondaryButton onClick={load} disabled={busy || loading}>
              Refresh
            </SecondaryButton>
            <Link
              href="/admin/audit"
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
            >
              Audit Log
            </Link>
            <Link
              href="/admin/metrics"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f2a] px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(11,31,42,0.20)] transition hover:shadow-[0_22px_56px_rgba(11,31,42,0.26)]"
            >
              Metrics
            </Link>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Loading…
        </div>
      ) : !tenant ? (
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Tenant not found.
        </div>
      ) : (
        <>
          <SectionShell
            title={
              <>
                <h2 className="text-lg font-semibold text-[#0b1f2a]">Profile</h2>
                <span className={statusPill(tenant.verification_status)}>{tenant.verification_status}</span>
                <span className={statusPill(tenant.account_status)}>{tenant.account_status}</span>
              </>
            }
            subtitle={
              <>
                <span className="font-mono text-[12px] text-black/60">{tenant.user_id}</span>
              </>
            }
            right={
              <>
                <PrimaryButton onClick={() => openEnforcement("verify_tenant")} disabled={busy} tone="good">
                  Verify
                </PrimaryButton>
                <SecondaryButton onClick={() => openEnforcement("set_pending_tenant")} disabled={busy}>
                  Pending
                </SecondaryButton>
                <PrimaryButton onClick={() => openEnforcement("reject_tenant")} disabled={busy} tone="bad">
                  Reject
                </PrimaryButton>
                {tenant.account_status === "disabled" ? (
                  <PrimaryButton onClick={() => openEnforcement("enable_tenant")} disabled={busy} tone="dark">
                    Enable
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={() => openEnforcement("disable_tenant")} disabled={busy} tone="bad">
                    Disable
                  </PrimaryButton>
                )}
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-semibold text-black/55">Full name</div>
                <div className="mt-1 text-sm font-semibold text-[#0b1f2a]">{(tenant.full_name || "").trim() || "—"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-semibold text-black/55">Phone</div>
                <div className="mt-1 text-sm font-semibold text-[#0b1f2a]">{(tenant.phone || "").trim() || "—"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-semibold text-black/55">Country</div>
                <div className="mt-1 text-sm font-semibold text-[#0b1f2a]">{(tenant.country || "").trim() || "—"}</div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-semibold text-black/55">Created</div>
                <div className="mt-1 text-sm font-semibold text-[#0b1f2a]">{fmtDate(tenant.created_at)}</div>
              </div>
            </div>
          </SectionShell>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
              <div className="text-xs font-semibold text-black/55">Total inspections</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{computed.total}</div>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
              <div className="text-xs font-semibold text-black/55">Completed</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{computed.counts.completed}</div>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
              <div className="text-xs font-semibold text-black/55">Paid+</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">
                {computed.counts.paid + computed.counts.scheduled + computed.counts.completed}
              </div>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
              <div className="text-xs font-semibold text-black/55">Revenue</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{formatNgn(computed.revenue)}</div>
            </div>
          </div>

          <div className="mt-6">
            <SectionShell title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Inspection history</h2>} subtitle="Latest first • filtered by tenant_user_id">
              {inspections.length === 0 ? (
                <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
                  <div className="font-semibold text-[#0b1f2a]">No inspection activity.</div>
                  <div className="mt-1 text-black/60">When this tenant requests inspections, they will show here.</div>
                </div>
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">When</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Inspection</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Status</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Fee</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Property</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {inspections.map((r) => (
                        <tr key={r.id} className="border-t border-black/5">
                          <td className="p-3 text-black/60">{fmtDate(r.created_at)}</td>
                          <td className="p-3">
                            <div className="font-mono text-xs text-[#0b1f2a]" title={r.id}>
                              {shortId(r.id)}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={statusPill(r.status)}>{r.status}</span>
                          </td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{formatNgn(r.inspection_fee_ngn)}</td>
                          <td className="p-3">
                            <div className="font-mono text-xs text-black/60" title={r.property_id}>
                              {shortId(r.property_id)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>
          </div>

          <div className="mt-6">
            <SectionShell title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Enforcement trail</h2>} subtitle="From admin_audit_logs (entity_type = tenant). Click an event to open diff drawer.">
              {audits.length === 0 ? (
                <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
                  <div className="font-semibold text-[#0b1f2a]">No enforcement events yet.</div>
                  <div className="mt-1 text-black/60">Once actions are taken, they will show here.</div>
                </div>
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">When</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Action</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Reason</th>
                        <th className="p-3"></th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {audits.map((a) => (
                        <tr key={a.id} className="border-t border-black/5">
                          <td className="p-3 text-black/60">{fmtDate(a.created_at)}</td>
                          <td className="p-3">
                            <span className={pillTone(a.action)}>{a.action}</span>
                            <div className="mt-2 font-mono text-[11px] text-black/50">{shortId(a.id)}</div>
                          </td>
                          <td className="p-3 text-black/60">{(a.reason || "").trim() || "—"}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openDrawer(a)}
                              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                            >
                              View diff
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>
          </div>
        </>
      )}

      {enforce ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeEnforcement} />
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
                  className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
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
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {auditErr}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <SecondaryButton onClick={closeEnforcement} disabled={busy}>
                  Cancel
                </SecondaryButton>

                <PrimaryButton
                  onClick={confirmEnforcement}
                  disabled={busy}
                  tone={enforce.kind.includes("reject") || enforce.kind.includes("disable") ? "bad" : "good"}
                >
                  Confirm
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {drawerOpen && drawerRow ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[720px] overflow-hidden border-l border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0b1f2a]">Audit diff</div>
                <div className="mt-1 text-sm text-black/60">
                  <span className={pillTone(drawerRow.action)}>{drawerRow.action}</span>{" "}
                  <span className="ml-2 font-mono text-[11px] text-black/50">{shortId(drawerRow.id)}</span>
                </div>
                <div className="mt-2 text-xs text-black/50">{fmtDate(drawerRow.created_at)}</div>
                <div className="mt-2 text-xs text-black/60">Reason: {(drawerRow.reason || "").trim() || "—"}</div>
              </div>

              <button
                onClick={closeDrawer}
                className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-black/10 p-4">
              <button
                onClick={() => setDrawerTab("diff")}
                className={[
                  "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                  drawerTab === "diff"
                    ? "border-black/10 bg-[#0b1f2a] text-white shadow-[0_12px_32px_rgba(11,31,42,0.22)]"
                    : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
                ].join(" ")}
              >
                Diff
              </button>

              <button
                onClick={() => setDrawerTab("before")}
                className={[
                  "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                  drawerTab === "before"
                    ? "border-black/10 bg-[#0b1f2a] text-white shadow-[0_12px_32px_rgba(11,31,42,0.22)]"
                    : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
                ].join(" ")}
              >
                Before
              </button>

              <button
                onClick={() => setDrawerTab("after")}
                className={[
                  "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                  drawerTab === "after"
                    ? "border-black/10 bg-[#0b1f2a] text-white shadow-[0_12px_32px_rgba(11,31,42,0.22)]"
                    : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
                ].join(" ")}
              >
                After
              </button>

              <div className="ml-auto text-xs text-black/50">
                {drawerTab === "diff" ? `${drawerDiff.length} changed keys` : "JSON view"}
              </div>
            </div>

            <div className="h-[calc(100%-152px)] overflow-auto p-5">
              {drawerTab === "diff" ? (
                drawerDiff.length === 0 ? (
                  <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
                    <div className="font-semibold text-[#0b1f2a]">No top-level changes detected.</div>
                    <div className="mt-1 text-black/60">If changes are nested, use the raw JSON tabs.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drawerDiff.map((d) => (
                      <div key={d.key} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-mono text-xs font-semibold text-[#0b1f2a]">{d.key}</div>
                          <Badge tone="warn">changed</Badge>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-black/10 bg-white p-3">
                            <div className="text-[11px] font-semibold text-black/50">Before</div>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-black/70">
                              {jsonPretty(d.before)}
                            </pre>
                          </div>
                          <div className="rounded-2xl border border-black/10 bg-white p-3">
                            <div className="text-[11px] font-semibold text-black/50">After</div>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-black/70">
                              {jsonPretty(d.after)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : drawerTab === "before" ? (
                <pre className="whitespace-pre-wrap break-words rounded-2xl border border-black/10 bg-white/70 p-4 font-mono text-[12px] text-black/70">
                  {jsonPretty(drawerRow.before)}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-2xl border border-black/10 bg-white/70 p-4 font-mono text-[12px] text-black/70">
                  {jsonPretty(drawerRow.after)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}