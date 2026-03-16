"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireSuperAdmin, type AdminAccessResult, type AdminLevel } from "@/lib/adminGuard";

type AdminProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  account_status: string | null;
  admin_level: string | null;
  admin_access_status: string | null;
  admin_invited_by_user_id: string | null;
  admin_approved_by_user_id: string | null;
  admin_approved_at: string | null;
  admin_access_note: string | null;
  admin_invitation_id: string | null;
  created_at: string | null;
};

type InvitationRow = {
  id: string;
  email: string;
  invited_admin_level: string;
  invited_by_user_id: string;
  invite_token: string;
  invite_status: string;
  owner_approval_required: boolean;
  approved_by_user_id: string | null;
  approved_at: string | null;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  revoked_by_user_id: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
};

type ProfileMini = {
  user_id: string;
  full_name: string | null;
};

type ApprovalModalState = null | {
  userId: string;
  fullName: string;
  adminLevel: string | null;
  invitationId: string | null;
};

const ADMIN_LEVEL_OPTIONS: Array<{ value: AdminLevel; label: string }> = [
  { value: "admin_ops", label: "Operations Admin" },
  { value: "kyc_admin", label: "KYC Admin" },
  { value: "support_admin", label: "Support Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const PRODUCTION_INVITE_BASE_URL = "https://keyvera.org";

function BadgeIcon({ size = 44 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl border border-black/10 bg-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function shortId(id: string | null | undefined) {
  const s = String(id || "");
  if (!s) return "—";
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function fmtDate(value: string | null | undefined) {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getAdminLevelLabel(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "super_admin") return "Super Admin";
  if (raw === "admin_ops") return "Operations Admin";
  if (raw === "kyc_admin") return "KYC Admin";
  if (raw === "support_admin") return "Support Admin";
  return "Legacy Admin";
}

function adminLevelPill(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (raw === "super_admin") {
    return `${base} border-[rgba(10,79,99,0.22)] bg-[rgba(10,79,99,0.10)] text-[#0a4f63]`;
  }
  if (raw === "admin_ops" || raw === "kyc_admin" || raw === "support_admin") {
    return `${base} border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  }
  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function accessStatusPill(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";

  if (raw === "active") return `${base} border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (raw === "pending_owner_approval") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (raw === "disabled" || raw === "revoked") return `${base} border-red-200 bg-red-50 text-red-700`;

  return `${base} border-black/10 bg-white/70 text-black/60`;
}

function inviteStatusPill(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";

  if (raw === "approved") return `${base} border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (raw === "accepted" || raw === "sent") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (raw === "revoked" || raw === "expired") return `${base} border-red-200 bg-red-50 text-red-700`;

  return `${base} border-black/10 bg-white/70 text-black/60`;
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

function SummaryCard({ title, value, tone = "neutral" }: { title: string; value: React.ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const cls =
    tone === "good"
      ? "border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.06)]"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50/70"
      : "border-black/10 bg-[rgba(11,31,42,0.04)]";

  return (
    <div className={`rounded-[22px] border p-5 shadow-[0_12px_30px_rgba(11,31,42,0.06)] ${cls}`}>
      <div className="text-xs font-semibold text-black/60">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-[#0b1f2a]">{value}</div>
    </div>
  );
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

export default function AdminAdminsPage() {
  const router = useRouter();

  const [access, setAccess] = useState<AdminAccessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileRows, setProfileRows] = useState<AdminProfileRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileMini>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAdminLevel, setInviteAdminLevel] = useState<AdminLevel>("admin_ops");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteDays, setInviteDays] = useState("7");
  const [latestInviteLink, setLatestInviteLink] = useState("");

  const [approvalModal, setApprovalModal] = useState<ApprovalModalState>(null);
  const [approvalNote, setApprovalNote] = useState("");

  const load = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const guard = await requireSuperAdmin();
      setAccess(guard);

      if (!guard.ok) {
        router.push("/admin");
        return;
      }

      const { data: rows, error: profileErr } = await supabase
        .from("profiles")
        .select(
          "user_id,full_name,role,account_status,admin_level,admin_access_status,admin_invited_by_user_id,admin_approved_by_user_id,admin_approved_at,admin_access_note,admin_invitation_id,created_at"
        )
        .or("role.eq.admin,admin_access_status.eq.pending_owner_approval")
        .order("created_at", { ascending: false });

      if (profileErr) throw profileErr;

      const { data: inviteRows, error: inviteErr } = await supabase
        .from("admin_invitations")
        .select(
          "id,email,invited_admin_level,invited_by_user_id,invite_token,invite_status,owner_approval_required,approved_by_user_id,approved_at,accepted_by_user_id,accepted_at,revoked_by_user_id,revoked_at,expires_at,note,created_at"
        )
        .order("created_at", { ascending: false });

      if (inviteErr) throw inviteErr;

      const loadedProfiles = (rows ?? []) as AdminProfileRow[];
      const loadedInvites = (inviteRows ?? []) as InvitationRow[];

      setProfileRows(loadedProfiles);
      setInvitations(loadedInvites);

      const profileIds = Array.from(
        new Set(
          [
            ...loadedProfiles.flatMap((row) => [
              String(row.user_id || ""),
              String(row.admin_invited_by_user_id || ""),
              String(row.admin_approved_by_user_id || ""),
            ]),
            ...loadedInvites.flatMap((row) => [
              String(row.invited_by_user_id || ""),
              String(row.approved_by_user_id || ""),
              String(row.accepted_by_user_id || ""),
              String(row.revoked_by_user_id || ""),
            ]),
          ].filter(Boolean)
        )
      );

      if (profileIds.length) {
        const { data: miniProfiles, error: miniErr } = await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", profileIds);

        if (miniErr) throw miniErr;

        const nextMap: Record<string, ProfileMini> = {};
        (miniProfiles ?? []).forEach((row: any) => {
          nextMap[String(row.user_id)] = {
            user_id: String(row.user_id),
            full_name: row.full_name ? String(row.full_name) : null,
          };
        });

        setProfileMap(nextMap);
      } else {
        setProfileMap({});
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load admin management.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentAdmins = useMemo(() => profileRows.filter((row) => row.role === "admin"), [profileRows]);

  const pendingOwnerApprovalRows = useMemo(
    () => profileRows.filter((row) => String(row.admin_access_status || "").toLowerCase() === "pending_owner_approval"),
    [profileRows]
  );

  const invitationProfileMap = useMemo(() => {
    const map: Record<string, AdminProfileRow> = {};
    profileRows.forEach((row) => {
      const invitationId = String(row.admin_invitation_id || "");
      if (invitationId) {
        map[invitationId] = row;
      }
    });
    return map;
  }, [profileRows]);

  const invitationMap = useMemo(() => {
    const map: Record<string, InvitationRow> = {};
    invitations.forEach((row) => {
      map[row.id] = row;
    });
    return map;
  }, [invitations]);

  const superAdminCount = useMemo(
    () => currentAdmins.filter((row) => String(row.admin_level || "").toLowerCase() === "super_admin").length,
    [currentAdmins]
  );

  const activeAdminCount = useMemo(
    () => currentAdmins.filter((row) => String(row.admin_access_status || "").toLowerCase() === "active").length,
    [currentAdmins]
  );

  const openInvitationCount = useMemo(
    () =>
      invitations.filter((row) => {
        const s = String(row.invite_status || "").toLowerCase();
        return s === "sent" || s === "accepted";
      }).length,
    [invitations]
  );

  const getProfileName = (userId: string | null | undefined) => {
    if (!userId) return "—";
    const name = profileMap[userId]?.full_name?.trim();
    return name || shortId(userId);
  };

  const createInviteLink = (token: string) => {
    return `${PRODUCTION_INVITE_BASE_URL}/admin/accept-invite?token=${token}`;
  };

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMsg("Production invite link copied.");
    } catch {
      setSuccessMsg("Production invite link generated. Copy it manually from the field.");
    }
  };

  const createInvitation = async () => {
    const actorUserId = access?.userId || null;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanNote = inviteNote.trim();
    const parsedDays = Number(inviteDays);
    const expiresAt =
      Number.isFinite(parsedDays) && parsedDays > 0
        ? new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    if (!actorUserId) {
      setErrorMsg("Current admin identity could not be resolved.");
      return;
    }

    if (!cleanEmail) {
      setErrorMsg("Invite email is required.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setErrorMsg("Enter a valid invite email.");
      return;
    }

    setBusyKey("create-invite");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const insertPayload = {
        email: cleanEmail,
        invited_admin_level: inviteAdminLevel,
        invited_by_user_id: actorUserId,
        owner_approval_required: true,
        expires_at: expiresAt,
        note: cleanNote || null,
      };

      const { data: inserted, error } = await supabase
        .from("admin_invitations")
        .insert(insertPayload)
        .select(
          "id,email,invited_admin_level,invited_by_user_id,invite_token,invite_status,owner_approval_required,approved_by_user_id,approved_at,accepted_by_user_id,accepted_at,revoked_by_user_id,revoked_at,expires_at,note,created_at"
        )
        .single();

      if (error) throw error;

      const invite = inserted as InvitationRow;
      const inviteLink = createInviteLink(invite.invite_token);

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: "create_admin_invitation",
          entity_type: "admin_invitation",
          entity_id: invite.id,
          reason: `Created admin invitation for ${cleanEmail} as ${inviteAdminLevel}.`,
          before: null,
          after: invite,
        });
      } catch {
        // keep page flow clean even if audit insert misses
      }

      setLatestInviteLink(inviteLink);
      setInviteEmail("");
      setInviteAdminLevel("admin_ops");
      setInviteNote("");
      setInviteDays("7");
      setSuccessMsg("Production admin invitation created. Copy the keyvera.org link and send it yourself.");
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to create admin invitation.");
    } finally {
      setBusyKey(null);
    }
  };

  const openApproval = (row: AdminProfileRow) => {
    setApprovalNote("");
    setErrorMsg("");
    setSuccessMsg("");
    setApprovalModal({
      userId: row.user_id,
      fullName: row.full_name?.trim() || "Pending Admin",
      adminLevel: row.admin_level,
      invitationId: row.admin_invitation_id,
    });
  };

  const closeApproval = () => {
    if (busyKey) return;
    setApprovalModal(null);
    setApprovalNote("");
  };

  const approvePendingAccess = async () => {
    if (!approvalModal) return;

    const actorUserId = access?.userId || null;
    const cleanNote = approvalNote.trim();

    if (!actorUserId) {
      setErrorMsg("Current admin identity could not be resolved.");
      return;
    }

    if (!cleanNote) {
      setErrorMsg("Approval note is required.");
      return;
    }

    setBusyKey(`approve-${approvalModal.userId}`);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: beforeProfile, error: beforeErr } = await supabase
        .from("profiles")
        .select(
          "user_id,full_name,role,account_status,admin_level,admin_access_status,admin_invited_by_user_id,admin_approved_by_user_id,admin_approved_at,admin_access_note,admin_invitation_id"
        )
        .eq("user_id", approvalModal.userId)
        .maybeSingle();

      if (beforeErr) throw beforeErr;

      const approvedAt = new Date().toISOString();

      const { data: afterProfile, error: updateErr } = await supabase
        .from("profiles")
        .update({
          role: "admin",
          admin_level: approvalModal.adminLevel ?? "admin_ops",
          admin_access_status: "active",
          admin_approved_by_user_id: actorUserId,
          admin_approved_at: approvedAt,
          admin_role_changed_by_user_id: actorUserId,
          admin_role_changed_at: approvedAt,
          admin_access_note: cleanNote,
          account_status: "active",
        })
        .eq("user_id", approvalModal.userId)
        .select(
          "user_id,full_name,role,account_status,admin_level,admin_access_status,admin_invited_by_user_id,admin_approved_by_user_id,admin_approved_at,admin_access_note,admin_invitation_id"
        )
        .maybeSingle();

      if (updateErr) throw updateErr;

      if (approvalModal.invitationId) {
        await supabase
          .from("admin_invitations")
          .update({
            invite_status: "approved",
            approved_by_user_id: actorUserId,
            approved_at: approvedAt,
          })
          .eq("id", approvalModal.invitationId);
      }

      try {
        await logAudit({
          actor_user_id: actorUserId,
          action: "approve_admin_access",
          entity_type: "profile",
          entity_id: approvalModal.userId,
          reason: cleanNote,
          before: beforeProfile,
          after: afterProfile,
        });
      } catch {
        // keep UI flow clean
      }

      setSuccessMsg("Admin access approved.");
      closeApproval();
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to approve admin access.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="min-h-[calc(100vh-120px)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <BadgeIcon size={44} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Admin Access Control</h1>
              <p className="mt-1 text-sm text-black/60">
                Owner-controlled admin invitations, approval queue, and RBAC visibility for future Keyvera growth.
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

            {access?.accessMode === "legacy" ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                Legacy owner fallback active
              </span>
            ) : (
              <span className="rounded-full border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] px-2.5 py-1 text-[11px] font-medium text-[#0a4f63]">
                Super-admin access
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-[28px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-5 text-sm text-[#0a4f63]">
        Sub-admin onboarding is production-only. Invite links generated here always point to <span className="font-semibold">keyvera.org</span>. Localhost stays for your owner development work only.
      </div>

      {access?.accessMode === "legacy" ? (
        <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          You are currently entering this screen through legacy owner fallback. This is safe for rollout, but we should assign your profile
          an explicit <span className="font-semibold">super_admin</span> level soon.
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {successMsg ? (
        <div className="mb-6 rounded-[28px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-5 text-sm text-[#0a4f63]">
          {successMsg}
        </div>
      ) : null}

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <SummaryCard title="Super Admins" value={superAdminCount} tone="good" />
        <SummaryCard title="Active Admins" value={activeAdminCount} tone="neutral" />
        <SummaryCard title="Open Invitations" value={openInvitationCount} tone="warn" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionShell
          title={
            <>
              <div className="text-sm font-semibold text-[#0b1f2a]">Create Admin Invitation</div>
              <SectionBadge>Owner sent only</SectionBadge>
            </>
          }
          subtitle="You generate a production invite link here, then send it yourself. Sub-admin onboarding runs on keyvera.org, not localhost."
        >
          <div className="p-5 md:p-6">
            <div className="grid gap-4">
              <div>
                <div className="text-[11px] font-medium text-black/50">Invite email</div>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="newadmin@example.com"
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                />
              </div>

              <div>
                <div className="text-[11px] font-medium text-black/50">Admin level</div>
                <select
                  value={inviteAdminLevel}
                  onChange={(e) => setInviteAdminLevel(e.target.value as AdminLevel)}
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                >
                  {ADMIN_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-medium text-black/50">Invite expires in days</div>
                <input
                  value={inviteDays}
                  onChange={(e) => setInviteDays(e.target.value)}
                  inputMode="numeric"
                  placeholder="7"
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                />
              </div>

              <div>
                <div className="text-[11px] font-medium text-black/50">Owner message</div>
                <textarea
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  rows={5}
                  placeholder="Write a clean owner message for this invitation..."
                  className="mt-1 w-full resize-none rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={createInvitation}
                  disabled={busyKey === "create-invite"}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                    busyKey === "create-invite"
                      ? "cursor-not-allowed bg-[#0a4f63]/60"
                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                  }`}
                >
                  {busyKey === "create-invite" ? "Creating…" : "Create Invite Link"}
                </button>
              </div>

              {latestInviteLink ? (
                <div className="rounded-[24px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-4">
                  <div className="text-sm font-semibold text-[#0b1f2a]">Latest production invite link</div>
                  <p className="mt-2 text-sm leading-relaxed text-black/60">
                    This link is generated for <span className="font-semibold">keyvera.org</span>. Send it to the hired sub-admin. Do not use localhost for their onboarding.
                  </p>
                  <input
                    value={latestInviteLink}
                    readOnly
                    className="mt-3 w-full rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm text-[#0b1f2a] outline-none"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => copyText(latestInviteLink)}
                      className="rounded-2xl border border-black/10 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          title={
            <>
              <div className="text-sm font-semibold text-[#0b1f2a]">Pending Owner Approval</div>
              <SectionBadge>{pendingOwnerApprovalRows.length}</SectionBadge>
            </>
          }
          subtitle="Accepted invitees remain here until you personally approve them."
        >
          {loading ? (
            <div className="p-6 text-sm text-black/60">Loading…</div>
          ) : pendingOwnerApprovalRows.length === 0 ? (
            <EmptyState
              title="No pending owner approvals."
              body="Once an invited person accepts the production link, they should appear here waiting for your explicit approval."
            />
          ) : (
            <div className="grid gap-4 p-4 md:p-5">
              {pendingOwnerApprovalRows.map((row) => {
                const linkedInvite = row.admin_invitation_id ? invitationMap[row.admin_invitation_id] : undefined;

                return (
                  <article
                    key={row.user_id}
                    className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#0b1f2a]">{row.full_name?.trim() || "Pending Admin"}</div>
                        <div className="mt-1 font-mono text-xs text-black/50">{shortId(row.user_id)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={adminLevelPill(row.admin_level)}>{getAdminLevelLabel(row.admin_level)}</span>
                        <span className={accessStatusPill(row.admin_access_status)}>
                          {String(row.admin_access_status || "pending_owner_approval").replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Invited by</div>
                        <div className="mt-1 text-sm text-[#0b1f2a]">{getProfileName(row.admin_invited_by_user_id)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Invite accepted</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(linkedInvite?.accepted_at || null)}</div>
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Owner message / access note</div>
                        <div className="mt-1 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/60">
                          {row.admin_access_note?.trim() || linkedInvite?.note?.trim() || "No message recorded yet."}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => openApproval(row)}
                        className="rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                      >
                        Approve Access
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionShell>
      </div>

      <div className="mt-6 grid gap-6">
        <SectionShell
          title={
            <>
              <div className="text-sm font-semibold text-[#0b1f2a]">Current Admins</div>
              <SectionBadge>{currentAdmins.length}</SectionBadge>
            </>
          }
          subtitle="This is your central view of who currently holds live admin access."
        >
          {loading ? (
            <div className="p-6 text-sm text-black/60">Loading…</div>
          ) : currentAdmins.length === 0 ? (
            <EmptyState title="No active admin profiles found." />
          ) : (
            <>
              <div className="hidden xl:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1380px] text-left text-sm">
                    <thead className="bg-gradient-to-b from-black/5 to-black/0">
                      <tr>
                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Admin</th>
                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Level</th>
                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Access</th>
                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Approved By</th>
                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Approved At</th>
                        <th className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-black/60">Owner Approval Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAdmins.map((row) => (
                        <tr key={row.user_id} className="border-t border-black/5 align-top">
                          <td className="px-5 py-5">
                            <div className="font-semibold text-[#0b1f2a]">{row.full_name?.trim() || "Admin"}</div>
                            <div className="mt-1 font-mono text-xs text-black/50">{shortId(row.user_id)}</div>
                          </td>
                          <td className="px-5 py-5">
                            <span className={adminLevelPill(row.admin_level)}>{getAdminLevelLabel(row.admin_level)}</span>
                          </td>
                          <td className="px-5 py-5">
                            <span className={accessStatusPill(row.admin_access_status)}>
                              {String(row.admin_access_status || "—").replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-5 text-black/60">{getProfileName(row.admin_approved_by_user_id)}</td>
                          <td className="px-5 py-5 text-black/60">{fmtDate(row.admin_approved_at)}</td>
                          <td className="px-5 py-5">
                            <div className="max-w-[420px] rounded-2xl border border-black/10 bg-white/80 p-3 text-xs leading-relaxed text-black/60">
                              {row.admin_access_note?.trim() || "No owner approval note recorded yet."}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 p-4 md:p-5 xl:hidden">
                {currentAdmins.map((row) => (
                  <article
                    key={row.user_id}
                    className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#0b1f2a]">{row.full_name?.trim() || "Admin"}</div>
                        <div className="mt-1 font-mono text-xs text-black/50">{shortId(row.user_id)}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={adminLevelPill(row.admin_level)}>{getAdminLevelLabel(row.admin_level)}</span>
                        <span className={accessStatusPill(row.admin_access_status)}>
                          {String(row.admin_access_status || "—").replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Approved by</div>
                        <div className="mt-1 text-sm text-black/60">{getProfileName(row.admin_approved_by_user_id)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Approved at</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(row.admin_approved_at)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Owner approval note</div>
                        <div className="mt-1 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/60">
                          {row.admin_access_note?.trim() || "No owner approval note recorded yet."}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </SectionShell>

        <SectionShell
          title={
            <>
              <div className="text-sm font-semibold text-[#0b1f2a]">Invitation Ledger</div>
              <SectionBadge>{invitations.length}</SectionBadge>
            </>
          }
          subtitle="Invitation creation stays owner-controlled here. Acceptance and owner approval are shown as separate stages."
        >
          {loading ? (
            <div className="p-6 text-sm text-black/60">Loading…</div>
          ) : invitations.length === 0 ? (
            <EmptyState title="No admin invitations created yet." />
          ) : (
            <div className="grid gap-4 p-4 md:p-5">
              {invitations.map((row) => {
                const inviteLink = createInviteLink(row.invite_token);
                const linkedProfile = invitationProfileMap[row.id];
                const accessStage = String(linkedProfile?.admin_access_status || "").toLowerCase();
                const isOpen = row.invite_status === "sent" || row.invite_status === "accepted";

                return (
                  <article
                    key={row.id}
                    className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#0b1f2a]">{row.email}</div>
                        <div className="mt-1 text-xs text-black/50">
                          {getAdminLevelLabel(row.invited_admin_level)} • invited by {getProfileName(row.invited_by_user_id)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={inviteStatusPill(row.invite_status)}>{row.invite_status}</span>
                        {accessStage ? (
                          <span className={accessStatusPill(accessStage)}>{accessStage.replaceAll("_", " ")}</span>
                        ) : null}
                        <span className={adminLevelPill(row.invited_admin_level)}>{getAdminLevelLabel(row.invited_admin_level)}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Created</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(row.created_at)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Accepted</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(row.accepted_at)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/40">Approved</div>
                        <div className="mt-1 text-sm text-black/60">{fmtDate(row.approved_at)}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-black/60">
                      {row.note?.trim() || "No owner message recorded yet."}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-black/50">Production invite link</div>
                        <input
                          readOnly
                          value={inviteLink}
                          className="mt-1 w-full rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-xs text-[#0b1f2a] outline-none"
                        />
                      </div>

                      <button
                        onClick={() => copyText(inviteLink)}
                        disabled={!isOpen}
                        className={`rounded-2xl px-4 py-3 text-xs font-semibold transition ${
                          isOpen
                            ? "border border-black/10 bg-white/80 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                            : "cursor-not-allowed border border-black/10 bg-white/70 text-black/40"
                        }`}
                      >
                        Copy Link
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionShell>
      </div>

      {approvalModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeApproval} />
          <div className="relative w-full max-w-xl rounded-[28px] border border-black/10 bg-white shadow-[0_26px_80px_rgba(11,31,42,0.24)]">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#0b1f2a]">Approve admin access</div>
                  <div className="mt-1 text-sm text-black/60">
                    {approvalModal.fullName} • <span className="font-mono text-xs">{shortId(approvalModal.userId)}</span>
                  </div>
                  <div className="mt-2 text-xs text-black/50">
                    Admin level: <span className="font-semibold text-[#0b1f2a]">{getAdminLevelLabel(approvalModal.adminLevel)}</span>
                  </div>
                </div>

                <button
                  onClick={closeApproval}
                  disabled={!!busyKey}
                  className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Close
                </button>
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-medium text-black/50">Owner approval note (required)</div>
                <textarea
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  rows={5}
                  placeholder="Write the exact approval note confirming you personally approved this admin access..."
                  className="mt-1 w-full resize-none rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#0b1f2a] outline-none transition focus:border-[rgba(14,165,163,0.40)] focus:ring-4 focus:ring-[rgba(14,165,163,0.12)]"
                />
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  onClick={closeApproval}
                  disabled={!!busyKey}
                  className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white disabled:cursor-not-allowed disabled:text-black/40"
                >
                  Cancel
                </button>

                <button
                  onClick={approvePendingAccess}
                  disabled={!!busyKey}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                    busyKey
                      ? "cursor-not-allowed bg-[#0a4f63]/60"
                      : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                  }`}
                >
                  {busyKey ? "Working…" : "Approve Access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}