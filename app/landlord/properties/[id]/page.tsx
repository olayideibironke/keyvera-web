"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PropertyRow = {
  id: string;
  title: string;
  description: string | null;
  address_line: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  rent_amount_ngn: number | null;
  rent_frequency: string | null;
  property_type: string | null;
  property_class: string | null;
  status: string;
  inspection_fee_ngn: number | null;
  inspection_fee_validated: boolean;
  created_at: string;
};

export default function LandlordPropertyViewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const propertyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<PropertyRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/landlord/properties")}`);
      return;
    }

    const { data: landlordRow, error: landlordErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (landlordErr || !landlordRow?.id) {
      setError(landlordErr?.message ?? "Landlord profile not found.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("properties")
      .select(
        "id,title,description,address_line,area,city,state,country,rent_amount_ngn,rent_frequency,property_type,property_class,status,inspection_fee_ngn,inspection_fee_validated,created_at"
      )
      .eq("id", propertyId)
      .eq("owner_landlord_id", landlordRow.id)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setError("Property not found.");
      setLoading(false);
      return;
    }

    setRow(data as PropertyRow);
    setLoading(false);
  }

  useEffect(() => {
    if (!propertyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Property</h1>
          <p className="mt-1 text-sm text-black/60">View listing details.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/landlord/properties")}
            className="rounded-xl border border-black/15 bg-white px-5 py-3 text-sm hover:bg-black/5"
          >
            Back
          </button>

          {row?.status === "draft" ? (
            <button
              onClick={() => router.push(`/landlord/properties/${row.id}/edit`)}
              className="rounded-xl bg-black px-6 py-3 text-sm text-white hover:opacity-90"
            >
              Edit Draft
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-8 text-sm text-black/60">Loading…</div>
      ) : row ? (
        <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{row.title}</h2>
              <p className="mt-2 text-sm text-black/70">
                {[row.area, row.city, row.state, row.country].filter(Boolean).join(", ") || "-"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={row.status} />
              <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs">
                {row.property_class ?? "standard"}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Info label="Rent">
              {row.rent_amount_ngn != null ? `₦${row.rent_amount_ngn.toLocaleString()}` : "-"}{" "}
              <span className="text-black/50">/ {row.rent_frequency ?? "-"}</span>
            </Info>

            <Info label="Property Type">{row.property_type ?? "-"}</Info>

            <Info label="Address Line">{row.address_line ?? "-"}</Info>

            <Info label="Inspection Fee (platform-controlled)">
              {row.inspection_fee_ngn != null ? `₦${row.inspection_fee_ngn.toLocaleString()}` : "—"}
              <span className="ml-2 text-xs text-black/50">
                {row.inspection_fee_validated ? "(validated)" : "(not validated)"}
              </span>
            </Info>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-medium">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">
              {row.description ?? "-"}
            </p>
          </div>

          {row.status === "pending_review" ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This property is pending review. Editing is disabled until admin action.
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    live: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
    archived: "bg-gray-100 text-gray-700",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-medium text-black/60">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}