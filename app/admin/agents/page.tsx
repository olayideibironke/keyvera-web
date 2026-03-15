"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminGuard";
import { useRouter } from "next/navigation";

type AgentRow = {
  id: string;
  user_id: string;
  kyc_status: "unsubmitted" | "pending" | "verified" | "rejected";
  license_number: string | null;
  kyc_id_front_image_path: string | null;
  kyc_id_front_image_uploaded_at: string | null;
  kyc_id_back_image_path: string | null;
  kyc_id_back_image_uploaded_at: string | null;
  kyc_submitted_at: string | null;
  created_at: string;
};

type ProfileMini = {
  user_id: string;
  account_status: string | null;
  full_name: string | null;
};

type EnforcementMode = null | {
  kind: "disable_agent" | "enable_agent";
  agent_id: string;
  user_id: string;
  agent_label: string;
};

type ReviewMode = null | {
  kind: "approve_kyc" | "reject_kyc";
  agent_id: string;
  user_id: string;
  agent_label: string;
  license_number: string | null;
  kyc_id_front_image_path: string | null;
  kyc_id_front_image_uploaded_at: string | null;
  kyc_id_back_image_path: string | null;
  kyc_id_back_image_uploaded_at: string | null;
  kyc_submitted_at: string | null;
};

type ImagePreviewMode = null | {
  agent_label: string;
  license_number: string | null;
  front_path: string | null;
  front_uploaded_at: string | null;
  back_path: string | null;
  back_uploaded_at: string | null;
  submitted_at: string | null;
};

function BadgeIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function shortId(id: string) {
  const s = String(id || "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function fmtDate(x: string | null | undefined) {
  const d = new Date(String(x || ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusPill(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (s === "disabled") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "active") return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function kycPill(status: AgentRow["kyc_status"]) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (status === "verified") {
    return `${base} border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  }
  if (status === "pending") {
    return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  }
  if (status === "rejected") {
    return `${base} border-red-200 bg-red-50 text-red-700`;
  }
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function hasFrontImage(path: string | null | undefined) {
  return !!String(path || "").trim();
}

function hasBackImage(path: string | null | undefined) {
  return !!String(path || "").trim();
}

function getImageFileName(path: string | null | undefined) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  const parts = raw.split("/");
  return parts[parts.length - 1] || raw;
}

function getSubmittedAt(row: AgentRow) {
  return row.kyc_submitted_at || row.created_at;
}

async function getActorUserIdOrRedirect(router: ReturnType<typeof useRouter>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) {
    router.push("/login");
    return null;
  }
  return user.id;
}

async function logAudit(payload: {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string;
  before: any;
  after: any;
}) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_user_id: payload.actor_user_id,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    reason: payload.reason,
    before: payload.before,
    after: payload.after,
  });

  if (error) throw error;
}

async function createSignedImageUrl(path: string) {
  const { data, error } = await supabase.storage.from("agent-kyc").createSignedUrl(path, 60 * 60);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Signed image URL could not be created.");
  return data.signedUrl;
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

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-[11px] font-semibold text-black/55">
      {children}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="p-8">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-black/60">
        <div className="font-semibold text-[#0b1f2a]">{title}</div>
        {body ? <div className="mt-1 text-black/60">{body}</div> : null}
      </div>
    </div>
  );
}

function SmallRuleCard({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.08)]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : "border-black/10 bg-white/80";

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_14px_34px_rgba(11,31,42,0.06)] ${cls}`}>
      <div className="text-sm font-semibold text-[#0b1f2a]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-black/55">{body}</div>
    </div>
  );
}

export default function AdminAgentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [enforce, setEnforce] = useState<EnforcementMode>(null);
  const [review, setReview] = useState<ReviewMode>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreviewMode>(null);

  const [reason, setReason] = useState("");
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const [checkGovId, setCheckGovId] = useState(false);
  const [checkNotExpired, setCheckNotExpired] = useState(false);
  const [checkIdentityMatch, setCheckIdentityMatch] = useState(false);
  const [checkFraudReview, setCheckFraudReview] = useState(false);

  const [reviewFrontUrl, setReviewFrontUrl] = useState<string | null>(null);
  const [reviewBackUrl, setReviewBackUrl] = useState<string | null>(null);
  const [reviewImageLoading, setReviewImageLoading] = useState(false);
  const [reviewImageErr, setReviewImageErr] = useState<string | null>(null);

  const [previewFrontUrl, setPreviewFrontUrl] = useState<string | null>(null);
  const [previewBackUrl, setPreviewBackUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg("");
    setAuditErr(null);

    try {
      const admin = await requireAdmin();
      if (!admin.ok) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("agents")
        .select(
          "id,user_id,kyc_status,license_number,kyc_id_front_image_path,kyc_id_front_image_uploaded_at,kyc_id_back_image_path,kyc_id_back_image_uploaded_at,kyc_submitted_at,created_at"
        )
        .in("kyc_status", ["pending", "verified", "rejected"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as AgentRow[];
      setRows(list);

      const userIds = Array.from(new Set(list.map((r) => String(r.user_id)).filter(Boolean)));

      if (userIds.length) {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("user_id,account_status,full_name")
          .in("user_id", userIds);

        if (pe) throw pe;

        const map: Record<string, ProfileMini> = {};
        (profs ?? []).forEach((p: any) => {
          map[String(p.user_id)] = {
            user_id: String(p.user_id),
            account_status: p.account_status ? String(p.account_status) : null,
            full_name: p.full_name ? String(p.full_name) : null,
          };
        });

        setProfiles(map);
      } else {
        setProfiles({});
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReviewImages() {
      if (!review) {
        setReviewFrontUrl(null);
        setReviewBackUrl(null);
        setReviewImageErr(null);
        setReviewImageLoading(false);
        return;
      }

      setReviewImageLoading(true);
      setReviewImageErr(null);
      setReviewFrontUrl(null);
      setReviewBackUrl(null);

      try {
        const frontPromise = review.kyc_id_front_image_path
          ? createSignedImageUrl(review.kyc_id_front_image_path)
          : Promise.resolve(null);

        const backPromise = review.kyc_id_back_image_path
          ? createSignedImageUrl(review.kyc_id_back_image_path)
          : Promise.resolve(null);

        const [frontUrl, backUrl] = await Promise.all([frontPromise, backPromise]);

        if (!cancelled) {
          setReviewFrontUrl(frontUrl);
          setReviewBackUrl(backUrl);
        }
      } catch (e: any) {
        if (!cancelled) {
          setReviewImageErr(e?.message ?? "Failed to load government ID images.");
        }
      } finally {
        if (!cancelled) {
          setReviewImageLoading(false);
        }
      }
    }

    loadReviewImages();

    return () => {
      cancelled = true;
    };
  }, [review]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewImages() {
      if (!imagePreview) {
        setPreviewFrontUrl(null);
        setPreviewBackUrl(null);
        setPreviewErr(null);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      setPreviewErr(null);
      setPreviewFrontUrl(null);
      setPreviewBackUrl(null);

      try {
        const frontPromise = imagePreview.front_path
          ? createSignedImageUrl(imagePreview.front_path)
          : Promise.resolve(null);

        const backPromise = imagePreview.back_path
          ? createSignedImageUrl(imagePreview.back_path)
          : Promise.resolve(null);

        const [frontUrl, backUrl] = await Promise.all([frontPromise, backPromise]);

        if (!cancelled) {
          setPreviewFrontUrl(frontUrl);
          setPreviewBackUrl(backUrl);
        }
      } catch (e: any) {
        if (!cancelled) {
          setPreviewErr(e?.message ?? "Failed to load government ID images.");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    loadPreviewImages();

    return () => {
      cancelled = true;
    };
  }, [imagePreview]);

  async function fetchProfileSnapshot(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,account_status,full_name,role,verification_status,country,created_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async function fetchAgentSnapshot(agentId: string) {
    const { data, error } = await supabase
      .from("agents")
      .select(
        "id,user_id,kyc_status,license_number,kyc_id_front_image_path,kyc_id_front_image_uploaded_at,kyc_id_back_image_path,kyc_id_back_image_uploaded_at,kyc_submitted_at,created_at"
      )
      .eq("id", agentId)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  function resetReviewState() {
    setReason("");
    setAuditErr(null);
    setCheckGovId(false);
    setCheckNotExpired(false);
    setCheckIdentityMatch(false);
    setCheckFraudReview(false);
    setReviewFrontUrl(null);
    setReviewBackUrl(null);
    setReviewImageErr(null);
    setReviewImageLoading(false);
  }

  const openReview = (kind: "approve_kyc" | "reject_kyc", row: AgentRow) => {
    const p = profiles[row.user_id];
    const label = p?.full_name?.trim() || "Agent";

    resetReviewState();
    setErrorMsg("");

    setReview({
      kind,
      agent_id: row.id,
      user_id: row.user_id,
      agent_label: `${label} • ${shortId(row.user_id)}`,
      license_number: row.license_number,
      kyc_id_front_image_path: row.kyc_id_front_image_path,
      kyc_id_front_image_uploaded_at: row.kyc_id_front_image_uploaded_at,
      kyc_id_back_image_path: row.kyc_id_back_image_path,
      kyc_id_back_image_uploaded_at: row.kyc_id_back_image_uploaded_at,
      kyc_submitted_at: row.kyc_submitted_at,
    });
  };

  const closeReview = () => {
    if (busyId) return;
    setReview(null);
    resetReviewState();
  };

  const openImagePreview = (row: AgentRow) => {
    const p = profiles[row.user_id];
    const label = p?.full_name?.trim() || "Agent";

    setPreviewFrontUrl(null);
    setPreviewBackUrl(null);
    setPreviewErr(null);

    setImagePreview({
      agent_label: `${label} • ${shortId(row.user_id)}`,
      license_number: row.license_number,
      front_path: row.kyc_id_front_image_path,
      front_uploaded_at: row.kyc_id_front_image_uploaded_at,
      back_path: row.kyc_id_back_image_path,
      back_uploaded_at: row.kyc_id_back_image_uploaded_at,
      submitted_at: getSubmittedAt(row),
    });
  };

  const closeImagePreview = () => {
    setImagePreview(null);
    setPreviewFrontUrl(null);
    setPreviewBackUrl(null);
    setPreviewErr(null);
    setPreviewLoading(false);
  };

  const updateKycStatus = async (
    row: AgentRow,
    status: "verified" | "rejected",
    auditReason: string
  ): Promise<boolean> => {
    setErrorMsg("");
    setAuditErr(null);
    setBusyId(row.id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return false;

      const before = await fetchAgentSnapshot(row.id);

      const { data: updatedRow, error } = await supabase
        .from("agents")
        .update({ kyc_status: status })
        .eq("id", row.id)
        .select(
          "id,user_id,kyc_status,license_number,kyc_id_front_image_path,kyc_id_front_image_uploaded_at,kyc_id_back_image_path,kyc_id_back_image_uploaded_at,kyc_submitted_at,created_at"
        )
        .maybeSingle();

      if (error) throw error;

      const after = updatedRow ?? (await fetchAgentSnapshot(row.id));

      if (!after) {
        const msg = "KYC update could not be verified because the updated agent record could not be reloaded.";
        setErrorMsg(msg);
        setAuditErr(msg);
        await load();
        return false;
      }

      if (after.kyc_status !== status) {
        const msg = `KYC update did not persist. Expected "${status}" but record is still "${after.kyc_status}".`;
        setErrorMsg(msg);
        setAuditErr(msg);
        await load();
        return false;
      }

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: status === "verified" ? "approve_agent_kyc" : "reject_agent_kyc",
          entity_type: "agent",
          entity_id: row.id,
          reason: auditReason,
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`KYC updated, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
      return true;
    } catch (e: any) {
      const msg = e?.message ?? "Failed to update KYC status.";
      setErrorMsg(msg);
      setAuditErr(msg);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmReview = async () => {
    if (!review) return;

    const cleanReason = reason.trim();
    if (!cleanReason) {
      setAuditErr("Reason is required.");
      return;
    }

    const currentRow = rows.find((r) => r.id === review.agent_id);
    if (!currentRow) {
      setAuditErr("Agent record not found.");
      return;
    }

    if (review.kind === "approve_kyc") {
      if (!String(review.license_number || "").trim()) {
        setAuditErr("Cannot approve KYC without a government ID number.");
        return;
      }

      if (!String(review.kyc_id_front_image_path || "").trim()) {
        setAuditErr("Cannot approve KYC without the front ID image.");
        return;
      }

      if (!String(review.kyc_id_back_image_path || "").trim()) {
        setAuditErr("Cannot approve KYC without the back ID image.");
        return;
      }

      if (!checkGovId || !checkNotExpired || !checkIdentityMatch || !checkFraudReview) {
        setAuditErr("All trust checks must be confirmed before approval.");
        return;
      }

      const composedReason =
        `Approve agent KYC. ${cleanReason} | ` +
        `Checks confirmed: government ID number reviewed, front ID image reviewed, back ID image reviewed, non-expired document confirmed, identity match reviewed, fraud review completed.`;

      const ok = await updateKycStatus(currentRow, "verified", composedReason);
      if (ok) {
        closeReview();
      }
      return;
    }

    const rejectReason = `Reject agent KYC. ${cleanReason}`;
    const ok = await updateKycStatus(currentRow, "rejected", rejectReason);
    if (ok) {
      closeReview();
    }
  };

  const openEnforcement = (kind: "disable_agent" | "enable_agent", row: AgentRow) => {
    const p = profiles[row.user_id];
    const label = p?.full_name?.trim() || "Agent";
    setReason("");
    setAuditErr(null);
    setErrorMsg("");
    setEnforce({
      kind,
      agent_id: row.id,
      user_id: row.user_id,
      agent_label: `${label} • ${shortId(row.user_id)}`,
    });
  };

  const closeEnforcement = () => {
    if (busyId) return;
    setEnforce(null);
    setReason("");
    setAuditErr(null);
  };

  const confirmEnforcement = async () => {
    if (!enforce) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setAuditErr("Reason is required.");
      return;
    }

    setErrorMsg("");
    setAuditErr(null);
    setBusyId(enforce.agent_id);

    try {
      const actorUserId = await getActorUserIdOrRedirect(router);
      if (!actorUserId) return;

      const before = await fetchProfileSnapshot(enforce.user_id);

      const nextStatus = enforce.kind === "disable_agent" ? "disabled" : "active";

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ account_status: nextStatus })
        .eq("user_id", enforce.user_id);

      if (upErr) throw upErr;

      const after = await fetchProfileSnapshot(enforce.user_id);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: enforce.kind,
          entity_type: "agent",
          entity_id: enforce.user_id,
          reason: cleanReason,
          before,
          after,
        });
      } catch (auditInsertErr: any) {
        setAuditErr(`Enforcement applied, but audit log insert failed. (${auditInsertErr?.message ?? "audit error"})`);
      }

      await load();
      closeEnforcement();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to apply enforcement.");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = rows.filter((r) => r.kyc_status === "pending").length;
  const verifiedCount = rows.filter((r) => r.kyc_status === "verified").length;
  const rejectedCount = rows.filter((r) => r.kyc_status === "rejected").length;

  const summary = useMemo(() => {
    if (loading) return { label: "Loading…", tone: "text-black/60" as const };
    if (errorMsg) return { label: "Attention needed", tone: "text-red-700" as const };
    if (pendingCount === 0) return { label: "No pending KYC", tone: "text-black/60" as const };
    return { label: `${pendingCount} pending review`, tone: "text-[#0a4f63]" as const };
  }, [loading, errorMsg, pendingCount]);

  return (
    <main className="min-h-[calc(100vh-120px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Agent Verifications</h1>
              <p className="mt-1 text-sm text-black/60">
                Strict KYC review for fraud control, trust screening, and safer marketplace participation.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
            >
              ← Admin Home
            </Link>
            <span className={`rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-medium ${summary.tone}`}>
              {summary.label}
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
            href="/admin/audit"
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Audit Log
          </Link>
          <Link
            href="/admin/metrics"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
          >
            Metrics
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {auditErr ? (
        <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{auditErr}</div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SmallRuleCard
          title="Core approval rule"
          body="Only approve agents after reviewing the government ID number, front ID image, back ID image, document validity, identity consistency, and fraud-risk signals."
          tone="good"
        />
        <SmallRuleCard
          title="Current schema direction"
          body="Front and back ID evidence are now the required KYC review standard. Future upgrades should add expiry-date capture, selfie match, and stronger fraud tooling."
          tone="warn"
        />
        <SmallRuleCard
          title="Operational standard"
          body="Every approval, rejection, disable, or enable action must carry a written reason so Keyvera maintains an auditable trust trail."
          tone="neutral"
        />
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.06)] p-5 shadow-[0_12px_30px_rgba(11,31,42,0.06)]">
          <div className="text-xs font-semibold text-black/60">Pending KYC</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{pendingCount}</div>
        </div>
        <div className="rounded-[22px] border border-black/10 bg-[rgba(11,31,42,0.04)] p-5 shadow-[0_12px_30px_rgba(11,31,42,0.06)]">
          <div className="text-xs font-semibold text-black/60">Verified</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{verifiedCount}</div>
        </div>
        <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 p-5 shadow-[0_12px_30px_rgba(11,31,42,0.06)]">
          <div className="text-xs font-semibold text-black/60">Rejected</div>
          <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{rejectedCount}</div>
        </div>
      </section>

      <SectionShell
        title={
          <>
            <div className="text-sm font-semibold text-[#0b1f2a]">KYC Review Queue</div>
            <SectionBadge>{rows.length}</SectionBadge>
          </>
        }
        subtitle="Pending, verified, and rejected agent KYC records. Review front and back ID evidence before approval."
        right={<div className="text-xs text-black/50">Trust-first review workspace</div>}
      >
        {loading ? (
          <div className="p-6 text-sm text-black/60">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No agent KYC records."
            body="When agents submit or move through KYC, they’ll appear here."
          />
        ) : (
          <>
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1440px] text-left text-sm">
                  <thead className="bg-gradient-to-b from-black/5 to-black/0">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Agent</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Agent ID</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">KYC</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Account</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Government ID</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Front ID</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Back ID</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Submitted</th>
                      <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const busy = busyId === r.id;
                      const p = profiles[r.user_id];
                      const account = (p?.account_status || "active").toLowerCase();
                      const isDisabled = account === "disabled";

                      return (
                        <tr key={r.id} className="border-t border-black/5 align-top">
                          <td className="px-5 py-5">
                            <div className="min-w-0">
                              <div className="font-semibold text-[#0b1f2a]">{p?.full_name?.trim() || "Agent"}</div>
                              <div className="mt-1 font-mono text-xs text-black/50" title={r.user_id}>
                                {shortId(r.user_id)}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-5">
                            <div className="font-mono text-xs text-[#0b1f2a]" title={r.id}>
                              {shortId(r.id)}
                            </div>
                          </td>

                          <td className="px-5 py-5">
                            <span className={kycPill(r.kyc_status)}>{r.kyc_status}</span>
                          </td>

                          <td className="px-5 py-5">
                            <span className={statusPill(account)}>{account}</span>
                          </td>

                          <td className="px-5 py-5 text-[#0b1f2a]">{r.license_number ?? "—"}</td>

                          <td className="px-5 py-5">
                            {hasFrontImage(r.kyc_id_front_image_path) ? (
                              <div className="space-y-2">
                                <span className="inline-flex items-center rounded-full border border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#0a4f63]">
                                  Uploaded
                                </span>
                                <div className="text-xs text-black/50">{getImageFileName(r.kyc_id_front_image_path)}</div>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-red-700">Missing front</div>
                            )}
                          </td>

                          <td className="px-5 py-5">
                            {hasBackImage(r.kyc_id_back_image_path) ? (
                              <div className="space-y-2">
                                <span className="inline-flex items-center rounded-full border border-[rgba(14,165,163,0.20)] bg-[rgba(14,165,163,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#0a4f63]">
                                  Uploaded
                                </span>
                                <div className="text-xs text-black/50">{getImageFileName(r.kyc_id_back_image_path)}</div>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-red-700">Missing back</div>
                            )}
                          </td>

                          <td className="px-5 py-5 text-black/60">{fmtDate(getSubmittedAt(r))}</td>

                          <td className="px-5 py-5">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                onClick={() => openImagePreview(r)}
                                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                              >
                                View Images
                              </button>

                              {r.kyc_status === "pending" ? (
                                <>
                                  <button
                                    onClick={() => openReview("approve_kyc", r)}
                                    disabled={busy}
                                    className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                      busy
                                        ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                        : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                                    }`}
                                  >
                                    {busy ? "Working…" : "Approve KYC"}
                                  </button>

                                  <button
                                    onClick={() => openReview("reject_kyc", r)}
                                    disabled={busy}
                                    className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                      busy
                                        ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                        : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                                    }`}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}

                              {isDisabled ? (
                                <button
                                  onClick={() => openEnforcement("enable_agent", r)}
                                  disabled={busy}
                                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                      : "bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(11,31,42,0.20)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]"
                                  }`}
                                >
                                  Enable Agent
                                </button>
                              ) : (
                                <button
                                  onClick={() => openEnforcement("disable_agent", r)}
                                  disabled={busy}
                                  className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold transition ${
                                    busy
                                      ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                      : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  }`}
                                >
                                  Disable Agent
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 p-4 md:p-5 xl:hidden">
              {rows.map((r) => {
                const busy = busyId === r.id;
                const p = profiles[r.user_id];
                const account = (p?.account_status || "active").toLowerCase();
                const isDisabled = account === "disabled";

                return (
                  <article
                    key={r.id}
                    className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0b1f2a]">{p?.full_name?.trim() || "Agent"}</div>
                        <div className="mt-1 font-mono text-xs text-black/50" title={r.user_id}>
                          {shortId(r.user_id)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={kycPill(r.kyc_status)}>{r.kyc_status}</span>
                        <span className={statusPill(account)}>{account}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Agent ID</div>
                        <div className="mt-1 font-mono text-xs text-[#0b1f2a]" title={r.id}>
                          {shortId(r.id)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Government ID No.</div>
                        <div className="mt-1 text-sm text-[#0b1f2a]">{r.license_number ?? "—"}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Front ID</div>
                        <div className="mt-1 text-sm text-black/60">
                          {hasFrontImage(r.kyc_id_front_image_path) ? getImageFileName(r.kyc_id_front_image_path) : "Missing front"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Back ID</div>
                        <div className="mt-1 text-sm text-black/60">
                          {hasBackImage(r.kyc_id_back_image_path) ? getImageFileName(r.kyc_id_back_image_path) : "Missing back"}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Submitted</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(getSubmittedAt(r))}</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <button
                        onClick={() => openImagePreview(r)}
                        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      >
                        View Images
                      </button>

                      {r.kyc_status === "pending" ? (
                        <>
                          <button
                            onClick={() => openReview("approve_kyc", r)}
                            disabled={busy}
                            className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                                : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)] hover:shadow-[0_18px_44px_rgba(10,79,99,0.30)]"
                            }`}
                          >
                            {busy ? "Working…" : "Approve KYC"}
                          </button>

                          <button
                            onClick={() => openReview("reject_kyc", r)}
                            disabled={busy}
                            className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                              busy
                                ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                                : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                            }`}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}

                      {isDisabled ? (
                        <button
                          onClick={() => openEnforcement("enable_agent", r)}
                          disabled={busy}
                          className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                              : "bg-gradient-to-r from-[#0b1f2a] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(11,31,42,0.20)] hover:shadow-[0_18px_44px_rgba(11,31,42,0.28)]"
                          }`}
                        >
                          Enable Agent
                        </button>
                      ) : (
                        <button
                          onClick={() => openEnforcement("disable_agent", r)}
                          disabled={busy}
                          className={`rounded-2xl border px-4 py-3 text-xs font-semibold transition ${
                            busy
                              ? "cursor-not-allowed border-black/10 bg-white/70 text-black/40"
                              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          Disable Agent
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </SectionShell>

      {review ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeReview} />
          <div className="relative w-full max-w-6xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">
                    {review.kind === "approve_kyc" ? "Approve agent KYC" : "Reject agent KYC"}
                  </div>
                  <div className="mt-1 text-sm text-black/60">
                    <span className="font-mono text-xs">{review.agent_label}</span>
                  </div>
                  <div className="mt-2 text-xs text-black/50">
                    Government ID / license number ={" "}
                    <span className="font-semibold text-[#0b1f2a]">{review.license_number || "missing"}</span>
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    Submitted = <span className="font-semibold text-[#0b1f2a]">{fmtDate(review.kyc_submitted_at)}</span>
                  </div>
                </div>

                <button
                  onClick={closeReview}
                  disabled={!!busyId}
                  className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-black/10 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#0b1f2a]">Front ID image</div>
                        <div className="mt-1 text-xs text-black/50">
                          {review.kyc_id_front_image_path ? getImageFileName(review.kyc_id_front_image_path) : "No front image"}
                        </div>
                      </div>
                      {reviewFrontUrl ? (
                        <a
                          href={reviewFrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-black/50">Uploaded: {fmtDate(review.kyc_id_front_image_uploaded_at)}</div>

                    {reviewImageLoading ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                        Loading images…
                      </div>
                    ) : reviewFrontUrl ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-3">
                        <img
                          src={reviewFrontUrl}
                          alt="Front ID"
                          className="max-h-[420px] w-full rounded-2xl object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Front ID image missing.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-black/10 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#0b1f2a]">Back ID image</div>
                        <div className="mt-1 text-xs text-black/50">
                          {review.kyc_id_back_image_path ? getImageFileName(review.kyc_id_back_image_path) : "No back image"}
                        </div>
                      </div>
                      {reviewBackUrl ? (
                        <a
                          href={reviewBackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-black/50">Uploaded: {fmtDate(review.kyc_id_back_image_uploaded_at)}</div>

                    {reviewImageLoading ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                        Loading images…
                      </div>
                    ) : reviewBackUrl ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-3">
                        <img
                          src={reviewBackUrl}
                          alt="Back ID"
                          className="max-h-[420px] w-full rounded-2xl object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Back ID image missing.
                      </div>
                    )}
                  </div>

                  {reviewImageErr ? (
                    <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {reviewImageErr}
                    </div>
                  ) : null}
                </div>

                <div>
                  {review.kind === "approve_kyc" ? (
                    <div className="rounded-[24px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-4">
                      <div className="text-sm font-semibold text-[#0b1f2a]">Mandatory trust checks before approval</div>
                      <div className="mt-3 grid gap-3">
                        <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/70">
                          <input
                            type="checkbox"
                            checked={checkGovId}
                            onChange={(e) => setCheckGovId(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>I reviewed the government ID number, front image, and back image.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/70">
                          <input
                            type="checkbox"
                            checked={checkNotExpired}
                            onChange={(e) => setCheckNotExpired(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>I confirmed the document is not expired.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/70">
                          <input
                            type="checkbox"
                            checked={checkIdentityMatch}
                            onChange={(e) => setCheckIdentityMatch(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>I confirmed the identity details are consistent with the agent record.</span>
                        </label>

                        <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/70">
                          <input
                            type="checkbox"
                            checked={checkFraudReview}
                            onChange={(e) => setCheckFraudReview(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>I completed a fraud-risk review and found no disqualifying red flags.</span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Rejection should be used when the KYC evidence is missing, suspicious, inconsistent, unreadable, or expired.
                    </div>
                  )}

                  <div className="mt-5">
                    <div className="text-[11px] font-medium text-black/50">Reason (required)</div>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={6}
                      placeholder={
                        review.kind === "approve_kyc"
                          ? "Write the approval reason and review notes..."
                          : "Write the rejection reason clearly..."
                      }
                      className="mt-1 w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                    />
                    {auditErr ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{auditErr}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  onClick={closeReview}
                  disabled={!!busyId}
                  className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmReview}
                  disabled={!!busyId}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    review.kind === "approve_kyc"
                      ? "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                      : "bg-gradient-to-r from-[#b91c1c] to-[#7f1d1d] shadow-[0_16px_38px_rgba(185,28,28,0.24)] hover:shadow-[0_20px_46px_rgba(185,28,28,0.30)]"
                  }`}
                >
                  {busyId ? "Working…" : review.kind === "approve_kyc" ? "Confirm Approval" : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {imagePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeImagePreview} />
          <div className="relative w-full max-w-6xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">Government ID image preview</div>
                  <div className="mt-1 text-sm text-black/60">
                    <span className="font-mono text-xs">{imagePreview.agent_label}</span>
                  </div>
                  <div className="mt-2 text-xs text-black/50">
                    Government ID / license number ={" "}
                    <span className="font-semibold text-[#0b1f2a]">{imagePreview.license_number || "missing"}</span>
                  </div>
                  <div className="mt-1 text-xs text-black/50">Submitted = {fmtDate(imagePreview.submitted_at)}</div>
                </div>

                <button
                  onClick={closeImagePreview}
                  className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                >
                  Close
                </button>
              </div>

              {previewLoading ? (
                <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                  Loading government ID images…
                </div>
              ) : previewErr ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {previewErr}
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-black/10 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#0b1f2a]">Front ID image</div>
                        <div className="mt-1 text-xs text-black/50">
                          {imagePreview.front_path ? getImageFileName(imagePreview.front_path) : "No front image"}
                        </div>
                      </div>
                      {previewFrontUrl ? (
                        <a
                          href={previewFrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-black/50">Uploaded: {fmtDate(imagePreview.front_uploaded_at)}</div>

                    {previewFrontUrl ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-3">
                        <img
                          src={previewFrontUrl}
                          alt="Front ID preview"
                          className="max-h-[520px] w-full rounded-2xl object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Front ID image missing.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-black/10 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#0b1f2a]">Back ID image</div>
                        <div className="mt-1 text-xs text-black/50">
                          {imagePreview.back_path ? getImageFileName(imagePreview.back_path) : "No back image"}
                        </div>
                      </div>
                      {previewBackUrl ? (
                        <a
                          href={previewBackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                        >
                          Open
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-black/50">Uploaded: {fmtDate(imagePreview.back_uploaded_at)}</div>

                    {previewBackUrl ? (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-3">
                        <img
                          src={previewBackUrl}
                          alt="Back ID preview"
                          className="max-h-[520px] w-full rounded-2xl object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Back ID image missing.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {enforce ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeEnforcement} />
          <div className="relative w-full max-w-xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">Confirm enforcement</div>
                  <div className="mt-1 text-sm text-black/60">
                    {enforce.kind === "disable_agent" ? "Disable agent access" : "Enable agent access"} •{" "}
                    <span className="font-mono text-xs">{enforce.agent_label}</span>
                  </div>
                </div>

                <button
                  onClick={closeEnforcement}
                  disabled={!!busyId}
                  className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Close
                </button>
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-medium text-black/50">Reason (required)</div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Write the reason that will appear in the audit log…"
                  className="mt-1 w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                />
                {auditErr ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{auditErr}</div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  onClick={closeEnforcement}
                  disabled={!!busyId}
                  className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmEnforcement}
                  disabled={!!busyId}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    enforce.kind === "disable_agent"
                      ? "bg-gradient-to-r from-[#b91c1c] to-[#7f1d1d] shadow-[0_16px_38px_rgba(185,28,28,0.24)] hover:shadow-[0_20px_46px_rgba(185,28,28,0.30)]"
                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                  }`}
                >
                  {busyId ? "Working…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}