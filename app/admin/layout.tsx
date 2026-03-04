// app/admin/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/agents", label: "Agent Verifications" },
  { href: "/admin/landlords", label: "Landlord Verifications" },
  { href: "/admin/properties", label: "Property Approvals" },
  { href: "/admin/audit", label: "Audit Log" },
];

const MOBILE_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/landlords", label: "Landlords" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/audit", label: "Audit" },
];

function isActivePath(pathname: string, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark() {
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_10px_26px_rgba(11,31,42,0.10)]">
      <div className="absolute inset-0 bg-[radial-gradient(18px_18px_at_30%_35%,rgba(14,165,163,0.55),transparent_62%),radial-gradient(22px_22px_at_70%_70%,rgba(10,79,99,0.40),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/0" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/40" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentLabel = useMemo(() => {
    const match = NAV_ITEMS.find((i) => isActivePath(pathname || "", i.href));
    return match?.label || "Admin";
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    if (mobileOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.05)]">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[300px] shrink-0 border-r border-black/10 bg-white/70 backdrop-blur-xl md:flex">
          <div className="w-full p-6">
            <div className="rounded-[28px] border border-black/10 bg-white/70 shadow-[0_14px_34px_rgba(11,31,42,0.08)] backdrop-blur-xl">
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <BrandMark />
                  <div className="leading-tight">
                    <div className="text-[15px] font-semibold text-[#0b1f2a]">Keyvera Admin</div>
                    <div className="text-xs text-black/60">Control Center</div>
                  </div>
                </div>

                <nav className="mt-5 space-y-2">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={isActivePath(pathname || "", item.href)}
                    />
                  ))}
                </nav>

                <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4">
                  <div className="text-xs font-semibold text-[#0b1f2a]">Compliance layer</div>
                  <div className="mt-1 text-xs text-black/60">
                    Enforcement actions and audit history live here. Keep it clean. Keep it logged.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-black/50">© {new Date().getFullYear()} Keyvera</div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1">
          {/* Top bar */}
          <div className="sticky top-0 z-30 border-b border-black/10 bg-white/70 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-6xl px-5 py-4 md:px-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Mobile menu button */}
                  <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/70 shadow-sm transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] md:hidden"
                    aria-label="Open admin menu"
                  >
                    <BurgerIcon />
                  </button>

                  {/* Desktop mark (subtle, no “orb” vibe) */}
                  <div className="hidden md:block">
                    <BrandMark />
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-[#0b1f2a]">{currentLabel}</div>
                    <div className="text-xs text-black/60">Keyvera Platform</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/"
                    className="hidden items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] md:inline-flex"
                  >
                    Exit Admin
                  </Link>
                  <Link
                    href="/admin/audit"
                    className="hidden items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)] md:inline-flex"
                  >
                    Audit Log
                  </Link>
                  <Link
                    href="/admin/metrics"
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
                  >
                    Metrics
                  </Link>
                </div>
              </div>

              {/* Mobile quick nav (kept) */}
              <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
                {MOBILE_ITEMS.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActivePath(pathname || "", item.href)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileOpen ? (
            <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
              <button
                type="button"
                aria-label="Close admin menu"
                onClick={() => setMobileOpen(false)}
                className="absolute inset-0 bg-black/30"
              />
              <div className="absolute left-0 top-0 h-full w-[86%] max-w-[340px] border-r border-black/10 bg-white/90 backdrop-blur-xl">
                <div className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <BrandMark />
                      <div className="leading-tight">
                        <div className="text-[15px] font-semibold text-[#0b1f2a]">Keyvera Admin</div>
                        <div className="text-xs text-black/60">Control Center</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/70 shadow-sm transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      aria-label="Close admin menu"
                    >
                      <CloseIcon />
                    </button>
                  </div>

                  <nav className="mt-5 space-y-2">
                    {NAV_ITEMS.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={isActivePath(pathname || "", item.href)}
                      />
                    ))}
                  </nav>

                  <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4">
                    <div className="text-xs font-semibold text-[#0b1f2a]">Admin actions</div>
                    <div className="mt-1 text-xs text-black/60">Use audit history for enforcement traceability.</div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        href="/admin/audit"
                        className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      >
                        Audit Log
                      </Link>
                      <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
                      >
                        Exit
                      </Link>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 text-xs text-black/50">© {new Date().getFullYear()} Keyvera</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Content */}
          <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">{children}</div>
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center rounded-2xl border px-4 py-3 text-sm font-semibold transition",
        active
          ? "border-[rgba(14,165,163,0.25)] bg-[rgba(14,165,163,0.10)] text-[#0b1f2a] shadow-[0_12px_28px_rgba(10,79,99,0.12)]"
          : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:text-[#0a4f63] hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]",
      ].join(" ")}
    >
      {/* left accent bar (premium) */}
      <span
        className={[
          "absolute left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full transition",
          active ? "bg-gradient-to-b from-[#0ea5a3] to-[#0a4f63]" : "bg-transparent group-hover:bg-black/10",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="pl-3">{label}</span>
    </Link>
  );
}

function MobileNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-xs font-semibold transition",
        active
          ? "border-[rgba(14,165,163,0.30)] bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] text-white shadow-[0_14px_34px_rgba(10,79,99,0.22)]"
          : "border-black/10 bg-white/70 text-[#0b1f2a] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function BurgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}