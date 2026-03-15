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

type RevenueRules = {
  inspection_budget_fee_ngn: string;
  inspection_standard_fee_ngn: string;
  inspection_premium_fee_ngn: string;
  landlord_listing_activation_fee_ngn: string;
  landlord_featured_boost_fee_ngn: string;
  agent_onboarding_fee_ngn: string;
  allow_launch_free_listing: boolean;
  launch_free_listing_limit: string;
  tenant_refund_policy: "review" | "credit_or_reschedule" | "restricted_after_scheduling";
};

const DEFAULT_RULES: RevenueRules = {
  inspection_budget_fee_ngn: "5000",
  inspection_standard_fee_ngn: "10000",
  inspection_premium_fee_ngn: "15000",
  landlord_listing_activation_fee_ngn: "5000",
  landlord_featured_boost_fee_ngn: "10000",
  agent_onboarding_fee_ngn: "5000",
  allow_launch_free_listing: true,
  launch_free_listing_limit: "1",
  tenant_refund_policy: "restricted_after_scheduling",
};

function toRules(value: any): RevenueRules {
  return {
    inspection_budget_fee_ngn: String(value?.inspection_budget_fee_ngn ?? DEFAULT_RULES.inspection_budget_fee_ngn),
    inspection_standard_fee_ngn: String(value?.inspection_standard_fee_ngn ?? DEFAULT_RULES.inspection_standard_fee_ngn),
    inspection_premium_fee_ngn: String(value?.inspection_premium_fee_ngn ?? DEFAULT_RULES.inspection_premium_fee_ngn),
    landlord_listing_activation_fee_ngn: String(
      value?.landlord_listing_activation_fee_ngn ?? DEFAULT_RULES.landlord_listing_activation_fee_ngn
    ),
    landlord_featured_boost_fee_ngn: String(
      value?.landlord_featured_boost_fee_ngn ?? DEFAULT_RULES.landlord_featured_boost_fee_ngn
    ),
    agent_onboarding_fee_ngn: String(value?.agent_onboarding_fee_ngn ?? DEFAULT_RULES.agent_onboarding_fee_ngn),
    allow_launch_free_listing:
      typeof value?.allow_launch_free_listing === "boolean"
        ? value.allow_launch_free_listing
        : DEFAULT_RULES.allow_launch_free_listing,
    launch_free_listing_limit: String(value?.launch_free_listing_limit ?? DEFAULT_RULES.launch_free_listing_limit),
    tenant_refund_policy:
      value?.tenant_refund_policy === "review" ||
      value?.tenant_refund_policy === "credit_or_reschedule" ||
      value?.tenant_refund_policy === "restricted_after_scheduling"
        ? value.tenant_refund_policy
        : DEFAULT_RULES.tenant_refund_policy,
  };
}

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

function parseStoredIdValue(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return {
      type: "drivers_license",
      number: "",
    };
  }

  const idx = raw.indexOf(":");
  if (idx === -1) {
    return {
      type: "drivers_license",
      number: raw,
    };
  }

  const maybeType = raw.slice(0, idx).trim();
  const maybeNumber = raw.slice(idx + 1).trim();

  const allowedTypes = new Set(["nin", "drivers_license", "international_passport", "voters_card"]);

  return {
    type: allowedTypes.has(maybeType) ? maybeType : "drivers_license",
    number: maybeNumber,
  };
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

function LandingPrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
    >
      {children}
    </Link>
  );
}

function LandingSecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#0b1f2a] shadow-sm transition hover:bg-black/[0.03]"
    >
      {children}
    </Link>
  );
}

function LandingInfoCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
      <div className="text-lg font-semibold text-[#0b1f2a]">{title}</div>
      <p className="mt-2 text-sm leading-7 text-black/60">{body}</p>
    </div>
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

function KycChecklistItem({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>{children}</span>
    </label>
  );
}

