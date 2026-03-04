// app/tenant/inspections/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type InspectionRequestRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;

  paid_at?: string | null;
  payment_reference?: string | null;
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

export default function TenantInspectionsPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<InspectionRequestRow[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, PropertyMini>>({});

  const [actionId, setActionId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<InspectionStatus, number> = {
      requested: 0,
      paid: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      const k = r.status as InspectionStatus;
      if (c[k] != null) c[k] += 1;
    }
    return c;
  }, [rows]);

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
        .select("id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at,paid_at,payment_reference")
        .eq("tenant_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = (data ?? []) as InspectionRequestRow[];
      setRows(list);

      const uniquePropertyIds = Array.from(new Set(list.map((x) => x.property_id)));
      if (uniquePropertyIds.length === 0) {
        setPropertyMap({});
        setLoading(false);
        return;
      }

      const { data: propsData, error: propsErr } = await supabase
        .from("properties")
        .select("id,title,area,city,state")
        .in("id", uniquePropertyIds);

      if (propsErr) throw propsErr;

      const map: Record<string, PropertyMini> = {};
      (propsData ?? []).forEach((p: any) => {
        map[p.id] = p as PropertyMini;
      });
      setPropertyMap(map);

      setLoading(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inspections.");
      setRows([]);
      setPropertyMap({});
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markPaid(id: string) {
    setError(null);
    setActionId(id);

    try {
      const user = await requireUser();
      if (!user) return;

      // Payment provider integration comes later.
      // For now this uses the secured RPC you created:
      // public.tenant_mark_inspection_paid(uuid, text)
      const { error: rpcErr } = await supabase.rpc("tenant_mark_inspection_paid", {
        p_inspection_id: id,
        p_payment_reference: null,
      });

      if (rpcErr) throw rpcErr;

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to mark paid.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Inspections</h1>
          <p className="mt-2 text-sm text-black/60">Requests you’ve made for verified listings.</p>

          {rows.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/70">
              <Pill label={`Requested: ${counts.requested}`} />
              <Pill label={`Paid: ${counts.paid}`} />
              <Pill label={`Scheduled: ${counts.scheduled}`} />
              <Pill label={`Completed: ${counts.completed}`} />
              <Pill label={`Cancelled: ${counts.cancelled}`} />
            </div>
          ) : null}
        </div>

        <button
          onClick={() => router.push("/properties")}
          className="rounded-xl border border-black/15 bg-white px-5 py-3 text-sm hover:bg-black/5"
        >
          Browse listings
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-8 text-sm text-black/60">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white p-10 text-center text-black/60">
          No inspection requests yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5">
              <tr>
                <th className="p-4">Property</th>
                <th className="p-4">Location</th>
                <th className="p-4">Fee</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = propertyMap[r.property_id];
                const loc = p ? [p.area, p.city, p.state].filter(Boolean).join(", ") : "-";
                const busy = actionId === r.id;

                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-4 font-medium">{p?.title ?? r.property_id}</td>
                    <td className="p-4">{loc || "-"}</td>
                    <td className="p-4">{formatNgn(r.inspection_fee_ngn)}</td>
                    <td className="p-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.status === "requested" ? (
                          <button
                            onClick={() => markPaid(r.id)}
                            disabled={busy}
                            className="rounded-lg bg-black px-4 py-2 text-xs text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {busy ? "Working..." : "Mark Paid"}
                          </button>
                        ) : null}

                        <button
                          onClick={() => router.push(`/tenant/inspections/${r.id}`)}
                          className="rounded-lg border px-4 py-2 text-xs hover:bg-black/5"
                          disabled={busy}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="rounded-full border border-black/10 bg-white px-3 py-1">{label}</span>;
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