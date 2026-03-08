"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RoleType = "admin" | "landlord" | "agent" | "tenant" | null;

function getSafeNext(next: string | null) {
  const raw = String(next || "").trim();
  if (!raw.startsWith("/")) return "/";
  return raw;
}

function roleHome(role: RoleType) {
  if (role === "landlord") return "/landlord";
  if (role === "agent") return "/agent";
  if (role === "tenant") return "/tenant";
  if (role === "admin") return "/admin";
  return "/";
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const safeNext = useMemo(() => getSafeNext(searchParams.get("next")), [searchParams]);

  const [message, setMessage] = useState("Completing your sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      try {
        setMessage("Completing your sign-in…");

        let sessionUserId: string | null = null;

        for (let i = 0; i < 12; i++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user?.id) {
            sessionUserId = session.user.id;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!sessionUserId) {
          setMessage("Session not ready. Redirecting to login…");
          router.replace(`/login?next=${encodeURIComponent(safeNext)}`);
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", sessionUserId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const role = (profile?.role as RoleType) ?? null;
        const destination = role ? roleHome(role) : safeNext || "/";

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
  }, [router, safeNext]);

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