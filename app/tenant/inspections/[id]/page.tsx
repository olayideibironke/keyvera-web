// app/tenant/inspections/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
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

export default function TenantInspectionDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const inspectionId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<InspectionRow | null>(null);
  const [property, setProperty] = useState<PropertyMini | null>(null);
  const [action, setAction] = useState<null | "pay" | "cancel">(null);

  const isBusy = loading || action !== null;

  const location = useMemo(() => {
    if (!property) return "-";
    return [property.area, property.city, property.state].filter(Boolean).join(", ") || "-";
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

  async function markAsPaid() {
    if (!row) return;
    if (row.status !== "requested") return;

    setAction("pay");
    setError(null);

    try {
      const user = await requireUser();
      if (!user) return;

      // Placeholder: we simulate payment completion.
      // Later: integrate payment provider + reference + paid_at.
      const { error } = await supabase
        .from("inspection_requests")
        .update({ status: "paid" })
        .eq("id", row.id)
        .eq("tenant_user_id", user.id);

      if (error) throw error;

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to process payment.");
    } finally {
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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inspection</h1>
          <p className="mt-2 text-sm text-black/60">Pay the fee to move forward. Scheduling comes after payment.</p>
        </div>

        <button
          onClick={() => router.push("/tenant/inspections")}
          className="rounded-xl border border-black/15 bg-white px-5 py-3 text-sm hover:bg-black/5"
        >
          Back
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-8 text-sm text-black/60">Loading…</div>
      ) : row ? (
        <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-black/50">Inspection ID</div>
              <div className="mt-1 font-mono text-xs">{row.id}</div>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Info label="Property">{property?.title ?? row.property_id}</Info>
            <Info label="Location">{location}</Info>
            <Info label="Inspection Fee">{formatNgn(row.inspection_fee_ngn)}</Info>
            <Info label="Requested At">{new Date(row.created_at).toLocaleString()}</Info>
          </div>

          {row.status === "requested" ? (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={markAsPaid}
                disabled={isBusy}
                className="rounded-xl bg-black px-6 py-3 text-sm text-white hover:opacity-90 disabled:opacity-60"
              >
                {action === "pay" ? "Processing..." : "Pay Inspection Fee"}
              </button>

              <button
                onClick={cancelRequest}
                disabled={isBusy}
                className="rounded-xl border border-black/15 bg-white px-6 py-3 text-sm hover:bg-black/5 disabled:opacity-60"
              >
                {action === "cancel" ? "Cancelling..." : "Cancel"}
              </button>

              <span className="text-xs text-black/50">Payment integration comes next (provider + reference).</span>
            </div>
          ) : null}

          {row.status === "paid" ? (
            <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              Payment received. Next step: we’ll let you pick an inspection schedule (and assign an agent).
            </div>
          ) : null}

          {row.status === "cancelled" ? (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              This request was cancelled.
            </div>
          ) : null}
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}