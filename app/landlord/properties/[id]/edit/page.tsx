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

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<"draft" | "submit" | null>(
    null
  );
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

  function update<K extends keyof typeof form>(key: K, value: any) {
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

      const { data: landlordRow } = await supabase
        .from("landlords")
        .select("id")
        .eq("user_id", user.id)
        .single();

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
        rent_frequency: data.rent_frequency,
        property_type: data.property_type,
        property_class: data.property_class,
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

      const { error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", propertyId)
        .eq("owner_landlord_id", landlordId);

      if (error) throw error;

      router.push("/landlord/properties");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update property.");
    } finally {
      setSavingAction(null);
    }
  }

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Edit Property</h1>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4">
          <Field label="Title *">
            <input
              className="w-full rounded-xl border p-3"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </Field>

          <Field label="Description *">
            <textarea
              className="w-full rounded-xl border p-3"
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>

          <Field label="Area *">
            <input
              className="w-full rounded-xl border p-3"
              value={form.area}
              onChange={(e) => update("area", e.target.value)}
            />
          </Field>

          <Field label="City *">
            <input
              className="w-full rounded-xl border p-3"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </Field>

          <Field label="Rent Amount (₦) *">
            <input
              type="number"
              className="w-full rounded-xl border p-3"
              value={form.rent_amount_ngn}
              onChange={(e) => update("rent_amount_ngn", e.target.value)}
            />
          </Field>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => save("draft")}
              className="rounded-xl bg-black px-5 py-3 text-white"
            >
              {savingAction === "draft" ? "Saving..." : "Save Draft"}
            </button>

            <button
              onClick={() => save("pending_review")}
              className="rounded-xl border px-5 py-3"
            >
              {savingAction === "submit"
                ? "Submitting..."
                : "Submit for Review"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}