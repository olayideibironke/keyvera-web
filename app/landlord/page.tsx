"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Property = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  rent_amount_ngn: number | null;
  status: string;
  created_at: string;
};

type AgentRow = {
  id: string;
  user_id: string;
  kyc_status: string | null;
  created_at?: string;
};

type AgentMini = {
  agent_id: string;
  user_id: string;
  kyc_status: string | null;
  full_name: string | null;
};

type AuthorizationStatus = "pending" | "approved" | "revoked";
type CreateMode = "pending" | "approved";

type AuthorizationRow = {
  id: string;
  property_id: string;
  agent_id: string;
  status: AuthorizationStatus;
  approved_at: string | null;
  approved_by_landlord_user_id: string | null;
};

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type InspectionRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;
  payment_reference?: string | null;
  paid_at?: string | null;
  scheduled_at?: string | null;
  scheduled_by_user_id?: string | null;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
  tenant_full_name?: string | null;
  scheduled_by_full_name?: string | null;
  completed_by_full_name?: string | null;
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

function maskRef(ref?: string | null) {
  const v = String(ref ?? "").trim();
  if (!v) return "—";
  if (v.length <= 10) return "••••••••";
  return `${v.slice(0, 6)}••••${v.slice(-4)}`;
}

function shortId(id: string) {
  const v = String(id ?? "").trim();
  if (!v) return "";
  return v.length <= 10 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function statusTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "live") return "bg-[rgba(14,165,163,0.10)] text-[#0a4f63] border-[rgba(14,165,163,0.25)]";
  if (s === "approved") return "bg-[rgba(10,79,99,0.10)] text-[#0a4f63] border-[rgba(10,79,99,0.22)]";
  if (s === "pending_review") return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "draft") return "bg-black/5 text-black/70 border-black/10";
  if (s === "suspended") return "bg-red-50 text-red-800 border-red-200";
  if (s === "archived") return "bg-black/5 text-black/70 border-black/10";
  return "bg-black/5 text-black/70 border-black/10";
}

function inspectionTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "bg-[rgba(14,165,163,0.10)] text-[#0a4f63] border-[rgba(14,165,163,0.25)]";
  if (s === "scheduled") return "bg-[rgba(11,31,42,0.06)] text-[#0b1f2a] border-black/10";
  if (s === "paid") return "bg-[rgba(10,79,99,0.10)] text-[#0a4f63] border-[rgba(10,79,99,0.22)]";
  if (s === "requested") return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "cancelled") return "bg-red-50 text-red-800 border-red-200";
  return "bg-black/5 text-black/70 border-black/10";
}

function kycTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "verified") return "bg-[rgba(14,165,163,0.10)] text-[#0a4f63] border-[rgba(14,165,163,0.25)]";
  if (s === "pending") return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "rejected") return "bg-red-50 text-red-800 border-red-200";
  return "bg-black/5 text-black/70 border-black/10";
}

function authTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-[rgba(14,165,163,0.10)] text-[#0a4f63] border-[rgba(14,165,163,0.25)]";
  if (s === "pending") return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "revoked") return "bg-red-50 text-red-800 border-red-200";
  return "bg-black/5 text-black/70 border-black/10";
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-88px)]">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
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
        <div className="min-w-0">
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

function InlinePill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
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
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
      ? "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.08)] text-[#0a4f63]"
      : "border-black/10 bg-white/70 text-black/70";

  return <div className={`rounded-[28px] border p-5 text-sm ${cls}`}>{children}</div>;
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
      <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{value}</div>
    </div>
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

function tagErr(context: string, e: any) {
  const msg = e?.message ? String(e.message) : String(e ?? "Unknown error");
  return new Error(`[${context}] ${msg}`);
}

