// app/ui/role-redirect-gate.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "landlord" | "tenant" | "agent";

function roleToPath(role: UserRole) {
  switch (role) {
    case "admin":
      return "/admin";
    case "landlord":
      return "/landlord";
    case "agent":
      return "/agent";
    case "tenant":
    default:
      return "/tenant";
  }
}

export default function RoleRedirectGate() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) return;

        const user = userRes.user;
        if (!user) return;

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileErr) return;

        const role = (profile?.role || "tenant") as UserRole;
        const dest = roleToPath(role);

        if (window.location.pathname !== dest) {
          router.replace(dest);
        }
      } catch {
        return;
      }
    })();
  }, [router]);

  return null;
}