export default function AgentPortalPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, PropertyMini>>({});
  const [agentRecord, setAgentRecord] = useState<AgentRecord | null>(null);
  const [authorizedPropertyIds, setAuthorizedPropertyIds] = useState<string[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  const [rules, setRules] = useState<RevenueRules>(DEFAULT_RULES);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  const [kycIdType, setKycIdType] = useState("drivers_license");
  const [kycIdNumber, setKycIdNumber] = useState("");
  const [kycConfirmGovId, setKycConfirmGovId] = useState(false);
  const [kycConfirmNotExpired, setKycConfirmNotExpired] = useState(false);
  const [kycConfirmTrueInfo, setKycConfirmTrueInfo] = useState(false);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycMessage, setKycMessage] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);

  async function loadRevenueRules() {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "revenue_rules")
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        setRules(toRules(data.setting_value));
      } else {
        setRules(DEFAULT_RULES);
      }
    } catch {
      setRules(DEFAULT_RULES);
    } finally {
      setRulesLoaded(true);
    }
  }

  async function resolveAgentAccess() {
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr) throw sessionErr;

    if (!session?.user) {
      setHasSession(false);
      setAuthorized(false);
      setAuthChecked(true);
      return null;
    }

    const user = session.user;
    setHasSession(true);

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    const role = String(profile?.role || "").toLowerCase();

    if (role && role !== "agent") {
      setAuthorized(false);
      setAuthChecked(true);

      if (role === "landlord") {
        router.replace("/landlord");
        return null;
      }

      if (role === "tenant") {
        router.replace("/tenant");
        return null;
      }

      if (role === "admin") {
        router.replace("/admin");
        return null;
      }

      return null;
    }

    if (role === "agent") {
      setAuthorized(true);
      setAuthChecked(true);
      return user;
    }

    setAuthorized(false);
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

    const parsed = parseStoredIdValue(record?.license_number);
    setKycIdType(parsed.type);
    setKycIdNumber(parsed.number);

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
        .in("status", ["paid", "scheduled"])
        .in("property_id", propertyIds)
        .order("created_at");

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
    } finally {
      setAuthChecked(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRevenueRules();
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
    try {
      await rpcCall("agent_mark_inspection_scheduled", id);
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function markCompleted(id: string) {
    setActionId(id);
    try {
      await rpcCall("agent_mark_inspection_completed", id);
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function cancelInspection(id: string) {
    setActionId(id);
    try {
      await rpcCall("agent_cancel_inspection", id);
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function submitKyc() {
    setKycMessage(null);
    setKycError(null);

    const cleanNumber = kycIdNumber.trim();
    if (!cleanNumber) {
      setKycError("Government ID number is required.");
      return;
    }

    if (!kycConfirmGovId || !kycConfirmNotExpired || !kycConfirmTrueInfo) {
      setKycError("You must confirm all KYC declarations before submission.");
      return;
    }

    if (!agentRecord?.id) {
      setKycError("Agent profile not found.");
      return;
    }

    setKycSubmitting(true);

    try {
      const { data: currentAgent, error: currentAgentError } = await supabase
        .from("agents")
        .select("id,user_id,kyc_status,license_number")
        .eq("id", agentRecord.id)
        .maybeSingle();

      if (currentAgentError) throw currentAgentError;
      if (!currentAgent) throw new Error("Agent profile not found.");

      const liveStatus = String(currentAgent.kyc_status ?? "").toLowerCase();

      if (liveStatus === "verified") {
        setAgentRecord(currentAgent as AgentRecord);
        const parsed = parseStoredIdValue(currentAgent.license_number);
        setKycIdType(parsed.type);
        setKycIdNumber(parsed.number);
        setKycMessage("Your KYC is already verified. No new submission was made.");
        return;
      }

      if (liveStatus === "pending") {
        setAgentRecord(currentAgent as AgentRecord);
        const parsed = parseStoredIdValue(currentAgent.license_number);
        setKycIdType(parsed.type);
        setKycIdNumber(parsed.number);
        setKycMessage("Your KYC is already under admin review. No new submission was made.");
        return;
      }

      const normalizedNumber = `${kycIdType}:${cleanNumber}`;

      const { data: updatedAgent, error: updateError } = await supabase
        .from("agents")
        .update({
          license_number: normalizedNumber,
          kyc_status: "pending",
        })
        .eq("id", agentRecord.id)
        .select("id,user_id,kyc_status,license_number")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedAgent) throw new Error("KYC submission could not be verified after update.");

      if (String(updatedAgent.kyc_status ?? "").toLowerCase() !== "pending") {
        throw new Error("KYC submission did not persist as pending.");
      }

      setAgentRecord(updatedAgent as AgentRecord);
      setKycMessage(
        "KYC submitted for admin review. Approval only happens after manual trust checks, including document validity review."
      );
      await load();
    } catch (e: any) {
      setKycError(e?.message ?? "Failed to submit KYC.");
    } finally {
      setKycSubmitting(false);
    }
  }

  const isKycVerified = agentRecord?.kyc_status === "verified";
  const isKycPending = agentRecord?.kyc_status === "pending";
  const isKycRejected = agentRecord?.kyc_status === "rejected";

  const paidCount = useMemo(() => rows.filter((r) => r.status === "paid").length, [rows]);
  const scheduledCount = useMemo(() => rows.filter((r) => r.status === "scheduled").length, [rows]);
  const totalFees = useMemo(() => rows.reduce((sum, r) => sum + Number(r.inspection_fee_ngn || 0), 0), [rows]);

  const onboardingFee = useMemo(() => Number(rules.agent_onboarding_fee_ngn || 0), [rules]);

  const agentRuleMessage = useMemo(() => {
    return `Agents can join Keyvera and begin the onboarding path, but professional participation starts after approval and the current onboarding fee of ${formatNgn(
      onboardingFee
    )}.`;
  }, [onboardingFee]);

  if (!authChecked) {
    return null;
  }

  if (!hasSession) {
    return (
      <main className="min-h-[calc(100vh-140px)]">
        <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-[0_16px_46px_rgba(11,31,42,0.10)]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(820px 360px at 12% 0%, rgba(14,165,163,0.16), rgba(255,255,255,0) 60%), radial-gradient(700px 320px at 88% 0%, rgba(11,31,42,0.10), rgba(255,255,255,0) 58%)",
            }}
          />

          <div className="relative grid gap-8 p-8 md:grid-cols-12 md:p-10">
            <div className="md:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#0b1f2a] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#0ea5a3]" style={{ opacity: 0.75 }} />
                Welcome to Keyvera for Agents
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-[#0b1f2a] md:text-5xl">
                Join Keyvera and manage inspections inside a more trusted rental workflow.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-black/65">
                Keyvera gives agents a cleaner operational flow for approved assignments, inspection scheduling, and
                accountable completion inside a structured marketplace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <LandingPrimaryLink href="/login?next=/agent">Sign In</LandingPrimaryLink>
                <LandingSecondaryLink href="/login?next=/agent&mode=signup">Sign Up</LandingSecondaryLink>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Assignments</div>
                  <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Approved queue only</div>
                  <div className="mt-1 text-xs leading-6 text-black/55">
                    See only the properties and inspections you are authorized to handle.
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Scheduling</div>
                  <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Operational clarity</div>
                  <div className="mt-1 text-xs leading-6 text-black/55">
                    Move inspections from paid to scheduled to completed with cleaner status control.
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Verification</div>
                  <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">KYC-first access</div>
                  <div className="mt-1 text-xs leading-6 text-black/55">
                    Build trust and unlock deeper workflow access through agent verification.
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold text-[#0b1f2a]">What agents get</div>

                <div className="mt-5 space-y-4">
                  <LandingInfoCard
                    title="Professional sign in and onboarding"
                    body={`Join Keyvera as an agent and enter a structured workflow with onboarding beginning at ${formatNgn(
                      onboardingFee
                    )}.`}
                  />
                  <LandingInfoCard
                    title="Role-based inspection control"
                    body="Approved assignments, scheduling, and completion live inside a cleaner agent dashboard."
                  />
                  <LandingInfoCard
                    title="Trust-first direction"
                    body="We are building the platform to help agents operate inside a safer and more accountable environment."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <InfoBadge tone="good">Paid trust-first marketplace</InfoBadge>
            <InfoBadge>Admin-controlled onboarding rules</InfoBadge>
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0b1f2a]">
            Join free. Professional participation is not free.
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">{agentRuleMessage}</p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard label="Agent onboarding fee" value={formatNgn(onboardingFee)} tone="navy" />
            <StatCard label="Rules status" value={rulesLoaded ? "Live" : "Loading"} tone="teal" />
            <StatCard label="Access model" value="Approval first" tone="amber" />
          </div>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mb-4 rounded-[24px] border border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.06)] p-4 text-sm text-[#0a4f63]">
        {agentRuleMessage}
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <StatCard label="Agent onboarding fee" value={formatNgn(onboardingFee)} tone="navy" />
        <StatCard label="Rules status" value={rulesLoaded ? "Live" : "Loading"} tone="teal" />
        <StatCard label="Access standard" value={isKycVerified ? "Verified" : "Verification needed"} tone="amber" />
      </div>

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
                {isKycVerified
                  ? "KYC verified"
                  : isKycPending
                  ? "KYC under review"
                  : isKycRejected
                  ? "KYC rejected"
                  : "KYC verification required"}
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
        <section className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 shadow-[0_16px_46px_rgba(11,31,42,0.06)]">
          <div className="border-b border-amber-200 p-5 md:p-6">
            <div className="text-lg font-semibold text-[#0b1f2a]">Complete your KYC before operating on Keyvera</div>
            <p className="mt-1 text-sm text-amber-900">
              Agents are a major trust risk in the rental market. Keyvera uses strict KYC screening to help reduce scams and fraud.
            </p>
          </div>

          <div className="p-5 md:p-6">
            {kycMessage ? (
              <div className="mb-4 rounded-2xl border border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.08)] p-4 text-sm text-[#0a4f63]">
                {kycMessage}
              </div>
            ) : null}

            {kycError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {kycError}
              </div>
            ) : null}

            {isKycRejected ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Your previous KYC review was rejected. Correct your information and submit again with a valid non-expired government ID.
              </div>
            ) : null}

            {isKycPending ? (
              <div className="mb-4 rounded-2xl border border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.08)] p-4 text-sm text-[#0a4f63]">
                Your KYC is currently under admin review. Scheduling and completion actions remain locked until approval.
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-black/10 bg-white/80 p-5">
                <div className="text-sm font-semibold text-[#0b1f2a]">KYC submission</div>
                <div className="mt-1 text-sm text-black/55">
                  Current launch requirement: submit your government ID type and ID number for manual admin review.
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                      Government ID type
                    </div>
                    <select
                      value={kycIdType}
                      onChange={(e) => setKycIdType(e.target.value)}
                      disabled={kycSubmitting || isKycPending}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="nin">NIN</option>
                      <option value="drivers_license">Driver&apos;s License</option>
                      <option value="international_passport">International Passport</option>
                      <option value="voters_card">Voter&apos;s Card</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
                      Government ID number
                    </div>
                    <input
                      value={kycIdNumber}
                      onChange={(e) => setKycIdNumber(e.target.value)}
                      disabled={kycSubmitting || isKycPending}
                      placeholder="Enter your government ID number"
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-3">
                  <KycChecklistItem checked={kycConfirmGovId} onChange={setKycConfirmGovId}>
                    I am submitting a real government-issued ID tied to my identity.
                  </KycChecklistItem>

                  <KycChecklistItem checked={kycConfirmNotExpired} onChange={setKycConfirmNotExpired}>
                    I confirm this document is valid and not expired.
                  </KycChecklistItem>

                  <KycChecklistItem checked={kycConfirmTrueInfo} onChange={setKycConfirmTrueInfo}>
                    I understand false identity information can lead to rejection, disablement, or permanent removal from Keyvera.
                  </KycChecklistItem>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={submitKyc}
                    disabled={kycSubmitting || isKycPending}
                    className="rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {kycSubmitting ? "Submitting..." : isKycPending ? "Under Review" : "Submit KYC"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                <LandingInfoCard
                  title="Current hard rule"
                  body="Only non-expired government ID should be submitted. Expired or suspicious KYC should be rejected."
                />
                <LandingInfoCard
                  title="Current launch limitation"
                  body="This phase captures your ID type and ID number for review. Secure image upload, selfie matching, and expiry-date field enforcement are the next upgrade."
                />
                <LandingInfoCard
                  title="Why this matters"
                  body="Keyvera is building around trust. Fraud-prone agent activity is one of the biggest market problems, so KYC remains a strict gate."
                />
              </div>
            </div>
          </div>
        </section>
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