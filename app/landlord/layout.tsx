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
  { href: "/landlord", label: "Dashboard", icon: "◎" },
  {
    href: "/landlord/properties/new",
    label: "+ Create Property",
    icon: "+",
  },
  {
    href: "/landlord/properties",
    label: "My Properties",
    icon: "▢",
  },
  { href: "/landlord/messages", label: "Messages", icon: "✉" },
  { href: "/landlord/settings", label: "Settings", icon: "⚙" },
];

const MOBILE_ITEMS: NavItem[] = [
  { href: "/landlord", label: "Dashboard", icon: "◎" },
  {
    href: "/landlord/properties/new",
    label: "Create",
    icon: "+",
  },
  {
    href: "/landlord/properties",
    label: "Properties",
    icon: "▢",
  },
  { href: "/landlord/messages", label: "Messages", icon: "✉" },
  { href: "/landlord/settings", label: "Settings", icon: "⚙" },
];

function isActivePath(pathname: string, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === "/landlord") {
    return pathname === "/landlord";
  }

  if (href === "/landlord/properties") {
    return (
      pathname === "/landlord/properties" ||
      pathname.startsWith("/landlord/properties/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function LandlordLayout({
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

          <div className="kv-sidebar-eyebrow">Landlord</div>
          <div className="kv-sidebar-title">
            Keyvera Platform
          </div>
        </div>

        <nav
          className="kv-sidebar-nav"
          aria-label="Landlord navigation"
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
            ← Exit
          </Link>

          <div className="px-2 pt-1 text-[11px] leading-relaxed text-[var(--kv-muted)]">
            Manage listings, agents, and inspection activity.
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
        aria-label="Landlord mobile navigation"
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