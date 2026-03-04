// app/page.tsx
import Link from "next/link";
import RoleRedirectGate from "@/app/ui/role-redirect-gate";

const BRAND_TEAL = "#0ea5a3";
const BRAND_TEAL_DARK = "#0a4f63";
const BRAND_NAVY = "#0b1f2a";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_TEAL, opacity: 0.75 }} />
      {children}
    </span>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})`,
        boxShadow: "0 12px 28px rgba(14,165,163,0.18)",
      }}
    >
      {children}
      <span className="ml-3 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.85)" }} />
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function RoleButton({
  href,
  label,
  desc,
  accent = "teal",
}: {
  href: string;
  label: string;
  desc: string;
  accent?: "teal" | "navy";
}) {
  const dot = accent === "navy" ? BRAND_NAVY : BRAND_TEAL;
  const ring =
    accent === "navy"
      ? "focus-visible:ring-[rgba(11,31,42,0.18)]"
      : "focus-visible:ring-[rgba(14,165,163,0.18)]";

  return (
    <Link
      href={href}
      className={`group flex items-start justify-between gap-4 rounded-2xl border border-black/10 bg-white/70 px-5 py-4 shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${ring}`}
    >
      <div>
        <div className="text-sm font-bold text-slate-950">{label}</div>
        <div className="mt-1 text-xs text-slate-600">{desc}</div>
      </div>
      <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: dot, opacity: 0.65 }} />
    </Link>
  );
}

function FeatureCard({
  title,
  subtitle,
  bullets,
  accent,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  accent?: "teal" | "navy";
}) {
  const grad =
    accent === "navy"
      ? `linear-gradient(135deg, rgba(11,31,42,0.12), rgba(11,31,42,0.03), rgba(255,255,255,0))`
      : `linear-gradient(135deg, rgba(14,165,163,0.14), rgba(14,165,163,0.04), rgba(255,255,255,0))`;

  const dot = accent === "navy" ? BRAND_NAVY : BRAND_TEAL;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-black/10 bg-white p-7 shadow-sm">
      <div className="pointer-events-none absolute inset-0" style={{ background: grad }} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-950">{title}</div>
            <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot, opacity: 0.65 }} />
            Verified
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {bullets.map((b) => (
            <div key={b} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="mt-1 h-2 w-2 flex-none rounded-full" style={{ backgroundColor: dot, opacity: 0.6 }} />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* If already logged in, route to the correct portal automatically */}
      <RoleRedirectGate />

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-white shadow-sm">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 380px at 18% 10%, rgba(14,165,163,0.18), rgba(255,255,255,0) 60%), radial-gradient(700px 320px at 85% 0%, rgba(11,31,42,0.10), rgba(255,255,255,0) 55%)",
          }}
        />

        <div className="relative grid gap-8 p-8 md:grid-cols-12 md:p-10">
          <div className="md:col-span-7">
            <Pill>Verified rental marketplace</Pill>

            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-950 md:text-5xl">
              Rent with confidence, verified listings, clear fees, and accountable inspections.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700">
              Keyvera reduces scams by verifying roles and enforcing inspection rules, so tenants see real listings and
              landlords stay in control.
            </p>

            {/* Primary CTAs */}
            <div className="mt-7 flex flex-wrap gap-3">
              <PrimaryButton href="/login">Get Started</PrimaryButton>
              <SecondaryButton href="/tenant">Explore as Tenant</SecondaryButton>
            </div>

            {/* Quick role access (premium, not cluttered) */}
            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-600">Quick access</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <RoleButton
                  href="/tenant"
                  label="Tenant"
                  desc="Browse verified listings and request inspections."
                  accent="teal"
                />
                <RoleButton
                  href="/landlord"
                  label="Landlord"
                  desc="List properties and manage inspection lifecycle."
                  accent="navy"
                />
                <RoleButton href="/agent" label="Agent" desc="Get verified and schedule inspections." accent="teal" />
                <RoleButton href="/admin" label="Admin" desc="Verify users, approve properties, view metrics." accent="navy" />
              </div>
            </div>

            {/* Trust chips */}
            <div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_TEAL, opacity: 0.7 }} />
                Identity checks
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_NAVY, opacity: 0.55 }} />
                Admin oversight
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_TEAL_DARK, opacity: 0.6 }} />
                Transparent fees
              </div>
            </div>
          </div>

          {/* Right “stats” panel */}
          <div className="md:col-span-5">
            <div className="grid gap-3 rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold" style={{ color: BRAND_NAVY, opacity: 0.9 }}>
                Marketplace controls
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-600">Verification</div>
                  <div className="mt-2 text-lg font-extrabold text-slate-950">Role-based</div>
                  <div className="mt-1 text-xs text-slate-600">Tenant, Agent, Landlord, Admin</div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-600">Inspections</div>
                  <div className="mt-2 text-lg font-extrabold text-slate-950">Fee-gated</div>
                  <div className="mt-1 text-xs text-slate-600">Validated before tenant access</div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-600">Disputes</div>
                  <div className="mt-2 text-lg font-extrabold text-slate-950">Traceable</div>
                  <div className="mt-1 text-xs text-slate-600">Clear audit trail</div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-600">Trust</div>
                  <div className="mt-2 text-lg font-extrabold text-slate-950">Verified</div>
                  <div className="mt-1 text-xs text-slate-600">Higher quality leads</div>
                </div>
              </div>

              <div className="mt-1 rounded-2xl border border-black/10 bg-white p-4 text-xs text-slate-700 shadow-sm">
                <span className="font-semibold" style={{ color: BRAND_NAVY }}>
                  Keyvera
                </span>{" "}
                is built to make rentals feel safe and professional, without noise.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROLE CARDS */}
      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          title="Agents"
          subtitle="Verification-first access to listings."
          bullets={[
            "Mandatory identity verification before listing or applying.",
            "Clear inspection fee rules tied to property status.",
            "Reduced fraud through admin enforcement.",
          ]}
          accent="teal"
        />

        <FeatureCard
          title="Landlords"
          subtitle="Control, visibility, and approvals."
          bullets={[
            "Approve agents and track property inspection activity.",
            "Keep listings clean with verified profiles only.",
            "See fee and status signals before engagement.",
          ]}
          accent="navy"
        />

        <FeatureCard
          title="Tenants"
          subtitle="More trust, less confusion."
          bullets={[
            "Transparent inspection fees and verified listings.",
            "Clear status signals before wasting time.",
            "Fewer scams through identity-first onboarding.",
          ]}
          accent="teal"
        />
      </section>

      {/* PREMIUM CTA */}
      <section className="rounded-[28px] border border-black/10 bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-950">Start with verified listings.</div>
            <div className="mt-1 text-sm text-slate-600">Browse as a tenant, or log in to access your role-based portal.</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton href="/login">Get Started</PrimaryButton>
            <SecondaryButton href="/tenant">Explore Listings</SecondaryButton>
          </div>
        </div>
      </section>
    </div>
  );
}