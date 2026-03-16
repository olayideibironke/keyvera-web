"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  admin_level: string | null;
  admin_access_status: string | null;
  admin_invited_by_user_id: string | null;
  admin_approved_by_user_id: string | null;
  admin_approved_at: string | null;
  admin_invitation_id: string | null;
  admin_access_note: string | null;
  account_status: string | null;
};

type AcceptState = "loading" | "invalid" | "ready" | "accepted";

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
  return "Admin";
}

function inviteStatusPill(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";

  if (raw === "approved") return `${base} border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.10)] text-[#0a4f63]`;
  if (raw === "accepted" || raw === "sent") return `${base} border-amber-200 bg-amber-50 text-amber-900`;
  if (raw === "revoked" || raw === "expired") return `${base} border-red-200 bg-red-50 text-red-700`;

  return `${base} border-black/10 bg-white/70 text-black/60`;
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

function AcceptInviteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,163,0.10),transparent_30%),linear-gradient(180deg,#eef7f7_0%,#f7fbfb_45%,#ffffff_100%)] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white"
          >
            ← Back to Login
          </Link>
        </div>

        <section className="rounded-[32px] border border-black/10 bg-white/75 shadow-[0_24px_80px_rgba(11,31,42,0.12)] backdrop-blur-xl">
          <div className="border-b border-black/10 p-6 md:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">Accept Admin Invitation</h1>
            <p className="mt-2 text-sm leading-relaxed text-black/60">
              This admin invitation does not give live access immediately. After acceptance, the account must still wait for explicit owner approval.
            </p>
          </div>

          <div className="p-6 md:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

function AcceptInviteLoadingFallback() {
  return (
    <AcceptInviteShell>
      <div className="rounded-[24px] border border-black/10 bg-white/70 p-5 text-sm text-black/60">
        Loading invitation…
      </div>
    </AcceptInviteShell>
  );
}

function AcceptAdminInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [state, setState] = useState<AcceptState>("loading");
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState("loading");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (!token) {
        setState("invalid");
        setErrorMsg("Invite token is missing.");
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/admin/accept-invite?token=${token}`)}`);
        return;
      }

      const userEmail = user.email ? String(user.email).toLowerCase() : null;
      setCurrentUserEmail(userEmail);

      const { data: inviteRow, error: inviteErr } = await supabase
        .from("admin_invitations")
        .select(
          "id,email,invited_admin_level,invited_by_user_id,invite_token,invite_status,owner_approval_required,approved_by_user_id,approved_at,accepted_by_user_id,accepted_at,revoked_by_user_id,revoked_at,expires_at,note,created_at"
        )
        .eq("invite_token", token)
        .maybeSingle();

      if (inviteErr) throw inviteErr;
      if (!inviteRow) {
        setState("invalid");
        setErrorMsg("This admin invite could not be found.");
        return;
      }

      const invite = inviteRow as InvitationRow;
      setInvitation(invite);

      if (invite.expires_at) {
        const expiresAtMs = new Date(invite.expires_at).getTime();
        if (!Number.isNaN(expiresAtMs) && expiresAtMs < Date.now()) {
          setState("invalid");
          setErrorMsg("This admin invite has expired.");
          return;
        }
      }

      if (invite.invite_status === "revoked") {
        setState("invalid");
        setErrorMsg("This admin invite has been revoked.");
        return;
      }

      if (invite.invite_status === "approved") {
        setState("invalid");
        setErrorMsg("This admin invite was already approved and can no longer be reused.");
        return;
      }

      if (!userEmail) {
        setState("invalid");
        setErrorMsg("Your authenticated account email could not be resolved.");
        return;
      }

      if (userEmail !== String(invite.email || "").toLowerCase()) {
        setState("invalid");
        setErrorMsg("This invite belongs to a different email address.");
        return;
      }

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select(
          "user_id,full_name,role,admin_level,admin_access_status,admin_invited_by_user_id,admin_approved_by_user_id,admin_approved_at,admin_invitation_id,admin_access_note,account_status"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      const nextProfile = (profileRow ?? null) as ProfileRow | null;
      setProfile(nextProfile);

      if (
        nextProfile &&
        nextProfile.role === "admin" &&
        String(nextProfile.admin_access_status || "").toLowerCase() === "active"
      ) {
        setState("invalid");
        setErrorMsg("This account already has active admin access.");
        return;
      }

      if (
        invite.accepted_by_user_id &&
        invite.accepted_by_user_id === user.id &&
        String(nextProfile?.admin_access_status || "").toLowerCase() === "pending_owner_approval"
      ) {
        setState("accepted");
        setSuccessMsg("Invite accepted. Your access is now waiting for owner approval.");
        return;
      }

      setState("ready");
    } catch (e: any) {
      setState("invalid");
      setErrorMsg(e?.message ?? "Failed to load admin invite.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const acceptInvite = async () => {
    if (!invitation || !token) return;

    setBusy(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/admin/accept-invite?token=${token}`)}`);
        return;
      }

      const actorEmail = user.email ? String(user.email).toLowerCase() : null;
      if (!actorEmail || actorEmail !== String(invitation.email || "").toLowerCase()) {
        setErrorMsg("This invite belongs to a different email address.");
        setBusy(false);
        return;
      }

      const acceptedAt = new Date().toISOString();

      const { data: beforeProfile, error: beforeErr } = await supabase
        .from("profiles")
        .select(
          "user_id,full_name,role,admin_level,admin_access_status,admin_invited_by_user_id,admin_approved_by_user_id,admin_approved_at,admin_invitation_id,admin_access_note,account_status"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (beforeErr) throw beforeErr;

      const ownerMessage = invitation.note?.trim()
        ? invitation.note.trim()
        : "Owner invitation accepted. Waiting for explicit owner approval.";

      const accessNoteBase = `Owner invite accepted. ${ownerMessage}`;

      const { data: updatedProfile, error: profileUpdateErr } = await supabase
        .from("profiles")
        .update({
          admin_level: invitation.invited_admin_level,
          admin_access_status: "pending_owner_approval",
          admin_invited_by_user_id: invitation.invited_by_user_id,
          admin_invitation_id: invitation.id,
          admin_access_note: accessNoteBase,
          account_status: "active",
        })
        .eq("user_id", user.id)
        .select(
          "user_id,full_name,role,admin_level,admin_access_status,admin_invited_by_user_id,admin_approved_by_user_id,admin_approved_at,admin_invitation_id,admin_access_note,account_status"
        )
        .maybeSingle();

      if (profileUpdateErr) throw profileUpdateErr;

      const { data: updatedInvite, error: inviteUpdateErr } = await supabase
        .from("admin_invitations")
        .update({
          invite_status: "accepted",
          accepted_by_user_id: user.id,
          accepted_at: acceptedAt,
        })
        .eq("id", invitation.id)
        .select(
          "id,email,invited_admin_level,invited_by_user_id,invite_token,invite_status,owner_approval_required,approved_by_user_id,approved_at,accepted_by_user_id,accepted_at,revoked_by_user_id,revoked_at,expires_at,note,created_at"
        )
        .single();

      if (inviteUpdateErr) throw inviteUpdateErr;

      try {
        await logAudit({
          actor_user_id: user.id,
          action: "accept_admin_invitation",
          entity_type: "admin_inviation",
          entity_id: invitation.id,
          reason: `Accepted admin invite for ${actorEmail}. Owner approval still required.`,
          before: {
            invitation,
            profile: beforeProfile,
          },
          after: {
            invitation: updatedInvite,
            profile: updatedProfile,
          },
        });
      } catch {
        // keep user flow clean
      }

      setInvitation(updatedInvite as InvitationRow);
      setProfile((updatedProfile ?? null) as ProfileRow | null);
      setState("accepted");
      setSuccessMsg("Invite accepted. Your access is now waiting for owner approval.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to accept admin invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AcceptInviteShell>
      {errorMsg ? (
        <div className="mb-5 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {successMsg ? (
        <div className="mb-5 rounded-[24px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-4 text-sm text-[#0a4f63]">
          {successMsg}
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="rounded-[24px] border border-black/10 bg-white/70 p-5 text-sm text-black/60">Loading invitation…</div>
      ) : null}

      {invitation ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-black/10 bg-white/80 p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Invite email</div>
            <div className="mt-2 text-base font-semibold text-[#0b1f2a]">{invitation.email}</div>

            <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Admin level</div>
            <div className="mt-2 text-base font-semibold text-[#0b1f2a]">{getAdminLevelLabel(invitation.invited_admin_level)}</div>

            <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Invite status</div>
            <div className="mt-2">
              <span className={inviteStatusPill(invitation.invite_status)}>{invitation.invite_status}</span>
            </div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white/80 p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Created</div>
            <div className="mt-2 text-sm text-black/60">{fmtDate(invitation.created_at)}</div>

            <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Expires</div>
            <div className="mt-2 text-sm text-black/60">{fmtDate(invitation.expires_at)}</div>

            <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Current signed-in email</div>
            <div className="mt-2 text-sm text-black/60">{currentUserEmail || "—"}</div>
          </div>

          <div className="md:col-span-2 rounded-[24px] border border-black/10 bg-white/80 p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Owner message</div>
            <div className="mt-2 text-sm leading-relaxed text-black/60">
              {invitation.note?.trim() || "No owner message was added."}
            </div>
          </div>

          {profile ? (
            <div className="md:col-span-2 rounded-[24px] border border-black/10 bg-white/80 p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">Current profile state</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-[11px] font-medium text-black/50">Role</div>
                  <div className="mt-1 text-sm text-[#0b1f2a]">{profile.role || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-black/50">Admin level</div>
                  <div className="mt-1 text-sm text-[#0b1f2a]">{getAdminLevelLabel(profile.admin_level)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-black/50">Access status</div>
                  <div className="mt-1 text-sm text-[#0b1f2a]">{profile.admin_access_status || "—"}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {state === "ready" ? (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-900">Owner approval still required</div>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            Accepting this invitation will only place your account into the pending owner approval queue. Live admin access stays blocked until the owner explicitly approves it.
          </p>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              onClick={acceptInvite}
              disabled={busy}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                busy
                  ? "cursor-not-allowed bg-[#0a4f63]/60"
                  : "bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] shadow-[0_16px_38px_rgba(10,79,99,0.28)] hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
              }`}
            >
              {busy ? "Accepting…" : "Accept Invitation"}
            </button>
          </div>
        </div>
      ) : null}

      {state === "accepted" ? (
        <div className="mt-6 rounded-[24px] border border-[rgba(14,165,163,0.22)] bg-[rgba(14,165,163,0.08)] p-5">
          <div className="text-sm font-semibold text-[#0b1f2a]">Waiting for owner approval</div>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            Your account is now in the pending owner approval stage. The owner must approve your admin access before any admin pages can be used.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/login"
              className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white"
            >
              Return to Login
            </Link>
          </div>
        </div>
      ) : null}
    </AcceptInviteShell>
  );
}

export default function AcceptAdminInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteLoadingFallback />}>
      <AcceptAdminInviteInner />
    </Suspense>
  );
}