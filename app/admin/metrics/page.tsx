"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";

type InspectionStatus = "requested" | "paid" | "scheduled" | "completed" | "cancelled";

type InspectionRow = {
  id: string;
  status: InspectionStatus;
  inspection_fee_ngn: number;
  created_at: string;
  paid_at?: string | null;
  scheduled_at?: string | null;
  scheduled_by_user_id?: string | null;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
};

type ProfileMini = { user_id: string; full_name: string | null };

type TrendRow = {
  day: string;
  paidCount: number;
  revenue: number;
};

type TopPropertyRow = {
  property_id: string;
  property_label: string | null;
  paid_plus_count: number;
  total_count: number;
  revenue_ngn: number;
};

type TopAgentRow = {
  agent_user_id: string;
  agent_name: string;
  scheduled_count: number;
  completed_count: number;
  paid_plus_count: number;
  revenue_ngn: number;
};

type TopPropsTab = "revenue" | "inspections";
type TopAgentsTab = "revenue" | "completed";

const RANGE_OPTIONS: Array<{ label: string; days: number }> = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "365d", days: 365 },
];

const CHART_COLORS = {
  teal: "#0ea5a3",
  tealDark: "#0a4f63",
  navy: "#0b1f2a",
  slate: "#64748b",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "#cbd5e1",
  grid: "#e5e7eb",
};

function clampDays(days: number) {
  const d = Math.max(1, Math.floor(Number(days || 0)));
  if (!Number.isFinite(d) || d <= 0) return 30;
  return d;
}

