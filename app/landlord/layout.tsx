// app/landlord/layout.tsx
import Link from "next/link";

export default function LandlordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-black/10 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] shadow-[0_10px_22px_rgba(10,79,99,0.22)]" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-[#0b1f2a]">Landlord</div>
                <div className="text-xs text-black/60">Keyvera Platform</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/landlord"
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
              >
                Dashboard
              </Link>
              <Link
                href="/landlord/properties/new"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
              >
                + Create Property
              </Link>
              <Link
                href="/"
                className="hidden md:inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
              >
                Exit
              </Link>
            </div>
          </div>

          {/* Quick links (mobile) */}
          <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
            <MobileNavLink href="/landlord" label="Dashboard" />
            <MobileNavLink href="/landlord/properties/new" label="Create" />
            <MobileNavLink href="/landlord/messages" label="Messages" />
            <MobileNavLink href="/landlord/settings" label="Settings" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">{children}</div>
    </div>
  );
}

function MobileNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[#0b1f2a] transition hover:bg-white hover:shadow-[0_10px_24px_rgba(11,31,42,0.10)]"
    >
      {label}
    </Link>
  );
}