export default function LandlordPropertiesPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [landlordUserId, setLandlordUserId] = useState<string | null>(null);
  const [landlordId, setLandlordId] = useState<string | null>(null);

  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agents, setAgents] = useState<AgentMini[]>([]);
  const [agentSearch, setAgentSearch] = useState("");

  const [authLoading, setAuthLoading] = useState(true);
  const [authorizations, setAuthorizations] = useState<AuthorizationRow[]>([]);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const [createMode, setCreateMode] = useState<CreateMode>("pending");

  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const [inspectionsLoading, setInspectionsLoading] = useState(true);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [inspectionsErr, setInspectionsErr] = useState<string | null>(null);
  const [inspectionPropertyId, setInspectionPropertyId] = useState<string>("");

  const [rules, setRules] = useState<RevenueRules>(DEFAULT_RULES);
  const [rulesLoaded, setRulesLoaded] = useState(false);

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

  async function resolveLandlordAccess() {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw tagErr("auth.getUser", userErr);

    if (!user) {
      setHasSession(false);
      setAuthorized(false);
      setAuthChecked(true);
      return null;
    }

    setHasSession(true);

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) throw tagErr("profiles.select(role)", profErr);

    const role = String(profile?.role || "").toLowerCase();

    if (role && role !== "landlord") {
      setAuthorized(false);
      setAuthChecked(true);

      if (role === "tenant") {
        router.replace("/tenant");
        return null;
      }

      if (role === "agent") {
        router.replace("/agent");
        return null;
      }

      if (role === "admin") {
        router.replace("/admin");
        return null;
      }

      return null;
    }

    if (role === "landlord") {
      setLandlordUserId(user.id);
      setAuthorized(true);
      setAuthChecked(true);
      return user;
    }

    setAuthorized(false);
    setAuthChecked(true);
    return null;
  }

  async function loadAuthorizations(propertyIds: string[]) {
    setAuthLoading(true);
    try {
      if (!propertyIds.length) {
        setAuthorizations([]);
        return;
      }

      const { data, error } = await supabase
        .from("agent_property_authorizations")
        .select("id,property_id,agent_id,status,approved_at,approved_by_landlord_user_id")
        .in("property_id", propertyIds);

      if (error) throw tagErr("agent_property_authorizations.select", error);

      setAuthorizations((data ?? []) as AuthorizationRow[]);
    } catch (e: any) {
      setError((e?.message ?? "Failed to load agent authorizations.") as string);
      setAuthorizations([]);
    } finally {
      setAuthLoading(false);
    }
  }

  async function hydrateUserNames(list: InspectionRow[]) {
    const ids = Array.from(
      new Set(
        list
          .flatMap((r) => [r.tenant_user_id, r.scheduled_by_user_id, r.completed_by_user_id])
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
      )
    );

    if (ids.length === 0) return list;

    const { data: profs, error } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
    if (error) throw tagErr("profiles.select(full_name) for inspections", error);

    const nameMap: Record<string, string | null> = {};
    (profs ?? []).forEach((p: any) => {
      nameMap[String(p.user_id)] = (p.full_name ?? null) as string | null;
    });

    return list.map((r) => ({
      ...r,
      tenant_full_name: nameMap[String(r.tenant_user_id)] ?? null,
      scheduled_by_full_name: r.scheduled_by_user_id ? nameMap[String(r.scheduled_by_user_id)] ?? null : null,
      completed_by_full_name: r.completed_by_user_id ? nameMap[String(r.completed_by_user_id)] ?? null : null,
    }));
  }

  async function loadInspections(propertyIds: string[]) {
    setInspectionsLoading(true);
    setInspectionsErr(null);

    try {
      if (!propertyIds.length) {
        setInspections([]);
        return;
      }

      const { data, error } = await supabase
        .from("inspection_requests")
        .select(
          "id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,payment_reference,paid_at,scheduled_at,scheduled_by_user_id,completed_at,completed_by_user_id"
        )
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });

      if (error) throw tagErr("inspection_requests.select", error);

      const base = (data ?? []) as InspectionRow[];
      const enriched = await hydrateUserNames(base);

      setInspections(enriched);
    } catch (e: any) {
      setInspectionsErr((e?.message ?? "Failed to load inspections.") as string);
      setInspections([]);
    } finally {
      setInspectionsLoading(false);
    }
  }

  async function loadAgents() {
    setAgentsLoading(true);
    try {
      const { data: agentRows, error: agentErr } = await supabase
        .from("agents")
        .select("id,user_id,kyc_status,created_at")
        .order("created_at", { ascending: false });

      if (agentErr) throw tagErr("agents.select", agentErr);

      const list = (agentRows ?? []) as AgentRow[];
      const userIds = Array.from(new Set(list.map((a) => a.user_id).filter(Boolean)));

      const nameMap: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", userIds);

        if (profErr) throw tagErr("profiles.select(full_name) for agents", profErr);

        (profs ?? []).forEach((p: any) => {
          nameMap[String(p.user_id)] = (p.full_name ?? null) as string | null;
        });
      }

      const merged: AgentMini[] = list.map((a) => ({
        agent_id: a.id,
        user_id: a.user_id,
        kyc_status: a.kyc_status ?? null,
        full_name: nameMap[a.user_id] ?? null,
      }));

      setAgents(merged);

      if (!selectedAgentId && merged.length > 0) setSelectedAgentId(merged[0].agent_id);
    } catch (e: any) {
      setError((e?.message ?? "Failed to load agents.") as string);
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    setActionMsg(null);
    setActionErr(null);

    try {
      const user = await resolveLandlordAccess();

      if (!user) {
        setProperties([]);
        setAuthorizations([]);
        setInspections([]);
        return;
      }

      const { data: landlordRow, error: landlordErr } = await supabase
        .from("landlords")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (landlordErr) throw tagErr("landlords.select(id)", landlordErr);

      setLandlordId(landlordRow.id);

      const { data, error: propsErr } = await supabase
        .from("properties")
        .select("id,title,area,city,rent_amount_ngn,status,created_at")
        .eq("owner_landlord_id", landlordRow.id)
        .order("created_at", { ascending: false });

      if (propsErr) throw tagErr("properties.select(owner_landlord_id=...)", propsErr);

      const props = (data ?? []) as Property[];
      setProperties(props);

      if (!selectedPropertyId && props.length > 0) setSelectedPropertyId(props[0].id);
      if (!inspectionPropertyId && props.length > 0) setInspectionPropertyId(props[0].id);

      const ids = props.map((p) => p.id);
      await Promise.all([loadAuthorizations(ids), loadInspections(ids)]);
    } catch (e: any) {
      setError((e?.message ?? "Failed to load landlord dashboard.") as string);
      setProperties([]);
      setAuthorizations([]);
      setInspections([]);
      setAuthorized(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const authByProperty = useMemo(() => {
    const map: Record<string, AuthorizationRow[]> = {};
    for (const a of authorizations) {
      const pid = String(a.property_id);
      if (!map[pid]) map[pid] = [];
      map[pid].push(a);
    }
    return map;
  }, [authorizations]);

  const agentsById = useMemo(() => {
    const map: Record<string, AgentMini> = {};
    for (const a of agents) map[a.agent_id] = a;
    return map;
  }, [agents]);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId]
  );

  const existingForSelected = useMemo(() => {
    if (!selectedPropertyId) return [];
    return (authByProperty[selectedPropertyId] ?? []).slice().sort((a, b) => {
      const at = a.approved_at ? new Date(a.approved_at).getTime() : 0;
      const bt = b.approved_at ? new Date(b.approved_at).getTime() : 0;
      return bt - at;
    });
  }, [authByProperty, selectedPropertyId]);

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return agents;

    return agents.filter((a) => {
      const name = (a.full_name ?? "").toLowerCase();
      const kyc = (a.kyc_status ?? "").toLowerCase();
      const id = a.agent_id.toLowerCase();
      return name.includes(q) || kyc.includes(q) || id.includes(q);
    });
  }, [agents, agentSearch]);

  const canSubmit = useMemo(() => {
    if (!landlordUserId) return false;
    if (!selectedPropertyId) return false;
    if (!selectedAgentId) return false;
    if (actionBusy) return false;
    if (agentsLoading) return false;
    return true;
  }, [actionBusy, agentsLoading, landlordUserId, selectedAgentId, selectedPropertyId]);

  const inspectionsForSelected = useMemo(() => {
    const pid = inspectionPropertyId || "";
    if (!pid) return [];
    return inspections.filter((r) => String(r.property_id) === pid);
  }, [inspections, inspectionPropertyId]);

  const summaryStats = useMemo(() => {
    const total = properties.length;
    const live = properties.filter((p) => String(p.status || "").toLowerCase() === "live").length;
    const pendingReview = properties.filter((p) => String(p.status || "").toLowerCase() === "pending_review").length;
    const approved = properties.filter((p) => String(p.status || "").toLowerCase() === "approved").length;

    const totalInspections = inspections.length;
    const selectedInspections = inspectionsForSelected.length;

    return {
      total,
      live,
      pendingReview,
      approved,
      totalInspections,
      selectedInspections,
    };
  }, [properties, inspections, inspectionsForSelected.length]);

  const revenueSummary = useMemo(() => {
    return {
      listingActivationFee: Number(rules.landlord_listing_activation_fee_ngn || 0),
      featuredBoostFee: Number(rules.landlord_featured_boost_fee_ngn || 0),
      freeLimit: Number(rules.launch_free_listing_limit || 0),
      freeEnabled: !!rules.allow_launch_free_listing,
    };
  }, [rules]);

  const landlordRuleMessage = useMemo(() => {
    if (revenueSummary.freeEnabled) {
      return `Landlords can draft listings for free. Early launch supports ${revenueSummary.freeLimit} free live listing(s), then listing activation fees apply.`;
    }
    return "Landlords can draft listings for free, but every live property requires paid listing activation.";
  }, [revenueSummary]);

  async function submitAuthorization() {
    setActionMsg(null);
    setActionErr(null);

    if (!landlordUserId) {
      setActionErr("Please log in again.");
      return;
    }
    if (!selectedPropertyId || !selectedAgentId) {
      setActionErr("Select a property and an agent.");
      return;
    }

    setActionBusy(true);
    try {
      const { data: existing, error: existErr } = await supabase
        .from("agent_property_authorizations")
        .select("id,status")
        .eq("property_id", selectedPropertyId)
        .eq("agent_id", selectedAgentId)
        .maybeSingle();

      if (existErr) throw tagErr("agent_property_authorizations.select(existing)", existErr);

      const nowIso = new Date().toISOString();
      const nextStatus: AuthorizationStatus = createMode === "approved" ? "approved" : "pending";

      const payload: Partial<AuthorizationRow> & {
        status: AuthorizationStatus;
        approved_by_landlord_user_id?: string | null;
        approved_at?: string | null;
      } =
        nextStatus === "approved"
          ? { status: "approved", approved_by_landlord_user_id: landlordUserId, approved_at: nowIso }
          : { status: "pending", approved_by_landlord_user_id: null, approved_at: null };

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("agent_property_authorizations")
          .update(payload)
          .eq("id", existing.id);
        if (updErr) throw tagErr("agent_property_authorizations.update", updErr);
      } else {
        const { error: insErr } = await supabase.from("agent_property_authorizations").insert({
          property_id: selectedPropertyId,
          agent_id: selectedAgentId,
          ...payload,
        });
        if (insErr) throw tagErr("agent_property_authorizations.insert", insErr);
      }

      await loadAuthorizations(properties.map((p) => p.id));

      const agentName = agentsById[selectedAgentId]?.full_name ?? "Agent";
      const propTitle = selectedProperty?.title ?? "Property";

      setActionMsg(
        nextStatus === "approved"
          ? `${agentName} approved for ${propTitle}.`
          : `Authorization request sent to ${agentName} for ${propTitle}.`
      );
    } catch (e: any) {
      setActionErr((e?.message ?? "Failed to submit authorization.") as string);
    } finally {
      setActionBusy(false);
    }
  }

  async function revokeAuthorization(authId: string) {
    setActionMsg(null);
    setActionErr(null);
    setActionBusy(true);

    try {
      const { error: updErr } = await supabase
        .from("agent_property_authorizations")
        .update({ status: "revoked" as AuthorizationStatus })
        .eq("id", authId);

      if (updErr) throw tagErr("agent_property_authorizations.revoke(update)", updErr);

      await loadAuthorizations(properties.map((p) => p.id));
      setActionMsg("Authorization revoked.");
    } catch (e: any) {
      setActionErr((e?.message ?? "Failed to revoke authorization.") as string);
    } finally {
      setActionBusy(false);
    }
  }

  async function approvePending(authId: string) {
    setActionMsg(null);
    setActionErr(null);
    setActionBusy(true);

    try {
      if (!landlordUserId) {
        setActionErr("Please log in again.");
        return;
      }

      const nowIso = new Date().toISOString();

      const { error: updErr } = await supabase
        .from("agent_property_authorizations")
        .update({
          status: "approved" as AuthorizationStatus,
          approved_by_landlord_user_id: landlordUserId,
          approved_at: nowIso,
        })
        .eq("id", authId);

      if (updErr) throw tagErr("agent_property_authorizations.approve(update)", updErr);

      await loadAuthorizations(properties.map((p) => p.id));
      setActionMsg("Authorization approved.");
    } catch (e: any) {
      setActionErr((e?.message ?? "Failed to approve authorization.") as string);
    } finally {
      setActionBusy(false);
    }
  }

  if (!authChecked) {
    return null;
  }

  if (!hasSession) {
    return (
      <PageShell>
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
                Welcome to Keyvera for Landlords
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-[#0b1f2a] md:text-5xl">
                Manage your properties in a safer, more professional rental workflow.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-black/65">
                Keyvera helps landlords present listings more professionally, manage inspection activity, and operate in
                a structured marketplace built around trust, verification, and accountability.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <LandingPrimaryLink href="/login?next=/landlord">Sign In</LandingPrimaryLink>
                <LandingSecondaryLink href="/login?next=/landlord&mode=signup">Sign Up</LandingSecondaryLink>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Visibility</div>
                  <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Better listing presence</div>
                  <div className="mt-1 text-xs leading-6 text-black/55">Present properties inside a cleaner marketplace experience.</div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Control</div>
                  <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Role-based workflow</div>
                  <div className="mt-1 text-xs leading-6 text-black/55">Keep agent access and property activity more organized.</div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Trust</div>
                  <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Inspection accountability</div>
                  <div className="mt-1 text-xs leading-6 text-black/55">Operate in a flow designed to reduce confusion and noise.</div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold text-[#0b1f2a]">What landlords get</div>

                <div className="mt-5 space-y-4">
                  <LandingInfoCard
                    title="Professional onboarding"
                    body="Join Keyvera, complete your access, and move into a more serious property workflow."
                  />
                  <LandingInfoCard
                    title="Structured listing activation"
                    body={
                      revenueSummary.freeEnabled
                        ? `Draft for free. Early launch supports ${revenueSummary.freeLimit} free live listing(s), then listing activation starts at ${formatNgn(
                            revenueSummary.listingActivationFee
                          )}.`
                        : `Draft for free. Live listings require activation, starting at ${formatNgn(
                            revenueSummary.listingActivationFee
                          )}.`
                    }
                  />
                  <LandingInfoCard
                    title="Premium visibility options"
                    body={`Featured listing boosts begin at ${formatNgn(
                      revenueSummary.featuredBoostFee
                    )} for stronger marketplace exposure.`}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <InlinePill tone="border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] text-[#0a4f63]">
              Paid trust-first marketplace
            </InlinePill>
            <InlinePill tone="border-black/10 bg-white/80 text-black/60">
              Admin-controlled launch rules
            </InlinePill>
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0b1f2a]">
            Draft free. Go live with structure.
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">{landlordRuleMessage}</p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatCard label="Listing activation" value={formatNgn(revenueSummary.listingActivationFee)} tone="navy" />
            <StatCard label="Featured boost" value={formatNgn(revenueSummary.featuredBoostFee)} tone="teal" />
            <StatCard
              label="Free live listing limit"
              value={revenueSummary.freeEnabled ? String(revenueSummary.freeLimit) : "0"}
              tone="amber"
            />
          </div>
        </section>
      </PageShell>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Landlord Dashboard</h1>
              <p className="mt-1 text-sm text-black/60">
                Welcome to Keyvera. Your next step is to create and manage your property listings.
              </p>
            </div>
          </div>

          {landlordId ? (
            <div className="mt-3 text-xs text-black/50">
              Landlord ID: <span className="font-mono">{landlordId}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={load}>Refresh</GhostButton>
          <GhostButton
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/");
              router.refresh();
            }}
          >
            Sign Out
          </GhostButton>
          <PrimaryButton onClick={() => router.push("/landlord/properties/new")}>+ Create Property</PrimaryButton>
        </div>
      </div>

      <div className="mb-4 rounded-[24px] border border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.06)] p-4 text-sm text-[#0a4f63]">
        {landlordRuleMessage}
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <StatCard label="Listing activation" value={formatNgn(revenueSummary.listingActivationFee)} tone="navy" />
        <StatCard label="Featured boost" value={formatNgn(revenueSummary.featuredBoostFee)} tone="teal" />
        <StatCard
          label="Free live listing limit"
          value={revenueSummary.freeEnabled ? String(revenueSummary.freeLimit) : "0"}
          tone="amber"
        />
        <StatCard label="Rules status" value={rulesLoaded ? "Live" : "Loading"} tone="neutral" />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-5">
        <StatCard label="Total listings" value={loading ? "—" : String(summaryStats.total)} tone="navy" />
        <StatCard label="Live" value={loading ? "—" : String(summaryStats.live)} tone="teal" />
        <StatCard label="Pending review" value={loading ? "—" : String(summaryStats.pendingReview)} tone="amber" />
        <StatCard label="Approved" value={loading ? "—" : String(summaryStats.approved)} tone="neutral" />
        <StatCard
          label="Inspections"
          value={
            loading
              ? "—"
              : inspectionPropertyId
              ? `${summaryStats.selectedInspections} / ${summaryStats.totalInspections}`
              : String(summaryStats.totalInspections)
          }
          tone="teal"
        />
      </div>

      {error ? (
        <div className="mb-6">
          <Message tone="error">{error}</Message>
        </div>
      ) : null}

      {loading ? (
        <Card title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Loading</h2>} subtitle="Fetching your properties and activity…">
          <div className="text-sm text-black/60">Loading…</div>
        </Card>
      ) : properties.length === 0 ? (
        <Card
          title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Welcome to Keyvera</h2>}
          subtitle="Your landlord account is ready. The next step is to create your first property."
          right={<PrimaryButton onClick={() => router.push("/landlord/properties/new")}>+ Create Property</PrimaryButton>}
        >
          <div className="rounded-2xl border border-black/10 bg-white/70 p-6 text-sm text-black/60">
            {revenueSummary.freeEnabled
              ? `You can draft properties for free. Early launch supports ${revenueSummary.freeLimit} free live listing(s), then listing activation applies at ${formatNgn(
                  revenueSummary.listingActivationFee
                )} per live property.`
              : `You can draft properties for free. Live listing activation applies at ${formatNgn(
                  revenueSummary.listingActivationFee
                )} per property once you move into the paid marketplace stage.`}
          </div>
        </Card>
      ) : (
        <>
          <Card
            title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Listings</h2>}
            subtitle="Your properties and their current status."
            right={<div className="text-xs text-black/50">Premium listing view</div>}
          >
            <div className="mb-5 rounded-[22px] border border-black/10 bg-white/80 p-4 text-sm text-black/60">
              Live marketplace participation is structured. Drafting stays free, while listing activation and featured boosts follow the current platform pricing rules.
            </div>

            <div className="hidden xl:block">
              <DataTableShell>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1160px] text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Title</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Location</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Rent</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Status</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Created</th>
                        <th className="w-[180px] px-5 py-4"></th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {properties.map((p) => (
                        <tr key={p.id} className="border-t border-black/5">
                          <td className="px-5 py-5">
                            <div className="font-semibold text-[#0b1f2a]">{p.title}</div>
                            <div className="mt-1 font-mono text-xs text-black/50">{shortId(p.id)}</div>
                          </td>
                          <td className="px-5 py-5 text-black/70">{[p.area, p.city].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-5 py-5 text-black/70">{p.rent_amount_ngn != null ? `₦${p.rent_amount_ngn.toLocaleString()}` : "—"}</td>
                          <td className="px-5 py-5">
                            <InlinePill tone={statusTone(p.status)}>{p.status}</InlinePill>
                          </td>
                          <td className="px-5 py-5 text-black/60">{formatDt(p.created_at)}</td>
                          <td className="px-5 py-5 text-right">
                            {p.status === "draft" ? (
                              <button
                                onClick={() => router.push(`/landlord/properties/${p.id}/edit`)}
                                className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                              >
                                Continue Editing
                              </button>
                            ) : (
                              <button
                                onClick={() => router.push(`/landlord/properties/${p.id}`)}
                                className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableShell>
            </div>

            <div className="grid gap-4 xl:hidden">
              {properties.map((p) => (
                <article
                  key={p.id}
                  className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0b1f2a]">{p.title}</div>
                      <div className="mt-1 font-mono text-xs text-black/50">{shortId(p.id)}</div>
                    </div>

                    <InlinePill tone={statusTone(p.status)}>{p.status}</InlinePill>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Location</div>
                      <div className="mt-1 text-sm text-black/60">{[p.area, p.city].filter(Boolean).join(", ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Rent</div>
                      <div className="mt-1 text-sm text-black/60">{p.rent_amount_ngn != null ? `₦${p.rent_amount_ngn.toLocaleString()}` : "—"}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Created</div>
                      <div className="mt-1 text-sm text-black/60">{formatDt(p.created_at)}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    {p.status === "draft" ? (
                      <button
                        onClick={() => router.push(`/landlord/properties/${p.id}/edit`)}
                        className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      >
                        Continue Editing
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/landlord/properties/${p.id}`)}
                        className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      >
                        View
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Card>

          <div className="mt-6">
            <Card
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Authorize an Agent</h2>}
              subtitle="Send an authorization request (pending) or approve immediately."
              right={
                <GhostButton onClick={() => loadAuthorizations(properties.map((p) => p.id))} disabled={authLoading}>
                  {authLoading ? "Refreshing…" : "Refresh Authorizations"}
                </GhostButton>
              }
            >
              {actionErr ? (
                <div className="mb-4">
                  <Message tone="error">{actionErr}</Message>
                </div>
              ) : null}

              {actionMsg ? (
                <div className="mb-4">
                  <Message tone="success">{actionMsg}</Message>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-5">
                <div className="md:col-span-1">
                  <label className="mb-2 block text-xs font-semibold text-black/60">Property</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none focus:border-black/20"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="mb-2 block text-xs font-semibold text-black/60">Agent search</label>
                  <input
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search name / kyc / id…"
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none focus:border-black/20"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="mb-2 block text-xs font-semibold text-black/60">Agent</label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none focus:border-black/20"
                    disabled={agentsLoading}
                  >
                    {agentsLoading ? (
                      <option value="">Loading agents…</option>
                    ) : filteredAgents.length === 0 ? (
                      <option value="">No matching agents</option>
                    ) : (
                      filteredAgents.map((a) => {
                        const name = a.full_name ?? `Agent ${a.agent_id.slice(0, 8)}`;
                        const badge = a.kyc_status === "verified" ? "verified" : a.kyc_status ?? "unknown";
                        return (
                          <option key={a.agent_id} value={a.agent_id}>
                            {name} • {badge}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="mb-2 block text-xs font-semibold text-black/60">Action</label>
                  <select
                    value={createMode}
                    onChange={(e) => setCreateMode(e.target.value as CreateMode)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none focus:border-black/20"
                    disabled={actionBusy}
                  >
                    <option value="pending">Request Authorization (pending)</option>
                    <option value="approved">Approve Immediately (approved)</option>
                  </select>
                </div>

                <div className="md:col-span-1 flex items-end">
                  <PrimaryButton onClick={submitAuthorization} disabled={!canSubmit} className="w-full">
                    {actionBusy ? "Working…" : "Submit"}
                  </PrimaryButton>
                </div>
              </div>

              <div className="mt-7">
                <h3 className="text-sm font-semibold text-[#0b1f2a]">Current authorizations</h3>

                {authLoading ? (
                  <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">Loading…</div>
                ) : !selectedPropertyId ? (
                  <div className="mt-3 text-sm text-black/60">Select a property to view authorizations.</div>
                ) : existingForSelected.length === 0 ? (
                  <div className="mt-3 text-sm text-black/60">No authorizations for this property yet.</div>
                ) : (
                  <div className="mt-3">
                    <DataTableShell>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <TableHead>
                            <tr>
                              <th className="p-3 text-xs font-semibold text-black/60">Agent</th>
                              <th className="p-3 text-xs font-semibold text-black/60">KYC</th>
                              <th className="p-3 text-xs font-semibold text-black/60">Status</th>
                              <th className="p-3 text-xs font-semibold text-black/60">Approved at</th>
                              <th className="w-[170px] p-3 text-right"></th>
                            </tr>
                          </TableHead>
                          <tbody>
                            {existingForSelected.map((a) => {
                              const agent = agentsById[a.agent_id];
                              const name = agent?.full_name ?? `Agent ${a.agent_id.slice(0, 8)}`;
                              const kyc = agent?.kyc_status ?? "unknown";
                              const approved = a.approved_at ? new Date(a.approved_at).toLocaleString() : "—";

                              return (
                                <tr key={a.id} className="border-t border-black/5">
                                  <td className="p-3">
                                    <div className="font-semibold text-[#0b1f2a]">{name}</div>
                                    <div className="font-mono text-xs text-black/50">{shortId(a.agent_id)}</div>
                                  </td>
                                  <td className="p-3">
                                    <InlinePill tone={kycTone(kyc)}>{kyc}</InlinePill>
                                  </td>
                                  <td className="p-3">
                                    <InlinePill tone={authTone(a.status)}>{a.status}</InlinePill>
                                  </td>
                                  <td className="p-3 text-black/70">{approved}</td>
                                  <td className="p-3 text-right">
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {a.status === "pending" ? (
                                        <button
                                          onClick={() => approvePending(a.id)}
                                          disabled={actionBusy}
                                          className="rounded-2xl bg-[#0b1f2a] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(11,31,42,0.22)] transition hover:shadow-[0_16px_34px_rgba(11,31,42,0.26)] disabled:opacity-60"
                                        >
                                          {actionBusy ? "Working…" : "Approve"}
                                        </button>
                                      ) : null}

                                      {a.status === "revoked" ? (
                                        <span className="text-xs text-black/50">Revoked</span>
                                      ) : (
                                        <button
                                          onClick={() => revokeAuthorization(a.id)}
                                          disabled={actionBusy}
                                          className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:opacity-60"
                                        >
                                          {actionBusy ? "Working…" : "Revoke"}
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
                    </DataTableShell>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-6">
            <Card
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Inspection Activity</h2>}
              subtitle="Read-only view of inspections across your properties."
              right={
                <GhostButton onClick={() => loadInspections(properties.map((p) => p.id))} disabled={inspectionsLoading}>
                  {inspectionsLoading ? "Refreshing…" : "Refresh Inspections"}
                </GhostButton>
              }
            >
              {inspectionsErr ? (
                <div className="mb-4">
                  <Message tone="error">{inspectionsErr}</Message>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-1">
                  <label className="mb-2 block text-xs font-semibold text-black/60">Property</label>
                  <select
                    value={inspectionPropertyId}
                    onChange={(e) => setInspectionPropertyId(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none focus:border-black/20"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 flex items-end">
                  <div className="text-xs text-black/50">Payment reference is masked for safety.</div>
                </div>
              </div>

              {inspectionsLoading ? (
                <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">Loading…</div>
              ) : !inspectionPropertyId ? (
                <div className="mt-5 text-sm text-black/60">Select a property to view inspections.</div>
              ) : inspectionsForSelected.length === 0 ? (
                <div className="mt-5 text-sm text-black/60">No inspections for this property yet.</div>
              ) : (
                <div className="mt-5">
                  <DataTableShell>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1440px] text-left text-sm">
                        <TableHead>
                          <tr>
                            <th className="p-3 text-xs font-semibold text-black/60">Tenant</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Status</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Fee</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Payment</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Created</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Paid</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Scheduled</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Scheduled by</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Completed</th>
                            <th className="p-3 text-xs font-semibold text-black/60">Completed by</th>
                          </tr>
                        </TableHead>
                        <tbody>
                          {inspectionsForSelected.map((r) => (
                            <tr key={r.id} className="border-t border-black/5">
                              <td className="p-3">
                                <div className="font-semibold text-[#0b1f2a]">{r.tenant_full_name ?? "Tenant"}</div>
                                <div className="font-mono text-xs text-black/50">{shortId(r.tenant_user_id)}</div>
                              </td>
                              <td className="p-3">
                                <InlinePill tone={inspectionTone(r.status)}>{r.status}</InlinePill>
                              </td>
                              <td className="p-3 text-black/70">{formatNgn(r.inspection_fee_ngn)}</td>
                              <td className="p-3 font-mono text-xs text-black/60">{maskRef(r.payment_reference)}</td>
                              <td className="p-3 text-black/70">{formatDt(r.created_at)}</td>
                              <td className="p-3 text-black/70">{formatDt(r.paid_at)}</td>
                              <td className="p-3 text-black/70">{formatDt(r.scheduled_at)}</td>
                              <td className="p-3">
                                {r.scheduled_by_full_name ? (
                                  <div className="font-semibold text-[#0b1f2a]">{r.scheduled_by_full_name}</div>
                                ) : r.scheduled_by_user_id ? (
                                  <div className="font-mono text-xs text-black/50">{shortId(r.scheduled_by_user_id)}</div>
                                ) : (
                                  <span className="text-black/50">—</span>
                                )}
                              </td>
                              <td className="p-3 text-black/70">{formatDt(r.completed_at)}</td>
                              <td className="p-3">
                                {r.completed_by_full_name ? (
                                  <div className="font-semibold text-[#0b1f2a]">{r.completed_by_full_name}</div>
                                ) : r.completed_by_user_id ? (
                                  <div className="font-mono text-xs text-black/50">{shortId(r.completed_by_user_id)}</div>
                                ) : (
                                  <span className="text-black/50">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataTableShell>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}