function formatNgn(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

function formatHours(h: number) {
  if (!Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} mins`;
  if (h < 48) return `${h.toFixed(1)} hrs`;
  return `${(h / 24).toFixed(1)} days`;
}

function safeMs(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const A = new Date(a).getTime();
  const B = new Date(b).getTime();
  if (Number.isNaN(A) || Number.isNaN(B)) return null;
  return A - B;
}

function dayKey(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDaysKeys(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function toIsoDay(x: any) {
  if (!x) return null;
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortId(id: string) {
  const s = String(id || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function formatShortDayLabel(day: string) {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BadgeIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function RangePills({
  valueDays,
  onChangeDays,
}: {
  valueDays: number;
  onChangeDays: (days: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {RANGE_OPTIONS.map((r) => (
        <button
          key={r.days}
          onClick={() => onChangeDays(r.days)}
          className={[
            "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            valueDays === r.days
              ? "border-black/10 bg-[#0b1f2a] text-white shadow-[0_12px_32px_rgba(11,31,42,0.22)]"
              : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
          ].join(" ")}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "live" | "warn";
}) {
  const cls =
    tone === "live"
      ? "border-[rgba(14,165,163,0.18)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-black/10 bg-white/70 text-black/55";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function SyncBadge({ isSynced }: { isSynced: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        isSynced ? "border-black/10 bg-white/70 text-black/55" : "border-amber-200 bg-amber-50 text-amber-900",
      ].join(" ")}
      title={isSynced ? "This section is using the global range." : "This section range is overridden."}
    >
      {isSynced ? "Synced" : "Overridden"}
    </span>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        active
          ? "border-black/10 bg-[#0b1f2a] text-white shadow-[0_12px_32px_rgba(11,31,42,0.22)]"
          : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition",
        "hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl bg-[#0b1f2a] px-4 py-2 text-sm font-semibold text-white transition",
        "shadow-[0_18px_48px_rgba(11,31,42,0.20)] hover:shadow-[0_22px_56px_rgba(11,31,42,0.26)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a3]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        className,
      ].join(" ")}
    >
      {children}
    </button>
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
    <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{title}</div>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-black/60">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChartShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/80 p-5 shadow-[0_14px_34px_rgba(11,31,42,0.08)]">
      <div>
        <div className="text-sm font-semibold text-[#0b1f2a]">{title}</div>
        {subtitle ? <div className="mt-1 text-xs leading-relaxed text-black/55">{subtitle}</div> : null}
      </div>
      <div className="mt-4 h-[250px] w-full">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

function DataTableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">{children}</div>;
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gradient-to-b from-black/5 to-black/0">{children}</thead>;
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
      <div className="font-semibold text-[#0b1f2a]">{title}</div>
      {body ? <div className="mt-1 text-black/60">{body}</div> : null}
    </div>
  );
}

function WarnState({
  title,
  body,
  code,
}: {
  title: string;
  body: React.ReactNode;
  code?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-amber-900/80">{body}</div>
      {code ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3 font-mono text-xs text-amber-900/70">
          {code}
        </div>
      ) : null}
    </div>
  );
}

function CustomChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(11,31,42,0.12)]">
      {label ? <div className="mb-2 text-xs font-semibold text-[#0b1f2a]">{label}</div> : null}
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const rawValue = Number(item.value || 0);
          const text = formatter ? formatter(rawValue, item.name) : String(rawValue);
          return (
            <div key={`${item.name}-${idx}`} className="flex items-center gap-2 text-xs text-black/70">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color || CHART_COLORS.teal }}
              />
              <span className="font-medium text-[#0b1f2a]">{item.name}</span>
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegendPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#0b1f2a]">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-black/50">{value}</span>
    </div>
  );
}

export default function AdminMetricsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string | null>>({});

  const [globalDays, setGlobalDays] = useState<number>(30);

  const [trendDays, setTrendDays] = useState<number>(30);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendErr, setTrendErr] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);

  const [topPropsTab, setTopPropsTab] = useState<TopPropsTab>("revenue");
  const [topPropsDays, setTopPropsDays] = useState<number>(90);
  const [topPropsLoading, setTopPropsLoading] = useState(false);
  const [topPropsErr, setTopPropsErr] = useState<string | null>(null);
  const [topProps, setTopProps] = useState<TopPropertyRow[]>([]);

  const [topAgentsTab, setTopAgentsTab] = useState<TopAgentsTab>("revenue");
  const [topAgentsDays, setTopAgentsDays] = useState<number>(90);
  const [topAgentsLoading, setTopAgentsLoading] = useState(false);
  const [topAgentsErr, setTopAgentsErr] = useState<string | null>(null);
  const [topAgents, setTopAgents] = useState<TopAgentRow[]>([]);

  const trendSynced = useMemo(() => clampDays(trendDays) === clampDays(globalDays), [trendDays, globalDays]);
  const topPropsSynced = useMemo(() => clampDays(topPropsDays) === clampDays(globalDays), [topPropsDays, globalDays]);
  const topAgentsSynced = useMemo(() => clampDays(topAgentsDays) === clampDays(globalDays), [topAgentsDays, globalDays]);

  async function requireAdminUser() {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) throw userErr;
    if (!user) {
      router.push("/login");
      return null;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) throw profErr;

    if (!profile || profile.role !== "admin") {
      router.push("/login");
      return null;
    }

    return user;
  }

  async function loadTrend(daysIn: number) {
    setTrendLoading(true);
    setTrendErr(null);

    try {
      const days = clampDays(daysIn);
      const { data, error } = await supabase.rpc("admin_platform_trend", { days_in: days });

      if (error) {
        setTrend([]);
        setTrendErr(String(error.message || "Failed to load platform trend."));
        setTrendLoading(false);
        return;
      }

      const keys = lastNDaysKeys(days);
      const byDay: Record<string, { paidCount: number; revenue: number }> = {};
      for (const k of keys) byDay[k] = { paidCount: 0, revenue: 0 };

      (data ?? []).forEach((r: any) => {
        const k = toIsoDay(r.day);
        if (!k || !byDay[k]) return;
        byDay[k].paidCount = Number(r.paid_count || 0);
        byDay[k].revenue = Number(r.revenue_ngn || 0);
      });

      setTrend(
        keys.map((k) => ({
          day: k,
          paidCount: byDay[k].paidCount,
          revenue: byDay[k].revenue,
        }))
      );
      setTrendLoading(false);
    } catch (e: any) {
      setTrend([]);
      setTrendErr(e?.message ?? "Failed to load platform trend.");
      setTrendLoading(false);
    }
  }

  async function loadTopProperties(tab: TopPropsTab, daysIn: number) {
    setTopPropsLoading(true);
    setTopPropsErr(null);

    try {
      const fn =
        tab === "revenue" ? "admin_platform_top_properties_by_revenue" : "admin_platform_top_properties_by_inspections";

      const { data, error } = await supabase.rpc(fn, {
        days_in: clampDays(daysIn),
        limit_in: 25,
      });

      if (error) {
        setTopProps([]);
        setTopPropsErr(String(error.message || "Failed to load top properties."));
        setTopPropsLoading(false);
        return;
      }

      setTopProps(
        (data ?? []).map((r: any) => ({
          property_id: String(r.property_id),
          property_label: r.property_label ? String(r.property_label) : null,
          paid_plus_count: Number(r.paid_plus_count || 0),
          total_count: Number(r.total_count || 0),
          revenue_ngn: Number(r.revenue_ngn || 0),
        }))
      );

      setTopPropsLoading(false);
    } catch (e: any) {
      setTopProps([]);
      setTopPropsErr(e?.message ?? "Failed to load top properties.");
      setTopPropsLoading(false);
    }
  }

  async function loadTopAgents(tab: TopAgentsTab, daysIn: number) {
    setTopAgentsLoading(true);
    setTopAgentsErr(null);

    try {
      const fn = tab === "revenue" ? "admin_platform_top_agents_by_revenue" : "admin_platform_top_agents_by_completed";

      const { data, error } = await supabase.rpc(fn, {
        days_in: clampDays(daysIn),
        limit_in: 25,
      });

      if (error) {
        setTopAgents([]);
        setTopAgentsErr(String(error.message || "Failed to load top agents."));
        setTopAgentsLoading(false);
        return;
      }

      setTopAgents(
        (data ?? []).map((r: any) => ({
          agent_user_id: String(r.agent_user_id),
          agent_name: r.agent_name ? String(r.agent_name) : "Agent",
          scheduled_count: Number(r.scheduled_count || 0),
          completed_count: Number(r.completed_count || 0),
          paid_plus_count: Number(r.paid_plus_count || 0),
          revenue_ngn: Number(r.revenue_ngn || 0),
        }))
      );

      setTopAgentsLoading(false);
    } catch (e: any) {
      setTopAgents([]);
      setTopAgentsErr(e?.message ?? "Failed to load top agents.");
      setTopAgentsLoading(false);
    }
  }

  function applyGlobalRangeAndRefresh() {
    const d = clampDays(globalDays);
    setTrendDays(d);
    setTopPropsDays(d);
    setTopAgentsDays(d);
    loadTrend(d);
    loadTopProperties(topPropsTab, d);
    loadTopAgents(topAgentsTab, d);
  }

  function resetTrendToGlobal() {
    const d = clampDays(globalDays);
    setTrendDays(d);
    loadTrend(d);
  }

  function resetTopPropsToGlobal() {
    const d = clampDays(globalDays);
    const defaultTab: TopPropsTab = "revenue";
    setTopPropsTab(defaultTab);
    setTopPropsDays(d);
    loadTopProperties(defaultTab, d);
  }

  function resetTopAgentsToGlobal() {
    const d = clampDays(globalDays);
    const defaultTab: TopAgentsTab = "revenue";
    setTopAgentsTab(defaultTab);
    setTopAgentsDays(d);
    loadTopAgents(defaultTab, d);
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const admin = await requireAdminUser();
      if (!admin) return;

      const { data, error } = await supabase
        .from("inspection_requests")
        .select(
          "id,status,inspection_fee_ngn,created_at,paid_at,scheduled_at,scheduled_by_user_id,completed_at,completed_by_user_id"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = (data ?? []) as InspectionRow[];
      setRows(list);

      const userIds = Array.from(
        new Set(
          list
            .flatMap((r) => [r.scheduled_by_user_id, r.completed_by_user_id])
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        )
      );

      if (userIds.length > 0) {
        const { data: profs, error: profErr2 } = await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", userIds);

        if (profErr2) throw profErr2;

        const m: Record<string, string | null> = {};
        (profs ?? []).forEach((p: ProfileMini) => {
          m[String(p.user_id)] = p.full_name ?? null;
        });
        setNameMap(m);
      } else {
        setNameMap({});
      }

      setLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load metrics.");
      setRows([]);
      setNameMap({});
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    loadTrend(trendDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, trendDays]);

  useEffect(() => {
    if (loading) return;
    loadTopProperties(topPropsTab, topPropsDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, topPropsTab, topPropsDays]);

  useEffect(() => {
    if (loading) return;
    loadTopAgents(topAgentsTab, topAgentsDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, topAgentsTab, topAgentsDays]);

  const computed = useMemo(() => {
    const counts: Record<InspectionStatus, number> = {
      requested: 0,
      paid: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };

    let revenue = 0;
    const toScheduleMs: number[] = [];
    const toCompleteMs: number[] = [];

    const scheduledBy: Record<string, number> = {};
    const completedBy: Record<string, number> = {};

    for (const r of rows) {
      counts[r.status] += 1;

      if (r.status === "paid" || r.status === "scheduled" || r.status === "completed") {
        revenue += Number(r.inspection_fee_ngn || 0);
      }

      if (r.scheduled_by_user_id) {
        const uid = String(r.scheduled_by_user_id);
        scheduledBy[uid] = (scheduledBy[uid] ?? 0) + 1;
      }

      if (r.completed_by_user_id) {
        const uid = String(r.completed_by_user_id);
        completedBy[uid] = (completedBy[uid] ?? 0) + 1;
      }

      if (r.scheduled_at) {
        const ms = safeMs(r.scheduled_at, r.paid_at ?? r.created_at);
        if (ms != null && ms >= 0) toScheduleMs.push(ms);
      }

      if (r.completed_at) {
        const ms = safeMs(r.completed_at, r.scheduled_at ?? r.paid_at ?? r.created_at);
        if (ms != null && ms >= 0) toCompleteMs.push(ms);
      }
    }

    const total = rows.length;
    const paidPlus = counts.paid + counts.scheduled + counts.completed;
    const conversion = total > 0 ? paidPlus / total : 0;

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
    const avgToScheduleHrs = avg(toScheduleMs) / (1000 * 60 * 60);
    const avgToCompleteHrs = avg(toCompleteMs) / (1000 * 60 * 60);

    const leaderboard = Array.from(new Set([...Object.keys(scheduledBy), ...Object.keys(completedBy)])).map((uid) => ({
      user_id: uid,
      name: nameMap[uid] ?? "Agent",
      scheduled: scheduledBy[uid] ?? 0,
      completed: completedBy[uid] ?? 0,
    }));
    leaderboard.sort((a, b) => b.completed - a.completed || b.scheduled - a.scheduled);

    const keys = lastNDaysKeys(7);
    const byDay: Record<string, { paidCount: number; paidRevenue: number }> = {};
    for (const k of keys) byDay[k] = { paidCount: 0, paidRevenue: 0 };

    for (const r of rows) {
      if (!(r.status === "paid" || r.status === "scheduled" || r.status === "completed")) continue;
      const k = dayKey(r.paid_at ?? r.created_at);
      if (!k || !byDay[k]) continue;
      byDay[k].paidCount += 1;
      byDay[k].paidRevenue += Number(r.inspection_fee_ngn || 0);
    }

    const trend7 = keys.map((k) => ({
      day: k,
      paidCount: byDay[k].paidCount,
      paidRevenue: byDay[k].paidRevenue,
    }));

    return {
      counts,
      total,
      paidPlus,
      revenue,
      conversion,
      avgToScheduleHrs,
      avgToCompleteHrs,
      leaderboard,
      trend7,
    };
  }, [rows, nameMap]);

  const statusChartData = useMemo(
    () => [
      { name: "Requested", value: computed.counts.requested, fill: CHART_COLORS.amber },
      { name: "Paid", value: computed.counts.paid, fill: CHART_COLORS.tealDark },
      { name: "Scheduled", value: computed.counts.scheduled, fill: CHART_COLORS.navy },
      { name: "Completed", value: computed.counts.completed, fill: CHART_COLORS.teal },
      { name: "Cancelled", value: computed.counts.cancelled, fill: CHART_COLORS.red },
    ],
    [computed.counts]
  );

  const funnelChartData = useMemo(
    () => [
      { name: "Requested", value: computed.counts.requested, fill: CHART_COLORS.amber },
      { name: "Paid+", value: computed.paidPlus, fill: CHART_COLORS.teal },
      { name: "Cancelled", value: computed.counts.cancelled, fill: CHART_COLORS.red },
    ],
    [computed.counts.cancelled, computed.counts.requested, computed.paidPlus]
  );

  const revenueTrendChartData = useMemo(
    () =>
      trend.map((t) => ({
        day: formatShortDayLabel(t.day),
        revenue: t.revenue,
        paidCount: t.paidCount,
      })),
    [trend]
  );

  return (
    <main className="min-h-[calc(100vh-120px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Admin Metrics</h1>
              <p className="mt-1 text-sm text-black/60">Platform KPIs, funnel, velocity, and trends.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              ← Admin Home
            </Link>
            <Badge tone="live">Live</Badge>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
          <div className="text-[11px] font-semibold text-black/50">Global range</div>
          <div className="flex flex-wrap items-center gap-2">
            <RangePills valueDays={globalDays} onChangeDays={setGlobalDays} />
            <PrimaryButton onClick={applyGlobalRangeAndRefresh}>Apply</PrimaryButton>
            <SecondaryButton onClick={load} className="px-5 py-2">
              Refresh
            </SecondaryButton>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white/70 p-8 text-sm text-black/60 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
          Loading…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Total inspections" value={`${computed.total}`} hint="All inspection requests (lifetime)." />
            <KpiCard label="Paid+" value={`${computed.paidPlus}`} hint="Paid, Scheduled, or Completed." />
            <KpiCard label="Revenue" value={formatNgn(computed.revenue)} hint="Sum of fees for Paid+." />
            <KpiCard label="Conversion" value={`${Math.round(computed.conversion * 100)}%`} hint="Paid+ / Total." />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <ChartShell title="Inspection status mix" subtitle="Clean count view across current lifecycle stages.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} barCategoryGap={26} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomChartTooltip formatter={(value) => `${value}`} />} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={42}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell title="Revenue trend" subtitle="Neater revenue read for the selected platform trend range.">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrendChartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(value) => `₦${Number(value).toLocaleString()}`}
                  />
                  <Tooltip
                    content={
                      <CustomChartTooltip
                        formatter={(value, name) => (name === "Revenue" ? formatNgn(value) : `${value}`)}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={CHART_COLORS.teal}
                    strokeWidth={3}
                    dot={{ r: 3.5, fill: CHART_COLORS.teal }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              title="Funnel share"
              subtitle="Requested vs Paid+ vs Cancelled."
              footer={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {funnelChartData.map((item) => (
                    <ChartLegendPill key={item.name} label={item.name} value={item.value} color={item.fill} />
                  ))}
                </div>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
                  <Pie
                    data={funnelChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={4}
                    cx="50%"
                    cy="47%"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={2}
                  >
                    {funnelChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip formatter={(value) => `${value}`} />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>

          <div className="mt-6">
            <SectionShell
              title={
                <>
                  <h2 className="text-lg font-semibold text-[#0b1f2a]">Platform trend</h2>
                  <SyncBadge isSynced={trendSynced} />
                  {!trendSynced ? (
                    <button
                      onClick={resetTrendToGlobal}
                      className="ml-1 rounded-2xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                    >
                      Reset
                    </button>
                  ) : null}
                </>
              }
              subtitle="Daily paid+ count and revenue."
              right={
                <>
                  <div className="flex flex-col items-end">
                    <div className="text-[11px] font-semibold text-black/50">Range</div>
                    <RangePills valueDays={trendDays} onChangeDays={setTrendDays} />
                  </div>
                  <SecondaryButton onClick={() => loadTrend(trendDays)} className="px-3 py-2 text-xs">
                    Refresh
                  </SecondaryButton>
                </>
              }
            >
              {trendLoading ? (
                <div className="text-sm text-black/60">Loading trend…</div>
              ) : trendErr ? (
                <WarnState
                  title="Platform trend not ready yet"
                  body={
                    <>
                      Deploy the SQL function <span className="font-mono text-[12px]">admin_platform_trend</span> to enable this section.
                    </>
                  }
                  code={trendErr}
                />
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">Day</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Paid+ count</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {trend.map((t) => {
                        const maxRevenue = Math.max(...trend.map((x) => x.revenue), 0);
                        const maxCount = Math.max(...trend.map((x) => x.paidCount), 0);
                        const wRev = maxRevenue > 0 ? Math.round((t.revenue / maxRevenue) * 100) : 0;
                        const wCnt = maxCount > 0 ? Math.round((t.paidCount / maxCount) * 100) : 0;

                        return (
                          <tr key={t.day} className="border-t border-black/5">
                            <td className="p-3 font-medium text-[#0b1f2a]">{t.day}</td>

                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 text-right font-semibold text-[#0b1f2a]">{t.paidCount}</div>
                                <div className="h-2 flex-1 rounded-full bg-black/5">
                                  <div className="h-2 rounded-full bg-[#0b1f2a]" style={{ width: `${wCnt}%` }} />
                                </div>
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-28 font-semibold text-[#0b1f2a]">{formatNgn(t.revenue)}</div>
                                <div className="h-2 flex-1 rounded-full bg-black/5">
                                  <div className="h-2 rounded-full bg-[#0a4f63]" style={{ width: `${wRev}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>
          </div>

          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <SectionShell
              title={
                <>
                  <h2 className="text-lg font-semibold text-[#0b1f2a]">Top properties</h2>
                  <SyncBadge isSynced={topPropsSynced} />
                  {!topPropsSynced ? (
                    <button
                      onClick={resetTopPropsToGlobal}
                      className="ml-1 rounded-2xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                    >
                      Reset
                    </button>
                  ) : null}
                </>
              }
              subtitle="Ranked by tab, within selected range."
              right={
                <>
                  <div className="flex flex-col items-end">
                    <div className="text-[11px] font-semibold text-black/50">Range</div>
                    <RangePills valueDays={topPropsDays} onChangeDays={setTopPropsDays} />
                  </div>

                  <TabButton active={topPropsTab === "revenue"} onClick={() => setTopPropsTab("revenue")}>
                    Revenue
                  </TabButton>
                  <TabButton active={topPropsTab === "inspections"} onClick={() => setTopPropsTab("inspections")}>
                    Paid+
                  </TabButton>

                  <SecondaryButton onClick={() => loadTopProperties(topPropsTab, topPropsDays)} className="px-3 py-2 text-xs">
                    Refresh
                  </SecondaryButton>
                </>
              }
            >
              {topPropsLoading ? (
                <div className="text-sm text-black/60">Loading…</div>
              ) : topPropsErr ? (
                <WarnState
                  title="Top properties not ready yet"
                  body={
                    <>
                      Deploy the SQL functions{" "}
                      <span className="font-mono text-[12px]">admin_platform_top_properties_by_revenue</span> and{" "}
                      <span className="font-mono text-[12px]">admin_platform_top_properties_by_inspections</span>.
                    </>
                  }
                  code={topPropsErr}
                />
              ) : topProps.length === 0 ? (
                <EmptyState title="No property activity in this range." />
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">Property</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Paid+</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                        <th className="p-3"></th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {topProps.map((p) => (
                        <tr key={p.property_id} className="border-t border-black/5">
                          <td className="p-3">
                            <div className="font-medium text-[#0b1f2a]">{p.property_label || "Property"}</div>
                            <div className="font-mono text-xs text-black/50">{shortId(p.property_id)}</div>
                          </td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{p.paid_plus_count}</td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{formatNgn(p.revenue_ngn)}</td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/admin/properties/${p.property_id}`}
                              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>

            <SectionShell
              title={
                <>
                  <h2 className="text-lg font-semibold text-[#0b1f2a]">Top agents</h2>
                  <SyncBadge isSynced={topAgentsSynced} />
                  {!topAgentsSynced ? (
                    <button
                      onClick={resetTopAgentsToGlobal}
                      className="ml-1 rounded-2xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                    >
                      Reset
                    </button>
                  ) : null}
                </>
              }
              subtitle="Ranked by tab, within selected range."
              right={
                <>
                  <div className="flex flex-col items-end">
                    <div className="text-[11px] font-semibold text-black/50">Range</div>
                    <RangePills valueDays={topAgentsDays} onChangeDays={setTopAgentsDays} />
                  </div>

                  <TabButton active={topAgentsTab === "revenue"} onClick={() => setTopAgentsTab("revenue")}>
                    Revenue
                  </TabButton>
                  <TabButton active={topAgentsTab === "completed"} onClick={() => setTopAgentsTab("completed")}>
                    Completed
                  </TabButton>

                  <SecondaryButton onClick={() => loadTopAgents(topAgentsTab, topAgentsDays)} className="px-3 py-2 text-xs">
                    Refresh
                  </SecondaryButton>
                </>
              }
            >
              {topAgentsLoading ? (
                <div className="text-sm text-black/60">Loading…</div>
              ) : topAgentsErr ? (
                <WarnState
                  title="Top agents not ready yet"
                  body={
                    <>
                      Deploy the SQL functions{" "}
                      <span className="font-mono text-[12px]">admin_platform_top_agents_by_revenue</span> and{" "}
                      <span className="font-mono text-[12px]">admin_platform_top_agents_by_completed</span>.
                    </>
                  }
                  code={topAgentsErr}
                />
              ) : topAgents.length === 0 ? (
                <EmptyState title="No agent activity in this range." />
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">Agent</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Completed</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                        <th className="p-3"></th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {topAgents.map((a) => (
                        <tr key={a.agent_user_id} className="border-t border-black/5">
                          <td className="p-3">
                            <div className="font-medium text-[#0b1f2a]">{a.agent_name || "Agent"}</div>
                            <div className="font-mono text-xs text-black/50">{shortId(a.agent_user_id)}</div>
                          </td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{a.completed_count}</td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{formatNgn(a.revenue_ngn)}</td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/admin/agents/${a.agent_user_id}`}
                              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_12px_30px_rgba(11,31,42,0.10)]"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>
          </section>

          <div className="mt-6">
            <SectionShell title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Funnel</h2>} subtitle="Counts by inspection status.">
              <div className="grid gap-3 md:grid-cols-5">
                <MetricPill label="Requested" value={computed.counts.requested} />
                <MetricPill label="Paid" value={computed.counts.paid} />
                <MetricPill label="Scheduled" value={computed.counts.scheduled} />
                <MetricPill label="Completed" value={computed.counts.completed} />
                <MetricPill label="Cancelled" value={computed.counts.cancelled} />
              </div>
            </SectionShell>
          </div>

          <div className="mt-6">
            <SectionShell title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Velocity</h2>} subtitle="Average time between lifecycle steps.">
              <div className="grid gap-4 md:grid-cols-2">
                <VelocityCard label="Paid → Scheduled" value={formatHours(computed.avgToScheduleHrs)} />
                <VelocityCard label="Scheduled → Completed" value={formatHours(computed.avgToCompleteHrs)} />
              </div>
            </SectionShell>
          </div>

          <div className="mt-6">
            <SectionShell title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Last 7 days</h2>} subtitle="Daily paid count and revenue (derived).">
              <DataTableShell>
                <table className="w-full text-left text-sm">
                  <TableHead>
                    <tr>
                      <th className="p-3 text-xs font-semibold text-black/60">Day</th>
                      <th className="p-3 text-xs font-semibold text-black/60">Paid count</th>
                      <th className="p-3 text-xs font-semibold text-black/60">Revenue</th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {computed.trend7.map((t) => (
                      <tr key={t.day} className="border-t border-black/5">
                        <td className="p-3 font-medium text-[#0b1f2a]">{t.day}</td>
                        <td className="p-3 font-semibold text-[#0b1f2a]">{t.paidCount}</td>
                        <td className="p-3 font-semibold text-[#0b1f2a]">{formatNgn(t.paidRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            </SectionShell>
          </div>

          <div className="mt-6">
            <SectionShell title={<h2 className="text-lg font-semibold text-[#0b1f2a]">Agent leaderboard</h2>} subtitle="Counts based on scheduled_by and completed_by.">
              {computed.leaderboard.length === 0 ? (
                <EmptyState title="No agent activity yet." />
              ) : (
                <DataTableShell>
                  <table className="w-full text-left text-sm">
                    <TableHead>
                      <tr>
                        <th className="p-3 text-xs font-semibold text-black/60">Agent</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Scheduled</th>
                        <th className="p-3 text-xs font-semibold text-black/60">Completed</th>
                      </tr>
                    </TableHead>
                    <tbody>
                      {computed.leaderboard.map((a) => (
                        <tr key={a.user_id} className="border-t border-black/5">
                          <td className="p-3">
                            <div className="font-medium text-[#0b1f2a]">{a.name}</div>
                            <div className="font-mono text-xs text-black/50">{shortId(a.user_id)}</div>
                          </td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{a.scheduled}</td>
                          <td className="p-3 font-semibold text-[#0b1f2a]">{a.completed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              )}
            </SectionShell>
          </div>
        </>
      )}
    </main>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-black/55">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{value}</div>
          {hint ? <div className="mt-2 text-xs leading-relaxed text-black/50">{hint}</div> : null}
        </div>

        <div className="h-10 w-10 shrink-0 rounded-2xl border border-black/10 bg-white shadow-sm" />
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.08)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-black/55">{label}</div>
        <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-black/50">
          Status
        </span>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-[#0b1f2a]">{value}</div>
    </div>
  );
}

function VelocityCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white/70 p-5 shadow-[0_16px_46px_rgba(11,31,42,0.08)] backdrop-blur-xl">
      <div className="text-xs font-semibold text-black/55">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0b1f2a]">{value}</div>
      <div className="mt-2 text-xs text-black/50">Computed from lifecycle timestamps.</div>
    </div>
  );
}