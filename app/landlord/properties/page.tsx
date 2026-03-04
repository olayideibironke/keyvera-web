"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Property = {
  id: string;
  title: string;
  area: string;
  city: string;
  rent_amount_ngn: number;
  status: string;
  created_at: string;
};

export default function LandlordPropertiesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);

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

      const { data, error } = await supabase
        .from("properties")
        .select("id,title,area,city,rent_amount_ngn,status,created_at")
        .eq("owner_landlord_id", landlordRow.id)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setProperties(data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">My Properties</h1>

        <button
          onClick={() => router.push("/landlord/properties/new")}
          className="rounded-xl bg-black px-6 py-3 text-sm text-white hover:opacity-90"
        >
          + Create Property
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="rounded-xl border border-black/10 p-8 text-center text-black/60">
          No properties yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5">
              <tr>
                <th className="p-4">Title</th>
                <th className="p-4">Location</th>
                <th className="p-4">Rent</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-4">{p.title}</td>
                  <td className="p-4">
                    {p.area}, {p.city}
                  </td>
                  <td className="p-4">₦{p.rent_amount_ngn.toLocaleString()}</td>
                  <td className="p-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="p-4 text-right">
                    {p.status === "draft" ? (
                      <button
                        onClick={() =>
                          router.push(`/landlord/properties/${p.id}/edit`)
                        }
                        className="rounded-lg border px-4 py-2 text-xs hover:bg-black/5"
                      >
                        Continue Editing
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          router.push(`/landlord/properties/${p.id}`)
                        }
                        className="rounded-lg border px-4 py-2 text-xs hover:bg-black/5"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending_review: "bg-yellow-100 text-yellow-700",
    approved: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    suspended: "bg-red-100 text-red-700",
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