"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";

type InspectionRow = {
  id: string;
  property_id: string;
  tenant_user_id: string;
  status: string;
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

export default function AdminInspectionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [propertyMap, setPropertyMap] = useState<Record<string, PropertyMini>>(
    {}
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const paidRows = useMemo(
    () => rows.filter((r) => r.status === "paid" || r.status === "requested"),
    [rows]
  );

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const admin = await requireAdmin();
      if (!admin.ok) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("inspection_requests")
        .select("id,property_id,tenant_user_id,status,inspection_fee_ngn,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = (data ?? []) as InspectionRow[];
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
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inspection queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id: string, status: string) {
    setError(null);
    setUpdatingId(id);

    try {
      const { error } = await supabase
        .from("inspection_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="p-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inspection Requests</h1>
          <p className="mt-2 text-gray-600">
            Internal queue for scheduling and completion.
          </p>
        </div>

        <button
          onClick={load}
          className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b font-semibold">
          All Requests ({rows.length}) — Active ({paidRows.length})
        </div>

        {loading ? (
          <div className="p-6">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-gray-600">No inspection requests.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Property</th>
                <th className="p-3">Location</th>
                <th className="p-3">Fee</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = propertyMap[r.property_id];
                const loc = p
                  ? [p.area, p.city, p.state].filter(Boolean).join(", ")
                  : "-";

                const busy = updatingId === r.id;

                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-semibold">{p?.title ?? r.property_id}</td>
                    <td className="p-3">{loc || "-"}</td>
                    <td className="p-3">
                      ₦{Number(r.inspection_fee_ngn).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 flex gap-2 flex-wrap">
                      {r.status === "paid" && (
                        <button
                          disabled={busy}
                          onClick={() => setStatus(r.id, "scheduled")}
                          className="px-3 py-1.5 rounded-lg bg-black text-white hover:opacity-90 disabled:opacity-60"
                        >
                          {busy ? "Updating..." : "Mark Scheduled"}
                        </button>
                      )}

                      {r.status === "scheduled" && (
                        <button
                          disabled={busy}
                          onClick={() => setStatus(r.id, "completed")}
                          className="px-3 py-1.5 rounded-lg bg-black text-white hover:opacity-90 disabled:opacity-60"
                        >
                          {busy ? "Updating..." : "Mark Completed"}
                        </button>
                      )}

                      {(r.status === "requested" || r.status === "paid") && (
                        <button
                          disabled={busy}
                          onClick={() => setStatus(r.id, "cancelled")}
                          className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
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
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}