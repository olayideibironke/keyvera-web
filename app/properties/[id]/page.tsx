// app/properties/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PublicProperty = {
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
  inspection_fee_ngn: number | null;
  created_at: string;
  status: string;
};

type InspectionInsertResult = {
  id: string;
};

export default function PublicPropertyDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const propertyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<PublicProperty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const location = useMemo(() => {
    if (!row) return "-";
    return [row.area, row.city, row.state, row.country].filter(Boolean).join(", ") || "-";
  }, [row]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id,title,description,address_line,area,city,state,country,rent_amount_ngn,rent_frequency,property_type,property_class,inspection_fee_ngn,created_at,status"
        )
        .eq("id", propertyId)
        .eq("status", "live")
        .maybeSingle();

      if (error) {
        setError(error.message);
        setRow(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Listing not found.");
        setRow(null);
        setLoading(false);
        return;
      }

      setRow(data as PublicProperty);
      setLoading(false);
    }

    if (propertyId) load();
  }, [propertyId]);

  async function requestInspection() {
    if (!row) return;

    setError(null);
    setRequesting(true);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || `/properties/${row.id}`)}`);
        return;
      }

      const fee = Number(row.inspection_fee_ngn ?? 0);
      if (!Number.isFinite(fee) || fee <= 0) {
        setError("Inspection fee is not available yet for this listing. Please try again later.");
        return;
      }

      const { data, error: insertErr } = await supabase
        .from("inspection_requests")
        .insert({
          property_id: row.id,
          tenant_user_id: user.id,
          status: "requested",
          inspection_fee_ngn: fee,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const inserted = data as InspectionInsertResult;
      router.push(`/tenant/inspections/${inserted.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to request inspection.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Listing</h1>
          <p className="mt-1 text-sm text-black/60">Verified rentals by Keyvera.</p>
        </div>

        <button
          onClick={() => router.push("/properties")}
          className="rounded-xl border border-black/15 bg-white px-5 py-3 text-sm hover:bg-black/5"
        >
          Back to listings
        </button>
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
              <p className="mt-2 text-sm text-black/70">{location}</p>
            </div>

            <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs">
              {row.property_class ?? "standard"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Info label="Rent">
              {row.rent_amount_ngn != null ? `₦${row.rent_amount_ngn.toLocaleString()}` : "-"}{" "}
              <span className="text-black/50">/ {row.rent_frequency ?? "-"}</span>
            </Info>

            <Info label="Property Type">{row.property_type ?? "-"}</Info>

            <Info label="Public Address">
              {row.address_line ? row.address_line : "Area-level location shown. Exact address shared after booking."}
            </Info>

            <Info label="Inspection Fee (platform-controlled)">
              {row.inspection_fee_ngn != null ? `₦${row.inspection_fee_ngn.toLocaleString()}` : "-"}
            </Info>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-medium">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">{row.description ?? "-"}</p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={requestInspection}
              disabled={requesting}
              className={[
                "rounded-xl px-6 py-3 text-sm text-white",
                requesting ? "bg-black/60" : "bg-black hover:opacity-90",
              ].join(" ")}
            >
              {requesting ? "Requesting..." : "Request Inspection"}
            </button>

            <span className="text-xs text-black/50">You’ll be taken to payment & scheduling after request.</span>
          </div>
        </div>
      ) : null}
    </main>
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