"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "◎" },
  { href: "/admin/metrics", label: "Metrics", icon: "▲" },
  { href: "/admin/agents", label: "Agent Verifications", icon: "✓" },
  {
    href: "/admin/landlords",
    label: "Landlord Verifications",
    icon: "⚑",
  },
  {
    href: "/admin/properties",
    label: "Property Approvals",
    icon: "▢",
  },
  { href: "/admin/audit", label: "Audit Log", icon: "≡" },
];

const MOBILE_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "◎" },
  { href: "/admin/metrics", label: "Metrics", icon: "▲" },
  { href: "/admin/agents", label: "Agents", icon: "✓" },
  { href: "/admin/landlords", label: "Landlords", icon: "⚑" },
  { href: "/admin/properties", label: "Properties", icon: "▢" },
  { href: "/admin/audit", label: "Audit", icon: "≡" },
];

function isActivePath(pathname: string, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";

  return (
    <div className="kv-portal-layout">
      <aside className="kv-sidebar">
        <div className="kv-sidebar-header">
          <Link href="/" className="inline-flex">
            <Image
              src="/keyvera-header.png"
              alt="Keyvera"
              width={180}
              height={50}
              className="h-8 w-auto"
              priority
            />
          </Link>

          <div className="kv-sidebar-eyebrow">Keyvera Admin</div>
          <div className="kv-sidebar-title">Control Center</div>
        </div>

        <nav
          className="kv-sidebar-nav"
          aria-label="Admin navigation"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                aria-current={active ? "page" : undefined}
                className="kv-sidebar-link"
              >
                <span
                  className="kv-sidebar-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="kv-sidebar-footer">
          <Link
            href="/"
            className="px-2 text-[13px] font-medium text-[var(--kv-body)] transition-colors hover:text-[var(--kv-teal)]"
          >
            ← Exit Admin
          </Link>

          <div className="px-2 pt-1 text-[11px] leading-relaxed text-[var(--kv-muted)]">
            Enforcement actions and audit history live here.
            Keep it logged.
          </div>
        </div>
      </aside>

      <div className="kv-portal-content">
        <div className="kv-portal-content-inner">
          {children}
        </div>
      </div>

      <nav
        className="kv-mobile-tabs"
        aria-label="Admin mobile navigation"
      >
        {MOBILE_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              aria-current={active ? "page" : undefined}
              className="kv-mobile-tab"
            >
              <span
                className="kv-mobile-tab-icon"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}