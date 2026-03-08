"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Property = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  rent_amount_ngn: number | null;
  status: string;
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

function shortId(id: string) {
  const v = String(id ?? "").trim();
  if (!v) return "";
  return v.length <= 10 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function statusTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "live") return "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]";
  if (s === "approved") return "border-[rgba(10,79,99,0.22)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]";
  if (s === "pending_review") return "border-amber-200 bg-amber-50 text-amber-900";
  if (s === "suspended") return "border-red-200 bg-red-50 text-red-700";
  return "border-black/10 bg-white/70 text-black/60";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {status}
    </span>
  );
}

function SectionShell({
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
    <section className="rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 p-5 md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
}

function DataTableShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-black/10 bg-white">{children}</div>;
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "teal" | "navy" | "amber";
}) {
  const ring =
    tone === "teal"
      ? "border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.06)]"
      : tone === "navy"
      ? "border-black/10 bg-[rgba(11,31,42,0.04)]"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50/70"
      : "border-black/10 bg-white/70";

  const dot =
    tone === "teal"
      ? "bg-[#0ea5a3]"
      : tone === "navy"
      ? "bg-[#0b1f2a]"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-black/40";

  return (
    <div className={`rounded-[22px] border p-5 shadow-[0_12px_30px_rgba(11,31,42,0.06)] backdrop-blur ${ring}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-black/60">{label}</div>
        <span className={`h-2 w-2 rounded-full ${dot}`} style={{ opacity: 0.75 }} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{value}</div>
    </div>
  );
}

export default function LandlordPropertiesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData.user;

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: landlordRow, error: landlordErr } = await supabase
        .from("landlords")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (landlordErr || !landlordRow) {
        setError("Landlord profile not found.");
        setLoading(false);
        return;
      }

      const { data, error: propsErr } = await supabase
        .from("properties")
        .select("id,title,area,city,rent_amount_ngn,status,created_at")
        .eq("owner_landlord_id", landlordRow.id)
        .order("created_at", { ascending: false });

      if (propsErr) {
        setError(propsErr.message);
        setLoading(false);
        return;
      }

      setProperties((data as Property[]) || []);
      setLoading(false);
    }

    load();
  }, [router]);

  const stats = useMemo(() => {
    const total = properties.length;
    const live = properties.filter((p) => String(p.status).toLowerCase() === "live").length;
    const pending = properties.filter((p) => String(p.status).toLowerCase() === "pending_review").length;
    const draft = properties.filter((p) => String(p.status).toLowerCase() === "draft").length;
    return { total, live, pending, draft };
  }, [properties]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-140px)]">
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">My Properties</h1>
              <p className="mt-1 text-sm text-black/60">Manage your listings and review each property’s readiness.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Refresh
          </button>
          <button
            onClick={() => router.push("/landlord/properties/new")}
            className="rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
          >
            + Create Property
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <StatCard label="Total listings" value={String(stats.total)} tone="navy" />
        <StatCard label="Live" value={String(stats.live)} tone="teal" />
        <StatCard label="Pending review" value={String(stats.pending)} tone="amber" />
        <StatCard label="Drafts" value={String(stats.draft)} tone="neutral" />
      </div>

      {error ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {properties.length === 0 ? (
        <SectionShell
          title={<h2 className="text-lg font-semibold text-[#0b1f2a]">No properties yet</h2>}
          subtitle="Create your first listing to start building your landlord pipeline."
          right={
            <button
              onClick={() => router.push("/landlord/properties/new")}
              className="rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
            >
              + Create Property
            </button>
          }
        >
          <div className="p-6 text-sm text-black/60">
            Once you create a property, it will appear here for tracking and review.
          </div>
        </SectionShell>
      ) : (
        <SectionShell
          title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Listings</h2>}
          subtitle="All landlord-owned properties in one clean workspace."
          right={<div className="text-xs text-black/50">Premium listing view</div>}
        >
          <div className="hidden xl:block">
            <DataTableShell>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1160px] text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="px-5 py-4 text-xs font-semibold text-black/60">Title</th>
                      <th className="px-5 py-4 text-xs font-semibold text-black/60">Location</th>
                      <th className="px-5 py-4 text-xs font-semibold text-black/60">Rent</th>
                      <th className="px-5 py-4 text-xs font-semibold text-black/60">Status</th>
                      <th className="px-5 py-4 text-xs font-semibold text-black/60">Created</th>
                      <th className="w-[180px] px-5 py-4"></th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {properties.map((p) => (
                      <tr key={p.id} className="border-t border-black/5 align-top">
                        <td className="px-5 py-5">
                          <div className="font-semibold text-[#0b1f2a]">{p.title}</div>
                          <div className="mt-1 font-mono text-xs text-black/50">{shortId(p.id)}</div>
                        </td>
                        <td className="px-5 py-5 text-black/70">{[p.area, p.city].filter(Boolean).join(", ") || "—"}</td>
                        <td className="px-5 py-5 text-black/70">{formatNgn(p.rent_amount_ngn)}</td>
                        <td className="px-5 py-5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-5 py-5 text-black/60">{formatDt(p.created_at)}</td>
                        <td className="px-5 py-5 text-right">
                          {p.status === "draft" ? (
                            <button
                              onClick={() => router.push(`/landlord/properties/${p.id}/edit`)}
                              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                            >
                              Continue Editing
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push(`/landlord/properties/${p.id}`)}
                              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
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
            </DataTableShell>
          </div>

          <div className="grid gap-4 xl:hidden">
            {properties.map((p) => (
              <article
                key={p.id}
                className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0b1f2a]">{p.title}</div>
                    <div className="mt-1 font-mono text-xs text-black/50">{shortId(p.id)}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Location</div>
                    <div className="mt-1 text-sm text-black/60">{[p.area, p.city].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Rent</div>
                    <div className="mt-1 text-sm text-black/60">{formatNgn(p.rent_amount_ngn)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Created</div>
                    <div className="mt-1 text-sm text-black/60">{formatDt(p.created_at)}</div>
                  </div>
                </div>

                <div className="mt-5">
                  {p.status === "draft" ? (
                    <button
                      onClick={() => router.push(`/landlord/properties/${p.id}/edit`)}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                    >
                      Continue Editing
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/landlord/properties/${p.id}`)}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                    >
                      View
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </SectionShell>
      )}
    </main>
  );
}