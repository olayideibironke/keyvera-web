"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  {
    href: "/admin/metrics",
    title: "Metrics",
    description: "Health snapshot across verifications, listings, inspections, and platform movement.",
    badge: "Platform health",
    accent: "teal",
  },
  {
    href: "/admin/agents",
    title: "Agent Verifications",
    description: "Review agent KYC, identity status, and approval readiness with cleaner operational flow.",
    badge: "Identity review",
    accent: "navy",
  },
  {
    href: "/admin/landlords",
    title: "Landlord Verifications",
    description: "Approve landlord identity checks and keep private-by-default verification decisions organized.",
    badge: "KYC decisions",
    accent: "slate",
  },
  {
    href: "/admin/properties",
    title: "Property Approvals",
    description: "Approve listings, validate fee setup, and maintain premium marketplace quality control.",
    badge: "Listing controls",
    accent: "teal-dark",
  },
] as const;

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

type RevenueRulesRow = {
  setting_key: string;
  setting_value: {
    inspection_budget_fee_ngn?: number | string;
    inspection_standard_fee_ngn?: number | string;
    inspection_premium_fee_ngn?: number | string;
    landlord_listing_activation_fee_ngn?: number | string;
    landlord_featured_boost_fee_ngn?: number | string;
    agent_onboarding_fee_ngn?: number | string;
    allow_launch_free_listing?: boolean;
    launch_free_listing_limit?: number | string;
    tenant_refund_policy?: RevenueRules["tenant_refund_policy"];
  } | null;
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

function roleToPath(role: string) {
  if (role === "admin") return "/admin";
  if (role === "landlord") return "/landlord";
  if (role === "agent") return "/agent";
  return "/tenant";
}

function toRules(value: RevenueRulesRow["setting_value"]): RevenueRules {
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

function toPayload(rules: RevenueRules) {
  return {
    inspection_budget_fee_ngn: Number(rules.inspection_budget_fee_ngn || 0),
    inspection_standard_fee_ngn: Number(rules.inspection_standard_fee_ngn || 0),
    inspection_premium_fee_ngn: Number(rules.inspection_premium_fee_ngn || 0),
    landlord_listing_activation_fee_ngn: Number(rules.landlord_listing_activation_fee_ngn || 0),
    landlord_featured_boost_fee_ngn: Number(rules.landlord_featured_boost_fee_ngn || 0),
    agent_onboarding_fee_ngn: Number(rules.agent_onboarding_fee_ngn || 0),
    allow_launch_free_listing: !!rules.allow_launch_free_listing,
    launch_free_listing_limit: Number(rules.launch_free_listing_limit || 0),
    tenant_refund_policy: rules.tenant_refund_policy,
  };
}

function AccentOrb({ tone }: { tone: "teal" | "navy" | "slate" | "teal-dark" }) {
  const bg =
    tone === "teal"
      ? "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(14,165,163,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(10,79,99,0.92),transparent_58%)]"
      : tone === "navy"
      ? "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(11,31,42,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(14,165,163,0.82),transparent_58%)]"
      : tone === "teal-dark"
      ? "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(10,79,99,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(14,165,163,0.82),transparent_58%)]"
      : "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(100,116,139,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(11,31,42,0.82),transparent_58%)]";

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_44px_rgba(11,31,42,0.12)]">
      <div className={`absolute inset-0 ${bg}`} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/0" />
    </div>
  );
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-[11px] font-semibold text-black/55">
      {children}
    </span>
  );
}

