"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type PropertyRow = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  state: string | null;
  status: string;
  rent_amount_ngn: number | null;
  rent_frequency?: string | null;
  property_type?: string | null;
  property_class?: string | null;
  inspection_fee_ngn?: number | null;
  inspection_fee_validated?: boolean | null;
  created_at: string;
};

type InspectionRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;
  scheduled_at?: string | null;
  completed_at?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
};

type ViewMode = "checking" | "public" | "private";

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

const PAGE_SIZE = 12;

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

function isTruthy(v: any) {
  return v === true || v === "true" || v === 1;
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
      className={`rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
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
      className={`rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function InlinePill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
}

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a]">
      <span className="text-black/50">{label}:</span> {value}
    </div>
  );
}

function EmptyBox({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
      <div className="font-semibold text-[#0b1f2a]">{title}</div>
      {body ? <div className="mt-1 text-black/60">{body}</div> : null}
    </div>
  );
}

function MetricCard({
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

export default function TenantPortalPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("checking");
  const [tenantUserId, setTenantUserId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const [bootLoading, setBootLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [rules, setRules] = useState<RevenueRules>(DEFAULT_RULES);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [minRent, setMinRent] = useState<string>("");
  const [maxRent, setMaxRent] = useState<string>("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"newest" | "rent_low" | "rent_high">("newest");

  const [page, setPage] = useState(1);

  const [propsLoading, setPropsLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [recoLoading, setRecoLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<PropertyRow[]>([]);

  const [reqLoading, setReqLoading] = useState(false);
  const [requests, setRequests] = useState<InspectionRow[]>([]);

  const [actionId, setActionId] = useState<string | null>(null);

  const isSearching = useMemo(() => {
    return !!(
      q.trim() ||
      city.trim() ||
      area.trim() ||
      String(minRent || "").trim() ||
      String(maxRent || "").trim() ||
      type.trim() ||
      sort !== "newest"
    );
  }, [q, city, area, minRent, maxRent, type, sort]);

  const pricingSummary = useMemo(() => {
    return {
      budget: Number(rules.inspection_budget_fee_ngn || 0),
      standard: Number(rules.inspection_standard_fee_ngn || 0),
      premium: Number(rules.inspection_premium_fee_ngn || 0),
    };
  }, [rules]);

  const refundPolicyLabel = useMemo(() => {
    if (rules.tenant_refund_policy === "review") return "Refunds reviewed case-by-case.";
    if (rules.tenant_refund_policy === "credit_or_reschedule")
      return "If an inspection fails from the platform side, Keyvera may offer credit or reschedule first.";
    return "Once an inspection is scheduled, fees are generally restricted from refund unless Keyvera decides otherwise.";
  }, [rules.tenant_refund_policy]);

  const propertyMapAll = useMemo(() => {
    const map: Record<string, PropertyRow> = {};
    for (const p of properties) map[p.id] = p;
    for (const p of recommendations) if (!map[p.id]) map[p.id] = p;
    return map;
  }, [properties, recommendations]);

  const totalPages = useMemo(() => {
    const t = Math.max(0, Number(totalCount || 0));
    return Math.max(1, Math.ceil(t / PAGE_SIZE));
  }, [totalCount]);

  const requestCounts = useMemo(() => {
    let requested = 0;
    let paid = 0;
    let scheduled = 0;
    let completed = 0;

    for (const r of requests) {
      if (r.status === "requested") requested++;
      if (r.status === "paid") paid++;
      if (r.status === "scheduled") scheduled++;
      if (r.status === "completed") completed++;
    }

    return { total: requests.length, requested, paid, scheduled, completed };
  }, [requests]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

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

  async function resolveTenantAccess() {
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr) throw sessionErr;

    if (!session?.user) {
      setTenantUserId(null);
      setViewMode("public");
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

    if (role && role !== "tenant") {
      if (role === "landlord") {
        router.replace("/landlord");
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

      setTenantUserId(null);
      setViewMode("public");
      return null;
    }

    if (role === "tenant") {
      setTenantUserId(user.id);
      setViewMode("private");
      return user;
    }

    setTenantUserId(null);
    setViewMode("public");
    return null;
  }

  function buildPropertyQuery() {
    let query = supabase
      .from("properties")
      .select(
        "id,title,area,city,state,status,rent_amount_ngn,rent_frequency,property_type,property_class,inspection_fee_ngn,inspection_fee_validated,created_at",
        { count: "exact" }
      )
      .eq("status", "live")
      .eq("inspection_fee_validated", true);

    const qq = q.trim();
    if (qq) query = query.ilike("title", `%${qq}%`);

    const cc = city.trim();
    if (cc) query = query.ilike("city", `%${cc}%`);

    const aa = area.trim();
    if (aa) query = query.ilike("area", `%${aa}%`);

    const tt = type.trim();
    if (tt) query = query.eq("property_type", tt);

    const min = Number(minRent);
    const max = Number(maxRent);
    if (Number.isFinite(min) && min > 0) query = query.gte("rent_amount_ngn", min);
    if (Number.isFinite(max) && max > 0) query = query.lte("rent_amount_ngn", max);

    if (sort === "newest") query = query.order("created_at", { ascending: false });
    if (sort === "rent_low") query = query.order("rent_amount_ngn", { ascending: true, nullsFirst: false });
    if (sort === "rent_high") query = query.order("rent_amount_ngn", { ascending: false, nullsFirst: false });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    return query.range(from, to);
  }

  async function loadProperties() {
    setPropsLoading(true);

    try {
      const { data, error, count } = await buildPropertyQuery();
      if (error) throw error;

      setProperties((data ?? []) as PropertyRow[]);
      setTotalCount(Number(count ?? 0));
    } catch (e: any) {
      setProperties([]);
      setTotalCount(0);
      setErrorMsg(e?.message ?? "Failed to load public listings.");
    } finally {
      setPropsLoading(false);
    }
  }

  async function loadRecommendations(excludeIds: string[]) {
    setRecoLoading(true);

    try {
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id,title,area,city,state,status,rent_amount_ngn,rent_frequency,property_type,property_class,inspection_fee_ngn,inspection_fee_validated,created_at"
        )
        .eq("status", "live")
        .eq("inspection_fee_validated", true)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      const raw = (data ?? []) as PropertyRow[];
      setRecommendations(raw.filter((p) => !excludeIds.includes(p.id)).slice(0, 4));
    } catch {
      setRecommendations([]);
    } finally {
      setRecoLoading(false);
    }
  }

  async function loadMyRequests(userId: string) {
    setReqLoading(true);

    try {
      const { data, error } = await supabase
        .from("inspection_requests")
        .select(
          "id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,scheduled_at,completed_at,payment_reference,paid_at"
        )
        .eq("tenant_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests((data ?? []) as InspectionRow[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load inspection requests.");
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }

  async function loadAll() {
    setBootLoading(true);
    setErrorMsg(null);
    setToastMsg(null);

    try {
      const user = await resolveTenantAccess();

      if (user) {
        await loadMyRequests(user.id);
      } else {
        setRequests([]);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load tenant portal.");
      setTenantUserId(null);
      setViewMode("public");
    } finally {
      setBootLoading(false);
    }
  }

  useEffect(() => {
    loadRevenueRules();
    loadAll();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadAll();
    });

    return () => sub?.subscription?.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, area, minRent, maxRent, type, sort]);

  useEffect(() => {
    if (viewMode === "checking") return;
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, page, q, city, area, minRent, maxRent, type, sort]);

  useEffect(() => {
    if (viewMode === "checking") return;
    const exclude = properties.map((p) => p.id);
    loadRecommendations(exclude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, properties]);

  function canRequestForProperty(p: PropertyRow) {
    const fee = Number(p.inspection_fee_ngn || 0);
    const validated = isTruthy(p.inspection_fee_validated);
    return validated && Number.isFinite(fee) && fee > 0;
  }

  async function requestInspection(propertyId: string) {
    setErrorMsg(null);
    setToastMsg(null);
    setActionId(`req:${propertyId}`);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/properties/${propertyId}`)}`);
        return;
      }

      const p = propertyMapAll[propertyId] ?? null;

      if (!p) {
        setErrorMsg("Property not found.");
        return;
      }

      if (!canRequestForProperty(p)) {
        setErrorMsg("Inspection fee is not ready for this property yet.");
        return;
      }

      const fee = Number(p.inspection_fee_ngn || 0);

      const { data, error } = await supabase.rpc("tenant_request_inspection", {
        p_property_id: propertyId,
        p_fee_ngn: fee,
      });

      if (error) throw error;

      const newId = String(data ?? "");
      if (newId) setToastMsg("Inspection requested.");

      if (tenantUserId) {
        await loadMyRequests(tenantUserId);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to request inspection.");
    } finally {
      setActionId(null);
    }
  }

  function clearSearch() {
    setQ("");
    setCity("");
    setArea("");
    setMinRent("");
    setMaxRent("");
    setType("");
    setSort("newest");
    setPage(1);
  }

  if (viewMode === "checking") {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8 overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-[0_16px_46px_rgba(11,31,42,0.10)]">
          <div
            className="p-8 md:p-10"
            style={{
              background:
                "radial-gradient(820px 360px at 12% 0%, rgba(14,165,163,0.16), rgba(255,255,255,0) 60%), radial-gradient(700px 320px at 88% 0%, rgba(11,31,42,0.10), rgba(255,255,255,0) 58%)",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#0b1f2a] shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-[#0ea5a3]" style={{ opacity: 0.75 }} />
                  Public property browsing
                </div>

                <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-[#0b1f2a] md:text-5xl">
                  Browse verified Keyvera properties before signing up.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-black/65">
                  Visitors and tenants can view live advertised properties and open full listing details for free.
                  Sign in is only required when you request a verified inspection or continue into payment.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {viewMode === "private" ? (
                  <>
                    <GhostButton onClick={loadAll}>Refresh</GhostButton>
                    <button
                      onClick={() => router.push("/")}
                      className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white"
                    >
                      Home
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="rounded-2xl border border-red-200 bg-red-50/80 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {signingOut ? "Signing Out..." : "Sign Out"}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login?next=/tenant"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/login?next=/tenant&mode=signup"
                      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#0b1f2a] shadow-sm transition hover:bg-black/[0.03]"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <MetricCard label="Budget inspection" value={formatNgn(pricingSummary.budget)} tone="amber" />
              <MetricCard label="Standard inspection" value={formatNgn(pricingSummary.standard)} tone="teal" />
              <MetricCard label="Premium inspection" value={formatNgn(pricingSummary.premium)} tone="navy" />
            </div>

            <div className="mt-5 rounded-[22px] border border-black/10 bg-white/80 p-4 text-sm leading-7 text-black/60">
              Browsing and full property details are free. Inspection requests and payments require a tenant account.
              {rulesLoaded ? <span className="ml-1">Live pricing rules loaded.</span> : null}
            </div>
          </div>
        </section>

        {viewMode === "private" ? (
          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <MetricCard label="My inspections" value={String(requestCounts.total)} tone="navy" />
            <MetricCard label="Requested" value={String(requestCounts.requested)} tone="amber" />
            <MetricCard label="Paid / Scheduled" value={`${requestCounts.paid + requestCounts.scheduled}`} tone="teal" />
            <MetricCard label="Completed" value={String(requestCounts.completed)} tone="teal" />
          </div>
        ) : null}

        {errorMsg ? (
          <div className="mb-6 rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
        ) : null}

        {toastMsg ? (
          <div className="mb-6 rounded-[22px] border border-green-200 bg-green-50 p-4 text-sm text-green-800">{toastMsg}</div>
        ) : null}

        <Card
          title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Search & Filters</h2>}
          subtitle="Find advertised listings by location, rent range, and type."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <StatChip label="Results" value={totalCount.toLocaleString()} />
              <GhostButton onClick={clearSearch} className="px-4 py-2 text-xs">
                Clear
              </GhostButton>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs font-semibold text-black/60">Search</label>
              <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3">
                <span className="text-black/40">🔎</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Title keywords"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-black/60">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Ikeja"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-black/60">Area</label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g., Phase 1"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-black/60">Min Rent</label>
              <input
                type="number"
                value={minRent}
                onChange={(e) => setMinRent(e.target.value)}
                placeholder="0"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20"
                min={0}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-black/60">Max Rent</label>
              <input
                type="number"
                value={maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
                placeholder="0"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20"
                min={0}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-black/60">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20"
              >
                <option value="">All</option>
                <option value="apartment">apartment</option>
                <option value="house">house</option>
                <option value="studio">studio</option>
                <option value="duplex">duplex</option>
                <option value="room">room</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-black/60">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "rent_low" | "rent_high")}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/20"
              >
                <option value="newest">Newest</option>
                <option value="rent_low">Rent Low → High</option>
                <option value="rent_high">Rent High → Low</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-end">
              <PrimaryButton onClick={() => setPage(1)} className="w-full">
                Apply
              </PrimaryButton>
            </div>
          </div>
        </Card>

        {bootLoading ? (
          <div className="mt-6 rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
            Loading…
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <Card
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">{isSearching ? "Results" : "Advertised Properties"}</h2>}
              subtitle={isSearching ? `${totalCount.toLocaleString()} listings found` : "Live verified listings open for public viewing."}
              right={
                <div className="flex items-center gap-2">
                  <GhostButton
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={propsLoading || page <= 1}
                    className="px-4 py-2 text-xs"
                  >
                    Prev
                  </GhostButton>
                  <div className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/60">
                    Page <span className="font-semibold text-[#0b1f2a]">{page}</span> /{" "}
                    <span className="font-semibold text-[#0b1f2a]">{totalPages}</span>
                  </div>
                  <GhostButton
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={propsLoading || page >= totalPages}
                    className="px-4 py-2 text-xs"
                  >
                    Next
                  </GhostButton>
                </div>
              }
            >
              {propsLoading ? (
                <EmptyBox title="Loading properties…" />
              ) : properties.length === 0 ? (
                <EmptyBox
                  title="No listings found"
                  body="If live properties exist, confirm the public SELECT policy allows reading live listings."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {properties.map((p) => (
                    <PropertyCard
                      key={p.id}
                      p={p}
                      actionId={actionId}
                      onRequest={() => requestInspection(p.id)}
                      canRequest={canRequestForProperty(p)}
                    />
                  ))}
                </div>
              )}

              <div className="mt-7">
                <h3 className="text-sm font-semibold text-[#0b1f2a]">You may also like</h3>
                <div className="mt-1 text-xs text-black/50">Additional verified options.</div>

                {recoLoading ? (
                  <div className="mt-3">
                    <EmptyBox title="Loading recommendations…" />
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="mt-3 text-sm text-black/60">No recommendations right now.</div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {recommendations.map((p) => (
                      <RecoCard
                        key={p.id}
                        p={p}
                        actionId={actionId}
                        onRequest={() => requestInspection(p.id)}
                        canRequest={canRequestForProperty(p)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {viewMode === "private" ? (
              <Card
                title={<h2 className="text-lg font-semibold text-[#0b1f2a]">My Inspections</h2>}
                subtitle="Track requests, payments, scheduling, and completion."
                right={
                  <div className="flex flex-wrap items-center gap-2">
                    <StatChip label="Total" value={requestCounts.total} />
                    <StatChip label="Requested" value={requestCounts.requested} />
                    <GhostButton
                      onClick={async () => {
                        if (!tenantUserId) return;
                        await loadMyRequests(tenantUserId);
                      }}
                      className="px-4 py-2 text-xs"
                      disabled={reqLoading}
                    >
                      {reqLoading ? "Refreshing…" : "Refresh"}
                    </GhostButton>
                  </div>
                }
              >
                {reqLoading ? (
                  <EmptyBox title="Loading your inspections…" />
                ) : requests.length === 0 ? (
                  <EmptyBox title="No inspection requests yet" body="Request an inspection from any verified listing." />
                ) : (
                  <div className="space-y-3">
                    {requests.map((r) => {
                      const p = propertyMapAll[r.property_id];
                      const title = p?.title ?? `Property ${shortId(r.property_id)}`;

                      const updated =
                        r.status === "paid"
                          ? formatDt(r.paid_at)
                          : r.status === "scheduled"
                          ? formatDt(r.scheduled_at)
                          : r.status === "completed"
                          ? formatDt(r.completed_at)
                          : formatDt(r.created_at);

                      const canPay = r.status === "requested";

                      return (
                        <div key={r.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_24px_rgba(11,31,42,0.05)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#0b1f2a]">{title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <InlinePill tone={statusTone(r.status)}>{r.status}</InlinePill>
                                <div className="text-xs text-black/50">Updated: {updated}</div>
                              </div>
                              <div className="mt-2 text-xs text-black/50 font-mono">{shortId(r.id)}</div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="text-sm font-semibold text-[#0b1f2a]">{formatNgn(r.inspection_fee_ngn)}</div>

                              {canPay ? (
                                <button
                                  onClick={() => router.push(`/tenant/inspections/${r.id}`)}
                                  className="rounded-2xl bg-[#0b1f2a] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                                >
                                  Pay Now
                                </button>
                              ) : (
                                <button
                                  onClick={() => router.push(`/tenant/inspections/${r.id}`)}
                                  className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          </div>

                          {r.payment_reference ? (
                            <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-3 text-xs text-black/60">
                              Payment ref: <span className="font-mono">{r.payment_reference}</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <Card
                title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Ready to inspect?</h2>}
                subtitle="Create a tenant account only when you are ready to request inspection."
              >
                <div className="space-y-4 text-sm leading-7 text-black/60">
                  <p>{refundPolicyLabel}</p>
                  <p>
                    You can view listings and full details without logging in. When you click Request Inspection,
                    Keyvera will ask you to sign in before creating the request.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/login?next=/tenant"
                    className="rounded-2xl bg-[#0b1f2a] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/login?next=/tenant&mode=signup"
                    className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-black/[0.03]"
                  >
                    Create Account
                  </Link>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function PropertyCard({
  p,
  onRequest,
  canRequest,
  actionId,
}: {
  p: PropertyRow;
  onRequest: () => void;
  canRequest: boolean;
  actionId: string | null;
}) {
  const loc = [p.area, p.city, p.state].filter(Boolean).join(", ") || "—";
  const rentStr = p.rent_amount_ngn != null ? formatNgn(p.rent_amount_ngn) : "—";
  const fee = Number(p.inspection_fee_ngn || 0);
  const feeStr = fee > 0 ? formatNgn(fee) : "—";
  const busy = actionId === `req:${p.id}`;

  return (
    <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_12px_30px_rgba(11,31,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#0b1f2a]">{p.title}</div>
          <div className="mt-1 text-xs text-black/60">{loc}</div>
        </div>
        <div className="h-9 w-9 shrink-0 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_10px_22px_rgba(10,79,99,0.18)]" />
      </div>

      <div className="mt-4 grid gap-2 text-xs">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-black/50">Rent</div>
            <div className="text-[11px] text-black/40">{p.rent_frequency ?? "—"}</div>
          </div>
          <div className="mt-1 whitespace-nowrap font-semibold tabular-nums leading-tight text-[#0b1f2a]">{rentStr}</div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-black/50">Inspection Fee</div>
            <div className="text-[11px] text-black/40">{p.inspection_fee_validated ? "validated" : "pending"}</div>
          </div>
          <div className="mt-1 whitespace-nowrap font-semibold tabular-nums leading-tight text-[#0b1f2a]">{feeStr}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.property_type ? <InlinePill tone="border-black/10 bg-white/70 text-black/55">{p.property_type}</InlinePill> : null}
        {p.property_class ? <InlinePill tone="border-black/10 bg-white/70 text-black/55">{p.property_class}</InlinePill> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-black/40 font-mono">{shortId(p.id)}</div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/properties/${p.id}`}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-black/[0.03]"
          >
            View Property
          </Link>

          <button
            onClick={onRequest}
            disabled={!canRequest || busy}
            className="rounded-2xl bg-[#0b1f2a] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(11,31,42,0.20)] transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Working…" : "Request Inspection"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecoCard({
  p,
  onRequest,
  canRequest,
  actionId,
}: {
  p: PropertyRow;
  onRequest: () => void;
  canRequest: boolean;
  actionId: string | null;
}) {
  const loc = [p.area, p.city, p.state].filter(Boolean).join(", ") || "—";
  const fee = Number(p.inspection_fee_ngn || 0);
  const feeStr = fee > 0 ? formatNgn(fee) : "—";
  const busy = actionId === `req:${p.id}`;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#0b1f2a]">{p.title}</div>
          <div className="mt-1 text-xs text-black/60">{loc}</div>
          <div className="mt-2 text-xs text-black/60">
            Fee: <span className="whitespace-nowrap font-semibold tabular-nums text-[#0b1f2a]">{feeStr}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Link
            href={`/properties/${p.id}`}
            className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-center text-xs font-semibold text-[#0b1f2a] transition hover:bg-white"
          >
            View
          </Link>

          <button
            onClick={onRequest}
            disabled={!canRequest || busy}
            className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white disabled:opacity-50"
          >
            {busy ? "…" : "Request"}
          </button>
        </div>
      </div>
    </div>
  );
}