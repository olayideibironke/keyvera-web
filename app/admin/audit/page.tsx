// app/admin/audit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  before: any | null;
  after: any | null;
  created_at: string;
};

type DiffItem = {
  type: "added" | "removed" | "changed";
  path: string;
  before?: any;
  after?: any;
};

function BadgeIcon({ size = 44 }: { size?: number }) {
  // Premium + neutral + consistent (no ribbons, no blobs)
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function fmtDate(x: string) {
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortId(id: string) {
  const s = String(id || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function pillTone(action: string) {
  const a = String(action || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold";
  if (a.includes("suspend")) return `${base} border-red-200 bg-red-50 text-red-700`;
  if (a.includes("disable")) return `${base} border-red-200 bg-red-50 text-red-700`;
  if (a.includes("approve") || a.includes("verify") || a.includes("enable")) {
    return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  }
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function safeJsonString(x: any) {
  try {
    if (x == null) return "—";
    return JSON.stringify(x, null, 2);
  } catch {
    return "—";
  }
}

function jsonPreview(x: any) {
  try {
    if (x == null) return "—";
    const s = JSON.stringify(x, null, 2);
    if (s.length <= 280) return s;
    return `${s.slice(0, 280)}…`;
  } catch {
    return "—";
  }
}

function isPlainObject(x: any) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function stableVal(x: any) {
  // stringify for stable comparison for primitives/objects/arrays
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function diffObjects(before: any, after: any): DiffItem[] {
  const out: DiffItem[] = [];
  const seen = new Set<string>();

  function walk(b: any, a: any, basePath: string) {
    const bIsObj = isPlainObject(b);
    const aIsObj = isPlainObject(a);

    // If both plain objects, compare keys recursively
    if (bIsObj && aIsObj) {
      const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
      for (const k of keys) {
        const p = basePath ? `${basePath}.${k}` : k;
        seen.add(p);
        const bv = (b as any)[k];
        const av = (a as any)[k];

        const bvUndef = typeof bv === "undefined";
        const avUndef = typeof av === "undefined";

        if (!bvUndef && avUndef) {
          out.push({ type: "removed", path: p, before: bv });
          continue;
        }
        if (bvUndef && !avUndef) {
          out.push({ type: "added", path: p, after: av });
          continue;
        }

        // both exist
        const bothPlain = isPlainObject(bv) && isPlainObject(av);
        if (bothPlain) {
          walk(bv, av, p);
          continue;
        }

        // arrays or primitives — compare direct
        if (stableVal(bv) !== stableVal(av)) {
          out.push({ type: "changed", path: p, before: bv, after: av });
        }
      }
      return;
    }

    // If one side is missing
    if (typeof b === "undefined" && typeof a !== "undefined") {
      out.push({ type: "added", path: basePath || "(root)", after: a });
      return;
    }
    if (typeof b !== "undefined" && typeof a === "undefined") {
      out.push({ type: "removed", path: basePath || "(root)", before: b });
      return;
    }

    // Non-objects at root: compare
    if (stableVal(b) !== stableVal(a)) {
      out.push({ type: "changed", path: basePath || "(root)", before: b, after: a });
    }
  }

  walk(before ?? undefined, after ?? undefined, "");
  // Small quality: sort by path
  out.sort((x, y) => x.path.localeCompare(y.path));
  return out;
}

function TonePill({ type }: { type: DiffItem["type"] }) {
  const base = "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold";
  if (type === "added")
    return (
      <span className={`${base} border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`}>Added</span>
    );
  if (type === "removed") return <span className={`${base} border-red-200 bg-red-50 text-red-700`}>Removed</span>;
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-900`}>Changed</span>;
}

export default function AdminAuditPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);

  const [q, setQ] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  // Diff drawer
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const admin = await requireAdmin();
      if (!admin.ok) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("id,actor_user_id,action,entity_type,entity_id,reason,before,after,created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        setRows([]);
        setErrorMsg(
          `Audit log is not deployed yet. Create table "admin_audit_logs" to enable compliance history. (${error.message})`
        );
        setLoading(false);
        return;
      }

      setRows((data ?? []) as AuditRow[]);
      setLoading(false);
    } catch (e: any) {
      setRows([]);
      setErrorMsg(e?.message ?? "Failed to load audit log.");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(String(r.entity_type || "").trim() || "unknown"));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(String(r.action || "").trim() || "unknown"));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;

      if (!needle) return true;

      const hay = [r.id, r.actor_user_id ?? "", r.action, r.entity_type, r.entity_id ?? "", r.reason ?? "", r.created_at]
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [rows, q, entityFilter, actionFilter]);

  const openRow = useMemo(() => {
    if (!openId) return null;
    return filtered.find((r) => r.id === openId) ?? null;
  }, [openId, filtered]);

  const openDiff = useMemo(() => {
    if (!openRow) return [];
    return diffObjects(openRow.before, openRow.after);
  }, [openRow]);

  return (
    <main className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Audit Log</h1>
              <p className="mt-1 text-sm text-black/60">Every enforcement action should leave a trail.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              ← Admin Home
            </Link>
            <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">
              {loading ? "Loading…" : `${filtered.length} shown`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Refresh
          </button>
          <Link
            href="/admin/metrics"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
          >
            Metrics
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{errorMsg}</div>
      ) : null}

      {/* Filters */}
      <section className="rounded-[28px] border border-black/10 bg-white/70 p-5 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-[11px] font-medium text-black/50">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Action, entity, id, reason…"
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
            />
          </div>

          <div>
            <div className="text-[11px] font-medium text-black/50">Entity</div>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
            >
              {entityOptions.map((x) => (
                <option key={x} value={x}>
                  {x === "all" ? "All" : x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[11px] font-medium text-black/50">Action</div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
            >
              {actionOptions.map((x) => (
                <option key={x} value={x}>
                  {x === "all" ? "All" : x}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="mt-6 overflow-hidden rounded-[28px] border border-black/10 bg-white/70 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-5">
          <div className="text-sm font-semibold text-[#0b1f2a]">Events</div>
          <div className="text-xs text-black/50">Newest first • Up to 200</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
              <div className="font-semibold text-[#0b1f2a]">No events found.</div>
              <div className="mt-1 text-black/60">Once enforcement actions run, they will appear here.</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-b from-black/5 to-black/0">
                <tr>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">When</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Action</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Entity</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Reason</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">Before</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60">After</th>
                  <th className="whitespace-nowrap p-4 text-xs font-semibold text-black/60 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isOpen = openId === r.id;

                  return (
                    <tr key={r.id} className="border-t border-black/5">
                      <td className="p-4 text-black/60">{fmtDate(r.created_at)}</td>

                      <td className="p-4">
                        <span className={pillTone(r.action)}>{r.action}</span>
                        <div className="mt-2 font-mono text-[11px] text-black/50" title={r.id}>
                          {shortId(r.id)}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-[#0b1f2a]">{r.entity_type}</div>
                        <div className="mt-1 font-mono text-xs text-black/50" title={r.entity_id ?? ""}>
                          {r.entity_id ? shortId(r.entity_id) : "—"}
                        </div>
                      </td>

                      <td className="p-4 text-black/60">{(r.reason || "").trim() || "—"}</td>

                      <td className="p-4">
                        <pre className="max-w-[320px] whitespace-pre-wrap rounded-2xl border border-black/10 bg-white/70 p-3 text-[11px] text-black/60">
                          {jsonPreview(r.before)}
                        </pre>
                      </td>

                      <td className="p-4">
                        <pre className="max-w-[320px] whitespace-pre-wrap rounded-2xl border border-black/10 bg-white/70 p-3 text-[11px] text-black/60">
                          {jsonPreview(r.after)}
                        </pre>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setOpenId(isOpen ? null : r.id)}
                          className={[
                            "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                            "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
                          ].join(" ")}
                        >
                          {isOpen ? "Close" : "Diff"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Diff Drawer */}
      {openRow ? (
        <section className="mt-6 rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold text-[#0b1f2a]">Diff</div>
                <span className={pillTone(openRow.action)}>{openRow.action}</span>
                <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-medium text-black/60">
                  {openDiff.length} changes
                </span>
              </div>

              <div className="mt-2 text-sm text-black/60">
                <span className="font-mono text-xs">{shortId(openRow.id)}</span> •{" "}
                <span className="font-semibold">{openRow.entity_type}</span>{" "}
                <span className="font-mono text-xs">{openRow.entity_id ? shortId(openRow.entity_id) : "—"}</span> •{" "}
                {fmtDate(openRow.created_at)}
              </div>

              {(openRow.reason || "").trim() ? (
                <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/70">
                  <div className="text-[11px] font-semibold text-black/50">Reason</div>
                  <div className="mt-1">{openRow.reason}</div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setOpenId(null)}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
            >
              Close
            </button>
          </div>

          {/* Changes */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[#0b1f2a]">Field changes</div>
                <div className="text-xs text-black/50">Added / Removed / Changed</div>
              </div>

              {openDiff.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                  No differences detected (or both snapshots are empty).
                </div>
              ) : (
                <div className="mt-3 max-h-[420px] overflow-auto rounded-2xl border border-black/10 bg-white/70">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gradient-to-b from-black/5 to-black/0">
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">Type</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Path</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openDiff.map((d) => {
                        const prev =
                          d.type === "added"
                            ? `→ ${stableVal(d.after)}`
                            : d.type === "removed"
                            ? `${stableVal(d.before)} →`
                            : `${stableVal(d.before)} → ${stableVal(d.after)}`;

                        return (
                          <tr key={`${d.type}:${d.path}`} className="border-t border-black/5">
                            <td className="p-3">
                              <TonePill type={d.type} />
                            </td>
                            <td className="p-3">
                              <div className="font-mono text-xs text-[#0b1f2a]">{d.path}</div>
                            </td>
                            <td className="p-3">
                              <div className="max-w-[540px] truncate font-mono text-[11px] text-black/60" title={prev}>
                                {prev}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Snapshots */}
            <div className="grid gap-4">
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-sm font-semibold text-[#0b1f2a]">Before (full)</div>
                <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-2xl border border-black/10 bg-white/70 p-3 text-[11px] text-black/60">
                  {safeJsonString(openRow.before)}
                </pre>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-sm font-semibold text-[#0b1f2a]">After (full)</div>
                <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-2xl border border-black/10 bg-white/70 p-3 text-[11px] text-black/60">
                  {safeJsonString(openRow.after)}
                </pre>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}