function RevenueMetric({
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
    <div className={`rounded-[24px] border p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)] ${ring}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} style={{ opacity: 0.75 }} />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{value}</div>
    </div>
  );
}

function SmallRuleCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
      <div className="text-sm font-semibold text-[#0b1f2a]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-black/55">{body}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-black/20"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-black/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesSaving, setRulesSaving] = useState(false);

  const [rules, setRules] = useState<RevenueRules>(DEFAULT_RULES);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (profileErr || !profile) {
          router.replace("/login");
          return;
        }

        if (profile.role !== "admin") {
          router.replace(roleToPath(profile.role));
          return;
        }

        setAuthorized(true);

        const { data: settingsRow, error: settingsErr } = await supabase
          .from("platform_settings")
          .select("setting_key,setting_value")
          .eq("setting_key", "revenue_rules")
          .maybeSingle();

        if (settingsErr) throw settingsErr;

        if (settingsRow) {
          setRules(toRules((settingsRow as RevenueRulesRow).setting_value));
        } else {
          setRules(DEFAULT_RULES);
        }
      } catch (e: any) {
        if (!authorized) {
          router.replace("/login");
          return;
        }
        setSaveError(e?.message ?? "Failed to load revenue rules.");
      } finally {
        setRulesLoading(false);
        setLoading(false);
      }
    })();
  }, [router, pathname]);

  const refundPolicyLabel = useMemo(() => {
    if (rules.tenant_refund_policy === "review") return "Refunds reviewed case-by-case";
    if (rules.tenant_refund_policy === "credit_or_reschedule") return "Credit or reschedule first";
    return "Restricted after scheduling";
  }, [rules.tenant_refund_policy]);

  function updateRule<K extends keyof RevenueRules>(key: K, value: RevenueRules[K]) {
    setRules((prev) => ({ ...prev, [key]: value }));
    setSaveMessage(null);
    setSaveError(null);
  }

  async function saveRules() {
    setRulesSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const payload = toPayload(rules);

      const { error } = await supabase.from("platform_settings").upsert(
        {
          setting_key: "revenue_rules",
          setting_value: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      );

      if (error) throw error;

      setSaveMessage("Revenue rules saved successfully.");
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save revenue rules.");
    } finally {
      setRulesSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-black/60">Loading admin…</div>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <section className="rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <AccentOrb tone="teal" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge>Admin control center</SectionBadge>
                  <SectionBadge>Premium operations</SectionBadge>
                  <SectionBadge>Revenue rules</SectionBadge>
                </div>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">
                  Admin Overview
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">
                  Verify identities, approve properties, monitor platform health, and control the paid marketplace rules
                  that make Keyvera a serious, trust-first rental business.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-auto">
            <Link
              href="/admin/metrics"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#0b1f2a] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(11,31,42,0.22)] transition hover:shadow-[0_22px_56px_rgba(11,31,42,0.28)]"
            >
              Open Metrics
            </Link>

            <Link
              href="/admin/agents"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] shadow-[0_14px_36px_rgba(11,31,42,0.08)] transition hover:bg-white hover:shadow-[0_18px_46px_rgba(11,31,42,0.12)]"
            >
              Process Verifications
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Priority</div>
            <div className="mt-2 text-sm font-semibold text-[#0b1f2a]">Verification and listing quality</div>
            <div className="mt-1 text-sm text-black/55">Keep agent, landlord, and property review queues clean.</div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Focus</div>
            <div className="mt-2 text-sm font-semibold text-[#0b1f2a]">Inspection workflow visibility</div>
            <div className="mt-1 text-sm text-black/55">Use metrics to track conversion, velocity, and completion health.</div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Standard</div>
            <div className="mt-2 text-sm font-semibold text-[#0b1f2a]">Premium marketplace discipline</div>
            <div className="mt-1 text-sm text-black/55">Every admin surface should feel polished, deliberate, and scalable.</div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SectionBadge>Revenue & platform rules</SectionBadge>
              <SectionBadge>Launch model</SectionBadge>
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#0b1f2a]">
              Keyvera Paid Marketplace Rules
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">
              Browsing stays free, but verified marketplace actions carry a fee to reduce fraud, filter unserious
              activity, and maintain a more structured Lagos rental process.
            </p>
          </div>

          <button
            type="button"
            onClick={saveRules}
            disabled={rulesLoading || rulesSaving}
            className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(10,79,99,0.24)] transition hover:shadow-[0_22px_56px_rgba(10,79,99,0.30)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rulesSaving ? "Saving Rules..." : "Save Rules"}
          </button>
        </div>

        {saveMessage ? (
          <div className="mt-5 rounded-[22px] border border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.08)] p-4 text-sm text-[#0a4f63]">
            {saveMessage}
          </div>
        ) : null}

        {saveError ? (
          <div className="mt-5 rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {saveError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <RevenueMetric label="Budget inspection" value={`₦${Number(rules.inspection_budget_fee_ngn || 0).toLocaleString()}`} tone="amber" />
          <RevenueMetric label="Standard inspection" value={`₦${Number(rules.inspection_standard_fee_ngn || 0).toLocaleString()}`} tone="teal" />
          <RevenueMetric label="Premium inspection" value={`₦${Number(rules.inspection_premium_fee_ngn || 0).toLocaleString()}`} tone="navy" />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <RevenueMetric
            label="Listing activation"
            value={`₦${Number(rules.landlord_listing_activation_fee_ngn || 0).toLocaleString()}`}
            tone="navy"
          />
          <RevenueMetric
            label="Featured boost"
            value={`₦${Number(rules.landlord_featured_boost_fee_ngn || 0).toLocaleString()}`}
            tone="teal"
          />
          <RevenueMetric
            label="Agent onboarding"
            value={`₦${Number(rules.agent_onboarding_fee_ngn || 0).toLocaleString()}`}
            tone="amber"
          />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-sm font-semibold text-[#0b1f2a]">Launch fee controls</div>
            <div className="mt-1 text-sm text-black/55">Set the starting prices for Keyvera’s paid marketplace model.</div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <LabeledInput
                label="Budget inspection fee (₦)"
                value={rules.inspection_budget_fee_ngn}
                onChange={(value) => updateRule("inspection_budget_fee_ngn", value)}
              />

              <LabeledInput
                label="Standard inspection fee (₦)"
                value={rules.inspection_standard_fee_ngn}
                onChange={(value) => updateRule("inspection_standard_fee_ngn", value)}
              />

              <LabeledInput
                label="Premium inspection fee (₦)"
                value={rules.inspection_premium_fee_ngn}
                onChange={(value) => updateRule("inspection_premium_fee_ngn", value)}
              />

              <LabeledInput
                label="Listing activation fee (₦)"
                value={rules.landlord_listing_activation_fee_ngn}
                onChange={(value) => updateRule("landlord_listing_activation_fee_ngn", value)}
              />

              <LabeledInput
                label="Featured listing fee (₦)"
                value={rules.landlord_featured_boost_fee_ngn}
                onChange={(value) => updateRule("landlord_featured_boost_fee_ngn", value)}
              />

              <LabeledInput
                label="Agent onboarding fee (₦)"
                value={rules.agent_onboarding_fee_ngn}
                onChange={(value) => updateRule("agent_onboarding_fee_ngn", value)}
              />

              <LabeledSelect
                label="Launch free listing"
                value={rules.allow_launch_free_listing ? "yes" : "no"}
                onChange={(value) => updateRule("allow_launch_free_listing", value === "yes")}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />

              <LabeledInput
                label="Free listing limit"
                value={rules.launch_free_listing_limit}
                onChange={(value) => updateRule("launch_free_listing_limit", value)}
              />

              <div className="md:col-span-2">
                <LabeledSelect
                  label="Tenant refund policy"
                  value={rules.tenant_refund_policy}
                  onChange={(value) =>
                    updateRule("tenant_refund_policy", value as RevenueRules["tenant_refund_policy"])
                  }
                  options={[
                    { value: "review", label: "Review case-by-case" },
                    { value: "credit_or_reschedule", label: "Credit or reschedule first" },
                    { value: "restricted_after_scheduling", label: "Restricted after scheduling" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <SmallRuleCard
              title="Tenant rule"
              body="Browsing is free. Payment starts when a tenant enters the verified inspection workflow."
            />
            <SmallRuleCard
              title="Landlord rule"
              body="Account creation and drafting can stay free, but live listings should require activation fees."
            />
            <SmallRuleCard
              title="Agent rule"
              body="Agents can join free, but professional participation begins after paid onboarding and approval."
            />
            <SmallRuleCard title="Refund rule" body={refundPolicyLabel} />
            <SmallRuleCard
              title="Launch logic"
              body={
                rules.allow_launch_free_listing
                  ? `Allow ${rules.launch_free_listing_limit || "0"} early-access free live listing(s) before standard paid activation.`
                  : "No free live listings. Every live property requires paid activation."
              }
            />
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
          <div className="text-sm font-semibold text-[#0b1f2a]">Official trust-positioning message</div>
          <div className="mt-3 rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            Browsing is free. Verified marketplace actions carry a fee to reduce fraud, filter unserious activity,
            and protect users inside a more structured rental process.
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl transition hover:bg-white hover:shadow-[0_22px_58px_rgba(11,31,42,0.14)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold text-black/55">
                  {item.badge}
                </span>

                <h2 className="mt-4 text-lg font-semibold tracking-tight text-[#0b1f2a]">
                  {item.title}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-black/60">
                  {item.description}
                </p>
              </div>

              <div className="shrink-0 pt-0.5">
                <AccentOrb tone={item.accent} />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
                Open workspace
              </div>
              <div className="inline-flex items-center rounded-full border border-black/10 bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#0b1f2a] transition group-hover:bg-[#0b1f2a] group-hover:text-white">
                Open
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}