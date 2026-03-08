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

function Card({
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
    <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function InlinePill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
}

function MetricCard({
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

function EmptyBox({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
      <div className="font-semibold text-[#0b1f2a]">{title}</div>
      {body ? <div className="mt-1 text-black/60">{body}</div> : null}
    </div>
  );
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
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_14px_34px_rgba(10,79,99,0.22)]" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">My Inspections</h1>
                <p className="mt-1 text-sm text-black/60">Requests you’ve made for verified listings.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={load}>Refresh</GhostButton>
            <GhostButton onClick={() => router.push("/tenant")}>Tenant Home</GhostButton>
            <PrimaryButton onClick={() => router.push("/tenant")}>Browse Listings</PrimaryButton>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-5">
          <MetricCard label="Total" value={String(rows.length)} tone="navy" />
          <MetricCard label="Requested" value={String(counts.requested)} tone="amber" />
          <MetricCard label="Paid" value={String(counts.paid)} tone="teal" />
          <MetricCard label="Scheduled" value={String(counts.scheduled)} tone="navy" />
          <MetricCard label="Completed" value={String(counts.completed)} tone="teal" />
        </div>

        {error ? (
          <div className="mb-6 rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <Card
            title={<h2 className="text-lg font-semibold text-[#0b1f2a]">No inspection requests yet</h2>}
            subtitle="Once you request inspections, they will appear here for tracking."
            right={<PrimaryButton onClick={() => router.push("/tenant")}>Browse Listings</PrimaryButton>}
          >
            <EmptyBox title="No inspections yet" body="Request an inspection from any verified property in the marketplace." />
          </Card>
        ) : (
          <Card
            title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Inspection Queue</h2>}
            subtitle="Review each request and continue the payment step when required."
            right={<InlinePill tone="border-black/10 bg-white/70 text-black/55">{rows.length} items</InlinePill>}
          >
            <div className="hidden xl:block">
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] text-left text-sm">
                    <thead className="bg-gradient-to-b from-black/5 to-black/0">
                      <tr>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Property</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Location</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Fee</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Status</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Created</th>
                        <th className="px-5 py-4 text-xs font-semibold text-black/60">Paid</th>
                        <th className="w-[220px] px-5 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const p = propertyMap[r.property_id];
                        const loc = p ? [p.area, p.city, p.state].filter(Boolean).join(", ") : "—";
                        const busy = actionId === r.id;

                        return (
                          <tr key={r.id} className="border-t border-black/5 align-top">
                            <td className="px-5 py-5">
                              <div className="font-semibold text-[#0b1f2a]">{p?.title ?? "Property"}</div>
                              <div className="mt-1 font-mono text-xs text-black/50">{shortId(r.id)}</div>
                            </td>
                            <td className="px-5 py-5 text-black/70">{loc || "—"}</td>
                            <td className="px-5 py-5 text-black/70">{formatNgn(r.inspection_fee_ngn)}</td>
                            <td className="px-5 py-5">
                              <InlinePill tone={statusTone(r.status)}>{r.status}</InlinePill>
                            </td>
                            <td className="px-5 py-5 text-black/60">{formatDt(r.created_at)}</td>
                            <td className="px-5 py-5 text-black/60">{formatDt(r.paid_at)}</td>
                            <td className="px-5 py-5 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {r.status === "requested" ? (
                                  <PrimaryButton onClick={() => markPaid(r.id)} disabled={busy} className="px-4 py-2.5 text-xs">
                                    {busy ? "Working..." : "Mark Paid"}
                                  </PrimaryButton>
                                ) : null}

                                <GhostButton
                                  onClick={() => router.push(`/tenant/inspections/${r.id}`)}
                                  disabled={busy}
                                  className="px-4 py-2.5 text-xs"
                                >
                                  View
                                </GhostButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:hidden">
              {rows.map((r) => {
                const p = propertyMap[r.property_id];
                const loc = p ? [p.area, p.city, p.state].filter(Boolean).join(", ") : "—";
                const busy = actionId === r.id;

                return (
                  <article
                    key={r.id}
                    className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_12px_30px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0b1f2a]">{p?.title ?? "Property"}</div>
                        <div className="mt-1 font-mono text-xs text-black/50">{shortId(r.id)}</div>
                      </div>
                      <InlinePill tone={statusTone(r.status)}>{r.status}</InlinePill>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Location</div>
                        <div className="mt-1 text-sm text-black/60">{loc || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Fee</div>
                        <div className="mt-1 text-sm text-black/60">{formatNgn(r.inspection_fee_ngn)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Created</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Paid</div>
                        <div className="mt-1 text-sm text-black/60">{formatDt(r.paid_at)}</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {r.status === "requested" ? (
                        <PrimaryButton onClick={() => markPaid(r.id)} disabled={busy} className="px-4 py-3 text-xs">
                          {busy ? "Working..." : "Mark Paid"}
                        </PrimaryButton>
                      ) : null}

                      <GhostButton onClick={() => router.push(`/tenant/inspections/${r.id}`)} disabled={busy} className="px-4 py-3 text-xs">
                        View
                      </GhostButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}