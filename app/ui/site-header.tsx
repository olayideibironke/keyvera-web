"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRole = "tenant" | "landlord" | "agent" | "admin";

const BRAND_TEAL = "#0ea5a3";
const BRAND_TEAL_DARK = "#0a4f63";
const BRAND_NAVY = "#0b1f2a";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function safeRole(value: unknown): UserRole | null {
  if (value === "tenant" || value === "landlord" || value === "agent" || value === "admin") return value;
  return null;
}

export default function SiteHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const nav = useMemo(
    () => [
      { label: "Admin", href: "/admin" },
      { label: "Landlord", href: "/landlord" },
      { label: "Agent", href: "/agent" },
      { label: "Tenant", href: "/tenant" },
    ],
    []
  );

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

    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
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
    loadAuth();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur">
      {/* Premium brand wash */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background:
            "linear-gradient(to bottom, rgba(14,165,163,0.14), rgba(14,165,163,0.06), rgba(255,255,255,0))",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:py-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image
            src="/keyvera-header.png"
            alt="Keyvera"
            width={420}
            height={140}
            className="h-16 w-auto md:h-20"
            priority
          />
        </Link>

        {/* Desktop nav (always visible) */}
        <nav className="hidden md:flex items-center">
          <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 shadow-sm backdrop-blur">
            {nav.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    "relative rounded-full px-4 py-2 text-sm font-semibold transition",
                    active ? "text-white shadow-sm" : "text-slate-700 hover:bg-black/5 hover:text-slate-950",
                  ].join(" ")}
                  style={
                    active ? { background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})` } : undefined
                  }
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-3.5 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-black/5"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
          >
            <span className="sr-only">Menu</span>
            <div className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 rounded bg-black/70" />
              <span className="block h-0.5 w-5 rounded bg-black/70" />
              <span className="block h-0.5 w-5 rounded bg-black/70" />
            </div>
          </button>

          {/* Auth CTA */}
          {authLoading ? (
            <div className="h-11 w-28 rounded-full border border-black/10 bg-white/70 shadow-sm" />
          ) : userId ? (
            <button
              onClick={logout}
              className="group inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              Logout
              <span
                className="ml-2 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: BRAND_TEAL, opacity: 0.75 }}
              />
            </button>
          ) : (
            <Link
              href="/login"
              className="group inline-flex items-center justify-center rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})`,
                boxShadow: "0 10px 24px rgba(14,165,163,0.18)",
              }}
            >
              <span className="opacity-95 transition group-hover:opacity-100">Login</span>
              <span
                className="ml-2 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.85)" }}
              />
            </Link>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="md:hidden border-t border-black/5 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <div className="rounded-2xl border border-black/10 bg-white shadow-sm overflow-hidden">
              <div className="p-2">
                {nav.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={[
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition",
                        active ? "text-white" : "text-slate-800 hover:bg-black/5",
                      ].join(" ")}
                      style={
                        active ? { background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})` } : undefined
                      }
                    >
                      <span>{it.label}</span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: active ? "rgba(255,255,255,0.85)" : BRAND_TEAL,
                          opacity: active ? 1 : 0.55,
                        }}
                      />
                    </Link>
                  );
                })}
              </div>

              <div className="border-t border-black/10 p-3">
                {!authLoading && userId ? (
                  <button
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})`,
                      boxShadow: "0 10px 24px rgba(14,165,163,0.18)",
                    }}
                  >
                    Logout
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})`,
                      boxShadow: "0 10px 24px rgba(14,165,163,0.18)",
                    }}
                  >
                    Login
                  </Link>
                )}

                <div className="mt-3 text-center text-xs" style={{ color: BRAND_NAVY, opacity: 0.6 }}>
                  Verified rental marketplace infrastructure.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}