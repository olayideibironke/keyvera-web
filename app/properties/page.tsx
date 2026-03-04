"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LiveProperty = {
  id: string;
  title: string;
  description: string | null;
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
};

export default function LivePropertiesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LiveProperty[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id,title,description,area,city,state,country,rent_amount_ngn,rent_frequency,property_type,property_class,inspection_fee_ngn,created_at"
        )
        .eq("status", "live")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as LiveProperty[]);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Verified Rentals
          </h1>
          <p className="mt-2 text-sm text-black/70">
            Live listings with controlled inspection fees.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 text-sm text-black/60">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-black/10 p-10 text-center text-black/60">
          No live listings yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/properties/${p.id}`)}
              className="text-left rounded-3xl border border-black/10 bg-white p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug">
                  {p.title}
                </h2>
                <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs">
                  {p.property_class ?? "standard"}
                </span>
              </div>

              <p className="mt-2 text-sm text-black/70 line-clamp-3">
                {p.description ?? "No description provided."}
              </p>

              <div className="mt-4 text-sm text-black/70">
                <div>
                  <span className="font-medium text-black">Location:</span>{" "}
                  {[p.area, p.city, p.state].filter(Boolean).join(", ") || "-"}
                </div>
                <div className="mt-1">
                  <span className="font-medium text-black">Rent:</span>{" "}
                  {p.rent_amount_ngn
                    ? `₦${p.rent_amount_ngn.toLocaleString()}`
                    : "-"}{" "}
                  <span className="text-black/50">
                    / {p.rent_frequency ?? "-"}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="font-medium text-black">
                    Inspection Fee:
                  </span>{" "}
                  {p.inspection_fee_ngn
                    ? `₦${p.inspection_fee_ngn.toLocaleString()}`
                    : "-"}
                </div>
              </div>

              <div className="mt-5 inline-flex items-center rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-medium hover:bg-black/5">
                View Listing →
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}