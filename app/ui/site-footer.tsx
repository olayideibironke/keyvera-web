"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DASHBOARD_PREFIXES = [
  "/admin",
  "/landlord",
  "/agent",
  "/tenant",
  "/dashboard",
];

export default function SiteFooter() {
  const pathname = usePathname() || "/";

  const isDashboard = DASHBOARD_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isDashboard) {
    return (
      <footer className="w-full border-t border-[var(--kv-border)] bg-white">
        <div className="kv-responsive-shell flex flex-col items-center justify-center gap-2 py-5 text-center">
          <span className="text-[12px] text-[var(--kv-muted)]">
            © {new Date().getFullYear()} Keyvera
          </span>

          <a
            href="https://westforgeholdings.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[var(--kv-muted)] transition-colors hover:text-[var(--kv-teal)]"
          >
            A product of Westforge Holdings Inc.
          </a>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full border-t border-[var(--kv-border)] bg-white">
      <div className="kv-responsive-shell grid items-center gap-6 py-7 text-center md:grid-cols-3 md:text-left">
        <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row md:justify-start">
          <Image
            src="/keyvera-header.png"
            alt="Keyvera"
            width={140}
            height={40}
            className="h-8 w-auto"
          />

          <span className="text-[13px] text-[var(--kv-muted)]">
            © {new Date().getFullYear()} Keyvera
          </span>
        </div>

        <div className="flex items-center justify-center">
          <a
            href="https://westforgeholdings.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-[var(--kv-muted)] transition-colors hover:text-[var(--kv-teal)]"
          >
            A product of Westforge Holdings Inc.
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] text-[var(--kv-muted)] md:justify-end">
          <Link
            href="/privacy"
            className="transition-colors hover:text-[var(--kv-teal)]"
          >
            Privacy
          </Link>

          <Link
            href="#"
            className="transition-colors hover:text-[var(--kv-teal)]"
          >
            Terms
          </Link>

          <Link
            href="#"
            className="transition-colors hover:text-[var(--kv-teal)]"
          >
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}