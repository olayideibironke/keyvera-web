"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatNgn(n?: number | null) {
  if (!n) return "—";
  return `₦${Number(n).toLocaleString()}`;
}

function formatDt(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "live") return "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]";
  if (s === "approved") return "border-[rgba(10,79,99,0.22)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]";
  if (s === "pending_review") return "border-amber-200 bg-amber-50 text-amber-900";
  if (s === "suspended") return "border-red-200 bg-red-50 text-red-700";
  if (s === "archived") return "border-black/10 bg-white/70 text-black/60";
  return "border-black/10 bg-white/70 text-black/60";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {status}
    </span>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white/80 p-4 shadow-[0_12px_30px_rgba(11,31,42,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">{label}</div>
      <div className="mt-2 text-sm text-[#0b1f2a]">{children}</div>
    </div>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white/75 p-4 shadow-[0_12px_30px_rgba(11,31,42,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[#0b1f2a]">{value}</div>
    </div>
  );
}

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

  const locationLabel = useMemo(() => {
    if (!row) return "—";
    return [row.area, row.city, row.state, row.country].filter(Boolean).join(", ") || "—";
  }, [row]);

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Property</h1>
              <p className="mt-1 text-sm text-black/60">Detailed listing view for your landlord workspace.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push("/landlord/properties")}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Back
          </button>

          {row?.status === "draft" ? (
            <button
              onClick={() => router.push(`/landlord/properties/${row.id}/edit`)}
              className="rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
            >
              Edit Draft
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Loading…
        </div>
      ) : row ? (
        <>
          <section className="rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.status} />
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-xs font-semibold text-black/55">
                    {row.property_class ?? "standard"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-xs font-semibold text-black/55">
                    {row.property_type ?? "property"}
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">{row.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">{locationLabel}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                <HeroStat
                  label="Rent"
                  value={`${formatNgn(row.rent_amount_ngn)}${row.rent_frequency ? ` / ${row.rent_frequency}` : ""}`}
                />
                <HeroStat label="Inspection fee" value={formatNgn(row.inspection_fee_ngn)} />
                <HeroStat label="Created" value={formatDt(row.created_at)} />
                <HeroStat
                  label="Fee validation"
                  value={row.inspection_fee_validated ? "Validated" : "Not validated"}
                />
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
              <div className="text-lg font-semibold text-[#0b1f2a]">Description</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-black/75">{row.description ?? "—"}</p>
            </section>

            <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
              <div className="text-lg font-semibold text-[#0b1f2a]">Property details</div>

              <div className="mt-4 grid gap-4">
                <InfoCard label="Address Line">{row.address_line ?? "—"}</InfoCard>
                <InfoCard label="Area">{row.area ?? "—"}</InfoCard>
                <InfoCard label="City">{row.city ?? "—"}</InfoCard>
                <InfoCard label="State">{row.state ?? "—"}</InfoCard>
                <InfoCard label="Country">{row.country ?? "—"}</InfoCard>
              </div>
            </section>
          </div>

          {row.status === "pending_review" ? (
            <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              This property is pending review. Editing is disabled until admin action.
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}