"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PropertyStatus = "draft" | "pending_review";

function t(v: string) {
  return v.trim();
}

function isPositiveNumberString(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
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
  tone: "error" | "warn" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
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

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [landlordId, setLandlordId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    address_line: "",
    area: "",
    city: "",
    state: "",
    country: "",
    rent_amount_ngn: "",
    rent_frequency: "yearly",
    property_type: "apartment",
    property_class: "standard",
    status: "draft" as PropertyStatus,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const missingRequired = useMemo(() => {
    return (
      !t(form.title) ||
      !t(form.description) ||
      !t(form.area) ||
      !t(form.city) ||
      !t(form.state) ||
      !t(form.country) ||
      !isPositiveNumberString(form.rent_amount_ngn)
    );
  }, [form]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: landlordRow } = await supabase.from("landlords").select("id").eq("user_id", user.id).single();

      if (!landlordRow) {
        setError("Landlord profile not found.");
        setLoading(false);
        return;
      }

      setLandlordId(landlordRow.id);

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("owner_landlord_id", landlordRow.id)
        .single();

      if (error || !data) {
        setError("Property not found.");
        setLoading(false);
        return;
      }

      setForm({
        title: data.title || "",
        description: data.description || "",
        address_line: data.address_line || "",
        area: data.area || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "",
        rent_amount_ngn: String(data.rent_amount_ngn || ""),
        rent_frequency: data.rent_frequency || "yearly",
        property_type: data.property_type || "apartment",
        property_class: data.property_class || "standard",
        status: data.status,
      });

      setLoading(false);
    }

    if (propertyId) load();
  }, [propertyId, router]);

  async function save(status: PropertyStatus) {
    if (!landlordId) return;

    if (status === "pending_review" && missingRequired) {
      setError("Complete all required fields before submitting.");
      return;
    }

    setSavingAction(status === "draft" ? "draft" : "submit");
    setError(null);

    try {
      const payload = {
        title: t(form.title),
        description: t(form.description),
        address_line: t(form.address_line) || null,
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

      const { error } = await supabase.from("properties").update(payload).eq("id", propertyId).eq("owner_landlord_id", landlordId);

      if (error) throw error;

      router.push("/landlord/properties");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update property.");
    } finally {
      setSavingAction(null);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Loading…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SectionCard
        title={<h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Edit Property</h1>}
        subtitle="Update your draft details, then save changes or submit for review."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => router.push("/landlord/properties")} disabled={savingAction !== null}>
              Back
            </GhostButton>
            <StatPill tone={form.status === "draft" ? "warn" : "neutral"}>{form.status}</StatPill>
          </div>
        }
      >
        {error ? (
          <div className="mb-5">
            <Message tone="error">{error}</Message>
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <StatPill tone={missingRequired ? "warn" : "good"}>
            {missingRequired ? "Required fields missing" : "Ready to submit"}
          </StatPill>
          <StatPill>Property ID: {propertyId}</StatPill>
        </div>

        <div className="grid gap-5">
          <Field label="Title" required>
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </Field>

          <Field label="Description" required>
            <textarea
              className="min-h-[150px] w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
              rows={5}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>

          <Field label="Address Line">
            <input
              className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
              value={form.address_line}
              onChange={(e) => update("address_line", e.target.value)}
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Area" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
              />
            </Field>

            <Field label="City" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>

            <Field label="State" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </Field>

            <Field label="Country" required>
              <input
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </Field>

            <Field label="Rent Amount (₦)" required>
              <input
                type="number"
                className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.35)] focus:ring-4 focus:ring-[rgba(14,165,163,0.10)]"
                value={form.rent_amount_ngn}
                onChange={(e) => update("rent_amount_ngn", e.target.value)}
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
            <PrimaryButton onClick={() => save("draft")} disabled={savingAction !== null}>
              {savingAction === "draft" ? "Saving..." : "Save Draft"}
            </PrimaryButton>

            <GhostButton onClick={() => save("pending_review")} disabled={savingAction !== null}>
              {savingAction === "submit" ? "Submitting..." : "Submit for Review"}
            </GhostButton>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}