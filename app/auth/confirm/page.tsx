"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";

type RoleType = "admin" | "landlord" | "agent" | "tenant" | null;

function getRoleFromNext(next: string): RoleType {
  const v = String(next || "").toLowerCase();

  if (v.startsWith("/landlord")) return "landlord";
  if (v.startsWith("/agent")) return "agent";
  if (v.startsWith("/tenant")) return "tenant";
  if (v.startsWith("/admin")) return "admin";

  return null;
}

function getSafeNext(next: string | null) {
  const raw = String(next || "").trim();
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  if (raw.startsWith("/auth/confirm")) return "/";
  return raw;
}

function roleHome(role: RoleType) {
  if (role === "landlord") return "/landlord";
  if (role === "agent") return "/agent";
  if (role === "tenant") return "/tenant";
  if (role === "admin") return "/admin";
  return "/";
}

function getMetadataRole(user: any): RoleType {
  const raw = user?.user_metadata?.role ?? user?.app_metadata?.role ?? null;
  if (raw === "admin" || raw === "landlord" || raw === "agent" || raw === "tenant") return raw;
  return null;
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "signup" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "invite" ||
    value === "email" ||
    value === "email_change"
  );
}

async function getProfileRole(userId: string): Promise<RoleType> {
  const { data, error } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();

  if (error) throw new Error(error.message);

  const role = data?.role ?? null;
  if (role === "admin" || role === "landlord" || role === "agent" || role === "tenant") return role;

  return null;
}

async function ensureRoleRecords(params: {
  userId: string;
  role: RoleType;
  forceRole?: boolean;
}) {
  const { userId, role, forceRole = false } = params;
  if (!role) return;

  const { data: existingProfile, error: profileCheckErr } = await supabase
    .from("profiles")
    .select("user_id, role, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileCheckErr) throw new Error(profileCheckErr.message);

  if (!existingProfile) {
    const { error: insertErr } = await supabase.from("profiles").insert({
      user_id: userId,
      role,
      full_name: null,
    });

    if (insertErr) throw new Error(insertErr.message);
  } else if (role && (forceRole || existingProfile.role !== role)) {
    const { error: updateErr } = await supabase.from("profiles").update({ role }).eq("user_id", userId);

    if (updateErr) throw new Error(updateErr.message);
  }

  if (role === "landlord") {
    const { data: existingLandlord, error: landlordCheckErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (landlordCheckErr) throw new Error(landlordCheckErr.message);

    if (!existingLandlord) {
      const { error: insertErr } = await supabase.from("landlords").insert({
        user_id: userId,
      });

      if (insertErr) throw new Error(insertErr.message);
    }
  }

  if (role === "agent") {
    const { data: existingAgent, error: agentCheckErr } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (agentCheckErr) throw new Error(agentCheckErr.message);

    if (!existingAgent) {
      const { error: insertErr } = await supabase.from("agents").insert({
        user_id: userId,
      });

      if (insertErr) throw new Error(insertErr.message);
    }
  }
}

async function reconcileAndResolveRole(params: {
  user: any;
  fallbackRole: RoleType;
}): Promise<RoleType> {
  const { user, fallbackRole } = params;
  const userId = user?.id as string | undefined;

  if (!userId) return fallbackRole;

  const metadataRole = getMetadataRole(user);
  const profileRoleBefore = await getProfileRole(userId);
  const resolvedRole = profileRoleBefore || metadataRole || fallbackRole || null;

  if (resolvedRole) {
    await ensureRoleRecords({
      userId,
      role: resolvedRole,
      forceRole: profileRoleBefore !== resolvedRole,
    });
  }

  const profileRoleAfter = await getProfileRole(userId);
  return profileRoleAfter || resolvedRole || null;
}

function getPostAuthTarget(role: RoleType, fallbackNext: string) {
  const roleDefault = roleHome(role);

  if (role && fallbackNext !== "/" && getRoleFromNext(fallbackNext) === role) {
    return fallbackNext;
  }

  if (roleDefault !== "/") {
    return roleDefault;
  }

  if (fallbackNext && fallbackNext !== "/") {
    return fallbackNext;
  }

  return "/";
}

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const safeNext = useMemo(() => getSafeNext(searchParams.get("next")), [searchParams]);
  const tokenHash = useMemo(() => searchParams.get("token_hash"), [searchParams]);
  const typeParam = useMemo(() => searchParams.get("type"), [searchParams]);
  const codeParam = useMemo(() => searchParams.get("code"), [searchParams]);

  const [message, setMessage] = useState("Completing your sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function waitForSessionUserId() {
      for (let i = 0; i < 12; i++) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user?.id) {
          return session.user.id;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      return null;
    }

    async function finishAuth() {
      try {
        setMessage("Completing your sign-in…");

        if (tokenHash && isEmailOtpType(typeParam)) {
          setMessage("Verifying your email confirmation…");

          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: typeParam,
          });

          if (error) throw error;
        } else if (codeParam) {
          setMessage("Securing your session…");

          const { error } = await supabase.auth.exchangeCodeForSession(codeParam);

          if (error) throw error;
        }

        const sessionUserId = await waitForSessionUserId();

        if (!sessionUserId) {
          setMessage("Session not ready. Redirecting to login…");
          router.replace(`/login?next=${encodeURIComponent(safeNext)}`);
          return;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const user = session?.user ?? null;
        if (!user) {
          router.replace(`/login?next=${encodeURIComponent(safeNext)}`);
          return;
        }

        const finalRole = await reconcileAndResolveRole({
          user,
          fallbackRole: getRoleFromNext(safeNext),
        });

        const destination = getPostAuthTarget(finalRole, safeNext);

        if (!cancelled) {
          router.replace(destination);
        }
      } catch {
        if (!cancelled) {
          setMessage("We could not complete your access. Redirecting to login…");
          router.replace(`/login?next=${encodeURIComponent(safeNext)}`);
        }
      }
    }

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, [router, safeNext, tokenHash, typeParam, codeParam]);

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#0b1f2a]">Keyvera</h1>
            <p className="mt-3 text-sm text-gray-600">{message}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function AuthConfirmFallback() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#0b1f2a]">Keyvera</h1>
            <p className="mt-3 text-sm text-gray-600">Preparing your secure access…</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<AuthConfirmFallback />}>
      <AuthConfirmContent />
    </Suspense>
  );
}