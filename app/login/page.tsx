"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

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
  if (!raw.startsWith("/")) return "/";
  return raw;
}

function getRoleHome(role: RoleType) {
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

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next");
  const modeParam = searchParams.get("mode");

  const safeNext = useMemo(() => getSafeNext(nextParam), [nextParam]);
  const inferredRole = useMemo(() => getRoleFromNext(safeNext), [safeNext]);

  const [mode, setMode] = useState<"login" | "signup">(modeParam === "signup" ? "signup" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setMode(modeParam === "signup" ? "signup" : "login");
  }, [modeParam]);

  async function getProfileRole(userId: string): Promise<RoleType> {
    const { data, error } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();

    if (error) throw new Error(error.message);
    return (data?.role as RoleType) ?? null;
  }

  async function ensureRoleRecords(params: {
    userId: string;
    role: RoleType;
    fullNameValue: string;
    forceRole?: boolean;
  }) {
    const { userId, role, fullNameValue, forceRole = false } = params;

    if (!role || role === "admin") return;

    const cleanName = fullNameValue.trim();

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
        full_name: cleanName || null,
      });

      if (insertErr) throw new Error(insertErr.message);
    } else {
      const updatePayload: { role?: RoleType; full_name?: string | null } = {};

      if (forceRole || existingProfile.role !== role) {
        updatePayload.role = role;
      }

      if (cleanName && existingProfile.full_name !== cleanName) {
        updatePayload.full_name = cleanName;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateErr } = await supabase.from("profiles").update(updatePayload).eq("user_id", userId);
        if (updateErr) throw new Error(updateErr.message);
      }
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
    fullNameValue: string;
    fallbackRole: RoleType;
  }): Promise<RoleType> {
    const { user, fullNameValue, fallbackRole } = params;
    const userId = user?.id as string | undefined;
    if (!userId) return fallbackRole;

    const metadataRole = getMetadataRole(user);
    const profileRoleBefore = await getProfileRole(userId);

    const resolvedRole = fallbackRole || metadataRole || profileRoleBefore;

    if (resolvedRole && resolvedRole !== "admin") {
      await ensureRoleRecords({
        userId,
        role: resolvedRole,
        fullNameValue,
        forceRole: profileRoleBefore !== resolvedRole,
      });
    }

    const profileRoleAfter = await getProfileRole(userId);
    return profileRoleAfter || resolvedRole || null;
  }

  function goAfterAuth(role: RoleType, fallbackNext: string) {
    if (role === "landlord") {
      router.push("/landlord");
      return;
    }

    if (role === "agent") {
      router.push("/agent");
      return;
    }

    if (role === "tenant") {
      router.push("/tenant");
      return;
    }

    if (role === "admin") {
      router.push("/admin");
      return;
    }

    if (fallbackNext && fallbackNext !== "/") {
      router.push(fallbackNext);
      return;
    }

    router.push("/");
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const cleanEmail = email.trim();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setErrorMsg("Login failed.");
        return;
      }

      const finalRole = await reconcileAndResolveRole({
        user,
        fullNameValue: fullName,
        fallbackRole: inferredRole,
      });

      goAfterAuth(finalRole, safeNext);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (!inferredRole || inferredRole === "admin") {
        setErrorMsg("Please start signup from the correct landlord, agent, or tenant page.");
        return;
      }

      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      const roleHome = getRoleHome(inferredRole);
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(roleHome)}`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: cleanName || null,
            role: inferredRole,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const session = data.session ?? null;
      const user = data.user ?? null;

      if (!session || !user) {
        setSuccessMsg("Signup successful. Check your email to confirm your account, then continue.");
        return;
      }

      const finalRole = await reconcileAndResolveRole({
        user,
        fullNameValue: cleanName,
        fallbackRole: inferredRole,
      });

      goAfterAuth(finalRole, safeNext);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  const pageTitle =
    mode === "signup"
      ? inferredRole === "landlord"
        ? "Landlord Sign Up"
        : inferredRole === "agent"
        ? "Agent Sign Up"
        : inferredRole === "tenant"
        ? "Tenant Sign Up"
        : "Create Account"
      : "Keyvera Login";

  const pageSubtext =
    mode === "signup"
      ? inferredRole === "landlord"
        ? "Create your landlord account to access your dashboard and property workflow."
        : inferredRole === "agent"
        ? "Create your agent account to access verification and inspection workflow."
        : inferredRole === "tenant"
        ? "Create your tenant account to browse listings and request inspections."
        : "Create your Keyvera account."
      : "Sign in to continue.";

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-[#0b1f2a]">{pageTitle}</h1>
            <p className="mt-2 text-sm text-gray-600">{pageSubtext}</p>
          </div>

          <form onSubmit={mode === "signup" ? handleSignup : handleLogin} className="space-y-4">
            {mode === "signup" ? (
              <input
                type="text"
                placeholder="Full name"
                className="w-full rounded-lg border p-3"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            ) : null}

            <input
              type="email"
              placeholder="Email"
              className="w-full rounded-lg border p-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-lg border p-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {errorMsg ? <p className="text-sm text-red-500">{errorMsg}</p> : null}
            {successMsg ? <p className="text-sm text-green-600">{successMsg}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-black p-3 text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (mode === "signup" ? "Creating account..." : "Logging in...") : mode === "signup" ? "Create Account" : "Login"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-600">
            {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setErrorMsg("");
                setSuccessMsg("");
                setMode(mode === "signup" ? "login" : "signup");
              }}
              className="font-semibold text-[#0a4f63] hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#0b1f2a]">Keyvera Login</h1>
            <p className="mt-2 text-sm text-gray-600">Loading…</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}