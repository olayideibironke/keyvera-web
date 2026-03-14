"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PropertyStatus = "draft" | "pending_review";

type LandlordRow = {
  id: string;
  user_id: string;
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

const REQUIRED_FIELDS = [
  "title",
  "description",
  "area",
  "city",
  "state",
  "country",
  "rent_amount_ngn",
  "rent_frequency",
  "property_type",
  "property_class",
] as const;

function t(v: string) {
  return v.trim();
}

function isPositiveNumberString(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function formatNgn(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

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

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </main>
  );
}

function SectionCard({
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
    <section className="rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-black/10 bg-white/75 text-black/55";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

function Message({
  tone,
  children,
}: {
  tone: "error" | "warn" | "info" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
      ? "border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] text-[#0a4f63]"
      : "border-black/10 bg-white/70 text-black/70";

  return <div className={`rounded-[24px] border p-4 text-sm ${cls}`}>{children}</div>;
}

function GhostButton({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#0b1f2a]">
        {label}
        {required ? <span className="ml-1 text-[#0a4f63]">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-2 text-xs text-black/45">{hint}</p> : null}
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

export default function LandlordCreatePropertyPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<"draft" | "submit" | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [landlordProfileMissing, setLandlordProfileMissing] = useState(false);

  const [propertyId, setPropertyId] = useState<string | null>(null);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [rules, setRules] = useState<RevenueRules>(DEFAULT_RULES);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [usedFreeLiveListings, setUsedFreeLiveListings] = useState(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    address_line: "",
    area: "",
    city: "",
    state: "",
    country: "Nigeria",
    rent_amount_ngn: "",
    rent_frequency: "yearly",
    property_type: "apartment",
    property_class: "standard",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const missingRequired = useMemo(() => {
    const missing: Array<(typeof REQUIRED_FIELDS)[number]> = [];

    for (const k of REQUIRED_FIELDS) {
      const v = (form as any)[k];

      if (k === "rent_amount_ngn") {
        if (!isPositiveNumberString(String(v ?? ""))) missing.push(k);
        continue;
      }

      if (typeof v === "string") {
        if (!t(v)) missing.push(k);
        continue;
      }

      if (v == null) missing.push(k);
    }

    return missing;
  }, [form]);

  const isBusy = loading || savingAction !== null;

  const canSaveDraft = useMemo(() => {
    if (isBusy) return false;
    if (!userId) return false;
    if (!landlordId || landlordProfileMissing) return false;
    if (!t(form.description)) return false;
    return true;
  }, [isBusy, userId, landlordId, landlordProfileMissing, form.description]);

  const canSubmit = useMemo(() => {
    if (isBusy) return false;
    if (!userId) return false;
    if (!landlordId || landlordProfileMissing) return false;
    if (missingRequired.length > 0) return false;
    return true;
  }, [isBusy, userId, landlordId, landlordProfileMissing, missingRequired.length]);

  const listingActivationFee = useMemo(
    () => Number(rules.landlord_listing_activation_fee_ngn || 0),
    [rules.landlord_listing_activation_fee_ngn]
  );

  const featuredBoostFee = useMemo(
    () => Number(rules.landlord_featured_boost_fee_ngn || 0),
    [rules.landlord_featured_boost_fee_ngn]
  );

  const freeListingLimit = useMemo(
    () => Math.max(0, Number(rules.launch_free_listing_limit || 0)),
    [rules.launch_free_listing_limit]
  );

  const freeListingEnabled = !!rules.allow_launch_free_listing;

  const freeListingsRemaining = useMemo(() => {
    if (!freeListingEnabled) return 0;
    return Math.max(0, freeListingLimit - usedFreeLiveListings);
  }, [freeListingEnabled, freeListingLimit, usedFreeLiveListings]);

  const listingRuleMessage = useMemo(() => {
    if (freeListingEnabled) {
      if (freeListingsRemaining > 0) {
        return `Drafting and review submission are free. You still have ${freeListingsRemaining} free live listing slot(s) remaining before paid listing activation applies.`;
      }
      return `Drafting and review submission are free. Your free live listing allocation has been exhausted, so live marketplace activation will require ${formatNgn(
        listingActivationFee
      )}.`;
    }

    return `Drafting and review submission are free. Live marketplace activation requires ${formatNgn(
      listingActivationFee
    )}.`;
  }, [freeListingEnabled, freeListingsRemaining, listingActivationFee]);

  async function getAuthoritativeUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user ?? null;
  }

  async function fetchLandlordRowByUserId(authUid: string): Promise<LandlordRow | null> {
    const { data, error } = await supabase.from("landlords").select("id, user_id").eq("user_id", authUid).maybeSingle();

    if (error) throw error;
    return (data as LandlordRow) ?? null;
  }

  async function ensureLandlordRow(authUid: string): Promise<LandlordRow | null> {
    const existing = await fetchLandlordRowByUserId(authUid);
    if (existing) return existing;

    const { data, error } = await supabase.from("landlords").insert({ user_id: authUid }).select("id, user_id").maybeSingle();

    if (error) throw error;
    if (data) return data as LandlordRow;

    return await fetchLandlordRowByUserId(authUid);
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

  async function loadUsedFreeLiveListings(currentLandlordId: string) {
    try {
      const { count, error } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_landlord_id", currentLandlordId)
        .in("status", ["approved", "live"]);

      if (error) throw error;
      setUsedFreeLiveListings(Number(count ?? 0));
    } catch {
      setUsedFreeLiveListings(0);
    }
  }

  async function init() {
    setLoading(true);
    setPageError(null);
    setLandlordProfileMissing(false);

    try {
      const user = await getAuthoritativeUser();

      if (!user) {
        setUserId(null);
        setUserEmail(null);
        setLandlordId(null);
        setLandlordProfileMissing(true);
        setPageError("You are not logged in. Please login as a landlord.");
        setLoading(false);

        router.replace(`/login?next=${encodeURIComponent(pathname || "/landlord/properties/new")}`);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const landlord = await ensureLandlordRow(user.id);

      if (!landlord?.id) {
        setLandlordId(null);
        setLandlordProfileMissing(true);
        setLoading(false);
        setPageError(
          "Landlord profile could not be accessed. This is usually a Row Level Security (RLS) policy issue on landlords."
        );
        return;
      }

      setLandlordId(landlord.id);
      setLandlordProfileMissing(false);

      await Promise.all([loadRevenueRules(), loadUsedFreeLiveListings(landlord.id)]);

      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setLandlordId(null);
      setLandlordProfileMissing(true);
      setPageError(e?.message ?? "Failed to load landlord session/profile.");
    }
  }

  function buildPayload(status: PropertyStatus) {
    return {
      owner_landlord_id: landlordId as string,
      created_by_user_id: userId as string,
      title: t(form.title),
      description: t(form.description),
      address_line: t(form.address_line) ? t(form.address_line) : null,
      area: t(form.area),
      city: t(form.city),
      state: t(form.state),
      country: t(form.country),
      rent_amount_ngn: Number(form.rent_amount_ngn),
      rent_frequency: form.rent_frequency,
      property_type: form.property_type,
      property_class: form.property_class,
      status,
      inspection_fee_ngn: 0,
      inspection_fee_validated: false,
    };
  }

  async function saveDraft() {
    if (!canSaveDraft) return;

    setSavingAction("draft");
    setPageError(null);

    try {
      const payload = buildPayload("draft");

      if (!propertyId) {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;
        setPropertyId(data.id);
      } else {
        const { error } = await supabase.from("properties").update(payload).eq("id", propertyId);
        if (error) throw error;
      }
    } catch (e: any) {
      setPageError(e?.message ?? "Failed to save draft.");
    } finally {
      setSavingAction(null);
    }
  }

  async function submitForReview() {
    setAttemptedSubmit(true);
    if (!canSubmit) return;

    setSavingAction("submit");
    setPageError(null);

    try {
      const payload = buildPayload("pending_review");

      if (!propertyId) {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;
        setPropertyId(data.id);
      } else {
        const { error } = await supabase.from("properties").update(payload).eq("id", propertyId);
        if (error) throw error;
      }

      router.push("/landlord/properties");
    } catch (e: any) {
      setPageError(e?.message ?? "Failed to submit property.");
    } finally {
      setSavingAction(null);
    }
  }

  useEffect(() => {
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      init();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showRequiredWarning = attemptedSubmit && !loading && missingRequired.length > 0;

  return (
    <PageShell>
      <SectionCard
        title={<h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Create Property</h1>}
        subtitle="Create your draft, then submit for review. Going live in the marketplace follows Keyvera’s listing activation rules."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => router.push("/landlord/properties")} disabled={isBusy}>
              Back
            </GhostButton>
            <StatPill tone={propertyId ? "good" : "neutral"}>{propertyId ? "Draft created" : "New listing"}</StatPill>
          </div>
        }
      >
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <StatPill tone={loading ? "neutral" : landlordProfileMissing ? "warn" : "good"}>
            {loading ? "Checking session…" : landlordProfileMissing ? "Landlord profile missing" : "Landlord access ready"}
          </StatPill>
          {userEmail ? <StatPill>Logged in as {userEmail}</StatPill> : null}
          {propertyId ? <StatPill>Draft ID: {propertyId}</StatPill> : null}
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <MetricCard label="Listing activation" value={formatNgn(listingActivationFee)} tone="navy" />
          <MetricCard label="Featured boost" value={formatNgn(featuredBoostFee)} tone="teal" />
          <MetricCard label="Free live slots left" value={String(freeListingsRemaining)} tone="amber" />
          <MetricCard label="Rules status" value={rulesLoaded ? "Live" : "Loading"} tone="neutral" />
        </div>

        <div className="mb-5">
          <Message tone="info">{listingRuleMessage}</Message>
        </div>

        <div className="mb-5">
          <Message tone="warn">
            Submitting for review does not automatically make this listing live. Admin review, fee validation, and live marketplace activation still happen afterward.
          </Message>
        </div>

        {pageError ? (
          <div className="mb-5">
            <Message tone="error">{pageError}</Message>
          </div>
        ) : null}

        {landlordProfileMissing ? (
          <div className="mb-5">
            <Message tone="warn">Missing landlord profile — you can’t create properties yet.</Message>
          </div>
        ) : null}

        {showRequiredWarning ? (
          <div className="mb-5">
            <Message tone="error">Please complete all required fields before submitting for review.</Message>
          </div>
        ) : null}

        <div className="grid gap-5">
          <Field label="Title" required hint="Use a clear market-facing title for the listing.">
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g., 2 Bedroom Apartment in Lekki Phase 1"
            />
          </Field>

          <Field label="Description" required hint="Describe the condition, layout, features, and rules.">
            <textarea
              className="min-h-[150px] w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Rooms, features, condition, rules, what’s included…"
            />
            {!t(form.description) && !loading ? <p className="mt-2 text-xs text-red-700">Description is required.</p> : null}
          </Field>

          <Field label="Address Line" hint="Optional. Public address can remain limited until booking.">
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
              value={form.address_line}
              onChange={(e) => update("address_line", e.target.value)}
              placeholder="e.g., Surulere (public address hidden until booking)"
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Area" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="e.g., Ijesha"
              />
            </Field>

            <Field label="City" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="e.g., Surulere"
              />
            </Field>

            <Field label="State" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                placeholder="e.g., Lagos"
              />
            </Field>

            <Field label="Country" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="e.g., Nigeria"
              />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Rent Amount (₦)" required>
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.rent_amount_ngn}
                onChange={(e) => update("rent_amount_ngn", e.target.value)}
                placeholder="e.g., 3500000"
                min={0}
              />
            </Field>

            <Field label="Rent Frequency" required>
              <select
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.rent_frequency}
                onChange={(e) => update("rent_frequency", e.target.value as any)}
              >
                <option value="yearly">yearly</option>
                <option value="monthly">monthly</option>
                <option value="weekly">weekly</option>
                <option value="daily">daily</option>
              </select>
            </Field>

            <Field label="Property Type" required>
              <select
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.property_type}
                onChange={(e) => update("property_type", e.target.value as any)}
              >
                <option value="apartment">apartment</option>
                <option value="house">house</option>
                <option value="studio">studio</option>
                <option value="duplex">duplex</option>
                <option value="room">room</option>
              </select>
            </Field>

            <Field label="Property Class" required>
              <select
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.property_class}
                onChange={(e) => update("property_class", e.target.value as any)}
              >
                <option value="standard">standard</option>
                <option value="premium">premium</option>
                <option value="luxury">luxury</option>
              </select>
            </Field>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={saveDraft} disabled={!canSaveDraft}>
              {savingAction === "draft" ? "Saving..." : "Save Draft"}
            </PrimaryButton>

            <GhostButton onClick={submitForReview} disabled={!canSubmit}>
              {savingAction === "submit" ? "Submitting..." : "Submit for Review"}
            </GhostButton>
          </div>

          <div className="rounded-[22px] border border-black/10 bg-white/80 p-4 text-sm text-black/60">
            Drafts are free. Review submission is free. Marketplace activation happens later and follows the current landlord pricing rules.
          </div>

          {loading ? <p className="text-sm text-black/60">Loading…</p> : null}
        </div>
      </SectionCard>
    </PageShell>
  );
}
