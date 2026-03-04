// app/landlord/properties/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PropertyStatus = "draft" | "pending_review";

type LandlordRow = {
  id: string;
  user_id: string;
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

export default function LandlordCreatePropertyPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<"draft" | "submit" | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // MUST be landlords.id (FK used by properties.owner_landlord_id)
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [landlordProfileMissing, setLandlordProfileMissing] = useState(false);

  const [propertyId, setPropertyId] = useState<string | null>(null);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

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
    // Project rule: description required
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

  async function getAuthoritativeUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user ?? null;
  }

  async function fetchLandlordRowByUserId(authUid: string): Promise<LandlordRow | null> {
    const { data, error } = await supabase
      .from("landlords")
      .select("id, user_id")
      .eq("user_id", authUid)
      .maybeSingle();

    if (error) throw error;
    return (data as LandlordRow) ?? null;
  }

  async function ensureLandlordRow(authUid: string): Promise<LandlordRow | null> {
    const existing = await fetchLandlordRowByUserId(authUid);
    if (existing) return existing;

    const { data, error } = await supabase
      .from("landlords")
      .insert({ user_id: authUid })
      .select("id, user_id")
      .maybeSingle();

    if (error) throw error;
    if (data) return data as LandlordRow;

    return await fetchLandlordRowByUserId(authUid);
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
      // landlord-locked
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="rounded-3xl border border-black/15 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Create Property</h1>
        <p className="mt-2 text-sm text-black/70">
          Add your listing details, save as draft, then submit for review. Inspection fees are set internally by Keyvera
          after review.
        </p>

        {pageError ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        ) : null}

        {landlordProfileMissing ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Missing landlord profile — you can’t create properties yet.
          </div>
        ) : null}

        {showRequiredWarning ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Please complete all required fields before submitting for review.
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-5">
          <Field label="Title *">
            <input
              className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g., 2 Bedroom Apartment in Lekki Phase 1"
            />
          </Field>

          <Field label="Description *">
            <textarea
              className="min-h-[140px] w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Rooms, features, condition, rules, what’s included…"
            />
            {!t(form.description) && !loading ? (
              <p className="mt-2 text-xs text-red-700">Description is required.</p>
            ) : null}
          </Field>

          <Field label="Address Line (optional)">
            <input
              className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
              value={form.address_line}
              onChange={(e) => update("address_line", e.target.value)}
              placeholder="e.g., Surulere (public address hidden until booking)"
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Area *">
              <input
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="e.g., Ijesha"
              />
            </Field>

            <Field label="City *">
              <input
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="e.g., Surulere"
              />
            </Field>

            <Field label="State *">
              <input
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                placeholder="e.g., Lagos"
              />
            </Field>

            <Field label="Country *">
              <input
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="e.g., Nigeria"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Rent Amount (₦) *">
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                value={form.rent_amount_ngn}
                onChange={(e) => update("rent_amount_ngn", e.target.value)}
                placeholder="e.g., 3500000"
                min={0}
              />
            </Field>

            <Field label="Rent Frequency *">
              <select
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
                value={form.rent_frequency}
                onChange={(e) => update("rent_frequency", e.target.value as any)}
              >
                <option value="yearly">yearly</option>
                <option value="monthly">monthly</option>
                <option value="weekly">weekly</option>
                <option value="daily">daily</option>
              </select>
            </Field>

            <Field label="Property Type *">
              <select
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
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

            <Field label="Property Class *">
              <select
                className="w-full rounded-xl border border-black/20 px-4 py-3 outline-none focus:border-black"
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
            <button
              type="button"
              disabled={!canSaveDraft}
              onClick={saveDraft}
              className={[
                "rounded-xl px-6 py-3 text-sm font-medium",
                canSaveDraft ? "bg-black text-white hover:bg-black/90" : "cursor-not-allowed bg-black/50 text-white",
              ].join(" ")}
            >
              {savingAction === "draft" ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submitForReview}
              className={[
                "rounded-xl border px-6 py-3 text-sm font-medium",
                canSubmit
                  ? "border-black/25 bg-white text-black hover:bg-black/5"
                  : "cursor-not-allowed border-black/15 bg-white text-black/40",
              ].join(" ")}
            >
              {savingAction === "submit" ? "Submitting..." : "Submit for Review"}
            </button>

            {propertyId ? (
              <span className="text-xs text-black/60">
                Draft ID: <span className="font-mono">{propertyId}</span>
              </span>
            ) : null}
          </div>

          {loading ? <p className="text-sm text-black/60">Loading…</p> : null}
          {userEmail ? <p className="text-xs text-black/40">Logged in as: {userEmail}</p> : null}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}