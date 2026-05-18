"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DASHBOARD_PREFIXES = ["/admin", "/landlord", "/agent", "/tenant", "/dashboard"];

export default function SiteFooter() {
  const pathname = usePathname() || "/";
  const isDashboard = DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isDashboard) {
    return (
      <footer
        className="border-t border-[var(--kv-border)] bg-white py-5 text-center text-[12px] text-[var(--kv-muted)]"
        style={{ marginLeft: 0 }}
      >
        © {new Date().getFullYear()} Keyvera
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--kv-border)] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-7 md:flex-row md:justify-between">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-7 text-[13px] text-[var(--kv-muted)]">
          <Link href="#" className="transition-colors hover:text-[var(--kv-teal)]">
            Privacy
          </Link>
          <Link href="#" className="transition-colors hover:text-[var(--kv-teal)]">
            Terms
          </Link>
          <Link href="#" className="transition-colors hover:text-[var(--kv-teal)]">
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
