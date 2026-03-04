// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  {
    href: "/admin/metrics",
    title: "Metrics",
    description: "Health snapshot across verifications, listings, and activity.",
    badge: "Platform health",
  },
  {
    href: "/admin/agents",
    title: "Agent Verifications",
    description: "Review agent KYC and verification status.",
    badge: "Identity review",
  },
  {
    href: "/admin/landlords",
    title: "Landlord Verifications",
    description: "Approve landlord identity checks (private by default).",
    badge: "KYC decisions",
  },
  {
    href: "/admin/properties",
    title: "Property Approvals",
    description: "Approve listings and validate inspection fee rules.",
    badge: "Listing controls",
  },
];

function roleToPath(role: string) {
  if (role === "admin") return "/admin";
  if (role === "landlord") return "/landlord";
  if (role === "agent") return "/agent";
  return "/tenant";
}

export default function AdminHome() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (profileErr || !profile) {
          router.replace("/login");
          return;
        }

        if (profile.role !== "admin") {
          router.replace(roleToPath(profile.role));
          return;
        }

        setAuthorized(true);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, pathname]);

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-black/60">Loading admin…</div>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_44px_rgba(11,31,42,0.12)]">
                <div className="absolute inset-0 bg-[radial-gradient(16px_16px_at_32%_30%,rgba(14,165,163,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(10,79,99,0.92),transparent_58%)]" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/0" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">
                  Admin Overview
                </h1>
                <p className="mt-1 text-sm text-black/60">
                  Verify identities, approve properties, and enforce inspection fee rules.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <Link
              href="/admin/metrics"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f2a] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(11,31,42,0.22)] transition hover:shadow-[0_22px_56px_rgba(11,31,42,0.28)]"
            >
              Open Metrics
            </Link>

            <Link
              href="/admin/agents"
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] shadow-[0_14px_36px_rgba(11,31,42,0.08)] transition hover:bg-white hover:shadow-[0_18px_46px_rgba(11,31,42,0.12)]"
            >
              Process Verifications
            </Link>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl transition hover:bg-white hover:shadow-[0_22px_58px_rgba(11,31,42,0.14)]"
          >
            <div className="text-sm font-semibold text-[#0b1f2a]">
              {item.title}
            </div>
            <p className="mt-2 text-sm text-black/60">
              {item.description}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}