"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type InspectionRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;
};

type PropertyMini = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  state: string | null;
};

function formatNgn(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatDt(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortId(id: string) {
  const v = String(id ?? "").trim();
  if (!v) return "";
  return v.length <= 10 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function statusTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "requested") return "border-amber-200 bg-amber-50 text-amber-900";
  if (s === "paid") return "border-[rgba(10,79,99,0.22)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]";
  if (s === "scheduled") return "border-black/10 bg-[rgba(11,31,42,0.06)] text-[#0b1f2a]";
  if (s === "completed") return "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]";
  if (s === "cancelled") return "border-red-200 bg-red-50 text-red-700";
  return "border-black/10 bg-white/70 text-black/60";
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

function InlinePill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
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

export default function TenantInspectionDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const inspectionId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [row, setRow] = useState<InspectionRow | null>(null);
  const [property, setProperty] = useState<PropertyMini | null>(null);
  const [action, setAction] = useState<null | "pay" | "cancel">(null);

  const isBusy = loading || action !== null;

  const location = useMemo(() => {
    if (!property) return "—";
    return [property.area, property.city, property.state].filter(Boolean).join(", ") || "—";
  }, [property]);

  async function requireUser() {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/tenant/inspections")}`);
      return null;
    }
    return user;
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const user = await requireUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("inspection_requests")
        .select("id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at")
        .eq("id", inspectionId)
        .eq("tenant_user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setRow(null);
        setProperty(null);
        setError("Inspection request not found.");
        setLoading(false);
        return;
      }

      const ir = data as InspectionRow;
      setRow(ir);

      const { data: propData, error: propErr } = await supabase
        .from("properties")
        .select("id,title,area,city,state")
        .eq("id", ir.property_id)
        .maybeSingle();

      if (!propErr && propData) setProperty(propData as PropertyMini);

      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setRow(null);
      setProperty(null);
      setError(e?.message ?? "Failed to load inspection request.");
    }
  }

  useEffect(() => {
    if (inspectionId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId]);

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    if (paymentState === "success") {
      setNotice("Stripe payment completed. Webhook confirmation is the next step we will wire up.");
    } else if (paymentState === "cancelled") {
      setNotice("Payment was cancelled before completion.");
    } else {
      setNotice(null);
    }
  }, [searchParams]);

  async function startStripeCheckout() {
    if (!row) return;
    if (row.status !== "requested") return;

    setAction("pay");
    setError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Tenant session not available.");
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inspectionRequestId: row.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to start Stripe checkout.");
      }

      const checkoutUrl = String(payload?.checkoutUrl || "").trim();
      if (!checkoutUrl) {
        throw new Error("Stripe checkout URL was not returned.");
      }

      window.location.href = checkoutUrl;
    } catch (e: any) {
      setError(e?.message ?? "Failed to start Stripe checkout.");
      setAction(null);
    }
  }

  async function cancelRequest() {
    if (!row) return;
    if (row.status !== "requested") return;

    setAction("cancel");
    setError(null);

    try {
      const user = await requireUser();
      if (!user) return;

      const { error } = await supabase
        .from("inspection_requests")
        .update({ status: "cancelled" })
        .eq("id", row.id)
        .eq("tenant_user_id", user.id);

      if (error) throw error;

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to cancel request.");
    } finally {
      setAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Inspection</h1>
                <p className="mt-1 text-sm text-black/60">Pay the fee to move forward. Scheduling comes after payment.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => router.push("/tenant/inspections")}>Back</GhostButton>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {notice ? (
          <div className="mb-6 rounded-[22px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-4 text-sm text-[#0a4f63]">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
            Loading…
          </div>
        ) : row ? (
          <>
            <SectionCard
              title={<h2 className="text-xl font-semibold text-[#0b1f2a]">{property?.title ?? "Inspection request"}</h2>}
              subtitle="Review the request details and complete the next action."
              right={<InlinePill tone={statusTone(row.status)}>{row.status}</InlinePill>}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HeroStat label="Inspection Fee" value={formatNgn(row.inspection_fee_ngn)} />
                <HeroStat label="Requested At" value={formatDt(row.created_at)} />
                <HeroStat label="Inspection ID" value={shortId(row.id)} />
                <HeroStat label="Location" value={location} />
              </div>
            </SectionCard>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <SectionCard
                title={<h3 className="text-lg font-semibold text-[#0b1f2a]">Request Details</h3>}
                subtitle="Core details for this inspection request."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Property">{property?.title ?? row.property_id}</InfoCard>
                  <InfoCard label="Location">{location}</InfoCard>
                  <InfoCard label="Status">
                    <InlinePill tone={statusTone(row.status)}>{row.status}</InlinePill>
                  </InfoCard>
                  <InfoCard label="Created">{formatDt(row.created_at)}</InfoCard>
                </div>
              </SectionCard>

              <SectionCard
                title={<h3 className="text-lg font-semibold text-[#0b1f2a]">Next Step</h3>}
                subtitle="The workflow advances after payment."
              >
                {row.status === "requested" ? (
                  <div>
                    <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      This inspection is waiting for payment. Once Stripe checkout succeeds, the next step is webhook confirmation.
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <PrimaryButton onClick={startStripeCheckout} disabled={isBusy}>
                        {action === "pay" ? "Redirecting..." : "Pay Inspection Fee"}
                      </PrimaryButton>

                      <GhostButton onClick={cancelRequest} disabled={isBusy}>
                        {action === "cancel" ? "Cancelling..." : "Cancel"}
                      </GhostButton>
                    </div>

                    <div className="mt-4 text-xs text-black/50">
                      You’ll be redirected to secure Stripe Checkout.
                    </div>
                  </div>
                ) : null}

                {row.status === "paid" ? (
                  <div className="rounded-[22px] border border-[rgba(10,79,99,0.18)] bg-[rgba(10,79,99,0.06)] p-4 text-sm text-[#0a4f63]">
                    Payment received. Next step: inspection scheduling and agent assignment.
                  </div>
                ) : null}

                {row.status === "scheduled" ? (
                  <div className="rounded-[22px] border border-black/10 bg-[rgba(11,31,42,0.04)] p-4 text-sm text-[#0b1f2a]">
                    This inspection has been scheduled. Watch your inspection queue for updates.
                  </div>
                ) : null}

                {row.status === "completed" ? (
                  <div className="rounded-[22px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-4 text-sm text-[#0a4f63]">
                    This inspection has been completed.
                  </div>
                ) : null}

                {row.status === "cancelled" ? (
                  <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    This request was cancelled.
                  </div>
                ) : null}
              </SectionCard>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}