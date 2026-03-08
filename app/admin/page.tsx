"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  {
    href: "/admin/metrics",
    title: "Metrics",
    description: "Health snapshot across verifications, listings, inspections, and platform movement.",
    badge: "Platform health",
    accent: "teal",
  },
  {
    href: "/admin/agents",
    title: "Agent Verifications",
    description: "Review agent KYC, identity status, and approval readiness with cleaner operational flow.",
    badge: "Identity review",
    accent: "navy",
  },
  {
    href: "/admin/landlords",
    title: "Landlord Verifications",
    description: "Approve landlord identity checks and keep private-by-default verification decisions organized.",
    badge: "KYC decisions",
    accent: "slate",
  },
  {
    href: "/admin/properties",
    title: "Property Approvals",
    description: "Approve listings, validate fee setup, and maintain premium marketplace quality control.",
    badge: "Listing controls",
    accent: "teal-dark",
  },
] as const;

function roleToPath(role: string) {
  if (role === "admin") return "/admin";
  if (role === "landlord") return "/landlord";
  if (role === "agent") return "/agent";
  return "/tenant";
}

function AccentOrb({ tone }: { tone: "teal" | "navy" | "slate" | "teal-dark" }) {
  const bg =
    tone === "teal"
      ? "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(14,165,163,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(10,79,99,0.92),transparent_58%)]"
      : tone === "navy"
      ? "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(11,31,42,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(14,165,163,0.82),transparent_58%)]"
      : tone === "teal-dark"
      ? "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(10,79,99,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(14,165,163,0.82),transparent_58%)]"
      : "bg-[radial-gradient(16px_16px_at_32%_30%,rgba(100,116,139,0.95),transparent_60%),radial-gradient(20px_20px_at_70%_72%,rgba(11,31,42,0.82),transparent_58%)]";

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_44px_rgba(11,31,42,0.12)]">
      <div className={`absolute inset-0 ${bg}`} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/0" />
    </div>
  );
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-[11px] font-semibold text-black/55">
      {children}
    </span>
  );
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
      <section className="rounded-[32px] border border-black/10 bg-white/70 p-6 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <AccentOrb tone="teal" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge>Admin control center</SectionBadge>
                  <SectionBadge>Premium operations</SectionBadge>
                </div>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0b1f2a] md:text-3xl">
                  Admin Overview
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/60">
                  Verify identities, approve properties, monitor platform health, and keep inspection workflows clean,
                  premium, and operationally tight.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-auto">
            <Link
              href="/admin/metrics"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#0b1f2a] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(11,31,42,0.22)] transition hover:shadow-[0_22px_56px_rgba(11,31,42,0.28)]"
            >
              Open Metrics
            </Link>

            <Link
              href="/admin/agents"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#0b1f2a] shadow-[0_14px_36px_rgba(11,31,42,0.08)] transition hover:bg-white hover:shadow-[0_18px_46px_rgba(11,31,42,0.12)]"
            >
              Process Verifications
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Priority</div>
            <div className="mt-2 text-sm font-semibold text-[#0b1f2a]">Verification and listing quality</div>
            <div className="mt-1 text-sm text-black/55">Keep agent, landlord, and property review queues clean.</div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Focus</div>
            <div className="mt-2 text-sm font-semibold text-[#0b1f2a]">Inspection workflow visibility</div>
            <div className="mt-1 text-sm text-black/55">Use metrics to track conversion, velocity, and completion health.</div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-[0_14px_34px_rgba(11,31,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Standard</div>
            <div className="mt-2 text-sm font-semibold text-[#0b1f2a]">Premium marketplace discipline</div>
            <div className="mt-1 text-sm text-black/55">Every admin surface should feel polished, deliberate, and scalable.</div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_46px_rgba(11,31,42,0.10)] backdrop-blur-xl transition hover:bg-white hover:shadow-[0_22px_58px_rgba(11,31,42,0.14)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold text-black/55">
                  {item.badge}
                </span>

                <h2 className="mt-4 text-lg font-semibold tracking-tight text-[#0b1f2a]">
                  {item.title}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-black/60">
                  {item.description}
                </p>
              </div>

              <div className="shrink-0 pt-0.5">
                <AccentOrb tone={item.accent} />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">
                Open workspace
              </div>
              <div className="inline-flex items-center rounded-full border border-black/10 bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#0b1f2a] transition group-hover:bg-[#0b1f2a] group-hover:text-white">
                Open
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}