"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRole = "tenant" | "landlord" | "agent" | "admin";

function safeRole(value: unknown): UserRole | null {
  if (value === "tenant" || value === "landlord" || value === "agent" || value === "admin") return value;
  return null;
}

const NAV_LINKS = [
  { label: "Listings", href: "#listings" },
  { label: "How It Works", href: "#how" },
  { label: "Roles", href: "#roles" },
  { label: "Trust", href: "#trust" },
];

const DASHBOARD_PREFIXES = ["/admin", "/landlord", "/agent", "/tenant", "/dashboard"];

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isDashboard = DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
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
    const r = safeRole(profile?.role);
    if (r) setRole(r);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAuth();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isDashboard) return null;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderBottom: scrolled ? "1px solid var(--kv-border)" : "1px solid transparent",
        boxShadow: scrolled ? "0 4px 16px rgba(26,60,74,0.06)" : "none",
      }}
    >
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center" onClick={() => setOpen(false)}>
          <Image
            src="/keyvera-header.png"
            alt="Keyvera"
            width={300}
            height={88}
            priority
            className="h-11 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((it) => (
            <Link key={it.href} href={it.href} className="kv-nav-link">
              {it.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/tenant"
            className="hidden md:inline-flex items-center justify-center font-medium text-white"
            style={{
              background: "var(--kv-teal)",
              padding: "10px 24px",
              borderRadius: "10px",
              fontSize: "14px",
              transition: "all 0.3s var(--kv-ease)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--kv-teal-mid)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--kv-teal)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Browse Properties
          </Link>

          {/* Auth link (small, preserves existing login/logout flow) */}
          {!authLoading && (
            <>
              {userId ? (
                <button
                  onClick={logout}
                  className="hidden md:inline-flex kv-nav-link"
                  style={{ background: "transparent" }}
                >
                  Logout
                </button>
              ) : (
                <Link href="/login" className="hidden md:inline-flex kv-nav-link">
                  Login
                </Link>
              )}
            </>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden inline-flex items-center justify-center"
            style={{
              width: "44px",
              height: "44px",
              border: "1px solid var(--kv-border)",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.6)",
              transition: "all 0.3s var(--kv-ease)",
            }}
          >
            <div className="flex flex-col gap-[5px]">
              <span
                className="block h-[2px] w-5 rounded-full bg-[var(--kv-heading)] transition-transform"
                style={{ transform: open ? "translateY(7px) rotate(45deg)" : "none" }}
              />
              <span
                className="block h-[2px] w-5 rounded-full bg-[var(--kv-heading)] transition-opacity"
                style={{ opacity: open ? 0 : 1 }}
              />
              <span
                className="block h-[2px] w-5 rounded-full bg-[var(--kv-heading)] transition-transform"
                style={{ transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="md:hidden border-t border-[var(--kv-border)] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-6 py-5">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--kv-body)] hover:bg-[var(--kv-bg-section)] hover:text-[var(--kv-teal)]"
                >
                  {it.label}
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
              {!authLoading && (
                <>
                  {userId ? (
                    <button
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
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
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
