"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRole = "tenant" | "landlord" | "agent" | "admin";

function safeRole(value: unknown): UserRole | null {
  if (
    value === "tenant" ||
    value === "landlord" ||
    value === "agent" ||
    value === "admin"
  ) {
    return value;
  }

  return null;
}

const NAV_LINKS = [
  { label: "Listings", href: "/#listings" },
  { label: "How It Works", href: "/#how" },
  { label: "Roles", href: "/#roles" },
  { label: "Trust", href: "/#trust" },
];

const DASHBOARD_PREFIXES = [
  "/admin",
  "/landlord",
  "/agent",
  "/tenant",
  "/dashboard",
];

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const isDashboard = DASHBOARD_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [, setRole] = useState<UserRole | null>(null);

  async function loadAuth() {
    setAuthLoading(true);
    setUserId(null);
    setRole(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAuthLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const resolvedRole = safeRole(profile?.role);

    if (resolvedRole) {
      setRole(resolvedRole);
    }

    setAuthLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setOpen(false);
    setUserId(null);
    setRole(null);
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    loadAuth();

    const { data: subscription } =
      supabase.auth.onAuthStateChange(() => {
        loadAuth();
      });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 40);
    }

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isDashboard) {
    return null;
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 w-full transition-all duration-500"
      style={{
        background: scrolled
          ? "rgba(255,255,255,0.96)"
          : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderBottom: scrolled
          ? "1px solid var(--kv-border)"
          : "1px solid transparent",
        boxShadow: scrolled
          ? "0 4px 16px rgba(26,60,74,0.06)"
          : "none",
      }}
    >
      <div className="kv-responsive-shell flex h-[88px] items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/keyvera-header.png"
            alt="Keyvera"
            width={300}
            height={88}
            priority
            className="h-[58px] w-auto max-w-[230px] object-contain sm:h-[64px] sm:max-w-[260px]"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="kv-nav-link whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/tenant"
            className="hidden items-center justify-center whitespace-nowrap font-medium text-white md:inline-flex"
            style={{
              background: "var(--kv-teal)",
              padding: "10px 20px",
              borderRadius: "10px",
              fontSize: "14px",
              transition: "all 0.3s var(--kv-ease)",
            }}
          >
            Browse Properties
          </Link>

          {!authLoading &&
            (userId ? (
              <button
                type="button"
                onClick={logout}
                className="kv-nav-link hidden bg-transparent md:inline-flex"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="kv-nav-link hidden md:inline-flex"
              >
                Login
              </Link>
            ))}

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="inline-flex items-center justify-center lg:hidden"
            style={{
              width: "44px",
              height: "44px",
              border: "1px solid var(--kv-border)",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.7)",
              transition: "all 0.3s var(--kv-ease)",
            }}
          >
            <div className="flex flex-col gap-[5px]">
              <span
                className="block h-[2px] w-5 rounded-full bg-[var(--kv-heading)] transition-transform"
                style={{
                  transform: open
                    ? "translateY(7px) rotate(45deg)"
                    : "none",
                }}
              />
              <span
                className="block h-[2px] w-5 rounded-full bg-[var(--kv-heading)] transition-opacity"
                style={{ opacity: open ? 0 : 1 }}
              />
              <span
                className="block h-[2px] w-5 rounded-full bg-[var(--kv-heading)] transition-transform"
                style={{
                  transform: open
                    ? "translateY(-7px) rotate(-45deg)"
                    : "none",
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[var(--kv-border)] bg-white/95 backdrop-blur-xl lg:hidden">
          <div className="kv-responsive-shell py-5">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--kv-body)] hover:bg-[var(--kv-bg-section)] hover:text-[var(--kv-teal)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-[var(--kv-border)] pt-4">
              <Link
                href="/tenant"
                onClick={() => setOpen(false)}
                className="kv-btn kv-btn-primary w-full"
                style={{ borderRadius: "10px" }}
              >
                Browse Properties
              </Link>

              {!authLoading &&
                (userId ? (
                  <button
                    type="button"
                    onClick={logout}
                    className="kv-btn kv-btn-secondary w-full"
                    style={{ borderRadius: "10px" }}
                  >
                    Logout
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="kv-btn kv-btn-secondary w-full"
                    style={{ borderRadius: "10px" }}
                  >
                    Login
                  </Link>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}