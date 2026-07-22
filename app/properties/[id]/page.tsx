"use client";

import Link from "next/link";
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
  inspection_fee_validated?: boolean | null;
  created_at: string;
  status: string;
};

type InspectionInsertResult = {
  id: string;
};

function formatNgn(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_24px_rgba(11,31,42,0.04)]">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">{label}</div>
      <div className="mt-2 text-sm font-medium text-[#0b1f2a]">{children}</div>
    </div>
  );
}

export default function PublicPropertyDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const propertyId = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<PublicProperty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const location = useMemo(() => {
    if (!row) return "—";
    return [row.area, row.city, row.state, row.country].filter(Boolean).join(", ") || "—";
  }, [row]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id,title,description,address_line,area,city,state,country,rent_amount_ngn,rent_frequency,property_type,property_class,inspection_fee_ngn,inspection_fee_validated,created_at,status"
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

      const { data, error: rpcErr } = await supabase.rpc("tenant_request_inspection", {
        p_property_id: row.id,
        p_fee_ngn: fee,
      });

      if (!rpcErr && data) {
        router.push(`/tenant/inspections/${String(data)}`);
        return;
      }

      const { data: insertedData, error: insertErr } = await supabase
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

      const inserted = insertedData as InspectionInsertResult;
      router.push(`/tenant/inspections/${inserted.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to request inspection.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#0b1f2a] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#0ea5a3]" style={{ opacity: 0.75 }} />
              Public property detail
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0b1f2a]">Listing Details</h1>
            <p className="mt-1 text-sm text-black/60">Full advertised property details are open before signup.</p>
          </div>

          <Link
            href="/tenant"
            className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-[#0b1f2a] shadow-sm transition hover:bg-black/[0.03]"
          >
            Back to listings
          </Link>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)]">
            Loading property…
          </div>
        ) : row ? (
          <section className="overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-[0_16px_46px_rgba(11,31,42,0.10)]">
            <div
              className="p-8 md:p-10"
              style={{
                background:
                  "radial-gradient(820px 360px at 12% 0%, rgba(14,165,163,0.16), rgba(255,255,255,0) 60%), radial-gradient(700px 320px at 88% 0%, rgba(11,31,42,0.10), rgba(255,255,255,0) 58%)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-3xl">
                  <h2 className="text-3xl font-extrabold tracking-tight text-[#0b1f2a] md:text-4xl">{row.title}</h2>
                  <p className="mt-3 text-base leading-8 text-black/65">{location}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#0b1f2a]">
                    {row.property_class ?? "standard"}
                  </span>
                  <span className="rounded-full border border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.08)] px-4 py-2 text-xs font-semibold text-[#0a4f63]">
                    {row.inspection_fee_validated ? "Inspection validated" : "Inspection pending"}
                  </span>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <Info label="Rent">
                  {formatNgn(row.rent_amount_ngn)}{" "}
                  <span className="text-black/50">/ {row.rent_frequency ?? "—"}</span>
                </Info>

                <Info label="Property Type">{row.property_type ?? "—"}</Info>

                <Info label="Inspection Fee">{formatNgn(row.inspection_fee_ngn)}</Info>

                <Info label="Listed">{formatDate(row.created_at)}</Info>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Info label="Public Address">
                  {row.address_line ? row.address_line : "Area-level location shown. Exact address shared after booking."}
                </Info>

                <Info label="Status">{row.status}</Info>
              </div>

              <div className="mt-8 rounded-[24px] border border-black/10 bg-white/80 p-6 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-black/45">Description</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/75">{row.description ?? "No description provided yet."}</p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={requestInspection}
                  disabled={requesting}
                  className={[
                    "rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition",
                    requesting
                      ? "bg-black/60"
                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]",
                  ].join(" ")}
                >
                  {requesting ? "Requesting..." : "Request Inspection"}
                </button>

                <span className="text-xs leading-6 text-black/50">
                  You can view this listing without signing in. Login starts only when you request inspection.
                </span>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}