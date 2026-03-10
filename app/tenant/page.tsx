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
  scheduled_by_user_id?: string | null;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
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

export default function TenantPortalPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("checking");
  const [tenantUserId, setTenantUserId] = useState<string | null>(null);

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
  const PAGE_SIZE = 12;

  const [propsLoading, setPropsLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [recoLoading, setRecoLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<PropertyRow[]>([]);

  const [reqLoading, setReqLoading] = useState(true);
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
    query = query.range(from, to);

    return query;
  }

  async function loadProperties() {
    setPropsLoading(true);
    try {
      const { data, error, count } = await buildPropertyQuery();
      if (error) throw error;

      const list = (data ?? []) as PropertyRow[];
      setProperties(list);
      setTotalCount(Number(count ?? 0));
    } catch (e: any) {
      setProperties([]);
      setTotalCount(0);
      setErrorMsg(e?.message ?? "Failed to load listings (check RLS policy on properties).");
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
      const filtered = raw.filter((p) => !excludeIds.includes(p.id)).slice(0, 4);
      setRecommendations(filtered);
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
          "id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,scheduled_at,scheduled_by_user_id,completed_at,completed_by_user_id,payment_reference,paid_at"
        )
        .eq("tenant_user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests((data ?? []) as InspectionRow[]);
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

      if (!user) {
        setRequests([]);
        setProperties([]);
        setRecommendations([]);
        setTotalCount(0);
        return;
      }

      setPage(1);
      await Promise.all([loadMyRequests(user.id)]);
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
    if (bootLoading || viewMode !== "private") return;
    loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootLoading, viewMode, page, q, city, area, minRent, maxRent, type, sort]);

  useEffect(() => {
    if (bootLoading || viewMode !== "private") return;
    const exclude = properties.map((p) => p.id);
    loadRecommendations(exclude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootLoading, viewMode, properties]);

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
      const user = await resolveTenantAccess();
      if (!user) return;

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
      await loadMyRequests(user.id);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to request inspection.");
    } finally {
      setActionId(null);
    }
  }

  function goToInspectionPayment(requestId: string) {
    router.push(`/tenant/inspections/${requestId}`);
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

  if (viewMode === "checking") {
    return null;
  }

  if (viewMode === "public") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
        <div className="mx-auto max-w-7xl px-6 py-10">
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
                  Welcome to Keyvera for Tenants
                </div>

                <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-[#0b1f2a] md:text-5xl">
                  Discover verified homes and rent with more confidence on Keyvera.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-black/65">
                  Browse validated listings, understand inspection fees clearly, and move through a more professional rental
                  workflow designed to reduce confusion and improve trust.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <LandingPrimaryLink href="/login?next=/tenant">Sign In</LandingPrimaryLink>
                  <LandingSecondaryLink href="/login?next=/tenant&mode=signup">Sign Up</LandingSecondaryLink>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Listings</div>
                    <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Verified visibility</div>
                    <div className="mt-1 text-xs leading-6 text-black/55">
                      Browse rental options with clearer signals around status and inspection readiness.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Inspections</div>
                    <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Transparent next steps</div>
                    <div className="mt-1 text-xs leading-6 text-black/55">
                      Request inspections with more structured fee handling and cleaner progress tracking.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Trust</div>
                    <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">Safer marketplace feel</div>
                    <div className="mt-1 text-xs leading-6 text-black/55">
                      Move through a platform built around verification, accountability, and reduced rental noise.
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
                  <div className="text-sm font-semibold text-[#0b1f2a]">What tenants get</div>

                  <div className="mt-5 space-y-4">
                    <LandingInfoCard
                      title="Professional sign in and onboarding"
                      body="Create your tenant account and access a cleaner rental browsing and inspection workflow."
                    />
                    <LandingInfoCard
                      title="Search with stronger signals"
                      body="Browse live listings with inspection fee readiness, property type, area, city, and pricing filters."
                    />
                    <LandingInfoCard
                      title="Track your inspection journey"
                      body="See requested, paid, scheduled, and completed inspections from one tenant dashboard."
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <InlinePill tone="border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] text-[#0a4f63]">
                Paid trust-first workflow
              </InlinePill>
              <InlinePill tone="border-black/10 bg-white/80 text-black/60">
                Admin-controlled launch pricing
              </InlinePill>
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0b1f2a]">
              Browsing is free. Verified inspection access carries a fee.
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">
              Keyvera is not a free-for-all marketplace. Fees help reduce fraud, filter unserious activity, and keep the
              rental process more structured for serious tenants, landlords, and agents.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <MetricCard label="Budget inspection" value={formatNgn(pricingSummary.budget)} tone="amber" />
              <MetricCard label="Standard inspection" value={formatNgn(pricingSummary.standard)} tone="teal" />
              <MetricCard label="Premium inspection" value={formatNgn(pricingSummary.premium)} tone="navy" />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
                <div className="text-sm font-semibold text-[#0b1f2a]">How tenant pricing works</div>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-black/60">
                  <p>Account creation is free. Browsing public listings is free.</p>
                  <p>
                    Payment starts only when you enter a verified inspection workflow for a property.
                  </p>
                  <p>
                    The final inspection fee shown on a property is the active marketplace amount for that listing.
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
                <div className="text-sm font-semibold text-[#0b1f2a]">Refund policy</div>
                <div className="mt-3 text-sm leading-relaxed text-black/60">{refundPolicyLabel}</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Tenant Marketplace</h1>
                <p className="mt-1 text-sm text-black/60">Browse verified listings and request inspections.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={loadAll}>Refresh</GhostButton>
            <button
              onClick={() => router.push("/")}
              className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              Home
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-[24px] border border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.06)] p-4 text-sm text-[#0a4f63]">
          Browsing stays free. Inspection payment begins only when you enter a verified property inspection workflow.
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <MetricCard label="My inspections" value={String(requestCounts.total)} tone="navy" />
          <MetricCard label="Requested" value={String(requestCounts.requested)} tone="amber" />
          <MetricCard label="Paid / Scheduled" value={`${requestCounts.paid + requestCounts.scheduled}`} tone="teal" />
          <MetricCard label="Completed" value={String(requestCounts.completed)} tone="teal" />
        </div>

        <div className="mb-6 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <Card
            title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Launch inspection pricing</h2>}
            subtitle="Current platform-guided tenant pricing from admin settings."
            right={
              <InlinePill tone="border-black/10 bg-white/70 text-black/55">
                {rulesLoaded ? "Live rules loaded" : "Loading rules..."}
              </InlinePill>
            }
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Budget" value={formatNgn(pricingSummary.budget)} tone="amber" />
              <MetricCard label="Standard" value={formatNgn(pricingSummary.standard)} tone="teal" />
              <MetricCard label="Premium" value={formatNgn(pricingSummary.premium)} tone="navy" />
            </div>
          </Card>

          <Card
            title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Tenant policy</h2>}
            subtitle="Marketplace trust and fee logic."
          >
            <div className="space-y-3 text-sm leading-relaxed text-black/60">
              <p>Keyvera uses paid inspection access to reduce fake demand and keep the process serious.</p>
              <p>{refundPolicyLabel}</p>
            </div>
          </Card>
        </div>

        {errorMsg ? (
          <div className="mb-6 rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
        ) : null}

        {toastMsg ? (
          <div className="mb-6 rounded-[22px] border border-green-200 bg-green-50 p-4 text-sm text-green-800">{toastMsg}</div>
        ) : null}

        <Card
          title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Search & Filters</h2>}
          subtitle="Find listings by location, rent range, and type."
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
                  placeholder="Title keywords (e.g., duplex, 2 bedroom...)"
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
              <label className="mb-2 block text-xs font-semibold text-black/60">Min Rent (₦)</label>
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
              <label className="mb-2 block text-xs font-semibold text-black/60">Max Rent (₦)</label>
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
                <option value="rent_low">Rent (Low → High)</option>
                <option value="rent_high">Rent (High → Low)</option>
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
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">{isSearching ? "Results" : "Featured"}</h2>}
              subtitle={isSearching ? `${totalCount.toLocaleString()} listings found` : "Verified listings ready for inspection."}
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
                  body="If you have live + validated properties in DB, this is almost always an RLS SELECT policy issue on public.properties."
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
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#0b1f2a]">You may also like</h3>
                    <div className="mt-1 text-xs text-black/50">Additional verified options.</div>
                  </div>
                </div>

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

            <Card
              title={<h2 className="text-lg font-semibold text-[#0b1f2a]">My Inspections</h2>}
              subtitle="Track requests, payments, scheduling, and completion."
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <StatChip label="Total" value={requestCounts.total} />
                  <StatChip label="Requested" value={requestCounts.requested} />
                  <StatChip label="Paid" value={requestCounts.paid} />
                  <GhostButton
                    onClick={async () => {
                      setErrorMsg(null);
                      setToastMsg(null);
                      const user = await resolveTenantAccess();
                      if (!user) return;
                      await loadMyRequests(user.id);
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
                    const busy = actionId === `pay:${r.id}`;

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
                                onClick={() => goToInspectionPayment(r.id)}
                                disabled={busy}
                                className="rounded-2xl bg-[#0b1f2a] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {busy ? "Working…" : "Pay Now"}
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

              <div className="mt-4 text-xs text-black/50">
                Requested inspections now route into Stripe Checkout from the detail page.
              </div>
            </Card>
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
        {p.property_type ? (
          <InlinePill tone="border-black/10 bg-white/70 text-black/55">{p.property_type}</InlinePill>
        ) : null}
        {p.property_class ? (
          <InlinePill tone="border-black/10 bg-white/70 text-black/55">{p.property_class}</InlinePill>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="text-[11px] text-black/40 font-mono">{shortId(p.id)}</div>

        <button
          onClick={onRequest}
          disabled={!canRequest || busy}
          className="rounded-2xl bg-[#0b1f2a] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(11,31,42,0.20)] transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Request Inspection"}
        </button>
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

        <button
          onClick={onRequest}
          disabled={!canRequest || busy}
          className="shrink-0 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white disabled:opacity-50"
        >
          {busy ? "…" : "Request"}
        </button>
      </div>
    </div>
  );
}